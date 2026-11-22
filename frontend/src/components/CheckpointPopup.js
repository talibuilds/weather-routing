import React from 'react';
import { format, parseISO } from 'date-fns';
import { Wind, CloudRain, CloudSnow, Thermometer, Clock, MapPin, AlertTriangle } from 'lucide-react';
import RiskBadge from './RiskBadge';
import './CheckpointPopup.css';

/**
 * CheckpointPopup renders the contents inside a Leaflet marker popup for a checkpoint.
 *
 * @param {Object} checkpoint
 * @param {string} checkpoint.name
 * @param {number} checkpoint.mile_marker
 * @param {string} checkpoint.eta
 * @param {Object} checkpoint.weather
 * @param {string} checkpoint.risk_level
 * @param {number} checkpoint.risk_score
 * @param {Object} checkpoint.risk_details
 */
const CheckpointPopup = ({ checkpoint }) => {
  if (!checkpoint) return null;

  const { name, mile_marker, eta, weather = {}, risk_level, risk_details = {} } = checkpoint;

  const formattedEta = eta
    ? (() => {
        try {
          return format(parseISO(eta), 'EEE, MMM d • h:mm a');
        } catch {
          return eta;
        }
      })()
    : 'N/A';

  const windMph = weather.wind_speed_mph ?? 0;
  const rainIn = weather.rain_in_hr ?? 0;
  const snowIn = weather.snow_in_hr ?? 0;
  const tempF = weather.temperature_f ?? '--';

  return (
    <div className="checkpoint-popup-card">
      <div className="popup-header">
        <div className="popup-title-row">
          <MapPin size={14} className="popup-pin-icon" />
          <span className="popup-title">{name || `Mile ${mile_marker}`}</span>
        </div>
        <RiskBadge level={risk_level} size="sm" />
      </div>

      <div className="popup-meta-row">
        <span className="popup-mile-badge">Mile {mile_marker?.toFixed?.(0) ?? mile_marker}</span>
        <div className="popup-eta">
          <Clock size={12} />
          <span>{formattedEta}</span>
        </div>
      </div>

      <div className="popup-weather-grid">
        <div className={`weather-cell ${windMph >= 35 ? 'elevated' : ''}`}>
          <div className="cell-label">
            <Wind size={12} />
            <span>Wind</span>
          </div>
          <div className="cell-value">{windMph} mph</div>
          <div className="cell-sub">{risk_details.wind_risk || 'Normal'}</div>
        </div>

        <div className={`weather-cell ${rainIn >= 0.25 ? 'elevated' : ''}`}>
          <div className="cell-label">
            <CloudRain size={12} />
            <span>Rain</span>
          </div>
          <div className="cell-value">{rainIn} in/h</div>
          <div className="cell-sub">{risk_details.rain_risk || 'None'}</div>
        </div>

        <div className={`weather-cell ${snowIn >= 0.5 ? 'elevated' : ''}`}>
          <div className="cell-label">
            <CloudSnow size={12} />
            <span>Snow</span>
          </div>
          <div className="cell-value">{snowIn} in/h</div>
          <div className="cell-sub">{risk_details.snow_risk || 'None'}</div>
        </div>

        <div className="weather-cell">
          <div className="cell-label">
            <Thermometer size={12} />
            <span>Temp</span>
          </div>
          <div className="cell-value">{tempF}°F</div>
          <div className="cell-sub">Surface</div>
        </div>
      </div>

      {risk_details.load_penalty_applied && (
        <div className="popup-penalty-alert">
          <AlertTriangle size={13} className="penalty-icon" />
          <span>{risk_details.load_penalty_detail}</span>
        </div>
      )}

      {risk_details.hazard_summary && !risk_details.load_penalty_applied && (
        <div className="popup-hazard-note">
          <span>{risk_details.hazard_summary}</span>
        </div>
      )}
    </div>
  );
};

export default CheckpointPopup;
