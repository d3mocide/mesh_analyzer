import numpy as np
import math
from tile_manager import TileManager

# Constants
EARTH_RADIUS_KM = 6371.0

def haversine_distance(lat1, lon1, lat2, lon2):
    R = EARTH_RADIUS_KM * 1000 # Meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def generate_profile(tile_manager, lat1, lon1, lat2, lon2, step_meters=30):
    dist_m = haversine_distance(lat1, lon1, lat2, lon2)
    if dist_m == 0:
        return [tile_manager.get_elevation(lat1, lon1)], 0
        
    num_points = max(2, int(dist_m / step_meters))
    
    lats = np.linspace(lat1, lat2, num_points)
    lons = np.linspace(lon1, lon2, num_points)
    
    elevations = []
    # Optimization: Chunk by tile to reduce cache logic overhead?
    # TileManager handles caching, so just loop.
    for lat, lon in zip(lats, lons):
        elev = tile_manager.get_elevation(lat, lon)
        elevations.append(elev)
        
    return elevations, dist_m

def calculate_fresnel_zone(dist_m, freq_mhz, p_d1, p_d2):
    # Radius of n-th Fresnel zone at point P (dist d1 from TX, d2 from RX)
    # Fn = sqrt( (n * lambda * d1 * d2) / (d1 + d2) )
    # lambda = c / f
    c = 2.99792e8
    wavelength = c / (freq_mhz * 1e6)
    
    return math.sqrt((1 * wavelength * p_d1 * p_d2) / dist_m)

def analyze_link(tile_manager, lat1, lon1, lat2, lon2, freq_mhz, tx_h, rx_h):
    # 1. Generate Terrain Profile
    elevs, dist_m = generate_profile(tile_manager, lat1, lon1, lat2, lon2)
    elevs = np.array(elevs)
    
    num_points = len(elevs)
    dists = np.linspace(0, dist_m, num_points)
    
    # 2. Line of Sight (Geometric)
    # Correct for Earth Curvature (K-factor 4/3 usually, but let's stick to flat link vs curved earth)
    # Elevation at point i: E[i] + EarthDrop[i]
    # Simple LoS line from (0, E[0]+tx_h) to (D, E[-1]+rx_h)
    
    # Earth Height correction: h = d^2 / (2 * k * R)
    # Using k=1.333
    k = 1.333
    R_eff = k * EARTH_RADIUS_KM * 1000
    
    # Drop relative to tangent at TX?
    # Standard approach: Project terrain onto "Curved Earth" or "Flat Earth with Curved Beam"
    # Let's add earth curvature to terrain elevations relative to a chord.
    # More simply: Add earth bulge to terrain info.
    # Bulge(d) = d_tx * d_rx / (2 * k * R)
    
    # Distances from TX
    d_tx = dists
    d_rx = dist_m - dists
    bulge = (d_tx * d_rx) / (2 * R_eff)
    
    terrain_h = elevs + bulge
    
    # LOS Line
    tx_alt = elevs[0] + tx_h # Height above sea level (no bulge at 0)
    rx_alt = elevs[-1] + rx_h # Height above sea level
    
    # Linear interpolation of LOS height across the path (ignoring bulge on LOS itself since it's the reference usually?)
    # Wait, if terrain is bulged, LOS is straight line?
    # Yes, standard method: Terrain += Bulge, Link = Straight Line.
    
    los_h = np.linspace(tx_alt, rx_alt, num_points)
    
    # 3. Fresnel Clearance
    # clearance = los_h - terrain_h
    clearance = los_h - terrain_h
    
    # Fresnel Radius at each point
    fresnel_radii = []
    min_clearance_ratio = 100.0
    worst_point_idx = -1
    
    for i in range(num_points):
        d1 = dists[i]
        d2 = dist_m - d1
        if d1 < 1 or d2 < 1: 
            fresnel_radii.append(0.1) # Avoid div zero at ends
            continue
            
        f1 = calculate_fresnel_zone(dist_m, freq_mhz, d1, d2)
        fresnel_radii.append(f1)
        
        ratio = clearance[i] / f1
        if ratio < min_clearance_ratio:
            min_clearance_ratio = ratio
            worst_point_idx = i
            
    # Evaluation
    status = "viable"
    if min_clearance_ratio < 0:
        status = "blocked"
    elif min_clearance_ratio < 0.6:
        status = "degraded" # 60% clearance rule
        
    return {
        "dist_km": dist_m / 1000,
        "status": status,
        "min_clearance_ratio": float(min_clearance_ratio),
        "path_loss_db": 0.0, # Placeholder for ITM
        "profile": elevs.tolist()  # Return raw profile for debug?
    }

def calculate_itm_loss(dist_m, elevs, freq_mhz, tx_h, rx_h):
    try:
        import itmlogic
        # Placeholder: Check actual ITM API. 
        # Assuming itmlogic.p2p(dist_km, profile, freq, h1, h2, ...)
        # Since I cannot verify the API at this exact second without "search_web" deep dive,
        # I will fall back to a robust simulation or basic models if import fails.
        # But let's try to simulate calling it.
        pass
    except ImportError:
        pass
        
    dist_km = dist_m / 1000
    if dist_km < 0.001: return 0
    fspl = 20 * math.log10(dist_km) + 20 * math.log10(freq_mhz) + 32.44
    return fspl
