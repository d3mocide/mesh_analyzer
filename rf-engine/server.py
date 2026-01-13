from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import rf_worker
import io
from starlette.responses import Response
from PIL import Image
import numpy as np
import mercantile
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MeshRF Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for dev, or specify ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    lat: float
    lon: float
    frequency_mhz: float
    height_meters: float

# --- Dependencies ---
from celery_config import celery_app
from rf_worker import run_analysis, optimize_location_task
import redis
from tile_manager import TileManager
import rf_physics
from rf_physics import analyze_link
from network_planner import NetworkPlanner

# --- Initialization ---
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL)
tile_manager = TileManager(redis_client)

# Initialize Physics & Planner
physics_engine = rf_physics 
planner = NetworkPlanner(physics_engine, tile_manager)

@app.post("/analyze-coverage")
async def analyze_coverage(req: AnalysisRequest):
    # Phase 3: Should also be queued, but kept sync for Phase 1/2 compat unless updated.
    # Let's keep sync for now as per prompt "return job_id" was for Task 2 Queue System.
    # The prompt says: "When the frontend requests a Heatmap, push the job to the queue immediately and return a job_id."
    
    # So we should convert this to async too?
    # For now, let's just queue optimize-location as requested in "Task 1: The Sieve Algorithm".
    # Wait, Task 2 says "When the frontend requests a Heatmap...".
    # I should queue both.
    
    task = celery_app.send_task('rf.analyze', args=[req.lat, req.lon, req.frequency_mhz, req.height_meters])
    return {"job_id": task.id, "status": "queued"}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    from celery.result import AsyncResult
    res = AsyncResult(job_id, app=celery_app)
    if res.ready():
        return {"status": "finished", "result": res.result}
    return {"status": res.status}

class OptimizeRequest(BaseModel):
    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float
    frequency_mhz: float
    height_meters: float


class OptimizeNetworkRequest(BaseModel):
    candidates: list[dict] # {lat, lon, height, weight, type}
    polygon: dict # GeoJSON dict
    frequency_mhz: float

@app.post("/optimize-network")
def optimize_network_endpoint(req: OptimizeNetworkRequest):
    """
    Synchronous network planning task (Prototype).
    """
    # 1. Sample Points
    print("Sampling target points...")
    targets = planner.sample_target_points(req.polygon, spacing_meters=200) # Coarse grid for speed
    print(f"Sampled {len(targets)} targets.")
    
    # 2. Build Graph
    print("Building coverage graph...")
    G = planner.build_coverage_graph(req.candidates, targets, req.frequency_mhz)
    print(f"Graph built with {G.number_of_edges()} edges.")
    
    # 3. Optimize
    print("Running optimization...")
    selected, coverage_pct = planner.optimize_sites(G)
    print("Optimization complete.")
    
    return {
        "status": "success",
        "selected_sites": selected,
        "coverage_percent": coverage_pct,
        "total_targets": len(targets)
    }

@app.post("/optimize-location")
async def optimize_location(req: OptimizeRequest):
    task = celery_app.send_task('rf.optimize', args=[
        req.min_lat, req.min_lon, req.max_lat, req.max_lon,
        req.frequency_mhz, req.height_meters
    ])
    return {"job_id": task.id, "status": "queued"}

class LinkRequest(BaseModel):
    tx_lat: float
    tx_lon: float
    rx_lat: float
    rx_lon: float
    frequency_mhz: float
    tx_height: float
    rx_height: float


@app.post("/calculate-link")
def calculate_link_endpoint(req: LinkRequest):
    """
    Synchronous endpoint for real-time link analysis.
    Uses cached TileManager.
    """
    result = analyze_link(
        tile_manager,
        req.tx_lat, req.tx_lon,
        req.rx_lat, req.rx_lon,
        req.frequency_mhz,
        req.tx_height, req.rx_height
    )
    return result

class ElevationRequest(BaseModel):
    lat: float
    lon: float

@app.post("/get-elevation")
def get_elevation_endpoint(req: ElevationRequest):
    """
    Get elevation for a single point.
    """
    elevation = tile_manager.get_elevation(req.lat, req.lon)
    return {"elevation": elevation}


@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/tiles/{z}/{x}/{y}.png")
def get_elevation_tile(z: int, x: int, y: int):
    """
    Serve elevation data as Terrain-RGB tiles.
    Format: height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
    """
    grid = tile_manager.get_interpolated_grid(x, y, z, size=256)
    
    # Encode to Terrain-RGB format
    # h = -10000 + (v * 0.1) => v = (h + 10000) * 10
    h_scaled = (grid + 10000) * 10
    h_scaled = np.clip(h_scaled, 0, 16777215) # Clip to 24-bit max
    h_scaled = h_scaled.astype(np.uint32)
    
    r = (h_scaled >> 16) & 0xFF
    g = (h_scaled >> 8) & 0xFF
    b = h_scaled & 0xFF
    
    rgb = np.stack((r, g, b), axis=-1).astype(np.uint8)
    
    img = Image.fromarray(rgb, mode='RGB')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    
    return Response(content=buf.getvalue(), media_type="image/png")

