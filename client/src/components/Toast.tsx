import React from 'react';
import { ToastMessage } from '../types';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        const getIcon = () => {
          switch (toast.type) {
            case 'error':
              return <AlertCircle size={18} color="#ef4444" />;
            case 'success':
              return <CheckCircle size={18} color="#10b981" />;
            case 'warning':
              return <AlertTriangle size={18} color="#f59e0b" />;
            default:
              return <Info size={18} color="#06b6d4" />;
          }
        };

        return (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div style={{ marginTop: '2px', flexShrink: 0 }}>{getIcon()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>
                {toast.title}
              </div>
              {toast.description && (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                  {toast.description}
                </div>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
              }}
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
