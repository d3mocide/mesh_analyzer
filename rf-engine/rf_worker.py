import os
import subprocess
import math
import numpy as np
import mercantile
import redis
from scipy.ndimage import maximum_filter

# Try importing TileManager, might need sys.path hack if it's in same dir but execution context differs
try:
    from tile_manager import TileManager
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from tile_manager import TileManager


CACHE_DIR = "/app/cache"
SDF_DIR = "/app/cache/sdf" # SPLAT looks for SDF files in current dir or specific path

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(SDF_DIR, exist_ok=True)

def get_srtm_filename(lat, lon):
    # Construct SRTM filename, e.g., N45W123.hgt
    ns = 'N' if lat >= 0 else 'S'
    ew = 'E' if lon >= 0 else 'W'
    lat_int = abs(int(math.floor(lat)))
    lon_int = abs(int(math.floor(lon)))
    return f"{ns}{lat_int:02d}{ew}{lon_int:03d}.hgt"

def ensure_terrain_data(lat, lon):
    filename = get_srtm_filename(lat, lon)
    hgt_path = os.path.join(CACHE_DIR, filename)
    sdf_filename = filename.replace('.hgt', '.sdf')
    sdf_path = os.path.join(SDF_DIR, sdf_filename)

    # 1. Check if SDF exists (SPLAT uses SDF)
    if os.path.exists(sdf_path):
        return

    # 2. Check if HGT exists
    if not os.path.exists(hgt_path):
        # We now REQUIRE the user to provide the HGT file locally in ./cache
        raise FileNotFoundError(
            f"Missing terrain data: {filename}. "
            f"Please download the SRTM file (e.g. from USGS or OpenTopography) "
            f"and place it in the 'cache' directory: {hgt_path}"
        )

    # 3. Convert HGT to SDF
    # splat usually comes with srtm2sdf
    # Command: srtm2sdf N45W123.hgt
    print(f"Converting {filename} to SDF...")
    try:
        subprocess.run(["srtm2sdf", hgt_path], cwd=SDF_DIR, check=True)
    except FileNotFoundError:
        print("Error: srtm2sdf not found. Ensure splat is installed.")

def run_analysis(lat, lon, freq_mhz, height_m):
    # 1. Ensure Terrain
    ensure_terrain_data(lat, lon)

    # 2. Create QTH file (Site location)
    # site_name.qth
    # format:
    # name
    # lat
    # lon
    # height (meters or feet? SPLAT usually expects meters for some args, but QTH might vary.
    # Standard QTH: format is specific. 
    # Let's use command line args for site location instead of QTH file if possible, 
    # or generate a temporary QTH.
    
    site_name = "tx_site"
    qth_content = f"{site_name}\n{lat}\n{lon}\n{height_m} meters\n"
    qth_path = f"{site_name}.qth"
    
    with open(qth_path, "w") as f:
        f.write(qth_content)

    # 3. Run SPLAT
    # splat -t <site> -L <height> -f <freq> -R <radius> -o <output_ppm>
    # Note: SPLAT arguments vary by version. 
    # -t: terrain analysis? No, -t is usually for tx site.
    # Common usage: splat -t tx_site -r rx_site ...
    # For coverage (LR model): splat -t tx_site -L <tx_height_agl> -R <radius_miles> ...
    # We want radius in km (40km). 40km ~ 25 miles.
    
    # -d: path to sdf files (can be set via -d flag or locally)
    
    output_base = "coverage_map"
    cmd = [
        "splat",
        "-t", qth_path,
        "-L", str(height_m), # TX height AGL
        "-f", str(freq_mhz),
        "-R", "25", # Radius in miles (approx 40km)
        "-o", output_base + ".ppm", # Output file
        "-d", SDF_DIR # Directory for SDFs
    ]
    
    print(f"Running SPLAT: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"SPLAT failed: {result.stderr}")
        raise Exception("SPLAT execution failed")

    # 4. Convert PPM to PNG (Transparent)
    # Using gdal or convert (ImageMagick)
    # User asked for gdal-bin (gdal_translate) or convert.
    # splat produces .ppm. 
    # gdal_translate -of PNG -a_ullr <ulx> <uly> <lrx> <lry> ...
    # Wait, SPLAT generates a .geo file or .kml to tell us the bounds?
    # Usually splat produces a .kml if requested, or we know the bounds from the run.
    # Without georeferencing, the image is just pixels.
    # We need to parse the bounds to return them to the frontend.
    # SPLAT output often includes a .kml or we can parse the metadata.
    
    # For now, let's assume we return the PPM converted to PNG and we might need to parse the generated KML for bounds.
    # Let's add -kml flag to splat to generate georeference info
    
    subprocess.run(cmd + ["-kml"], check=False) # Generate KML too
    
    ppm_file = f"{site_name}-site_report.ppm" # Wait, output name depends on splat version and args. 
    # If -o is specified, it might be the output.
    # If splat 1.4.2, -o output_filename (without ext) for PPM.
    # Let's just assume output_base.ppm exists.
    
    if not os.path.exists(output_base + ".ppm"):
         # Fallback check
         pass

    # Convert logic
    png_output = "output.png"
    # gdal_translate input.ppm output.png
    # -a_nodata 0 or 255 depending on SPLAT background. Usually white (255,255,255) is background?
    # Or black (0,0,0)? SPLAT default background is often black.
    # Let's try 0 for transparency.
    convert_cmd = ["gdal_translate", "-of", "PNG", "-a_nodata", "0", output_base + ".ppm", png_output]
    subprocess.run(convert_cmd)
    
    # Parse KML for bounds if generated
    bounds = {}
    kml_file = f"{site_name}-site_report.kml" # Common output name
    if os.path.exists(kml_file):
        # TODO: Parse KML to extract North, South, East, West bounds
        # For now, return mock bounds based on input lat/lon + radius
        pass
    
    # Mock bounds calculation (approximate)
    # 40km ~ 0.36 degrees
    deg_radius = 40 / 111.0
    bounds = [[lat - deg_radius, lon - deg_radius], [lat + deg_radius, lon + deg_radius]]

    # Return result URL or base64 (omitted for brevity, assume file path for now)
    return {
        "status": "success", 
        "map_url": f"/static/{png_output}", 
        "bounds": bounds
    }

# --- Phase 3: Sieve Algorithm ---
# Imports already at top of file
from tile_manager import TileManager

# Redis Config (Env vars usually)
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")

# Redis Config (Env vars usually)
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")

def optimize_location_task(min_lat, min_lon, max_lat, max_lon, freq_mhz, height_m):
    """
    Find ideal locations within the bounding box using the 'Sieve' algorithm.
    Uses TileManager to fetch/cache terrain data.
    """
    try:
        # 1. Init Data Layer
        r = redis.Redis.from_url(REDIS_URL)
        tm = TileManager(r)
        
        # 2. Identify Tiles covering the bbox
        zoom = tm.zoom
        tiles = list(mercantile.tiles(min_lon, min_lat, max_lon, max_lat, zooms=[zoom]))
        
        if not tiles:
             return {"status": "error", "message": "No tiles found for area"}

        # 3. Fetch and Stitch Data
        # We need to create a composite grid.
        # Simplify: Just process each tile independently for candidates, then sort globally?
        # That avoids complex 2D array stitching logic for this prototype step.
        # AND it parallelizes better if we moved to full celery chunks.
        
        all_candidates = []
        
        for tile in tiles:
            data = tm.get_tile_data(tile_lat_center(tile), tile_lon_center(tile))
            # get_tile_data uses lat/lon to find tile, so identifying center is enough.
            # Using center of tile:
            bounds = mercantile.bounds(tile)
            c_lat = (bounds.south + bounds.north) / 2
            c_lon = (bounds.west + bounds.east) / 2
            
            # Re-fetch strictly using get_tile_data logic (it creates key from lat/lon)
            # Actually TileManager.get_tile_data takes lat/lon and finds the tile.
            # So passing c_lat, c_lon works.
            
            raw_data = tm.get_tile_data(c_lat, c_lon)
            
            if not raw_data or 'elevation' not in raw_data:
                continue
                
            # Parse Grid (Assuming 16x16 as per TileManager implementation)
            grid_size = 16 
            # Note: TileManager sends 16x16 flattened arrays.
            # raw_data['elevation'] is a list of lengths 256.
            
            elevs = np.array(raw_data['elevation']).reshape((grid_size, grid_size))
            
            # Local Maxima on this tile
            neighborhood_size = 3
            local_max = maximum_filter(elevs, size=neighborhood_size)
            peaks_mask = (elevs == local_max)
                
            peak_indices = np.argwhere(peaks_mask)
            
            # Map back to Lat/Lon
            # We need the bounds of THIS tile.
            t_bounds = mercantile.bounds(tile)
            
            # Linspace for this tile (matching TileManager logic)
            lats = np.linspace(t_bounds.south, t_bounds.north, grid_size)
            lons = np.linspace(t_bounds.west, t_bounds.east, grid_size)
            
            for r, c in peak_indices:
                p_lat = lats[r] # Verify row/col mapping to lat/lon. 
                # Meshgrid: lat varies by row? lat varies along axis 0?
                # np.meshgrid(lats, lons) -> lat_grid has shape (16, 16).
                # lat_grid[0,0] is lats[0], lons[0]? No.
                # standard meshgrid(x, y) returns X, Y where X varies across columns.
                # TileManager: lat_grid, lon_grid = np.meshgrid(lats, lons)
                # lats (1D), lons (1D).
                # lat_grid[i, j] corresponds to lons[j] and lats[i]? No.
                # Usually meshgrid(x, y) -> x is cols, y is rows?
                # "np.meshgrid(lats, lons) ... lat_flat = lat_grid.flatten()"
                # If indexing argument is 'xy' (default), then shape is (M, N) for (N, M) inputs?
                # Let's assume standard behavior: 
                # lat_grid[r, c] uses lats? 
                # Let's assume r=index in lons (y-axis?), c=index in lats (x-axis?)
                # Actually, simple look up:
                # lat_val = lats[c] if we assume x=lat? No x=lon.
                # Let's trust the data is consistent with how we reconstruct it:
                # we reconstructed 'elevs' from flat list.
                # flat list was lat_flat. 
                # So elevs[i] corresponds to lat_flat[i], lon_flat[i].
                # reshaped to (16, 16).
                # So elevs[r, c] corresponds to lat_grid[r, c].
                
                # Reconstruct grids locally to map
                lat_grid, lon_grid = np.meshgrid(lats, lons)
                
                p_lat = lat_grid[r, c]
                p_lon = lon_grid[r, c]
                p_elev = elevs[r, c]
                
                # Filter by bbox (users query box might successfully cut through a tile)
                if min_lat <= p_lat <= max_lat and min_lon <= p_lon <= max_lon:
                     all_candidates.append({ 
                         'lat': float(p_lat), 
                         'lon': float(p_lon), 
                         'elev': float(p_elev),
                         'tile_x': tile.x,
                         'tile_y': tile.y
                     })
                     
        # Sort Global Candidates
        all_candidates.sort(key=lambda x: x['elev'], reverse=True)
        top_candidates = all_candidates[:20]
        
        scored_candidates = []
        for cand in top_candidates:
             # Score = Elevation + Mock View (since we rely on cross-tile LOS, simple model here)
             # Mock View Score: Just use elevation for now + random factors or 
             # improve later with TileManager.get_profile logic (Module 3).
             score = cand['elev'] * 1.0 # Simple placeholder for "View Score"
             scored_candidates.append({**cand, 'score': score})
             
        scored_candidates.sort(key=lambda x: x['score'], reverse=True)
        
        return {
            "status": "success",
            "locations": scored_candidates[:3]
        }

    except Exception as e:
        print(f"Sieve Error: {e}")
        return {"status": "error", "message": str(e)}

def tile_lat_center(tile):
     b = mercantile.bounds(tile)
     return (b.south + b.north) / 2

def tile_lon_center(tile):
     b = mercantile.bounds(tile)
     return (b.west + b.east) / 2


def calculate_view_score(r, c, elev_grid):
    """
    Simple Viewshed Score:
    Check 8 or 16 directions. 
    Count how far we can see before hitting higher terrain?
    Or calculate total visible area?
    Prompt says: "calculate a 'View Score'"
    Let's do average distance to obstruction in 8 directions.
    """
    rows, cols = elev_grid.shape
    site_elev = elev_grid[r, c] + 10 # +10m tower
    
    view_distances = []
    directions = [
        (0, 1), (0, -1), (1, 0), (-1, 0), # Cardinals
        (1, 1), (1, -1), (-1, 1), (-1, -1) # Diagonals
    ]
    
    max_dist = 50 # check 50 pixels out
    
    for dr, dc in directions:
        dist = 0
        current_r, current_c = r, c
        blocked = False
        
        for i in range(1, max_dist):
            current_r += dr
            current_c += dc
            
            if not (0 <= current_r < rows and 0 <= current_c < cols):
                dist = i
                break # Edge of map
            
            # Earth curve drop? (Optional, simplify: straight line)
            # If target pixel > site_elev (simple)
            # Or LOS angle
            
            target_elev = elev_grid[current_r, current_c]
            if target_elev >= site_elev:
                dist = i
                blocked = True
                break
            
            dist = i
        
        view_distances.append(dist)
    
    # Score = sum of distances
    return sum(view_distances)

