import type { InputHTMLAttributes } from 'react';
import './Switch.css';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export function Switch({ 
  label, 
  description,
  className = '', 
  id,
  ...props 
}: SwitchProps) {
  const inputId = id || `switch-${Math.random().toString(36).slice(2)}`;
  
  return (
    <div className={`switch-container ${className}`}>
      {(label || description) && (
        <div className="switch-info">
          {label && <label htmlFor={inputId} className="switch-label">{label}</label>}
          {description && <span className="switch-description">{description}</span>}
        </div>
      )}
      <label className="switch">
        <input type="checkbox" id={inputId} {...props} />
        <span className="switch-track">
          <span className="switch-thumb" />
        </span>
      </label>
    </div>
  );
}
