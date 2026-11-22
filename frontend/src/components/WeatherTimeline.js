import React, { useState, useEffect, useRef } from 'react';
import { format, addHours } from 'date-fns';
import { Play, Pause, RotateCcw, Clock, Layers, Flame } from 'lucide-react';
import './WeatherTimeline.css';

/**
 * WeatherTimeline renders a 0-48hr forecast slider for the corridor weather heatmap.
 *
 * @param {number} hourOffset - currently selected forecast hour (0..48)
 * @param {Function} onChange - handler when slider value changes
 * @param {string|Date} departureTime - base departure timestamp
 * @param {boolean} showHeatmap - whether heatmap layer is visible
 * @param {Function} onToggleHeatmap - toggle heatmap visibility
 */
const WeatherTimeline = ({
  hourOffset = 0,
  onChange,
  departureTime = new Date(),
  showHeatmap = true,
  onToggleHeatmap,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef(null);

  const baseDate = departureTime ? new Date(departureTime) : new Date();
  const currentForecastDate = addHours(baseDate, hourOffset);

  const formattedTime = (() => {
    try {
      return format(currentForecastDate, 'EEE, MMM d • h:mm a');
    } catch {
      return `+${hourOffset} hours`;
    }
  })();

  // Handle Play/Pause Auto-playback of 48h timeline
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        onChange((prev) => {
          if (prev >= 48) {
            setIsPlaying(false);
            return 48;
          }
          return prev + 1;
        });
      }, 550);
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, onChange]);

  const handleStep = (delta) => {
    setIsPlaying(false);
    const nextVal = Math.max(0, Math.min(48, hourOffset + delta));
    onChange(nextVal);
  };

  const handleReset = () => {
    setIsPlaying(false);
    onChange(0);
  };

  return (
    <div className="weather-timeline-panel">
      <div className="timeline-header">
        <div className="timeline-title-wrap">
          <Flame size={16} className="timeline-fire-icon" />
          <span className="timeline-title">Trip Corridor Heatmap</span>
          <span className="timeline-range-badge">0 – 48h Forecast</span>
        </div>

        <div className="timeline-controls-right">
          <button
            className={`heatmap-toggle-btn ${showHeatmap ? 'active' : ''}`}
            onClick={onToggleHeatmap}
            title={showHeatmap ? 'Hide Corridor Heatmap' : 'Show Corridor Heatmap'}
          >
            <Layers size={14} />
            <span>{showHeatmap ? 'Heatmap ON' : 'Heatmap OFF'}</span>
          </button>
        </div>
      </div>

      <div className="timeline-scrubber-row">
        <div className="scrubber-buttons">
          <button
            className={`play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause forecast timeline' : 'Auto-play forecast timeline'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <button
            className="step-btn"
            onClick={() => handleStep(-1)}
            disabled={hourOffset <= 0}
            title="Step back 1 hour"
          >
            -1h
          </button>

          <button
            className="step-btn"
            onClick={() => handleStep(1)}
            disabled={hourOffset >= 48}
            title="Step forward 1 hour"
          >
            +1h
          </button>

          <button
            className="step-btn reset-btn"
            onClick={handleReset}
            title="Reset to departure time (T+0)"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        <div className="slider-wrapper">
          <div className="slider-track-container">
            <input
              type="range"
              min="0"
              max="48"
              step="1"
              value={hourOffset}
              onChange={(e) => {
                setIsPlaying(false);
                onChange(Number(e.target.value));
              }}
              className="timeline-range-input"
            />
            {/* Visual gradient fill of track */}
            <div
              className="slider-fill-bar"
              style={{ width: `${(hourOffset / 48) * 100}%` }}
            />
          </div>

          <div className="timeline-ticks">
            <span>T+0h</span>
            <span>+12h</span>
            <span>+24h</span>
            <span>+36h</span>
            <span>+48h</span>
          </div>
        </div>

        <div className="timeline-timestamp-box">
          <div className="offset-display">
            <span className="offset-number">+{hourOffset}</span>
            <span className="offset-unit">hrs</span>
          </div>
          <div className="full-timestamp">
            <Clock size={11} />
            <span>{formattedTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherTimeline;
