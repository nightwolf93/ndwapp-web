import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'default', 
    size = 'md', 
    loading = false, 
    icon,
    children, 
    className = '',
    disabled,
    ...props 
  }, ref) => {
    return (
      <button
        ref={ref}
        className={`btn btn-${variant} btn-${size} ${loading ? 'btn-loading' : ''} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="btn-spinner" />
        )}
        {!loading && icon && (
          <span className="btn-icon">{icon}</span>
        )}
        {children && <span className="btn-text">{children}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
