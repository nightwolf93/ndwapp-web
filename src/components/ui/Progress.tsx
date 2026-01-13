import type { HTMLAttributes } from 'react';
import './Progress.css';

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Progress({ 
  value, 
  max = 100, 
  showValue = false,
  size = 'md',
  className = '', 
  ...props 
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  return (
    <div className={`progress-container ${showValue ? 'progress-with-value' : ''} ${className}`} {...props}>
      <div className={`progress progress-${size}`}>
        <div 
          className="progress-bar"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showValue && (
        <span className="progress-value">{Math.round(percentage)}%</span>
      )}
    </div>
  );
}
