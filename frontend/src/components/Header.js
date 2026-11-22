import React, { useState } from 'react';
import { Truck, ShieldCheck, Info, X, Wind, CloudRain, CloudSnow } from 'lucide-react';
import './Header.css';

const Header = ({ backendOnline = true }) => {
  const [showRulesModal, setShowRulesModal] = useState(false);

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-logo-glow">
          <Truck className="brand-icon" size={24} />
        </div>
        <div className="brand-text">
          <div className="brand-title-row">
            <h1 className="brand-title">SPOTTER</h1>
            <span className="brand-tag">WEATHER ROUTING</span>
          </div>
          <p className="brand-subtitle">Intelligent Hazard-Aware Fleet Optimization</p>
        </div>
      </div>

      <div className="header-actions">
        <div className="status-indicator">
          <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
          <span className="status-text">
            {backendOnline ? 'API Connected' : 'Demo Mode (Offline)'}
          </span>
        </div>

        <button
          className="rules-modal-btn"
          onClick={() => setShowRulesModal(true)}
          title="View Weather & Load Safety Rules"
        >
          <Info size={16} />
          <span>Safety Rules</span>
        </button>
      </div>

      {showRulesModal && (
        <div className="modal-overlay" onClick={() => setShowRulesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <ShieldCheck size={20} className="modal-title-icon" />
                <h3>Safety Rules & Load Limits</h3>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowRulesModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <section className="rules-section">
                <h4>Weather Risk Thresholds</h4>
                <div className="rules-table-container">
                  <table className="rules-table">
                    <thead>
                      <tr>
                        <th>Condition</th>
                        <th>Low</th>
                        <th>Moderate</th>
                        <th>High</th>
                        <th>Severe</th>
                        <th>No Travel</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <span className="table-condition-col">
                            <Wind size={14} /> Wind
                          </span>
                        </td>
                        <td>&lt; 25 mph</td>
                        <td>25 - 34</td>
                        <td>35 - 44</td>
                        <td>45 - 54</td>
                        <td className="danger-cell">&ge; 55 mph</td>
                      </tr>
                      <tr>
                        <td>
                          <span className="table-condition-col">
                            <CloudRain size={14} /> Rain
                          </span>
                        </td>
                        <td>&lt; 0.10 in/hr</td>
                        <td>0.10 - 0.25</td>
                        <td>0.25 - 0.50</td>
                        <td>0.50 - 1.00</td>
                        <td className="danger-cell">&gt; 1.00 in/hr</td>
                      </tr>
                      <tr>
                        <td>
                          <span className="table-condition-col">
                            <CloudSnow size={14} /> Snow
                          </span>
                        </td>
                        <td>&lt; 0.5 in/hr</td>
                        <td>0.5 - 1.0</td>
                        <td>1.0 - 2.0</td>
                        <td>2.0 - 3.0</td>
                        <td className="danger-cell">&gt; 3.0 in/hr</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rules-section">
                <h4>Load-Weight Safety Rules</h4>
                <div className="load-rules-grid">
                  <div className="load-rule-card critical">
                    <span className="rule-badge red">&ge; 55 mph</span>
                    <p className="rule-desc">
                      <strong>No Travel</strong> regardless of load weight (critical tipping & blowover hazard).
                    </p>
                  </div>
                  <div className="load-rule-card critical">
                    <span className="rule-badge red">45 - 54 mph + &gt; 30,000 lb</span>
                    <p className="rule-desc">
                      Elevated to <strong>No Travel</strong> due to elevated wind profile risk.
                    </p>
                  </div>
                  <div className="load-rule-card severe">
                    <span className="rule-badge orange">35 - 44 mph + &gt; 40,000 lb</span>
                    <p className="rule-desc">
                      Elevated to <strong>Severe</strong> hazard risk for heavy freight configurations.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rules-section">
                <h4>Route Recommendation Hierarchy</h4>
                <ol className="recommendation-order">
                  <li><strong>1. Fewest Severe miles</strong> (and zero No Travel miles)</li>
                  <li><strong>2. Fewest High risk miles</strong></li>
                  <li><strong>3. Lowest average risk score</strong> across corridor checkpoints</li>
                  <li><strong>4. Shortest travel time</strong> (hours/distance)</li>
                </ol>
              </section>
            </div>

            <div className="modal-footer">
              <button
                className="modal-action-btn"
                onClick={() => setShowRulesModal(false)}
              >
                Close Reference
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
