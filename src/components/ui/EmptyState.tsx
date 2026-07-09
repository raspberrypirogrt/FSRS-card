'use client';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, actionLabel, onAction, children }: EmptyStateProps) {
  return (
    <div className="empty-state animate-fadeIn">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      
      {(actionLabel && onAction) && (
        <button 
          className="btn btn-primary" 
          onClick={onAction}
          style={{ marginTop: 'var(--space-lg)' }}
        >
          {actionLabel}
        </button>
      )}
      
      {children && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
