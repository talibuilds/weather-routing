import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Award,
  Eye,
  EyeOff,
  Navigation,
} from 'lucide-react';
import CheckpointPopup from './CheckpointPopup';
import RiskBadge from './RiskBadge';
import './MapView.css';

// Fix default Leaflet icon paths in React build
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icon Helpers
const createOriginIcon = () =>
  L.divIcon({
    className: 'custom-map-icon',
    html: `
      <div class="endpoint-marker origin-marker">
        <span class="endpoint-icon">A</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });

const createDestIcon = () =>
  L.divIcon({
    className: 'custom-map-icon',
    html: `
      <div class="endpoint-marker dest-marker">
        <span class="endpoint-icon">B</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });

const createCheckpointIcon = (riskLevel) => {
  const isSevere = riskLevel === 'Severe' || riskLevel === 'No Travel';
  const colorMap = {
    'Low': '#22c55e',
    'Moderate': '#f59e0b',
    'High': '#f97316',
    'Severe': '#ef4444',
    'No Travel': '#dc2626',
  };
  const color = colorMap[riskLevel] || '#22c55e';

  return L.divIcon({
    className: 'custom-cp-icon-wrap',
    html: `
      <div class="cp-dot ${isSevere ? 'severe-pulse' : ''}" style="background-color: ${color};">
        ${isSevere ? `<span class="pulse-ring" style="border-color: ${color};"></span>` : ''}
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
};

// Component to dynamically fit bounds when routes change
const MapBoundsFitter = ({ routes, selectedRouteIndex }) => {
  const map = useMap();

  useEffect(() => {
    if (!routes || routes.length === 0) return;

    try {
      const activeRoute = routes[selectedRouteIndex] || routes[0];
      const coords = activeRoute.geometry?.coordinates || [];

      if (coords.length > 0) {
        const bounds = L.latLngBounds(coords.map((c) => [c[1], c[0]]));
        map.flyToBounds(bounds, {
          padding: [50, 50],
          duration: 1.2,
          maxZoom: 12,
        });
      }
    } catch (e) {
      console.warn('Map fit bounds warning:', e);
    }
  }, [routes, selectedRouteIndex, map]);

  return null;
};

/**
 * MapView component rendering Leaflet dark matter map, route polylines,
 * checkpoint risk pins, corridor heatmap, and floating recommendation HUD.
 */
const MapView = ({
  routes = [],
  selectedRouteIndex = 0,
  onSelectRoute,
  recommendedRouteIndex = 0,
  recommendation = {},
  heatmapData = null,
  forecastHour = 0,
  showHeatmap = true,
}) => {
  const [showCheckpoints, setShowCheckpoints] = useState(true);
  const [showAllRoutes, setShowAllRoutes] = useState(true);

  // OpenStreetMap tiles with dark CSS filter (free, no API key needed)
  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Active route
  const activeRoute = routes[selectedRouteIndex] || routes[0];
  const recommendedRoute = routes[recommendedRouteIndex] || routes[0];

  // Origin & destination endpoints
  const endpoints = useMemo(() => {
    if (!activeRoute || !activeRoute.checkpoints || activeRoute.checkpoints.length === 0) {
      return null;
    }
    const cps = activeRoute.checkpoints;
    const origin = cps[0];
    const dest = cps[cps.length - 1];
    return { origin, dest };
  }, [activeRoute]);

  // Current corridor heatmap nodes at selected forecast hour
  const currentHeatmapNodes = useMemo(() => {
    if (!showHeatmap || !heatmapData || !heatmapData.grid_points) return [];
    return heatmapData.grid_points.map((pt) => {
      const timeline = pt.timeline || [];
      const currentSnapshot =
        timeline.find((item) => item.hour_offset === forecastHour) || timeline[0] || {};
      return {
        lat: pt.lat,
        lng: pt.lng,
        mile_marker: pt.mile_marker,
        risk_level: currentSnapshot.risk_level || 'Low',
        risk_score: currentSnapshot.risk_score || 1,
        color: currentSnapshot.color || '#22c55e',
        wind: currentSnapshot.wind_speed_mph,
        rain: currentSnapshot.rain_in_hr,
        hazard: currentSnapshot.primary_hazard,
      };
    });
  }, [heatmapData, forecastHour, showHeatmap]);

  // Default center of US
  const defaultCenter = [39.8283, -98.5795];
  const defaultZoom = 4;

  return (
    <div className="map-view-wrapper">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="leaflet-container-dark"
        zoomControl={false}
      >
        <TileLayer url={tileUrl} attribution={tileAttribution} maxZoom={19} />

        {/* Bound updater hook */}
        <MapBoundsFitter routes={routes} selectedRouteIndex={selectedRouteIndex} />

        {/* Corridor Weather Heatmap Layer */}
        {showHeatmap &&
          currentHeatmapNodes.map((node, idx) => (
            <React.Fragment key={`heatmap-${idx}-${forecastHour}`}>
              {/* Outer soft glow buffer */}
              <Circle
                center={[node.lat, node.lng]}
                radius={42000} // ~26 miles
                pathOptions={{
                  fillColor: node.color,
                  fillOpacity: 0.22,
                  stroke: false,
                }}
              />
              {/* Core intensified circle */}
              <Circle
                center={[node.lat, node.lng]}
                radius={22000} // ~14 miles
                pathOptions={{
                  fillColor: node.color,
                  fillOpacity: 0.45,
                  stroke: true,
                  color: node.color,
                  weight: 1.5,
                  opacity: 0.6,
                }}
              >
                <Popup className="dark-leaflet-popup">
                  <div className="heatmap-popup">
                    <div className="heatmap-popup-header">
                      <span>Corridor Zone #{idx + 1}</span>
                      <RiskBadge level={node.risk_level} size="sm" />
                    </div>
                    <div className="heatmap-popup-body">
                      <div>Forecast Offset: <strong>+{forecastHour} hrs</strong></div>
                      <div>Wind: <strong>{node.wind} mph</strong></div>
                      <div>Precipitation: <strong>{node.rain} in/hr</strong></div>
                      <div>Hazard: <strong>{node.hazard || 'None'}</strong></div>
                    </div>
                  </div>
                </Popup>
              </Circle>
            </React.Fragment>
          ))}

        {/* Route Polylines */}
        {routes.map((r) => {
          const isSelected = r.route_index === selectedRouteIndex;
          const isRec = r.route_index === recommendedRouteIndex;
          const coords = r.geometry?.coordinates || [];
          if (coords.length === 0) return null;

          // If showAllRoutes is false, only draw selected route
          if (!showAllRoutes && !isSelected) return null;

          const latLngs = coords.map((c) => [c[1], c[0]]);

          let strokeColor = '#475569';
          let strokeWeight = 4;
          let strokeOpacity = 0.55;
          let dashArray = null;

          if (isSelected) {
            strokeColor = '#6366f1';
            strokeWeight = 6;
            strokeOpacity = 0.95;
          } else if (isRec) {
            strokeColor = '#10b981';
            strokeWeight = 4.5;
            strokeOpacity = 0.8;
            dashArray = '6, 6';
          }

          return (
            <React.Fragment key={`route-poly-${r.route_index}`}>
              {/* Glow underline for selected route */}
              {isSelected && (
                <Polyline
                  positions={latLngs}
                  pathOptions={{
                    color: '#818cf8',
                    weight: 10,
                    opacity: 0.35,
                    lineCap: 'round',
                  }}
                />
              )}
              <Polyline
                positions={latLngs}
                pathOptions={{
                  color: strokeColor,
                  weight: strokeWeight,
                  opacity: strokeOpacity,
                  dashArray: dashArray,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                eventHandlers={{
                  click: () => onSelectRoute(r.route_index),
                }}
              />
            </React.Fragment>
          );
        })}

        {/* Checkpoint Markers on the Selected Route */}
        {showCheckpoints &&
          activeRoute &&
          activeRoute.checkpoints &&
          activeRoute.checkpoints.map((cp, idx) => {
            // Skip first and last as they get Origin/Destination icons
            if (idx === 0 || idx === activeRoute.checkpoints.length - 1) return null;

            return (
              <Marker
                key={`cp-${activeRoute.route_index}-${idx}`}
                position={[cp.lat, cp.lng]}
                icon={createCheckpointIcon(cp.risk_level)}
              >
                <Popup className="dark-leaflet-popup">
                  <CheckpointPopup checkpoint={cp} />
                </Popup>
              </Marker>
            );
          })}

        {/* Origin & Destination Markers */}
        {endpoints && (
          <>
            <Marker position={[endpoints.origin.lat, endpoints.origin.lng]} icon={createOriginIcon()}>
              <Popup className="dark-leaflet-popup">
                <div className="endpoint-popup">
                  <div className="endpoint-popup-title">Trip Origin</div>
                  <div className="endpoint-popup-name">{endpoints.origin.name}</div>
                  <div className="endpoint-popup-eta">Departure: {endpoints.origin.eta}</div>
                </div>
              </Popup>
            </Marker>

            <Marker position={[endpoints.dest.lat, endpoints.dest.lng]} icon={createDestIcon()}>
              <Popup className="dark-leaflet-popup">
                <div className="endpoint-popup">
                  <div className="endpoint-popup-title">Trip Destination</div>
                  <div className="endpoint-popup-name">{endpoints.dest.name}</div>
                  <div className="endpoint-popup-eta">Estimated Arrival: {endpoints.dest.eta}</div>
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {/* Floating Recommended Route HUD Banner */}
      {recommendedRoute && recommendation.reason && (
        <div className="map-hud-recommendation">
          <div className="hud-badge-row">
            <div className="hud-rec-tag">
              <Award size={14} />
              <span>ALGORITHM RECOMMENDATION</span>
            </div>
            <RiskBadge
              level={recommendedRoute.route_summary?.max_risk_level || 'Low'}
              size="sm"
            />
          </div>

          <div className="hud-route-details">
            <span className="hud-route-title">{recommendedRoute.name}</span>
            <div className="hud-stats-row">
              <span>{recommendedRoute.total_distance_miles} miles</span>
              <span>•</span>
              <span>{recommendedRoute.total_duration_formatted}</span>
              <span>•</span>
              <span className="hud-highlight-stat">
                {recommendedRoute.route_summary?.severe_miles ?? 0} mi Severe
              </span>
            </div>
          </div>

          <p className="hud-reason">{recommendation.reason}</p>
        </div>
      )}

      {/* Map Overlay Controls (Top Left) */}
      <div className="map-layer-controls">
        <button
          className={`layer-btn ${showCheckpoints ? 'active' : ''}`}
          onClick={() => setShowCheckpoints(!showCheckpoints)}
          title="Toggle Checkpoint Markers"
        >
          {showCheckpoints ? <Eye size={13} /> : <EyeOff size={13} />}
          <span>Checkpoints</span>
        </button>

        <button
          className={`layer-btn ${showAllRoutes ? 'active' : ''}`}
          onClick={() => setShowAllRoutes(!showAllRoutes)}
          title="Toggle All 3 Routes Visibility"
        >
          <Navigation size={13} />
          <span>{showAllRoutes ? '3 Routes' : 'Active Only'}</span>
        </button>
      </div>

      {/* Map Legend (Bottom Right) */}
      <div className="map-legend-card">
        <div className="legend-title">Risk Classification</div>
        <div className="legend-items-list">
          <div className="legend-row">
            <span className="legend-sample bg-low" />
            <span>Low (&lt;25 mph wind / light rain)</span>
          </div>
          <div className="legend-row">
            <span className="legend-sample bg-moderate" />
            <span>Moderate (25-34 mph / 0.1-0.25&quot;)</span>
          </div>
          <div className="legend-row">
            <span className="legend-sample bg-high" />
            <span>High (35-44 mph / 0.25-0.50&quot;)</span>
          </div>
          <div className="legend-row">
            <span className="legend-sample bg-severe" />
            <span>Severe (45-54 mph / heavy snow)</span>
          </div>
          <div className="legend-row">
            <span className="legend-sample bg-no-travel pulsing" />
            <span className="no-travel-label">No Travel (&ge;55 mph or load limit)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
