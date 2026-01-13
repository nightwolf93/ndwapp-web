import type { HTMLAttributes, ReactNode } from 'react';
import './Badge.css';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
  size?: 'sm' | 'md';
  dot?: boolean;
  children: ReactNode;
}

export function Badge({ 
  variant = 'default', 
  size = 'md',
  dot = false,
  className = '', 
  children, 
  ...props 
}: BadgeProps) {
  return (
    <span className={`badge badge-${variant} badge-${size} ${className}`} {...props}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
