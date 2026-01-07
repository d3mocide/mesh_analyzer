import React from 'react';
import LinkProfileChart from './LinkProfileChart';

const LinkAnalysisPanel = ({ nodes, linkStats, budget, distance, units }) => { 
    if (nodes.length !== 2) return null;

    // Conversions
    const isImperial = units === 'imperial';
    const distDisplay = isImperial ? (distance * 0.621371).toFixed(2) + ' mi' : distance.toFixed(2) + ' km';
    const clearanceVal = linkStats.minClearance;
    const clearanceDisplay = isImperial ? (clearanceVal * 3.28084).toFixed(1) + ' ft' : clearanceVal + ' m';

    // Colors
    const isObstructed = linkStats.isObstructed;
    const margin = budget ? budget.margin : 0;
    
    // WISP Ratings
    const quality = linkStats.linkQuality || 'Obstructed (-)';
    
    let statusColor = '#ff0000'; // Default Red
    let statusText = quality.toUpperCase();

    if (quality.includes('Excellent')) {
        statusColor = '#00ff41'; // Green
    } else if (quality.includes('Good')) {
        statusColor = '#00ff41'; // Green (maybe slightly different?)
    } else if (quality.includes('Marginal')) {
        statusColor = '#ffbf00'; // Amber
    } else if (quality.includes('Obstructed')) {
         statusColor = '#ff0000'; // Red
    }
    
    // Override if Margin is bad (even if Fresnel is clear)
    if (margin < 0) {
        statusColor = '#ff0000';
        statusText = 'NO SIGNAL';
    } else if (margin < 10 && !quality.includes('Obstructed')) {
         // If margin is low but LOS is clear, warn
         if (statusColor === '#00ff41') statusColor = '#ffbf00';
         if (!statusText.includes('MARGINAL')) statusText += ' (LOW SNR)';
    }

    // Responsive Chart Logic
    const [panelSize, setPanelSize] = React.useState({ width: 300, height: 350 });
    const [dimensions, setDimensions] = React.useState({ width: 268, height: 100 });
    const panelRef = React.useRef(null);
    const draggingRef = React.useRef(false);
    const lastPosRef = React.useRef({ x: 0, y: 0 });

    // Update Chart Dimensions when Panel Size changes
    React.useEffect(() => {
        setDimensions({
            width: Math.max(260, panelSize.width - 32),
            height: Math.max(100, panelSize.height - 250)
        });
    }, [panelSize]);

    // Resize Handler
    const handleMouseDown = (e) => {
        draggingRef.current = true;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        e.preventDefault(); // Prevent selection
    };

    const handleMouseMove = (e) => {
        if (!draggingRef.current) return;
        
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        
        lastPosRef.current = { x: e.clientX, y: e.clientY };

        setPanelSize(prev => {
            // Dragging Left (negative dx) should INCREASE width (since anchored right)
            // Dragging Down (positive dy) should INCREASE height
            
            const newWidth = prev.width - dx; 
            const newHeight = prev.height + dy;

            return {
                width: Math.max(300, newWidth),
                height: Math.max(300, newHeight)
            };
        });
    };

    const handleMouseUp = () => {
        draggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    return (
        <div ref={panelRef} style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: `${panelSize.width}px`,
            height: `${panelSize.height}px`,
            background: 'rgba(10, 10, 15, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '16px',
            color: '#eee',
            zIndex: 1000, 
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            // Custom resize, remove CSS resize
            overflow: 'hidden' 
        }}>
            {/* Custom Bottom-Left Resize Handle */}
            <div 
                onMouseDown={handleMouseDown}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '24px',
                    height: '24px',
                    cursor: 'sw-resize',
                    zIndex: 1001,
                    // Light background for "tab" feel + distinct grip lines
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    backgroundImage: `repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 4px,
                        rgba(255, 255, 255, 0.5) 4px,
                        rgba(255, 255, 255, 0.5) 5px
                    )`,
                    // Triangle shape
                    clipPath: 'polygon(0 100%, 100% 100%, 0 0)',
                    borderBottomLeftRadius: '8px',
                    transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                title="Resize Panel"
            ></div>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1em', fontWeight: 600 }}>Link Analysis</h3>
                <span style={{ 
                    fontSize: '0.8em', 
                    fontWeight: 800, 
                    color: '#000', 
                    background: statusColor, 
                    padding: '2px 8px', 
                    borderRadius: '4px' 
                }}>
                    {statusText}
                </span>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9em', marginBottom: '16px', flexShrink: 0 }}>
                <div>
                    <div style={{ color: '#888', fontSize: '0.85em' }}>Distance</div>
                    <div style={{ fontSize: '1.2em', fontWeight: 500 }}>{distDisplay}</div>
                </div>
                <div>
                    <div style={{ color: '#888', fontSize: '0.85em' }}>Margin</div>
                    <div style={{ fontSize: '1.2em', fontWeight: 500, color: statusColor }}>{margin} dB</div>
                </div>
                <div>
                    <div style={{ color: '#888', fontSize: '0.85em' }}>RSSI</div>
                    <div style={{ fontSize: '1.1em' }}>{budget.rssi} dBm</div>
                </div>
                <div>
                    <div style={{ color: '#888', fontSize: '0.85em' }}>First Fresnel</div>
                    <div style={{ fontSize: '1.1em' }}>{clearanceDisplay}</div>
                </div>
            </div>

            {/* Profile Chart - Flexible Height */}
            <div style={{ borderTop: '1px solid #333', paddingTop: '12px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#888', fontSize: '0.85em', marginBottom: '4px' }}>Terrain & Path Profile</div>
                {linkStats.loading ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontStyle: 'italic' }}>
                        Loading Elevation Data...
                    </div>
                ) : (
                    <div style={{flexGrow: 1, minHeight: '100px'}}>
                        <LinkProfileChart 
                            profileWithStats={linkStats.profileWithStats} 
                            width={dimensions.width}
                            height={dimensions.height}
                            units={units}
                        />
                    </div>
                )}
            </div>

            {/* Legend / Info */}
            <div style={{ marginTop: '12px', display: 'flex', gap: '12px', fontSize: '0.75em', color: '#666', flexShrink: 0, marginLeft: '20px' }}> {/* Left margin to avoid handle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff41' }}></div>
                    <span>LOS</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5d4037' }}></div>
                    <span>Terrain</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1px dashed #00f2ff' }}></div>
                    <span>Fresnel</span>
                </div>
            </div>
        </div>
    );
};

export default LinkAnalysisPanel;
