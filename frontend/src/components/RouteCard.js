import React from 'react';
import {
  Clock,
  Compass,
  Wind,
  CloudRain,
  CloudSnow,
  AlertTriangle,
  Award,
  ChevronRight,
  Gauge,
} from 'lucide-react';
import RiskBadge from './RiskBadge';
import './RouteCard.css';

/**
 * RouteCard displays a detailed route summary, risk breakdown bar chart,
 * average risk score, severe mile callouts, and recommendation glow badge.
 *
 * @param {Object} route - Route data object
 * @param {boolean} isSelected - Whether this route is currently highlighted/active
 * @param {boolean} isRecommended - Whether this route is recommended by algorithm
 * @param {Function} onSelect - Click handler
 * @param {number} rank - Algorithm ranking position (1, 2, 3)
 */
const RouteCard = ({ route, isSelected, isRecommended, onSelect, rank }) => {
  if (!route) return null;

  const {
    name,
    total_distance_miles = 0,
    total_duration_formatted = '',
    total_duration_hours = 0,
    route_summary = {},
    checkpoints = [],
  } = route;

  const summary = route_summary || {};
  const avgRisk = summary.avg_risk ?? 1.0;
  const maxRisk = summary.max_risk_level || 'Low';

  const lowMiles = summary.low_miles || 0;
  const moderateMiles = summary.moderate_miles || 0;
  const highMiles = summary.high_miles || 0;
  const severeMiles = summary.severe_miles || 0;
  const noTravelMiles = summary.no_travel_miles || 0;

  const criticalMiles = severeMiles + noTravelMiles;
  const criticalSegments = (summary.severe_miles_count || 0) + (summary.no_travel_segments || 0);

  // Compute percentage widths for the risk breakdown stacked bar
  const totalBarMiles = Math.max(1, lowMiles + moderateMiles + highMiles + severeMiles + noTravelMiles);
  const lowPct = ((lowMiles / totalBarMiles) * 100).toFixed(1);
  const modPct = ((moderateMiles / totalBarMiles) * 100).toFixed(1);
  const highPct = ((highMiles / totalBarMiles) * 100).toFixed(1);
  const severePct = ((severeMiles / totalBarMiles) * 100).toFixed(1);
  const noTravelPct = ((noTravelMiles / totalBarMiles) * 100).toFixed(1);

  // Approximate average speed
  const avgSpeed = total_duration_hours > 0
    ? Math.round(total_distance_miles / total_duration_hours)
    : 60;

  const extremes = summary.weather_extremes || {};

  return (
    <div
      className={`route-card ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect();
      }}
    >
      {/* Top Banner for Recommended Route */}
      {isRecommended && (
        <div className="recommended-ribbon">
          <Award size={14} className="ribbon-icon" />
          <span className="ribbon-text">RECOMMENDED SAFEST ROUTE</span>
          <span className="ribbon-rank">#1 SAFEST</span>
        </div>
      )}

      <div className="card-header">
        <div className="route-identity">
          <div className="route-index-chip">
            {rank ? `#${rank}` : 'ALT'}
          </div>
          <div className="route-title-wrap">
            <h3 className="route-name">{name}</h3>
            <span className="route-cps-count">{checkpoints.length} Checkpoints</span>
          </div>
        </div>

        <RiskBadge level={maxRisk} size="sm" label={`Max: ${maxRisk}`} />
      </div>

      {/* Metrics Row: Distance, Duration, Avg Speed */}
      <div className="metrics-row">
        <div className="metric-box">
          <div className="metric-label">
            <Compass size={12} />
            <span>Distance</span>
          </div>
          <div className="metric-value">{Number(total_distance_miles).toLocaleString()} mi</div>
        </div>

        <div className="metric-box">
          <div className="metric-label">
            <Clock size={12} />
            <span>Duration</span>
          </div>
          <div className="metric-value">{total_duration_formatted}</div>
        </div>

        <div className="metric-box">
          <div className="metric-label">
            <Gauge size={12} />
            <span>Avg Speed</span>
          </div>
          <div className="metric-value">{avgSpeed} mph</div>
        </div>

        <div className="metric-box score-box">
          <div className="metric-label">Avg Risk</div>
          <div className={`metric-value risk-score-val ${avgRisk > 2.5 ? 'elevated' : ''}`}>
            {avgRisk.toFixed(2)}
            <span className="score-denom">/5</span>
          </div>
        </div>
      </div>

      {/* Risk Breakdown Stacked Bar Chart */}
      <div className="risk-breakdown-section">
        <div className="breakdown-header">
          <span className="breakdown-title">Corridor Risk Exposure</span>
          <span className="breakdown-total">{total_distance_miles} mi total</span>
        </div>

        <div className="stacked-bar-container">
          {Number(lowPct) > 0 && (
            <div
              className="bar-segment bar-low"
              style={{ width: `${lowPct}%` }}
              title={`Low Risk: ${lowMiles} mi (${lowPct}%)`}
            />
          )}
          {Number(modPct) > 0 && (
            <div
              className="bar-segment bar-moderate"
              style={{ width: `${modPct}%` }}
              title={`Moderate: ${moderateMiles} mi (${modPct}%)`}
            />
          )}
          {Number(highPct) > 0 && (
            <div
              className="bar-segment bar-high"
              style={{ width: `${highPct}%` }}
              title={`High: ${highMiles} mi (${highPct}%)`}
            />
          )}
          {Number(severePct) > 0 && (
            <div
              className="bar-segment bar-severe"
              style={{ width: `${severePct}%` }}
              title={`Severe: ${severeMiles} mi (${severePct}%)`}
            />
          )}
          {Number(noTravelPct) > 0 && (
            <div
              className="bar-segment bar-no-travel"
              style={{ width: `${noTravelPct}%` }}
              title={`No Travel: ${noTravelMiles} mi (${noTravelPct}%)`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="bar-legend">
          <span className="legend-item">
            <span className="legend-dot dot-low" />
            <span className="legend-text">Low: {lowMiles}m</span>
          </span>
          <span className="legend-item">
            <span className="legend-dot dot-moderate" />
            <span className="legend-text">Mod: {moderateMiles}m</span>
          </span>
          {highMiles > 0 && (
            <span className="legend-item">
              <span className="legend-dot dot-high" />
              <span className="legend-text">High: {highMiles}m</span>
            </span>
          )}
          {severeMiles > 0 && (
            <span className="legend-item critical-legend">
              <span className="legend-dot dot-severe" />
              <span className="legend-text">Severe: {severeMiles}m</span>
            </span>
          )}
          {noTravelMiles > 0 && (
            <span className="legend-item critical-legend">
              <span className="legend-dot dot-no-travel" />
              <span className="legend-text">No Travel: {noTravelMiles}m</span>
            </span>
          )}
        </div>
      </div>

      {/* Critical Hazards Alert Callout */}
      {criticalMiles > 0 ? (
        <div className="critical-hazard-callout">
          <AlertTriangle size={14} className="callout-icon" />
          <div className="callout-text">
            <strong>{criticalMiles.toFixed(1)} miles</strong> of critical hazard conditions (
            {criticalSegments} checkpoints in Severe/No Travel)!
          </div>
        </div>
      ) : (
        <div className="safe-pass-callout">
          <span className="safe-check">✓</span>
          <span>Zero Severe or No Travel hazards along entire corridor</span>
        </div>
      )}

      {/* Weather Extremes Footer Chips */}
      <div className="card-extremes-row">
        <div className="extreme-chip" title="Maximum predicted wind speed">
          <Wind size={11} />
          <span>Max Wind: {extremes.max_wind_mph ?? 0} mph</span>
        </div>
        <div className="extreme-chip" title="Maximum predicted precipitation rate">
          <CloudRain size={11} />
          <span>Max Rain: {extremes.max_rain_in_hr ?? 0} in/h</span>
        </div>
        {extremes.max_snow_in_hr > 0 && (
          <div className="extreme-chip" title="Maximum predicted snowfall rate">
            <CloudSnow size={11} />
            <span>Max Snow: {extremes.max_snow_in_hr} in/h</span>
          </div>
        )}
      </div>

      <div className="card-action-hint">
        <span>{isSelected ? 'Currently Viewing on Map' : 'Click to View on Map'}</span>
        <ChevronRight size={14} className="hint-arrow" />
      </div>
    </div>
  );
};

export default RouteCard;
