import networkx as nx
from shapely.geometry import shape, Point, box
import numpy as np
import logging

logger = logging.getLogger(__name__)

class NetworkPlanner:
    def __init__(self, physics_engine, tile_manager):
        self.physics = physics_engine
        self.tile_manager = tile_manager

    def sample_target_points(self, polygon_geojson, spacing_meters=100):
        """
        Generates a grid of sample points within the target polygon.
        """
        poly = shape(polygon_geojson)
        minx, miny, maxx, maxy = poly.bounds
        
        # Simple grid sampling
        # Degree approx: 1 deg ~ 111km -> 100m ~ 0.0009 deg
        step = spacing_meters / 111000.0
        
        points = []
        for x in np.arange(minx, maxx, step):
            for y in np.arange(miny, maxy, step):
                p = Point(x, y)
                if poly.contains(p):
                    # Get elevation for the point
                    elev = self.tile_manager.get_elevation(y, x)
                    points.append({
                        "id": f"tgt_{len(points)}",
                        "lat": y,
                        "lon": x,
                        "elev": elev
                    })
        return points

    def build_coverage_graph(self, candidates, targets, freq_mhz, rx_height=2.0):
        """
        Builds a bipartite-like graph where edges connect Candidates to Targets
        if a viable RF link exists.
        """
        G = nx.Graph()
        
        # Add Nodes
        for i, c in enumerate(candidates):
            c_id = f"cand_{i}"
            G.add_node(c_id, type="candidate", data=c, weight=c.get('weight', 1))
            
        for t in targets:
            G.add_node(t['id'], type="target", data=t)
            
        # Add Edges (Run Physics)
        # Optimization: This is O(M*N). For large sets, parallelize or basic filter first.
        for i, c in enumerate(candidates):
            c_id = f"cand_{i}"
            tx_h = c.get('height', 10)
            
            for t in targets:
                # Check RF
                # analyze_link(tile_manager, lat1, lon1, lat2, lon2, freq_mhz, tx_h, rx_h)
                result = self.physics.analyze_link(
                    self.tile_manager,
                    c['lat'], c['lon'],
                    t['lat'], t['lon'],
                    freq_mhz,
                    tx_h,
                    rx_height
                )
                
                if result['status'] == 'viable' or result['status'] == 'degraded':
                    # Edge exists
                    G.add_edge(c_id, t['id'])
                    
        return G

    def optimize_sites(self, G):
        """
        Selects minimal set of candidates to cover maximum targets.
        Greedy Set Cover approximation.
        """
        # Targets that need covering
        universe = set(n for n, d in G.nodes(data=True) if d.get('type') == 'target')
        covered = set()
        selected_candidates = []
        
        # Candidates available
        candidates = [n for n, d in G.nodes(data=True) if d.get('type') == 'candidate']
        
        while len(covered) < len(universe):
            # Find candidate that covers the most *uncovered* targets
            # weighted by candidate cost? Prompt says "lowest total weight".
            # Metric: Cost / NewPointsCovered. Pick lowest.
            
            best_cand = None
            best_ratio = float('inf')
            best_new_cover = set()
            
            made_progress = False
            
            for cand in candidates:
                if cand in selected_candidates:
                    continue
                    
                neighbors = set(G.neighbors(cand))
                # Intersect with UNIVERSE (targets) just in case
                neighbors = neighbors.intersection(universe)
                
                new_cover = neighbors - covered
                count = len(new_cover)
                
                if count > 0:
                    weight = G.nodes[cand]['weight']
                    ratio = weight / count
                    
                    if ratio < best_ratio:
                        best_ratio = ratio
                        best_cand = cand
                        best_new_cover = new_cover
                        made_progress = True
            
            if not made_progress:
                break # Cannot cover any more
                
            selected_candidates.append(best_cand)
            covered.update(best_new_cover)
            
        return [G.nodes[n]['data'] for n in selected_candidates], len(covered) / len(universe) if universe else 0
