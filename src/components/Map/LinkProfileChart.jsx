import React from 'react';

const LinkProfileChart = ({ profileWithStats, width = 200, height = 100, units = 'metric' }) => { // Added units default
    if (!profileWithStats || profileWithStats.length === 0) return null;

    // Unit Conversion Helpers
    const isImperial = units === 'imperial';
    const distFactor = isImperial ? 0.621371 : 1;
    const heightFactor = isImperial ? 3.28084 : 1;
    const distUnit = isImperial ? 'mi' : 'km';
    const heightUnit = isImperial ? 'ft' : 'm';

    let minElev = Math.min(
        ...profileWithStats.map(p => p.effectiveTerrain),
        ...profileWithStats.map(p => p.losHeight - p.f1Radius)
    );
    let maxElev = Math.max(
        ...profileWithStats.map(p => p.losHeight + p.f1Radius), 
        ...profileWithStats.map(p => p.effectiveTerrain)
    );
    
    // Add margin to prevent clipping
    const range = maxElev - minElev;
    const padding = range * 0.1 || 10;
    minElev -= padding;
    maxElev += padding;

    const totalDist = profileWithStats[profileWithStats.length - 1].distance;

    // Label Values
    const totalDistLabel = (totalDist * distFactor).toFixed(1);
    const maxElevLabel = (maxElev * heightFactor).toFixed(0);

    // Padding
    const p = 10;
    const w = width - p * 2;
    const h = height - p * 2;

    const scaleX = (d) => p + (d / totalDist) * w;
    const scaleY = (e) => height - p - ((e - minElev) / (maxElev - minElev)) * h;

    // Generate Path Data
    
    let terrainPath = `M ${scaleX(0)} ${height}`; 
    profileWithStats.forEach(pt => {
        const elev = pt.effectiveTerrain !== undefined ? pt.effectiveTerrain : pt.elevation;
        terrainPath += ` L ${scaleX(pt.distance)} ${scaleY(elev)}`;
    });
    terrainPath += ` L ${scaleX(totalDist)} ${height} Z`;

    let bareEarthPath = "";
    if (profileWithStats[0].earthBulge !== undefined) {
         bareEarthPath = `M ${scaleX(0)} ${height}`;
          profileWithStats.forEach((pt, i) => {
             const ground = pt.elevation + pt.earthBulge;
             const cmd = i === 0 ? 'M' : 'L';
             bareEarthPath += `${cmd} ${scaleX(pt.distance)} ${scaleY(ground)}`;
         });
    }

    const losPath = `M ${scaleX(0)} ${scaleY(profileWithStats[0].losHeight)} L ${scaleX(totalDist)} ${scaleY(profileWithStats[profileWithStats.length - 1].losHeight)}`;

    let f1Path = "";
    profileWithStats.forEach((pt, i) => {
        const f1Bottom = pt.losHeight - pt.f1Radius;
        const cmd = i === 0 ? 'M' : 'L';
        f1Path += `${cmd} ${scaleX(pt.distance)} ${scaleY(f1Bottom)}`;
    });

    return (
        <div style={{ marginTop: '10px', background: '#0000', border: '1px solid #333', borderRadius: '4px' }}>
            <svg width={width} height={height}>
                {/* Terrain (Effective - Includes Clutter) */}
                <path d={terrainPath} fill="#5d4037" stroke="none" opacity="0.8" />
                
                {/* Bare Earth Line (if Geodetic enabled) */}
                {bareEarthPath && <path d={bareEarthPath} fill="none" stroke="#8d6e63" strokeWidth="1" opacity="0.5" />}
                
                {/* Fresnel Zone Bottom Limit */}
                <path d={f1Path} fill="none" stroke="#00f2ff" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />

                {/* LOS Line */}
                <path d={losPath} fill="none" stroke="#00ff41" strokeWidth="2" />

                {/* Axis Labels (Improved Alignment) */}
                <text 
                    x={p} 
                    y={height - 5} 
                    fill="#ccc" 
                    fontSize="10" 
                    textAnchor="start" 
                    style={{ textShadow: '0 0 3px #000' }}
                >
                    0{distUnit}
                </text>
                <text 
                    x={width - p} 
                    y={height - 5} 
                    fill="#ccc" 
                    fontSize="10" 
                    textAnchor="end" 
                    style={{ textShadow: '0 0 3px #000' }}
                >
                    {totalDistLabel}{distUnit}
                </text>
                <text 
                    x={p} 
                    y={p + 10} 
                    fill="#ccc" 
                    fontSize="10" 
                    textAnchor="start" 
                    style={{ textShadow: '0 0 3px #000' }}
                >
                    {maxElevLabel}{heightUnit}
                </text>
            </svg>
        </div>
    );
};

export default LinkProfileChart;
