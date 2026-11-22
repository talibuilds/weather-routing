import React from 'react';
import {
  Sparkles,
  MapPin,
  Truck,
  Ruler,
  Layers,
  Flame,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
} from 'lucide-react';
import './GuidedTour.css';

/**
 * GuidedTour component:
 * Step-by-step interactive onboarding for first-time / guest users.
 * Explains each core control, risk calculations, and map features.
 */
const TOUR_STEPS = [
  {
    step: 1,
    icon: MapPin,
    iconColor: '#6366f1',
    badge: 'Step 1 of 5 • Route Endpoints',
    title: 'Define Origin & Destination',
    description:
      'Enter any US cities (e.g. Chicago, IL to Denver, CO) or click one of the quick scenario chips. Use the swap button to reverse directions in one click.',
    highlightHint: 'Look at the top of the sidebar under Trip Parameters.',
  },
  {
    step: 2,
    icon: Truck,
    iconColor: '#f59e0b',
    badge: 'Step 2 of 5 • Physics & Load Weight',
    title: 'Freight Weight & Blowover Limits',
    description:
      'Use the weight slider from 5,000 to 80,000 lbs. Notice how heavy loads (>30k and >40k lbs) dynamically escalate wind risk levels to prevent crosswind rollovers.',
    highlightHint: 'Slide weight above 40,000 lbs to see strict wind penalties engage.',
  },
  {
    step: 3,
    icon: Ruler,
    iconColor: '#10b981',
    badge: 'Step 3 of 5 • Checkpoint Sampling',
    title: 'Time-Synchronized Weather Sampling',
    description:
      'Choose sampling frequency every 10, 25, or 50 miles. Spotter calculates your truck’s arrival ETA at each checkpoint and queries Open-Meteo for microclimate conditions at that exact hour.',
    highlightHint: '25 miles is recommended for interstate logistics runs.',
  },
  {
    step: 4,
    icon: Layers,
    iconColor: '#818cf8',
    badge: 'Step 4 of 5 • Route Comparison',
    title: '3 Corridors & Safety Recommendation',
    description:
      'Click "Find Safest Route" to generate 3 options. The algorithm evaluates mileage exposed to Severe or No Travel weather and recommends the safest path with detailed justifications.',
    highlightHint: 'Click on any Route Card to view its checkpoints on the map.',
  },
  {
    step: 5,
    icon: Flame,
    iconColor: '#ef4444',
    badge: 'Step 5 of 5 • Forecast Heatmap',
    title: '0–48 Hour Corridor Radar Heatmap',
    description:
      'Use the bottom timeline slider or press Play to animate weather movement across the next 48 hours. See whether departing in 3 hours avoids approaching storm fronts.',
    highlightHint: 'Click on any radar circle on the map to inspect weather variables.',
  },
];

const GuidedTour = ({
  currentStep = 0,
  onNext,
  onPrev,
  onClose,
  onFinishAndRun,
}) => {
  const current = TOUR_STEPS[currentStep] || TOUR_STEPS[0];
  const IconComponent = current.icon;
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <div className="tour-overlay">
      <div className="tour-modal">
        {/* Header */}
        <div className="tour-modal-header">
          <div className="tour-badge-row">
            <span className="tour-step-badge">{current.badge}</span>
          </div>
          <button className="tour-close-btn" onClick={onClose} title="Skip Tour">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="tour-modal-body">
          <div
            className="tour-icon-wrap"
            style={{ backgroundColor: `${current.iconColor}22`, color: current.iconColor }}
          >
            <IconComponent size={26} />
          </div>

          <h3 className="tour-title">{current.title}</h3>
          <p className="tour-desc">{current.description}</p>

          <div className="tour-hint-box">
            <Sparkles size={14} className="hint-icon" />
            <span className="hint-text"><strong>Tip:</strong> {current.highlightHint}</span>
          </div>
        </div>

        {/* Footer with Step Dots & Controls */}
        <div className="tour-modal-footer">
          <div className="tour-dots">
            {TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`tour-dot ${idx === currentStep ? 'active' : ''}`}
              />
            ))}
          </div>

          <div className="tour-actions">
            <button
              className="tour-btn secondary"
              onClick={onPrev}
              disabled={isFirst}
            >
              <ChevronLeft size={16} />
              <span>Back</span>
            </button>

            {!isLast ? (
              <button className="tour-btn primary" onClick={onNext}>
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button className="tour-btn success" onClick={onFinishAndRun}>
                <Play size={14} />
                <span>Run Demo Route</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
export { TOUR_STEPS };
