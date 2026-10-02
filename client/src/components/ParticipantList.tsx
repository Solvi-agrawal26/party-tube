import React, { useState } from 'react';
import { ParticipantData, Role } from '../types';
import { getAvatarColor } from '../utils/youtube';
import { Crown, Shield, User, Eye, MoreVertical, UserMinus, ArrowRightLeft } from 'lucide-react';

interface ParticipantListProps {
  participants: ParticipantData[];
  currentUser: ParticipantData | null;
  onAssignRole: (userId: string, role: Role) => void;
  onRemoveParticipant: (userId: string) => void;
  onTransferHost: (userId: string) => void;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  currentUser,
  onAssignRole,
  onRemoveParticipant,
  onTransferHost,
}) => {
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  const isHost = currentUser?.role === 'HOST';

  const renderRoleBadge = (role: Role) => {
    switch (role) {
      case 'HOST':
        return (
          <span className="badge badge-host">
            <Crown size={12} /> Host
          </span>
        );
      case 'MODERATOR':
        return (
          <span className="badge badge-moderator">
            <Shield size={12} /> Mod
          </span>
        );
      case 'VIEWER':
        return (
          <span className="badge badge-viewer">
            <Eye size={12} /> Viewer
          </span>
        );
      default:
        return (
          <span className="badge badge-participant">
            <User size={12} /> Participant
          </span>
        );
    }
  };

  return (
    <div className="participants-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
          IN THIS PARTY ({participants.length})
        </span>
      </div>

      {participants.map((p) => {
        const isSelf = currentUser?.userId === p.userId;
        const isMenuOpen = activeMenuUserId === p.userId;

        return (
          <div key={p.userId} className="participant-row" style={{ position: 'relative' }}>
            <div className="participant-info">
              <div
                className="chat-avatar"
                style={{ background: getAvatarColor(p.username) }}
              >
                {p.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f1f5f9' }}>
                    {p.username}
                  </span>
                  {isSelf && <span style={{ color: '#6366f1', fontSize: '0.75rem' }}>(You)</span>}
                </div>
                <div style={{ marginTop: '2px' }}>{renderRoleBadge(p.role)}</div>
              </div>
            </div>

            {/* Host Actions Menu */}
            {isHost && !isSelf && (
              <div style={{ position: 'relative' }}>
                <button
                  className="btn-icon"
                  onClick={() => setActiveMenuUserId(isMenuOpen ? null : p.userId)}
                  title="Manage Participant"
                >
                  <MoreVertical size={16} />
                </button>

                {isMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: '6px',
                      background: '#161b2e',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                      zIndex: 50,
                      minWidth: '190px',
                      overflow: 'hidden',
                      animation: 'fadeIn 0.15s ease-out',
                    }}
                  >
                    <div style={{ padding: '6px 12px', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      Change Role
                    </div>
                    {p.role !== 'MODERATOR' && (
                      <button
                        className="btn"
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem', background: 'transparent' }}
                        onClick={() => {
                          onAssignRole(p.userId, 'MODERATOR');
                          setActiveMenuUserId(null);
                        }}
                      >
                        <Shield size={14} color="#06b6d4" /> Promote to Moderator
                      </button>
                    )}
                    {p.role !== 'PARTICIPANT' && (
                      <button
                        className="btn"
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem', background: 'transparent' }}
                        onClick={() => {
                          onAssignRole(p.userId, 'PARTICIPANT');
                          setActiveMenuUserId(null);
                        }}
                      >
                        <User size={14} color="#10b981" /> Set as Participant
                      </button>
                    )}
                    {p.role !== 'VIEWER' && (
                      <button
                        className="btn"
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem', background: 'transparent' }}
                        onClick={() => {
                          onAssignRole(p.userId, 'VIEWER');
                          setActiveMenuUserId(null);
                        }}
                      >
                        <Eye size={14} color="#8b5cf6" /> Set as Viewer
                      </button>
                    )}

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

                    <button
                      className="btn"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem', background: 'transparent', color: '#f59e0b' }}
                      onClick={() => {
                        onTransferHost(p.userId);
                        setActiveMenuUserId(null);
                      }}
                    >
                      <ArrowRightLeft size={14} /> Transfer Host
                    </button>

                    <button
                      className="btn"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.82rem', background: 'transparent', color: '#ef4444' }}
                      onClick={() => {
                        onRemoveParticipant(p.userId);
                        setActiveMenuUserId(null);
                      }}
                    >
                      <UserMinus size={14} /> Kick Participant
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
