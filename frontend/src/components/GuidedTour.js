import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import './GuidedTour.css';

/**
 * Interactive Guided Tour
 * Positions spotlight and anchored tooltip right onto the target UI section,
 * matching real-world interactive onboarding (e.g. Shepherd / Driver.js).
 */
const TOUR_STEPS = [
  {
    targetId: 'tour-step-locations',
    tab: 'form',
    title: 'Define Origin & Destination',
    text: 'Enter your departure and arrival cities, or pick from quick presets like Chicago → Denver. Swap origin and destination with one click.',
    preferredPlacement: 'right',
  },
  {
    targetId: 'tour-step-weight',
    tab: 'form',
    title: 'Freight Weight & Tipping Limits',
    text: 'Adjust your truck cargo weight. Notice how loads over 30,000 lbs and 40,000 lbs dynamically trigger strict crosswind safety thresholds.',
    preferredPlacement: 'right',
  },
  {
    targetId: 'tour-step-sampling',
    tab: 'form',
    title: 'Checkpoint Sampling Frequency',
    text: 'Choose weather sampling every 10, 25, or 50 miles. Spotter models your arrival ETA at each checkpoint to query time-synchronized weather.',
    preferredPlacement: 'right',
  },
  {
    targetId: 'tour-step-submit',
    tab: 'form',
    title: 'Find Safest Corridor',
    text: 'Click "Find Safest Route" to synthesize 3 alternative highway paths, sample checkpoints, and rank them by the safety hierarchy.',
    preferredPlacement: 'right',
  },
  {
    targetId: 'tour-step-routes',
    tab: 'form',
    title: 'Corridor Safety Comparison',
    text: 'Review the 3 route options with color-coded risk mileage breakdown. The safest path is highlighted with the recommendation ribbon.',
    preferredPlacement: 'right',
  },
  {
    targetId: 'tour-step-timeline',
    tab: 'map',
    title: '48-Hour Corridor Heatmap',
    text: 'Scrub the timeline or hit Play to watch moving weather radar circles along the highway corridor over the next 48 hours.',
    preferredPlacement: 'top',
  },
];

const GuidedTour = ({
  currentStep = 0,
  onNext,
  onPrev,
  onClose,
  onFinishAndRun,
  onChangeTab,
}) => {
  const [targetRect, setTargetRect] = useState(null);
  const [placement, setPlacement] = useState('right');
  const [tooltipPos, setTooltipPos] = useState({ top: 100, left: 100 });
  const tooltipRef = useRef(null);

  const stepData = TOUR_STEPS[currentStep] || TOUR_STEPS[0];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  // Measure and update target position
  const updatePosition = useCallback(() => {
    if (!stepData) return;

    // Switch tab on mobile if target is in a different view tab
    if (onChangeTab && stepData.tab) {
      onChangeTab(stepData.tab);
    }

    const el = document.getElementById(stepData.targetId);
    if (!el) {
      setTargetRect(null);
      return;
    }

    // Scroll target into view
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    // Compute tooltip placement
    const tooltipEl = tooltipRef.current;
    const ttWidth = tooltipEl ? tooltipEl.offsetWidth : 340;
    const ttHeight = tooltipEl ? tooltipEl.offsetHeight : 180;
    const padding = 16;
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    let computedPlacement = stepData.preferredPlacement || 'right';
    let top = 0;
    let left = 0;

    // Mobile fallback: always place below or above target
    if (windowW < 900) {
      if (rect.bottom + ttHeight + padding < windowH) {
        computedPlacement = 'bottom';
        top = rect.bottom + 12;
        left = Math.max(padding, Math.min(windowW - ttWidth - padding, rect.left));
      } else {
        computedPlacement = 'top';
        top = Math.max(padding, rect.top - ttHeight - 12);
        left = Math.max(padding, Math.min(windowW - ttWidth - padding, rect.left));
      }
    } else {
      // Desktop placement
      if (computedPlacement === 'right') {
        left = rect.right + 16;
        top = rect.top + rect.height / 2 - ttHeight / 2;

        // If overflowing right edge, flip to bottom or left
        if (left + ttWidth > windowW - padding) {
          if (rect.left - ttWidth - 16 > padding) {
            computedPlacement = 'left';
            left = rect.left - ttWidth - 16;
          } else {
            computedPlacement = 'bottom';
            left = Math.max(padding, rect.left);
            top = rect.bottom + 14;
          }
        }
      } else if (computedPlacement === 'top') {
        top = rect.top - ttHeight - 14;
        left = rect.left + rect.width / 2 - ttWidth / 2;
        if (top < padding) {
          computedPlacement = 'bottom';
          top = rect.bottom + 14;
        }
      } else if (computedPlacement === 'bottom') {
        top = rect.bottom + 14;
        left = rect.left + rect.width / 2 - ttWidth / 2;
        if (top + ttHeight > windowH - padding) {
          computedPlacement = 'top';
          top = rect.top - ttHeight - 14;
        }
      }

      // Keep within viewport bounds
      top = Math.max(padding, Math.min(windowH - ttHeight - padding, top));
      left = Math.max(padding, Math.min(windowW - ttWidth - padding, left));
    }

    setPlacement(computedPlacement);
    setTooltipPos({ top, left });
  }, [stepData, onChangeTab]);

  useEffect(() => {
    // Small delay to allow any tab switch or scroll to finish
    const timer = setTimeout(updatePosition, 80);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  return (
    <div className="anchored-tour-root">
      {/* Target Cutout Spotlight */}
      {targetRect && (
        <div
          className="spotlight-cutout"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        >
          <span className="spotlight-pulse-border" />
        </div>
      )}

      {/* Anchored Tooltip Card */}
      <div
        ref={tooltipRef}
        className={`anchored-tooltip-card placement-${placement}`}
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        {/* Pointer Arrow */}
        <div className={`tooltip-pointer-arrow arrow-${placement}`} />

        {/* Card Content */}
        <div className="tooltip-header-row">
          <h4 className="tooltip-title">{stepData.title}</h4>
        </div>

        <p className="tooltip-text">{stepData.text}</p>

        {/* Bottom Actions Row (Matches TapTap Demo style) */}
        <div className="tooltip-bottom-bar">
          <span className="step-counter-text">
            <strong>{currentStep + 1}</strong> / {TOUR_STEPS.length}
          </span>

          <div className="tooltip-btn-group">
            <button className="tour-text-btn" onClick={onClose}>
              Skip tour
            </button>

            {!isFirst && (
              <button className="tour-back-btn" onClick={onPrev} title="Previous step">
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>
            )}

            {!isLast ? (
              <button className="tour-next-btn" onClick={onNext}>
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button className="tour-next-btn success" onClick={onFinishAndRun}>
                <Play size={14} />
                <span>Run Demo</span>
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
