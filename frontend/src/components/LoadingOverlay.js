import React from 'react';
import { Truck, CloudRain, ShieldCheck, Compass } from 'lucide-react';
import './LoadingOverlay.css';

const LoadingOverlay = ({ message = 'Calculating safest weather-aware routes...' }) => {
  return (
    <div className="loading-overlay">
      <div className="loading-card">
        <div className="radar-spinner">
          <div className="radar-circle circle-1" />
          <div className="radar-circle circle-2" />
          <div className="radar-circle circle-3" />
          <div className="radar-sweep" />
          <div className="radar-truck-center">
            <Truck size={28} className="truck-pulse" />
          </div>
        </div>

        <h3 className="loading-title">Analyzing Weather Corridors</h3>
        <p className="loading-subtitle">{message}</p>

        <div className="loading-steps">
          <div className="step-item active">
            <Compass size={14} className="step-icon" />
            <span>Finding 3 alternative routes</span>
          </div>
          <div className="step-item active">
            <CloudRain size={14} className="step-icon" />
            <span>Sampling weather along checkpoint ETAs</span>
          </div>
          <div className="step-item active">
            <ShieldCheck size={14} className="step-icon" />
            <span>Calculating truck load & wind safety risk</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
