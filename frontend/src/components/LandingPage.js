import React from 'react';
import {
  Truck,
  ShieldCheck,
  Compass,
  Wind,
  CloudRain,
  Flame,
  Sparkles,
  ArrowRight,
  Play,
  Layers,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import './LandingPage.css';

/**
 * LandingPage component:
 * Creative, modern hero & overview for Spotter Weather-Aware Truck Routing.
 * Introduces the platform, key capabilities, risk engine, and provides
 * explicit entry points to launch the console or start the guided tour.
 */
const LandingPage = ({ onLaunchApp, onStartTour, onRunDemo }) => {
  return (
    <div className="landing-container">
      {/* Background Decorative Glow Gradients */}
      <div className="landing-ambient-glow glow-1" />
      <div className="landing-ambient-glow glow-2" />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge-row">
          <span className="hero-badge">
            <span className="badge-pulse-dot" />
            Spotter Intelligent Freight Dispatch
          </span>
          <span className="hero-badge-secondary">Physics & Weather AI</span>
        </div>

        <h1 className="hero-title">
          Weather-Aware <span className="gradient-text">Truck Routing</span> & Hazard Avoidance
        </h1>

        <p className="hero-description">
          Commercial truck navigation engineered for extreme safety. We synthesize real-time highway
          routing with ETA-synchronized microclimate forecasts and trailer weight tipping physics
          to recommend the safest interstate corridor.
        </p>

        {/* Hero CTAs */}
        <div className="hero-actions-row">
          <button
            className="hero-primary-btn"
            onClick={onLaunchApp}
            id="tour-launch-btn"
          >
            <span>Launch Route Console</span>
            <ArrowRight size={18} className="btn-arrow" />
          </button>

          <button
            className="hero-tour-btn"
            onClick={onStartTour}
            id="tour-guided-btn"
          >
            <Sparkles size={16} className="btn-sparkle" />
            <span>Interactive Guided Tour</span>
          </button>

          <button
            className="hero-demo-btn"
            onClick={onRunDemo}
            title="Instant one-click demo from Chicago to Denver"
          >
            <Play size={14} />
            <span>Quick Demo: Chicago → Denver</span>
          </button>
        </div>

        {/* Live Metric Tickers */}
        <div className="hero-stats-grid">
          <div className="stat-card">
            <div className="stat-value">3 Paths</div>
            <div className="stat-label">Multi-Corridor Generation</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">10–50 mi</div>
            <div className="stat-label">Checkpoint Sampling Resolution</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">0–48 hrs</div>
            <div className="stat-label">Corridor Forecast Scrubbing</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">40,000+ lb</div>
            <div className="stat-label">Dynamic Load Tipping Rules</div>
          </div>
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section className="features-section">
        <div className="section-header">
          <span className="section-pill">Core Engineering</span>
          <h2 className="section-title">Built specifically for heavy freight safety</h2>
          <p className="section-subtitle">
            Traditional GPS calculates travel time. Spotter predicts weather hazards at the exact
            hour your truck reaches each checkpoint.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-box indigo">
              <Compass size={22} />
            </div>
            <h3 className="feature-title">Multi-Route Corridor Synthesis</h3>
            <p className="feature-text">
              Generates primary interstate and lateral waypoint detours (Northern & Southern corridors)
              via OSRM to provide distinct routing choices instead of a single path.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box emerald">
              <Zap size={22} />
            </div>
            <h3 className="feature-title">ETA-Synchronized Sampling</h3>
            <p className="feature-text">
              Calculates precise arrival timestamps for every 10, 25, or 50 miles, querying Open-Meteo
              forecast API to sample wind, rain, and snow at that exact hour.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box amber">
              <Truck size={22} />
            </div>
            <h3 className="feature-title">Load-Weight Tipping Physics</h3>
            <p className="feature-text">
              Accounts for trailer center of gravity: wind gusts over 45 mph trigger automatic No Travel
              warnings for loads over 30,000 lbs, and 35 mph triggers Severe alerts for 40,000+ lbs.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box rose">
              <Flame size={22} />
            </div>
            <h3 className="feature-title">48-Hour Forecast Heatmap</h3>
            <p className="feature-text">
              Visual radar heatmap along the corridor with an interactive timeline scrubber and
              auto-play to evaluate departing now versus delaying departure.
            </p>
          </div>
        </div>
      </section>

      {/* Safety Rules Preview Matrix */}
      <section className="safety-matrix-section">
        <div className="matrix-card">
          <div className="matrix-header">
            <div className="matrix-title-wrap">
              <ShieldCheck size={20} className="matrix-icon" />
              <h3 className="matrix-title">Hazard Severity Classification Engine</h3>
            </div>
            <span className="matrix-badge">Rule Specification</span>
          </div>

          <div className="matrix-table-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>Weather Variable</th>
                  <th>Low Risk</th>
                  <th>Moderate</th>
                  <th>High</th>
                  <th>Severe</th>
                  <th>No Travel</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="var-col">
                      <Wind size={15} /> Wind Speed
                    </span>
                  </td>
                  <td>&lt; 25 mph</td>
                  <td>25 – 34 mph</td>
                  <td>35 – 44 mph</td>
                  <td>45 – 54 mph</td>
                  <td className="danger-text">&ge; 55 mph</td>
                </tr>
                <tr>
                  <td>
                    <span className="var-col">
                      <CloudRain size={15} /> Rain Precipitation
                    </span>
                  </td>
                  <td>&lt; 0.10 in/hr</td>
                  <td>0.10 – 0.25 in/hr</td>
                  <td>0.25 – 0.50 in/hr</td>
                  <td>0.50 – 1.00 in/hr</td>
                  <td className="danger-text">&gt; 1.00 in/hr</td>
                </tr>
                <tr>
                  <td>
                    <span className="var-col">
                      <Layers size={15} /> Snowfall Rate
                    </span>
                  </td>
                  <td>&lt; 0.5 in/hr</td>
                  <td>0.5 – 1.0 in/hr</td>
                  <td>1.0 – 2.0 in/hr</td>
                  <td>2.0 – 3.0 in/hr</td>
                  <td className="danger-text">&gt; 3.0 in/hr</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="matrix-footer-notes">
            <div className="note-item">
              <CheckCircle2 size={15} className="note-icon" />
              <span>
                <strong>Multi-tier recommendation preference:</strong> 1. Fewest Severe/No Travel miles &rarr; 2. Fewest High miles &rarr; 3. Lowest avg risk score &rarr; 4. Shortest travel time.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="cta-banner">
        <div className="cta-content">
          <h2 className="cta-title">Ready to plan a weather-conscious route?</h2>
          <p className="cta-desc">
            Enter your origin, destination, cargo weight, and departure window to analyze 3 route corridors.
          </p>
          <div className="cta-btn-group">
            <button className="cta-launch-btn" onClick={onLaunchApp}>
              <span>Launch Dispatch Console</span>
              <ArrowRight size={18} />
            </button>
            <button className="cta-tour-btn" onClick={onStartTour}>
              <Sparkles size={16} />
              <span>Step-by-Step Tour</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-left">
          <Truck size={18} className="footer-logo" />
          <span>Spotter Weather-Aware Truck Routing &bull; Full Stack Production Model</span>
        </div>
        <div className="footer-right">
          <span>OSRM + Open-Meteo + React + Django</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
