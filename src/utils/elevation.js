import * as turf from '@turf/turf';

/**
 * Fetch elevation profile along a path using Open-Meteo API
 * @param {Object} start - {lat, lng}
 * @param {Object} end - {lat, lng}
 * @param {number} samples - Number of points to sample (default 20)
 * @returns {Promise<Array>} Array of {lat, lng, elevation, distance}
 */
export const fetchElevationPath = async (start, end, samples = 20) => {
    try {
        const startPt = turf.point([start.lng, start.lat]);
        const endPt = turf.point([end.lng, end.lat]);
        const totalDistance = turf.distance(startPt, endPt, { units: 'kilometers' });
        const bearing = turf.bearing(startPt, endPt);

        const points = [];
        const lats = [];
        const lngs = [];

        // Generate sample points
        for (let i = 0; i <= samples; i++) {
            const fraction = i / samples;
            const distToCheck = totalDistance * fraction;
            const pt = turf.destination(startPt, distToCheck, bearing, { units: 'kilometers' });
            
            // Adjust coords slightly if needed, but Open-Meteo is robust
            const [lng, lat] = pt.geometry.coordinates;
            
            points.push({
                lat, lng, 
                distance: distToCheck, // Distance from start
                totalDistance // For reference
            });

            lats.push(lat);
            lngs.push(lng);
        }

        // calls Open-Meteo Elevation API (or local mirror)
        const baseUrl = import.meta.env.VITE_ELEVATION_API_URL || 'https://api.open-meteo.com/v1/elevation';
        const url = `${baseUrl}?latitude=${lats.join(',')}&longitude=${lngs.join(',')}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Elevation API Failed');
        
        const data = await response.json();
        
        if (!data.elevation || data.elevation.length !== points.length) {
             console.warn("Mismatch in elevation data length");
             // Fallback to 0 if fails? Or null
        }

        // Merge elevation into points
        const merged = points.map((pt, idx) => ({
            ...pt,
            elevation: data.elevation ? data.elevation[idx] : 0
        }));

        return merged;

    } catch (error) {
        console.error("Error fetching elevation:", error);
        return []; // Return empty array on failure so app doesn't crash
    }
};
