import * as turf from '@turf/turf';

/**
 * Calculate Free Space Path Loss (FSPL) in dB
 * @param {number} distanceKm - Distance in Kilometers
 * @param {number} freqMHz - Frequency in MHz
 * @returns {number} Path Loss in dB
 */
export const calculateFSPL = (distanceKm, freqMHz) => {
  if (distanceKm <= 0) return 0;
  // FSPL(dB) = 20log10(d) + 20log10(f) + 32.44
  return 20 * Math.log10(distanceKm) + 20 * Math.log10(freqMHz) + 32.44;
};

/**
 * Calculate the radius of the nth Fresnel Zone
 * @param {number} distanceKm - Total link distance in Kilometers
 * @param {number} freqMHz - Frequency in MHz
 * @param {number} pointDistKm - Distance from one end to the point of interest (default: midpoint)
 * @returns {number} Radius in meters
 */
export const calculateFresnelRadius = (distanceKm, freqMHz, pointDistKm = null) => {
  if (!pointDistKm) pointDistKm = distanceKm / 2;
  const d1 = pointDistKm; 
  const d2 = distanceKm - pointDistKm; 
  const fGHz = freqMHz / 1000;
  
  // r = 17.32 * sqrt((d1 * d2) / (f * D))
  // d1, d2, D in km, f in GHz, r in meters
  return 17.32 * Math.sqrt((d1 * d2) / (fGHz * distanceKm));
};

/**
 * Calculate Link Budget
 * @param {Object} params
 * @param {number} params.txPower - TX Power in dBm
 * @param {number} params.txGain - TX Antenna Gain in dBi
 * @param {number} params.txLoss - TX Cable Loss in dB
 * @param {number} params.rxGain - RX Antenna Gain in dBi (Assuming symmetric for now or user defined)
 * @param {number} params.rxLoss - RX Cable Loss in dB
 * @param {number} params.distanceKm - Distance in Km
 * @param {number} params.freqMHz - Frequency in MHz
 * @param {number} params.sf - Spreading Factor (for sensitivity)
 * @param {number} params.bw - Bandwidth in kHz (for sensitivity)
 * @returns {Object} { rssi, fspl, snrLimit, linkMargin }
 */
export const calculateLinkBudget = ({
  txPower, txGain, txLoss, 
  rxGain, rxLoss, 
  distanceKm, freqMHz,
  sf, bw
}) => {
  const fspl = calculateFSPL(distanceKm, freqMHz);
  
  // Estimated RSSI at receiver
  // RSSI = Ptx + Gtx - Ltx - FSPL + Grx - Lrx
  const rssi = txPower + txGain - txLoss - fspl + rxGain - rxLoss;

  // Receiver Sensitivity Calculation (Semtech SX1262 approx)
  // S = -174 + 10log10(BW) + NF + SNR_limit
  // Standard LoRa sensitivity approximation: 
  // SF7/125kHz ~ -123dBm
  // Rule of thumb: Higher SF = Lower (better) sensitivity. Double BW = 3dB worse.
  
  // Base sensitivity for SF7, 125kHz
  let baseSensitivity = -123; 
  
  // Adjust for Bandwidth: 10 * log10(BW_meas / BW_ref)
  // If BW goes 125 -> 250, noise floor rises by 3dB, sensitivity worsens by 3dB
  const bwFactor = 10 * Math.log10(bw / 125);
  
  // Adjust for Spreading Factor: Each step adds ~2.5dB of process gain
  // SF7 is base. SF12 is 5 steps higher.
  const sfFactor = (sf - 7) * -2.5; 

  const sensitiveLimit = baseSensitivity + bwFactor + sfFactor;

  const linkMargin = rssi - sensitiveLimit;

  return {
    rssi: parseFloat(rssi.toFixed(2)),
    fspl: parseFloat(fspl.toFixed(2)),
    sensitivity: parseFloat(sensitiveLimit.toFixed(2)),
    margin: parseFloat(linkMargin.toFixed(2))
  };
};

/**
 * Calculate Fresnel Zone Polygon coordinates
 * @param {Object} p1 - Start {lat, lng}
 * @param {Object} p2 - End {lat, lng}
 * @param {number} freqMHz - Frequency
 * @param {number} steps - Number of steps for the polygon
 * @returns {Array} List of [lat, lng] arrays for Leaflet Polygon
 */
export const calculateFresnelPolygon = (p1, p2, freqMHz, steps = 30) => {
  const startPt = turf.point([p1.lng, p1.lat]);
  const endPt = turf.point([p2.lng, p2.lat]);
  const totalDistance = turf.distance(startPt, endPt, { units: 'kilometers' });
  const bearing = turf.bearing(startPt, endPt);
  
  // Left and Right boundaries
  const leftSide = [];
  const rightSide = [];

  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const dist = totalDistance * fraction; // Current distance along path
    
    // Calculate Fresnel Radius at this point
    // totalDistance must be in Km for Fresnel calc
    // dist is distance from source
    // Fresnel Radius calc expects total distance and distance from source
    
    // Warning: calculateFresnelRadius returns METERS
    const rMeters = calculateFresnelRadius(totalDistance, freqMHz, dist);
    const rKm = rMeters / 1000;

    // Find point on the line
    const pointOnLine = turf.destination(startPt, dist, bearing, { units: 'kilometers' });
    
    // Perpendicular points
    // Bearing - 90 is Left, Bearing + 90 is Right
    const leftPt = turf.destination(pointOnLine, rKm, bearing - 90, { units: 'kilometers' });
    const rightPt = turf.destination(pointOnLine, rKm, bearing + 90, { units: 'kilometers' });

    // Leaflet wants [lat, lng]
    leftSide.push(leftPt.geometry.coordinates.reverse()); 
    // We unshift rightSide to keep polygon drawing order correct (CCW)
    rightSide.unshift(rightPt.geometry.coordinates.reverse());
  }

  return [...leftSide, ...rightSide];
};


/**
 * Calculate Earth Bulge at a specific point
 * @param {number} distKm - Distance from start point (km)
 * @param {number} totalDistKm - Total link distance (km)
 * @param {number} kFactor - Standard Refraction Factor (default 1.33)
 * @returns {number} Bulge height in meters
 */
export const calculateEarthBulge = (distKm, totalDistKm, kFactor = 1.33) => {
  // Earth Radius (km)
  const R = 6371;
  const Re = R * kFactor; // Effective Radius

  // Distance to second point
  const d1 = distKm;
  const d2 = totalDistKm - distKm;

  // h = (d1 * d2) / (2 * Re)
  // Result in km, convert to meters
  const hKm = (d1 * d2) / (2 * Re);
  return hKm * 1000;
};


/**
 * Analyze Link Profile for Obstructions (Geodetic + Clutter + Fresnel Standards)
 * @param {Array} profile - Array of {distance, elevation} points (distance in km, elevation in m)
 * @param {number} freqMHz - Frequency
 * @param {number} txHeightAGL - TX Antenna Height (m)
 * @param {number} rxHeightAGL - RX Antenna Height (m)
 * @param {number} kFactor - Atmospheric Refraction (default 1.33)
 * @param {number} clutterHeight - Uniform Clutter Height (e.g., Trees/Urban) default 0
 * @returns {Object} { minClearance, isObstructed, linkQuality, profileWithStats }
 */
export const analyzeLinkProfile = (profile, freqMHz, txHeightAGL, rxHeightAGL, kFactor = 1.33, clutterHeight = 0) => {
  if (!profile || profile.length === 0) return { isObstructed: false, minClearance: 999 };

  const startPt = profile[0];
  const endPt = profile[profile.length - 1];
  const totalDistKm = endPt.distance; 

  const txH = startPt.elevation + txHeightAGL; 
  const rxH = endPt.elevation + rxHeightAGL;

  let minClearance = 9999;
  let isObstructed = false;
  let worstFresnelRatio = 1.0; // 1.0 = Fully Clear. < 0.6 = Bad.

  const profileWithStats = profile.map(pt => {
    const d = pt.distance; // km
    
    // 1. Calculate Earth Bulge
    const bulge = calculateEarthBulge(d, totalDistKm, kFactor);
    
    // 2. Effective Terrain Height (Terrain + Bulge + Clutter)
    const effectiveTerrain = pt.elevation + bulge + clutterHeight;

    // 3. LOS Height at this distance
    const ratio = d / totalDistKm;
    const losHeight = txH + (rxH - txH) * ratio;

    // 4. Fresnel Radius (m)
    const f1 = calculateFresnelRadius(totalDistKm, freqMHz, d);

    // 5. Clearance (m) relative to F1 bottom
    // Positive = Clear of F1. Negative = Inside F1 or Obstructed.
    const distFromCenter = losHeight - effectiveTerrain;
    const clearance = distFromCenter - f1;
    
    // Ratio of Clearance / F1 Radius (for quality check)
    // 60% rule means distFromCenter >= 0.6 * F1
    const fRatio = f1 > 0 ? (distFromCenter / f1) : 1; 

    if (fRatio < worstFresnelRatio) worstFresnelRatio = fRatio;
    if (clearance < minClearance) minClearance = clearance;

    // Obstructed logic
    if (distFromCenter <= 0) isObstructed = true;

    return {
      ...pt,
      earthBulge: bulge,
      effectiveTerrain, 
      losHeight,
      f1Radius: f1,
      clearance,
      fresnelRatio: fRatio
    };
  });

  // Determine Link Quality String
  // Excellent (>0.8), Good (>0.6), Marginal (>0), Obstructed (<=0)
  
  let linkQuality = "Obstructed";
  if (worstFresnelRatio >= 0.8) linkQuality = "Excellent (+++)";
  else if (worstFresnelRatio >= 0.6) linkQuality = "Good (++)"; // 60% rule
  else if (worstFresnelRatio > 0) linkQuality = "Marginal (+)"; // Visual LOS, but heavy Fresnel
  else linkQuality = "Obstructed (-)"; // No Visual LOS

  return {
    minClearance: parseFloat(minClearance.toFixed(1)),
    isObstructed,
    linkQuality,
    profileWithStats
  };
};


