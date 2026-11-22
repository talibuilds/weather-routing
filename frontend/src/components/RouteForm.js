import React, { useState } from 'react';
import { format, addHours } from 'date-fns';
import {
  MapPin,
  Navigation,
  ArrowUpDown,
  Calendar,
  Weight,
  Ruler,
  Truck,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import './RouteForm.css';

/**
 * RouteForm provides interactive inputs for origin, destination,
 * departure time, load weight (with slider & rules feedback), and checkpoint sampling interval.
 */
const RouteForm = ({ onSubmit, isLoading }) => {
  // Default departure: now + 1 hour formatted for datetime-local
  const getDefaultDatetime = () => {
    const nextHour = addHours(new Date(), 1);
    return format(nextHour, "yyyy-MM-dd'T'HH:mm");
  };

  const [origin, setOrigin] = useState('Chicago, IL');
  const [destination, setDestination] = useState('Denver, CO');
  const [departureDatetime, setDepartureDatetime] = useState(getDefaultDatetime);
  const [loadWeight, setLoadWeight] = useState(38000);
  const [samplingInterval, setSamplingInterval] = useState(25);

  // Quick preset test routes
  const presets = [
    { label: 'Chicago → Denver', orig: 'Chicago, IL', dest: 'Denver, CO', weight: 42000 },
    { label: 'Chicago → Dallas', orig: 'Chicago, IL', dest: 'Dallas, TX', weight: 35000 },
    { label: 'Atlanta → Phoenix', orig: 'Atlanta, GA', dest: 'Phoenix, AZ', weight: 48000 },
    { label: 'Seattle → Salt Lake', orig: 'Seattle, WA', dest: 'Salt Lake City, UT', weight: 28000 },
  ];

  const applyPreset = (preset) => {
    setOrigin(preset.orig);
    setDestination(preset.dest);
    setLoadWeight(preset.weight);
    toast.success(`Loaded preset: ${preset.label}`, {
      icon: '📍',
      style: { background: '#12121a', color: '#e2e8f0', border: '1px solid #1e1e2e' },
    });
  };

  const handleSwapLocations = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!origin.trim()) {
      toast.error('Please enter an origin location.');
      return;
    }
    if (!destination.trim()) {
      toast.error('Please enter a destination location.');
      return;
    }
    if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
      toast.error('Origin and destination cannot be identical.');
      return;
    }
    if (loadWeight < 5000 || loadWeight > 80000) {
      toast.error('Load weight must be between 5,000 and 80,000 lbs.');
      return;
    }

    // Convert local datetime-local to ISO UTC
    let isoDeparture;
    try {
      isoDeparture = new Date(departureDatetime).toISOString();
    } catch {
      isoDeparture = new Date().toISOString();
    }

    onSubmit({
      origin: origin.trim(),
      destination: destination.trim(),
      departure_datetime: isoDeparture,
      load_weight: Number(loadWeight),
      sampling_interval_miles: Number(samplingInterval),
    });
  };

  // Determine weight alert text
  const getWeightStatusNote = () => {
    if (loadWeight > 40000) {
      return {
        text: 'Heavy Load (>40k lb): 35-44 mph wind elevated to Severe; ≥45 mph is No Travel.',
        severity: 'high',
      };
    } else if (loadWeight > 30000) {
      return {
        text: 'Standard Heavy (>30k lb): 45-54 mph wind elevated to No Travel.',
        severity: 'medium',
      };
    } else {
      return {
        text: 'Light Load (≤30k lb): Standard wind thresholds apply.',
        severity: 'low',
      };
    }
  };

  const weightStatus = getWeightStatusNote();

  return (
    <div className="route-form-container">
      <div className="form-card-header">
        <div className="form-title-group">
          <Truck size={18} className="form-header-icon" />
          <h2 className="form-title">Trip & Freight Parameters</h2>
        </div>
        <span className="form-badge">Interactive Routing</span>
      </div>

      {/* Preset pills */}
      <div className="presets-bar">
        <span className="presets-label">Quick Scenarios:</span>
        <div className="preset-buttons">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="preset-chip"
              onClick={() => applyPreset(p)}
              disabled={isLoading}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="route-form">
        {/* Origin & Destination with Swap button */}
        <div className="locations-wrapper" id="tour-step-locations">
          <div className="form-field">
            <label className="field-label" htmlFor="origin-input">
              <span className="label-icon-wrap origin-dot">
                <MapPin size={13} />
              </span>
              Origin
            </label>
            <div className="input-with-icon">
              <input
                id="origin-input"
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g., Chicago, IL"
                required
                disabled={isLoading}
                className="text-input"
              />
            </div>
          </div>

          <div className="swap-btn-container">
            <button
              type="button"
              className="swap-btn"
              onClick={handleSwapLocations}
              disabled={isLoading}
              title="Swap origin and destination"
            >
              <ArrowUpDown size={14} />
            </button>
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor="dest-input">
              <span className="label-icon-wrap dest-dot">
                <Navigation size={13} />
              </span>
              Destination
            </label>
            <div className="input-with-icon">
              <input
                id="dest-input"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Dallas, TX"
                required
                disabled={isLoading}
                className="text-input"
              />
            </div>
          </div>
        </div>

        {/* Departure Datetime */}
        <div className="form-field">
          <label className="field-label" htmlFor="departure-input">
            <Calendar size={14} className="field-icon" />
            Departure Date & Time
          </label>
          <input
            id="departure-input"
            type="datetime-local"
            value={departureDatetime}
            onChange={(e) => setDepartureDatetime(e.target.value)}
            required
            disabled={isLoading}
            className="text-input datetime-input"
          />
        </div>

        {/* Load Weight Slider */}
        <div className="form-field" id="tour-step-weight">
          <div className="field-header-row">
            <label className="field-label" htmlFor="load-weight-input">
              <Weight size={14} className="field-icon" />
              Load Weight (lbs)
            </label>
            <div className="weight-display-badge">
              {Number(loadWeight).toLocaleString()} lbs
            </div>
          </div>

          <div className="slider-container">
            <input
              id="load-weight-input"
              type="range"
              min="5000"
              max="80000"
              step="500"
              value={loadWeight}
              onChange={(e) => setLoadWeight(Number(e.target.value))}
              disabled={isLoading}
              className="weight-slider"
            />
            <div className="slider-limits">
              <span>5,000 lbs (Empty)</span>
              <span className="limit-mark mark-30k">30k</span>
              <span className="limit-mark mark-40k">40k</span>
              <span>80,000 lbs (Max)</span>
            </div>
          </div>

          <div className={`weight-rule-tip tip-${weightStatus.severity}`}>
            <AlertCircle size={13} className="rule-tip-icon" />
            <span>{weightStatus.text}</span>
          </div>
        </div>

        {/* Sampling Interval Selector */}
        <div className="form-field" id="tour-step-sampling">
          <label className="field-label">
            <Ruler size={14} className="field-icon" />
            Checkpoint Sampling Frequency
          </label>
          <div className="sampling-segmented-control">
            {[10, 25, 50].map((val) => (
              <button
                key={val}
                type="button"
                className={`segment-btn ${samplingInterval === val ? 'active' : ''}`}
                onClick={() => setSamplingInterval(val)}
                disabled={isLoading}
              >
                <span className="segment-miles">{val} miles</span>
                <span className="segment-density">
                  {val === 10 ? 'High Detail' : val === 25 ? 'Recommended' : 'Fast'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          id="tour-step-submit"
          type="submit"
          disabled={isLoading}
          className={`submit-route-btn ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? (
            <span className="btn-content">
              <span className="spinner-dot" />
              Analyzing Corridors...
            </span>
          ) : (
            <span className="btn-content">
              <Sparkles size={16} />
              Find Safest Route
            </span>
          )}
        </button>
      </form>
    </div>
  );
};

export default RouteForm;
