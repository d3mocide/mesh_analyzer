import React, { useState, useEffect } from 'react';
import { RADIO_PRESETS, DEVICE_PRESETS, ANTENNA_PRESETS } from '../../data/presets';
import { useRF } from '../../context/RFContext';
import { fetchElevationPath } from '../../utils/elevation';
import { analyzeLinkProfile, calculateLinkBudget } from '../../utils/rfMath';

const Sidebar = () => {
    const {
        selectedRadioPreset, setSelectedRadioPreset,
        selectedDevice, setSelectedDevice,
        selectedAntenna, setSelectedAntenna,
        txPower, setTxPower,
        antennaHeight, setAntennaHeight,
        antennaGain, setAntennaGain,
        freq, setFreq,
        bw, setBw,
        sf, setSf,
        cr, setCr,
        erp, cableLoss,
        units, setUnits,
        mapStyle, setMapStyle,
        kFactor, setKFactor,
        clutterHeight, setClutterHeight,
        batchNodes, setBatchNodes
    } = useRF();

    // Responsive & Collapse Logic
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isOpen, setIsOpen] = useState(window.innerWidth > 768);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // Optional: Auto-collapse on small screens
            if (mobile && isOpen) setIsOpen(false);
            if (!mobile && !isOpen) setIsOpen(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleTxPowerChange = (e) => {
        setTxPower(Math.min(Number(e.target.value), DEVICE_PRESETS[selectedDevice].tx_power_max));
    };

    const isCustom = selectedRadioPreset === 'CUSTOM';
    const isCustomAntenna = selectedAntenna === 'CUSTOM';

    const sectionStyle = {
        marginBottom: 'var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: 'var(--spacing-md)'
    };

    const labelStyle = {
        display: 'block',
        color: 'var(--color-text-muted)',
        fontSize: '0.85rem',
        marginBottom: 'var(--spacing-xs)',
        marginTop: 'var(--spacing-sm)'
    };

    const inputStyle = {
        width: '100%',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-main)',
        padding: 'var(--spacing-sm)',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'monospace'
    };

    const selectStyle = {
        ...inputStyle,
        cursor: 'pointer'
    };


  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        style={{
            position: isMobile ? 'fixed' : 'absolute', // Stay with sidebar
            top: '85px',
            left: isOpen ? '330px' : '15px', // Floating to the right
            zIndex: 2010, // Above sidebar (2000)
            background: 'var(--color-primary)',
            color: '#000',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            fontSize: '10px'
        }}
      >
        {isOpen ? '◀' : '▶'}
      </button>

      <aside style={{
        width: isOpen ? '320px' : '0px',
        background: 'var(--color-bg-panel)',
        borderRight: '1px solid var(--color-border)',
        height: '100vh',
        padding: isOpen ? 'var(--spacing-md)' : '0px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2000,
        position: isMobile ? 'fixed' : 'relative',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        whiteSpace: 'nowrap',
        opacity: isOpen ? 1 : 0,
        boxShadow: isMobile && isOpen ? '4px 0 20px rgba(0,0,0,0.5)' : 'none'
      }}>
      <h2 style={{ 
        color: 'var(--color-primary)', 
        margin: '0 0 var(--spacing-lg) 0',
        fontSize: '1.2rem',
        letterSpacing: '0.05em',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px'
      }}>
        <img src="/icon.svg" alt="App Icon" style={{ height: '24px', width: '24px' }} /> meshRF
      </h2>
      
      {/* DEVICE SELECTION */}
      <div style={sectionStyle}>
        <h3 style={{fontSize: '1rem', color: '#fff', margin: '0 0 var(--spacing-sm) 0'}}>Hardware</h3>
        
        <label style={labelStyle}>Device Preset</label>
        <select 
            style={selectStyle}
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
        >
            {Object.values(DEVICE_PRESETS).map(device => (
                <option key={device.id} value={device.id}>{device.name}</option>
            ))}
        </select>

        <label style={labelStyle}>Antenna Type</label>
        <select 
            style={selectStyle}
            value={selectedAntenna}
            onChange={(e) => setSelectedAntenna(e.target.value)}
        >
             {Object.values(ANTENNA_PRESETS).map(ant => (
                <option key={ant.id} value={ant.id}>
                    {ant.name} ({ant.gain} dBi)
                </option>
            ))}
        </select>

        {isCustomAntenna && (
            <div>
                 <label style={labelStyle}>Custom Gain (dBi)</label>
                 <input 
                    type="number" 
                    style={inputStyle} 
                    value={antennaGain} 
                    onChange={(e) => setAntennaGain(Number(e.target.value))}
                />
            </div>
        )}

        <label style={labelStyle}>
            Antenna Height: {units === 'imperial' ? `${(antennaHeight * 3.28084).toFixed(0)} ft` : `${antennaHeight} m`}
        </label>
        <input 
            type="range" 
            min="1" max="50" 
            value={antennaHeight} 
            onChange={(e) => setAntennaHeight(Number(e.target.value))}
            style={{width: '100%', cursor: 'pointer'}}
        />
      </div>

      {/* RADIO SETTINGS */}
      <div style={sectionStyle}>
        <h3 style={{fontSize: '1rem', color: '#fff', margin: '0 0 var(--spacing-sm) 0'}}>Radio Config</h3>
        
        <label style={labelStyle}>Radio Preset</label>
        <select 
            style={selectStyle}
            value={selectedRadioPreset}
            onChange={(e) => setSelectedRadioPreset(e.target.value)}
        >
            {Object.values(RADIO_PRESETS).map(preset => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
        </select>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)'}}>
            <div>
                <label style={labelStyle}>Freq (MHz)</label>
                <input 
                    type="number" 
                    style={inputStyle} 
                    value={freq} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setFreq(e.target.value)}
                />
            </div>
             <div>
                <label style={labelStyle}>BW (kHz)</label>
                <input 
                    type="number" 
                    style={inputStyle} 
                    value={bw} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setBw(e.target.value)}
                />
            </div>
             <div>
                <label style={labelStyle}>SF</label>
                <input 
                    type="number" 
                    style={inputStyle} 
                    value={sf} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setSf(e.target.value)}
                />
            </div>
             <div>
                <label style={labelStyle}>CR</label>
                <input 
                    type="number" 
                    style={inputStyle} 
                    value={cr} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setCr(e.target.value)}
                />
            </div>
        </div>

        <label style={labelStyle}>
            TX Power (dBm): {txPower} 
            <span style={{color: 'var(--color-secondary)', marginLeft: '8px'}}>
                (Max: {DEVICE_PRESETS[selectedDevice].tx_power_max})
            </span>
        </label>
        <input 
            type="range" 
            min="0" 
            max={DEVICE_PRESETS[selectedDevice].tx_power_max} 
            value={txPower} 
            onChange={handleTxPowerChange}
            style={{width: '100%', cursor: 'pointer', accentColor: 'var(--color-primary)'}}
        />

        {/* ERP CALCULATION DISPLAY */}
        <div style={{
            marginTop: 'var(--spacing-md)', 
            padding: 'var(--spacing-sm)', 
            background: 'var(--glass-bg)', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)'
        }}>
            <label style={{fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase'}}>Estimated ERP</label>
            <div style={{fontSize: '1.2rem', color: 'var(--color-primary)', fontWeight: 'bold'}}>
                {erp} dBm
            </div>
            <div style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>
                (TX {txPower} + Gain {antennaGain} - Loss {cableLoss})
            </div>
        </div>
      </div>

        {/* SETTINGS */}
        <div style={sectionStyle}>
             <h3 style={{fontSize: '1rem', color: '#fff', margin: '0 0 var(--spacing-sm) 0'}}>Settings</h3>
             <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px'}}>
                 <label style={{color: '#aaa', fontSize: '0.9em'}}>Units</label>
                 <div style={{display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden', border: '1px solid #444'}}>
                     <button 
                        onClick={() => setUnits('metric')}
                        style={{
                            background: units === 'metric' ? 'var(--color-primary)' : 'transparent',
                            color: units === 'metric' ? '#000' : '#888',
                            border: 'none',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '0.8em',
                            fontWeight: 600
                        }}
                     >
                        Metric
                     </button>
                     <button 
                        onClick={() => setUnits('imperial')}
                        style={{
                            background: units === 'imperial' ? 'var(--color-primary)' : 'transparent',
                            color: units === 'imperial' ? '#000' : '#888',
                            border: 'none',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '0.8em',
                            fontWeight: 600
                        }}
                     >
                        Imperial
                     </button>
                 </div>
             </div>
             
             {/* Environmental Settings */}
             <div style={{marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px dashed #444'}}>
                 <label style={{color: '#aaa', fontSize: '0.9em', display: 'block', marginBottom: '8px'}}>Environment</label>
                 
                 <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                     <div>
                         <label style={{fontSize: '0.75em', color: '#888'}}>Refraction (K)</label>
                         <input 
                            type="number" 
                            step="0.01"
                            value={kFactor}
                            onChange={(e) => setKFactor(parseFloat(e.target.value))}
                            style={{...inputStyle, padding: '2px 4px', fontSize: '0.85em'}}
                         />
                     </div>
                     <div>
                         <label style={{fontSize: '0.75em', color: '#888'}}>Clutter (m)</label>
                         <input 
                            type="number" 
                            step="1"
                            value={clutterHeight}
                            onChange={(e) => setClutterHeight(parseFloat(e.target.value))}
                            style={{...inputStyle, padding: '2px 4px', fontSize: '0.85em'}}
                         />
                     </div>
                 </div>
                 <div style={{fontSize: '0.7em', color: '#666', marginTop: '4px', fontStyle: 'italic'}}>
                     K=1.33 Standard, K=1.0 Bare Earth
                 </div>
             </div>

             {/* Batch Operations */}
             <div style={{marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px dashed #444'}}>
                 <label style={{color: '#aaa', fontSize: '0.9em', display: 'block', marginBottom: '8px'}}>Batch Processing</label>
                 
                 {/* Import */}
                 <div style={{marginBottom: '8px'}}>
                     <label style={{display: 'block', padding: '6px 10px', background: '#333', color: '#ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8em', textAlign: 'center'}}>
                         Import Nodes (CSV)
                         <input 
                            type="file" 
                            accept=".csv"
                            style={{display: 'none'}}
                            onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        const text = event.target.result;
                                        const lines = text.split('\n');
                                        const newNodes = [];
                                        lines.forEach((line, idx) => {
                                            if (idx === 0 && line.toLowerCase().includes('lat')) return; // Skip header
                                            const parts = line.split(',');
                                            if (parts.length >= 3) {
                                                // Assume: name, lat, lon OR lat, lon, name?
                                                // Let's try to detect or enforce Name,Lat,Lon
                                                let name, lat, lng;
                                                
                                                // Simple heuristic: if parts[0] is number, it's lat.
                                                if (!isNaN(parseFloat(parts[0]))) {
                                                     lat = parseFloat(parts[0]);
                                                     lng = parseFloat(parts[1]);
                                                     name = parts[2] || `Node ${idx}`;
                                                } else {
                                                     name = parts[0];
                                                     lat = parseFloat(parts[1]);
                                                     lng = parseFloat(parts[2]);
                                                }
                                                
                                                if (!isNaN(lat) && !isNaN(lng)) {
                                                    newNodes.push({ id: idx, name: name.trim(), lat, lng });
                                                }
                                            }
                                        });
                                        setBatchNodes(newNodes);
                                        alert(`Imported ${newNodes.length} nodes.`);
                                    };
                                    reader.readAsText(file);
                                }
                            }}
                         />
                     </label>
                     <div style={{fontSize: '0.7em', color: '#666', marginTop: '4px'}}>Format: Name, Lat, Lon</div>
                 </div>

                 {/* Export Report */}
                 {batchNodes.length > 1 && (
                     <button 
                        style={{...buttonStyle, background: '#00afb9', width: '100%'}}
                        onClick={async () => {
                             const totalLinks = batchNodes.length * (batchNodes.length - 1) / 2;
                             if (batchNodes.length > 20 && !window.confirm(`Preparing to analyze ${totalLinks} links. This may take a while. Continue?`)) return;
                             
                             const startExport = async () => {
                                 let csvContent = "data:text/csv;charset=utf-8,Source,Target,Distance_km,Status,Quality,Margin_dB,Clearance_m\n";
                                 
                                 // Iterate all pairs
                                 for (let i = 0; i < batchNodes.length; i++) {
                                     for (let j = i + 1; j < batchNodes.length; j++) {
                                         const n1 = batchNodes[i];
                                         const n2 = batchNodes[j];
                                         
                                         try {
                                             // Fetch Profile
                                             const profile = await fetchElevationPath(
                                                 {lat: n1.lat, lng: n1.lng}, 
                                                 {lat: n2.lat, lng: n2.lng}, 
                                                 20 // Lower resolution for batch to save time
                                             );
                                             
                                             if (profile) {
                                                  const analysis = analyzeLinkProfile(
                                                      profile, 
                                                      freq, 
                                                      antennaHeight, 
                                                      antennaHeight,
                                                      kFactor,
                                                      clutterHeight
                                                  );
                                                  
                                                  const distKm = profile[profile.length-1].distance;
                                                  
                                                  // Link Budget
                                                  const budget = calculateLinkBudget({
                                                        txPower, 
                                                        txGain: antennaGain, 
                                                        txLoss: cableLoss,
                                                        rxGain: antennaGain, 
                                                        rxLoss: cableLoss,
                                                        distanceKm: distKm, 
                                                        freqMHz: freq,
                                                        sf, bw
                                                  });
                                                  
                                                  const status = analysis.isObstructed ? 'OBSTRUCTED' : (budget.margin > 10 ? 'GOOD' : 'MARGINAL');
                                                  
                                                  csvContent += `${n1.name},${n2.name},${distKm.toFixed(3)},${status},${analysis.linkQuality},${budget.margin},${analysis.minClearance}\n`;
                                             }
                                         } catch (e) {
                                             console.error("Batch Error", e);
                                             csvContent += `${n1.name},${n2.name},ERR,ERR,ERR,ERR,ERR\n`;
                                         }
                                         
                                         // Small delay to prevent browser freeze & rate limit
                                         await new Promise(r => setTimeout(r, 200));
                                     }
                                 }
                                 
                                 // Trigger Download
                                 const encodedUri = encodeURI(csvContent);
                                 const link = document.createElement("a");
                                 link.setAttribute("href", encodedUri);
                                 link.setAttribute("download", `mesh_rf_analysis_${new Date().toISOString().slice(0,10)}.csv`);
                                 document.body.appendChild(link);
                                 link.click();
                                 document.body.removeChild(link);
                             };
                             
                             // Allow UI to update before blocking
                             setTimeout(startExport, 100);
                        }}
                     >
                         Export Mesh Report
                     </button>
                 )}
                 {batchNodes.length > 0 && (
                      <div style={{fontSize: '0.75em', color: '#888', marginTop: '4px'}}>{batchNodes.length} Nodes Loaded</div>
                 )}
             </div>

             {/* Map Style Selector */}
             <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', marginTop: '12px'}}>
                 <label style={{color: '#aaa', fontSize: '0.9em'}}>Map Style</label>
                 <select 
                    value={mapStyle}
                    onChange={(e) => setMapStyle(e.target.value)}
                    style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid #444',
                        color: '#eee',
                        borderRadius: '4px',
                        padding: '4px',
                        fontSize: '0.85em',
                        width: '120px'
                    }}
                 >
                     <option value="dark">Dark Matter</option>
                     <option value="light">Light Mode</option>
                     <option value="topo">Topography</option>
                     <option value="satellite">Satellite</option>
                 </select>
             </div>

             {/* Footer */}
             <div style={{marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #333', textAlign: 'center'}}>
                 <a 
                    href="https://github.com/d3mocide/MeshRF/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{color: '#666', fontSize: '0.75em', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}
                 >
                    <svg height="16" viewBox="0 0 16 16" width="16" style={{fill: '#666'}}>
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                    </svg>
                    d3mocide/MeshRF
                 </a>
             </div>
        </div>

    </aside>
    </>
  );
};

export default Sidebar;
