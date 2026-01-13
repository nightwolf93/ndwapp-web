import { forwardRef, type InputHTMLAttributes } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`;
    
    return (
      <div className={`input-container ${error ? 'input-error' : ''} ${className}`}>
        {label && <label htmlFor={inputId} className="input-label">{label}</label>}
        <input 
          ref={ref}
          id={inputId}
          className="input"
          {...props} 
        />
        {error && <span className="input-error-message">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
