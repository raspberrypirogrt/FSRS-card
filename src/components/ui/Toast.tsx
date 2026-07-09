'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { v7 as uuidv7 } from 'uuid';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = uuidv7();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => {
          let icon = 'ℹ️';
          if (toast.type === 'success') icon = '✅';
          if (toast.type === 'error') icon = '❌';
          if (toast.type === 'warning') icon = '⚠️';

          return (
            <div key={toast.id} className={`toast ${toast.type} animate-slideInRight`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span>{icon}</span>
                <span>{toast.message}</span>
              </div>
              <button 
                className="btn-icon btn-ghost" 
                style={{ width: '24px', height: '24px', fontSize: 'var(--text-xs)' }}
                onClick={() => removeToast(toast.id)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
