import React from 'react';
import { ActionRequest } from '../types';
import { formatTime } from '../utils/youtube';
import { Check, X, Bell, Play, Pause, FastForward, Film } from 'lucide-react';

interface PendingRequestsProps {
  isOpen: boolean;
  requests: ActionRequest[];
  onClose: () => void;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export const PendingRequestsModal: React.FC<PendingRequestsProps> = ({
  isOpen,
  requests,
  onClose,
  onApprove,
  onReject,
}) => {
  if (!isOpen) return null;

  const renderActionDetails = (req: ActionRequest) => {
    switch (req.action) {
      case 'play':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Play size={14} color="#10b981" />
            <span>Play Video</span>
          </div>
        );
      case 'pause':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Pause size={14} color="#f59e0b" />
            <span>Pause Video</span>
          </div>
        );
      case 'seek':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FastForward size={14} color="#06b6d4" />
            <span>Seek to {formatTime(req.payload?.time || 0)}</span>
          </div>
        );
      case 'change_video':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Film size={14} color="#ec4899" />
            <span>Change Video to ID: <code>{req.payload?.videoId}</code></span>
          </div>
        );
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Bell size={20} color="#f59e0b" />
            <span>Pending Participant Requests ({requests.length})</span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
              No pending requests right now.
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                    {req.username}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                    {renderActionDetails(req)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    className="btn btn-success"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    onClick={() => onApprove(req.id)}
                    title="Approve and apply to room"
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                    onClick={() => onReject(req.id)}
                    title="Reject request"
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
