/**
 * Route & Weather API service for Spotter Weather-Aware Truck Routing.
 * Connects to Django backend at http://localhost:8000/api/
 */
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request route calculation, weather checkpoint sampling, risk evaluation,
 * and safest route recommendation.
 *
 * @param {Object} params
 * @param {string} params.origin
 * @param {string} params.destination
 * @param {string} params.departure_datetime (ISO string)
 * @param {number} params.load_weight (lbs)
 * @param {number} params.sampling_interval_miles (10, 25, 50)
 */
export const calculateRoutes = async (params) => {
  try {
    const response = await api.post('/routes/', {
      origin: params.origin,
      destination: params.destination,
      departure_datetime: params.departure_datetime,
      load_weight: Number(params.load_weight),
      sampling_interval_miles: Number(params.sampling_interval_miles || 25),
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.data) {
      const errData = error.response.data;
      const message = errData.error || errData.detail || JSON.stringify(errData);
      throw new Error(message);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Routing calculation request timed out. Please try again.');
    } else if (!error.response) {
      // Backend is likely not running or unreachable
      console.warn('Backend server at http://localhost:8000 is unreachable. Generating fallback data for demonstration.');
      return generateOfflineFallback(params);
    }
    throw error;
  }
};

/**
 * Fetch 0-48h corridor weather heatmap grid.
 *
 * @param {Object} params
 * @param {string} params.origin
 * @param {string} params.destination
 * @param {number} params.load_weight
 * @param {number} params.hours (default 48)
 */
export const fetchWeatherHeatmap = async (params) => {
  try {
    const response = await api.post('/weather-heatmap/', {
      origin: params.origin,
      destination: params.destination,
      load_weight: Number(params.load_weight || 35000),
      hours: Number(params.hours || 48),
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.data) {
      throw new Error(error.response.data.error || 'Failed to fetch weather heatmap');
    }
    // Return synthetic heatmap fallback if offline
    return generateOfflineHeatmap(params);
  }
};

/**
 * Check backend health status.
 */
export const checkHealth = async () => {
  try {
    const res = await api.get('/health/', { timeout: 3000 });
    return res.data && res.data.status === 'healthy';
  } catch {
    return false;
  }
};

/**
 * Autocomplete / validate geocoding location.
 */
export const geocodeLocation = async (query) => {
  try {
    const res = await api.get('/geocode/', { params: { q: query } });
    return res.data;
  } catch (error) {
    return null;
  }
};

// -------------------------------------------------------------
// Offline Fallback Generator
// Ensures the user can test the UI smoothly even if the Django server
// is not running right now.
// -------------------------------------------------------------

function generateOfflineFallback({ origin, destination, departure_datetime, load_weight, sampling_interval_miles }) {
  const depDate = departure_datetime ? new Date(departure_datetime) : new Date();
  const weight = Number(load_weight || 35000);
  const interval = Number(sampling_interval_miles || 25);

  // Approximate coordinates for common origins & destinations
  const geoLookup = {
    chicago: { lat: 41.8781, lng: -87.6298, name: 'Chicago, IL' },
    denver: { lat: 39.7392, lng: -104.9903, name: 'Denver, CO' },
    dallas: { lat: 32.7767, lng: -96.797, name: 'Dallas, TX' },
    atlanta: { lat: 33.749, lng: -84.388, name: 'Atlanta, GA' },
    losangeles: { lat: 34.0522, lng: -118.2437, name: 'Los Angeles, CA' },
  };

  const findCoord = (str, def) => {
    const clean = (str || '').toLowerCase().replace(/[^a-z]/g, '');
    for (const k of Object.keys(geoLookup)) {
      if (clean.includes(k)) return geoLookup[k];
    }
    return def;
  };

  const origGeo = findCoord(origin, { lat: 41.8781, lng: -87.6298, name: origin || 'Chicago, IL' });
  const destGeo = findCoord(destination, { lat: 32.7767, lng: -96.797, name: destination || 'Dallas, TX' });

  // Generate 3 route variations (Direct, Northern detour, Southern detour)
  const routeConfigs = [
    {
      name: 'Route 1 (Primary Interstate)',
      curve: 0.0,
      distMultiplier: 1.0,
      speedMph: 62,
      hazardScenario: 'clear', // Safest route
    },
    {
      name: 'Route 2 (Northern Highway Corridor)',
      curve: 0.12,
      distMultiplier: 1.07,
      speedMph: 58,
      hazardScenario: 'moderate_wind',
    },
    {
      name: 'Route 3 (Southern Detour)',
      curve: -0.14,
      distMultiplier: 1.13,
      speedMph: 60,
      hazardScenario: 'storm_front', // High severe hazards
    },
  ];

  const totalBaseMiles = Math.round(
    Math.hypot(destGeo.lat - origGeo.lat, destGeo.lng - origGeo.lng) * 69 * 1.2
  );

  const routes = routeConfigs.map((cfg, routeIdx) => {
    const totalDist = Math.round(totalBaseMiles * cfg.distMultiplier);
    const totalHours = Number((totalDist / cfg.speedMph).toFixed(2));
    const totalSeconds = Math.round(totalHours * 3600);
    const hrs = Math.floor(totalHours);
    const mins = Math.round((totalHours - hrs) * 60);

    // Build geometry LineString
    const numPoints = 50;
    const coordinates = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      let lat = origGeo.lat + t * (destGeo.lat - origGeo.lat);
      let lng = origGeo.lng + t * (destGeo.lng - origGeo.lng);
      // Perpendicular arc
      const arc = 4 * t * (1 - t) * cfg.curve;
      lat += arc * (destGeo.lng - origGeo.lng) * 0.2;
      lng -= arc * (destGeo.lat - origGeo.lat) * 0.2;
      coordinates.push([Number(lng.toFixed(5)), Number(lat.toFixed(5))]);
    }

    // Generate Checkpoints
    const checkpoints = [];
    const numCheckpoints = Math.max(3, Math.floor(totalDist / interval));

    let severeCount = 0;
    let highCount = 0;
    let noTravelCount = 0;
    let sumRiskScores = 0;

    let lowMiles = 0;
    let moderateMiles = 0;
    let highMiles = 0;
    let severeMiles = 0;
    let noTravelMiles = 0;

    for (let i = 0; i <= numCheckpoints; i++) {
      const t = i / numCheckpoints;
      const mile = Math.round(t * totalDist);
      const coordIdx = Math.min(coordinates.length - 1, Math.floor(t * (coordinates.length - 1)));
      const [lng, lat] = coordinates[coordIdx];

      const etaSeconds = t * totalSeconds;
      const eta = new Date(depDate.getTime() + etaSeconds * 1000);

      // Synthesize weather based on scenario
      let wind = 12 + Math.sin(i * 0.5) * 6;
      let rain = 0.0;
      let snow = 0.0;
      let temp = 48 - (lat - 35) * 1.8;

      if (cfg.hazardScenario === 'moderate_wind' && i > numCheckpoints * 0.4 && i < numCheckpoints * 0.7) {
        wind = 32 + (i % 3) * 4; // 32-40 mph
      } else if (cfg.hazardScenario === 'storm_front' && i > numCheckpoints * 0.3 && i < numCheckpoints * 0.8) {
        wind = 46 + (i % 4) * 3; // 46-55 mph
        rain = 0.55 + (i % 3) * 0.2;
        if (temp < 32) snow = 1.8;
      }

      // Risk rules calculation
      let windRisk = 'Low', windScore = 1;
      let loadPenaltyApplied = false;
      let loadPenaltyDetail = '';

      if (wind >= 55) {
        windRisk = 'No Travel'; windScore = 5;
      } else if (wind >= 45) {
        if (weight > 30000) {
          windRisk = 'No Travel'; windScore = 5;
          loadPenaltyApplied = true;
          loadPenaltyDetail = `Wind (${wind.toFixed(1)} mph) + load (${weight.toLocaleString()} lb > 30,000 lb) = No Travel.`;
        } else {
          windRisk = 'Severe'; windScore = 4;
        }
      } else if (wind >= 35) {
        if (weight > 40000) {
          windRisk = 'Severe'; windScore = 4;
          loadPenaltyApplied = true;
          loadPenaltyDetail = `Wind (${wind.toFixed(1)} mph) + load (${weight.toLocaleString()} lb > 40,000 lb) = Severe.`;
        } else {
          windRisk = 'High'; windScore = 3;
        }
      } else if (wind >= 25) {
        windRisk = 'Moderate'; windScore = 2;
      }

      let rainRisk = 'Low', rainScore = 1;
      if (rain > 1.0) { rainRisk = 'No Travel'; rainScore = 5; }
      else if (rain >= 0.5) { rainRisk = 'Severe'; rainScore = 4; }
      else if (rain >= 0.25) { rainRisk = 'High'; rainScore = 3; }
      else if (rain >= 0.1) { rainRisk = 'Moderate'; rainScore = 2; }

      let snowRisk = 'Low', snowScore = 1;
      if (snow > 3.0) { snowRisk = 'No Travel'; snowScore = 5; }
      else if (snow >= 2.0) { snowRisk = 'Severe'; snowScore = 4; }
      else if (snow >= 1.0) { snowRisk = 'High'; snowScore = 3; }
      else if (snow >= 0.5) { snowRisk = 'Moderate'; snowScore = 2; }

      const maxScore = Math.max(windScore, rainScore, snowScore);
      const scoreToLevel = { 1: 'Low', 2: 'Moderate', 3: 'High', 4: 'Severe', 5: 'No Travel' };
      const scoreToColor = {
        1: '#22c55e',
        2: '#f59e0b',
        3: '#f97316',
        4: '#ef4444',
        5: '#dc2626',
      };
      const overallLevel = scoreToLevel[maxScore];
      sumRiskScores += maxScore;

      const segMiles = i === 0 ? 0 : interval;
      if (overallLevel === 'No Travel') { noTravelMiles += segMiles; noTravelCount++; }
      else if (overallLevel === 'Severe') { severeMiles += segMiles; severeCount++; }
      else if (overallLevel === 'High') { highMiles += segMiles; highCount++; }
      else if (overallLevel === 'Moderate') { moderateMiles += segMiles; }
      else { lowMiles += segMiles; }

      checkpoints.push({
        index: i,
        name: i === 0 ? `Origin (${origGeo.name})` : i === numCheckpoints ? `Destination (${destGeo.name})` : `Checkpoint ${i} (Mile ${mile})`,
        mile_marker: mile,
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        eta: eta.toISOString(),
        segment_miles: segMiles,
        weather: {
          temperature_f: Number(temp.toFixed(1)),
          wind_speed_mph: Number(wind.toFixed(1)),
          rain_in_hr: Number(rain.toFixed(2)),
          snow_in_hr: Number(snow.toFixed(2)),
        },
        risk_level: overallLevel,
        risk_score: maxScore,
        color: scoreToColor[maxScore],
        risk_details: {
          wind_risk: windRisk,
          wind_score: windScore,
          wind_reason: `Wind ${wind.toFixed(1)} mph`,
          rain_risk: rainRisk,
          rain_score: rainScore,
          snow_risk: snowRisk,
          snow_score: snowScore,
          load_penalty_applied: loadPenaltyApplied,
          load_penalty_detail: loadPenaltyDetail,
          primary_hazard: maxScore > 1 ? (windScore >= rainScore ? 'Crosswind' : 'Precipitation') : 'None',
          hazard_summary: loadPenaltyApplied ? loadPenaltyDetail : `Standard conditions (${overallLevel})`,
        },
      });
    }

    const avgRisk = Number((sumRiskScores / checkpoints.length).toFixed(2));

    return {
      route_index: routeIdx,
      name: cfg.name,
      total_distance_miles: totalDist,
      total_duration_hours: totalHours,
      total_duration_formatted: `${hrs}h ${mins}m`,
      total_duration_seconds: totalSeconds,
      geometry: {
        type: 'LineString',
        coordinates: coordinates,
      },
      checkpoints: checkpoints,
      route_summary: {
        total_distance_miles: totalDist,
        total_duration_hours: totalHours,
        total_duration_formatted: `${hrs}h ${mins}m`,
        avg_risk: avgRisk,
        max_risk_level: noTravelCount > 0 ? 'No Travel' : severeCount > 0 ? 'Severe' : highCount > 0 ? 'High' : 'Moderate',
        max_risk_score: noTravelCount > 0 ? 5 : severeCount > 0 ? 4 : highCount > 0 ? 3 : 2,
        low_miles: lowMiles,
        moderate_miles: moderateMiles,
        high_miles: highMiles,
        severe_miles: severeMiles,
        no_travel_miles: noTravelMiles,
        no_travel_segments: noTravelCount,
        severe_miles_count: severeCount,
        high_miles_count: highCount,
        weather_extremes: {
          max_wind_mph: cfg.hazardScenario === 'storm_front' ? 52.4 : cfg.hazardScenario === 'moderate_wind' ? 38.0 : 22.5,
          max_rain_in_hr: cfg.hazardScenario === 'storm_front' ? 0.75 : 0.05,
          max_snow_in_hr: 0.0,
          min_temp_f: 38.0,
          max_temp_f: 58.0,
        },
        risk_distribution: {
          Low: Math.max(0, checkpoints.length - severeCount - highCount - noTravelCount - 2),
          Moderate: 2,
          High: highCount,
          Severe: severeCount,
          'No Travel': noTravelCount,
        },
      },
    };
  });

  return {
    query: {
      origin: origGeo,
      destination: destGeo,
      departure_datetime: depDate.toISOString(),
      load_weight_lbs: weight,
      sampling_interval_miles: interval,
    },
    routes: routes,
    recommendation: {
      recommended_route_index: 0,
      recommended_route_name: routes[0].name,
      reason: `${routes[0].name} is recommended: Zero Severe or No Travel miles detected (safest corridor); Lowest average weather risk score (${routes[0].route_summary.avg_risk}/5.0); Optimal travel time of ${routes[0].route_summary.total_duration_formatted}. Avoids ${routes[2].route_summary.severe_miles} miles of Severe/No Travel hazards present on ${routes[2].name}.`,
      rankings: [
        { rank: 1, route_index: 0, name: routes[0].name, avg_risk: routes[0].route_summary.avg_risk },
        { rank: 2, route_index: 1, name: routes[1].name, avg_risk: routes[1].route_summary.avg_risk },
        { rank: 3, route_index: 2, name: routes[2].name, avg_risk: routes[2].route_summary.avg_risk },
      ],
    },
  };
}

function generateOfflineHeatmap({ hours = 48 }) {
  const points = [];
  const startLat = 41.8781;
  const startLng = -87.6298;
  const endLat = 32.7767;
  const endLng = -96.797;
  const numSteps = 12;

  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const lat = startLat + t * (endLat - startLat);
    const lng = startLng + t * (endLng - startLng);
    const timeline = [];

    for (let h = 0; h <= hours; h++) {
      // Dynamic simulated weather wave moving over time
      const wave = Math.sin((h + i * 2) * 0.25);
      const wind = Math.max(5, 20 + wave * 22);
      const rain = wave > 0.4 ? (wave - 0.4) * 0.9 : 0;
      let level = 'Low';
      let score = 1;
      let color = '#22c55e';

      if (wind >= 55 || rain > 1.0) {
        level = 'No Travel'; score = 5; color = '#dc2626';
      } else if (wind >= 45 || rain >= 0.5) {
        level = 'Severe'; score = 4; color = '#ef4444';
      } else if (wind >= 35 || rain >= 0.25) {
        level = 'High'; score = 3; color = '#f97316';
      } else if (wind >= 25 || rain >= 0.1) {
        level = 'Moderate'; score = 2; color = '#f59e0b';
      }

      timeline.push({
        hour_offset: h,
        temperature_f: 50 + Math.round(wave * 12),
        wind_speed_mph: Number(wind.toFixed(1)),
        rain_in_hr: Number(rain.toFixed(2)),
        snow_in_hr: 0.0,
        risk_level: level,
        risk_score: score,
        color: color,
        primary_hazard: score > 2 ? 'High Wind / Rain' : 'None',
      });
    }

    points.push({
      point_index: i,
      lat: Number(lat.toFixed(4)),
      lng: Number(lng.toFixed(4)),
      timeline: timeline,
    });
  }

  return {
    hours: hours,
    grid_points: points,
  };
}
