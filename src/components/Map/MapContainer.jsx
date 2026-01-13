import React, { useState } from 'react';
import { MapContainer, TileLayer, ImageOverlay, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import LinkLayer from './LinkLayer';
import LinkAnalysisPanel from './LinkAnalysisPanel';
import OptimizationLayer from './OptimizationLayer';
import { useRF } from '../../context/RFContext';
import { calculateLinkBudget } from '../../utils/rfMath';
import * as turf from '@turf/turf';
import DeckGLOverlay from './DeckGLOverlay';
import { ViewshedLayer } from './ViewshedLayer';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';

// Fix for default marker icon issues in React Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

import { useMapEvents } from 'react-leaflet';

const ViewshedClickHandler = ({ active, setObserver }) => {
    useMapEvents({
        click(e) {
            if (active) {
                // Fetch elevation for this point
                const { lat, lng } = e.latlng;
                
                // Optimistic update first (with default height 0)
                setObserver({ lat, lng, height: 0 });
                
                // Fetch real elevation
                fetch('http://localhost:5001/get-elevation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat, lon: lng })
                })
                .then(res => res.json())
                .then(data => {
                    console.log("Viewshed Debug - Fetched Elevation (Click):", data);
                    const elevation = data.elevation || 0;
                    // Update with real elevation + 2m observer height (tripod/human)
                    const newObserver = { lat, lng, height: elevation + 2.0 };
                    console.log("Viewshed Debug - Setting Observer (Click):", newObserver);
                    setObserver(newObserver);
                })
                .catch(err => {
                    console.error("Failed to fetch elevation:", err);
                    setObserver({ lat, lng, height: 2.0 }); // Fallback
                });
            }
        }
    });
    return null;
};

const MapComponent = () => {
  // Default Map Center (Portland, OR)
  const defaultLat = parseFloat(import.meta.env.VITE_MAP_LAT) || 45.5152;
  const defaultLng = parseFloat(import.meta.env.VITE_MAP_LNG) || -122.6784;
  const position = [defaultLat, defaultLng];

  // Lifted State
  const [nodes, setNodes] = useState([]); 
  const [linkStats, setLinkStats] = useState({ minClearance: 0, isObstructed: false, loading: false });
  const [coverageOverlay, setCoverageOverlay] = useState(null); // { url, bounds }
  const [toolMode, setToolMode] = useState('link'); // 'link', 'optimize', 'coverage', 'viewshed', 'none'
  const [heatmapData, setHeatmapData] = useState([]); // Data for HeatmapLayer
  const [viewshedObserver, setViewshedObserver] = useState(null); // Single Point for Viewshed Tool
  
  // Calculate Budget at container level for Panel
  const { txPower, antennaGain, freq, sf, bw, cableLoss, units, mapStyle, batchNodes } = useRF();
  
  // Map Configs
  const MAP_STYLES = {
      dark: {
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      },
      light: {
          url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      },
      topo: {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
      },
      satellite: {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      }
  };

  const currentStyle = MAP_STYLES[mapStyle] || MAP_STYLES.dark;

  let budget = null;
  let distance = 0;

  if (nodes.length === 2) {
      const [p1, p2] = nodes;
      distance = turf.distance(
          [p1.lng, p1.lat], 
          [p2.lng, p2.lat], 
          { units: 'kilometers' }
      );

      budget = calculateLinkBudget({
          txPower, 
          txGain: antennaGain, 
          txLoss: cableLoss,
          rxGain: antennaGain, 
          rxLoss: cableLoss,
          distanceKm: distance, 
          freqMHz: freq,
          sf, bw
      });
  }

  // Prepare DeckGL Layers
  const deckLayers = [];
  
  // Viewshed Layer (Only active in 'viewshed' mode)
  if (toolMode === 'viewshed' && viewshedObserver) {
      deckLayers.push(new ViewshedLayer({
          id: 'viewshed-layer',
          observerPos: viewshedObserver, // Passed as prop, consumed by renderSubLayers
          updateTriggers: {
              renderSubLayers: [viewshedObserver] // Ensure sublayers re-render when observer moves
          }
      }));
  }

  // Placeholder Heatmap Data if empty
  if (toolMode === 'coverage' && heatmapData.length === 0) {
       // Mock data for immediate feedback
       // In real app, this would come from a comprehensive coverage simulation
       const mockPoints = [];
       for(let i=0; i<100; i++) {
           mockPoints.push({
               lon: defaultLng + (Math.random() - 0.5) * 0.1,
               lat: defaultLat + (Math.random() - 0.5) * 0.1,
               signalStrength: Math.random()
           });
       }
       // Avoid setting state in render body in real React, but for this deckLayers construction block:
       // We'll just use the local variable for the layer
       deckLayers.push(new HeatmapLayer({
          id: 'coverage-heatmap',
          data: mockPoints,
          getPosition: d => [d.lon, d.lat],
          getWeight: d => d.signalStrength,
          radiusPixels: 40,
          intensity: 1,
          threshold: 0.05
      }));
  } else if (toolMode === 'coverage' && heatmapData.length > 0) {
      deckLayers.push(new HeatmapLayer({
          id: 'coverage-heatmap',
          data: heatmapData,
          getPosition: d => [d.lon, d.lat],
          getWeight: d => d.signalStrength,
          radiusPixels: 40,
          intensity: 1,
          threshold: 0.05
      }));
  }



  return (
    <div style={{ flex: 1, height: '100%', position: 'relative' }}>
      <MapContainer 
        center={position} 
        zoom={13} 
        style={{ height: '100%', width: '100%', background: '#0a0a0f' }}
      >
        <ViewshedClickHandler 
            active={toolMode === 'viewshed'} 
            setObserver={setViewshedObserver} 
        />
        <TileLayer
          attribution={currentStyle.attribution}
          url={currentStyle.url} 
        />
        <DeckGLOverlay layers={deckLayers} />
        
        <LinkLayer 
            nodes={nodes} 
            setNodes={setNodes}
            linkStats={linkStats}
            setLinkStats={setLinkStats}
            setCoverageOverlay={setCoverageOverlay}
            active={toolMode === 'link'}
        />
        {coverageOverlay && (
             <ImageOverlay 
                url={coverageOverlay.url}
                bounds={coverageOverlay.bounds}
                opacity={0.6}
             />
        )}
        
        {/* Visual Marker for Viewshed Observer */}
        {toolMode === 'viewshed' && viewshedObserver && (
            <Marker 
                position={viewshedObserver} 
                draggable={true}
                eventHandlers={{
                    dragend: (e) => {
                         const { lat, lng } = e.target.getLatLng();
                         // Fetch Elevation again on drag end
                        fetch('http://localhost:5001/get-elevation', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lat, lon: lng })
                        })
                        .then(res => res.json())
                        .then(data => {
                            console.log("Viewshed Debug - Fetched Elevation:", data);
                            const elevation = data.elevation || 0;
                            const newObserver = { lat, lng, height: elevation + 2.0 };
                            console.log("Viewshed Debug - Setting Observer:", newObserver);
                            setViewshedObserver(newObserver);
                        })
                        .catch(err => {
                             console.error("Failed to fetch height", err);
                             setViewshedObserver({ lat, lng, height: 2.0 });
                        });
                    }
                }}
            >
                <Popup>Allowed Observer Location</Popup>
            </Marker>
        )}
        <OptimizationLayer active={toolMode === 'optimize'} setActive={(active) => setToolMode(active ? 'optimize' : 'none')} />
      </MapContainer>

      {/* Tool Toggles */}
      <div style={{ position: 'absolute', top: 20, left: 60, zIndex: 1000, display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => {
                if (toolMode === 'link') {
                    // Toggling OFF
                    setToolMode('none');
                    setNodes([]);
                    setLinkStats({ minClearance: 0, isObstructed: false, loading: false });
                    setCoverageOverlay(null);
                } else {
                    // Toggling ON
                    setToolMode('link');
                }
            }}
            style={{
                background: toolMode === 'link' ? '#00ff41' : '#222',
                color: toolMode === 'link' ? '#000' : '#fff',
                border: '1px solid #444',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
            }}
          >
            Link Analysis
          </button>

          <button 
            onClick={() => setToolMode(toolMode === 'optimize' ? 'none' : 'optimize')}
            style={{
                background: toolMode === 'optimize' ? '#00f2ff' : '#222',
                color: toolMode === 'optimize' ? '#000' : '#fff',
                border: '1px solid #444',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
            }}
          >
            {toolMode === 'optimize' ? 'Cancel Find' : 'Find Ideal Spot'}
          </button>

          <button 
            onClick={() => setToolMode(toolMode === 'coverage' ? 'none' : 'coverage')}
            style={{
                background: toolMode === 'coverage' ? '#ffaa00' : '#222',
                color: toolMode === 'coverage' ? '#000' : '#fff',
                border: '1px solid #444',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
            }}
          >
            Heatmap
          </button>
          
          <button 
            onClick={() => {
                if(toolMode === 'viewshed') {
                    setToolMode('none');
                    setViewshedObserver(null);
                } else {
                    setToolMode('viewshed');
                }
            }}
            style={{
                background: toolMode === 'viewshed' ? '#22ff00' : '#222',
                color: toolMode === 'viewshed' ? '#000' : '#fff',
                border: '1px solid #444',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
            }}
          >
            Viewshed
          </button>
      </div>

      {/* Overlay Panel */}
      {nodes.length === 2 && (
          <LinkAnalysisPanel 
              nodes={nodes}
              linkStats={linkStats}
              budget={budget}
              distance={distance}
              units={units}
          />
      )}
      
      {/* Batch Nodes Rendering */}
      {batchNodes.length > 0 && batchNodes.map((node) => (
          <Marker 
              key={`batch-${node.id}`} 
              position={[node.lat, node.lng]} 
              icon={L.divIcon({
                  className: 'batch-node-icon',
                  html: `<div style="background-color: #aaa; width: 8px; height: 8px; border-radius: 50%; opacity: 0.7; border: 1px solid #000;"></div>`,
                  iconSize: [8, 8],
                  iconAnchor: [4, 4]
              })}
          >
              <Popup>{node.name}</Popup>
          </Marker>
      ))}
    </div>
  );
};

export default MapComponent;
