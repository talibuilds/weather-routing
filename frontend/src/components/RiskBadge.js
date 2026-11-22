import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, ShieldAlert, CheckCircle } from 'lucide-react';
import './RiskBadge.css';

/**
 * RiskBadge component displaying color-coded risk levels with optional pulsing animation.
 *
 * @param {string} level - 'Low' | 'Moderate' | 'High' | 'Severe' | 'No Travel'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} showIcon - whether to render hazard icon
 * @param {string} label - optional custom text override
 */
const RiskBadge = ({ level = 'Low', size = 'md', showIcon = true, label }) => {
  const normalizedLevel = (level || 'Low').trim();

  const getRiskClass = (lvl) => {
    switch (lvl.toLowerCase()) {
      case 'low':
        return 'risk-low';
      case 'moderate':
        return 'risk-moderate';
      case 'high':
        return 'risk-high';
      case 'severe':
        return 'risk-severe';
      case 'no travel':
      case 'notravel':
        return 'risk-no-travel';
      default:
        return 'risk-low';
    }
  };

  const getIcon = (lvl) => {
    const iconSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;
    switch (lvl.toLowerCase()) {
      case 'low':
        return <CheckCircle size={iconSize} className="risk-icon" />;
      case 'moderate':
        return <ShieldCheck size={iconSize} className="risk-icon" />;
      case 'high':
        return <AlertTriangle size={iconSize} className="risk-icon" />;
      case 'severe':
        return <AlertOctagon size={iconSize} className="risk-icon" />;
      case 'no travel':
      case 'notravel':
        return <ShieldAlert size={iconSize} className="risk-icon" />;
      default:
        return <CheckCircle size={iconSize} className="risk-icon" />;
    }
  };

  const riskClass = getRiskClass(normalizedLevel);
  const displayLabel = label || normalizedLevel;

  return (
    <span className={`risk-badge ${riskClass} size-${size}`}>
      {showIcon && getIcon(normalizedLevel)}
      <span className="risk-label">{displayLabel}</span>
      {(normalizedLevel.toLowerCase() === 'severe' || normalizedLevel.toLowerCase() === 'no travel') && (
        <span className="pulse-dot" />
      )}
    </span>
  );
};

export default RiskBadge;
