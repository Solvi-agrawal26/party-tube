import React, { useState } from 'react';
import { ParticipantData, Role, RoomDetailsPayload, RoomType } from '../types';
import { getAvatarColor } from '../utils/youtube';
import {
  Crown,
  Shield,
  User,
  Eye,
  Copy,
  Check,
  Share2,
  LogOut,
  Bell,
  Globe,
  Lock,
  Settings,
  X,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  roomId: string;
  currentUser: ParticipantData | null;
  roomDetails: RoomDetailsPayload | null;
  pendingRequestsCount: number;
  onOpenRequests: () => void;
  onLeaveRoom: () => void;
  onUpdateRoomDetails?: (details: {
    name?: string;
    description?: string;
    category?: string;
    roomType?: RoomType;
  }) => void;
  onToast: (toast: { type: 'success' | 'info' | 'warning'; title: string; description?: string }) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomId,
  currentUser,
  roomDetails,
  pendingRequestsCount,
  onOpenRequests,
  onLeaveRoom,
  onUpdateRoomDetails,
  onToast,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Settings form local state
  const isPublic = roomDetails?.roomType === 'public';
  const [editName, setEditName] = useState(roomDetails?.name || 'Watch Party');
  const [editDesc, setEditDesc] = useState(roomDetails?.description || '');
  const [editCategory, setEditCategory] = useState(roomDetails?.category || 'General');
  const [editType, setEditType] = useState<RoomType>(roomDetails?.roomType || 'private');

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    onToast({ type: 'success', title: 'Room Code Copied!', description: roomId });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    onToast({
      type: 'success',
      title: isPublic ? 'Channel Link Copied!' : 'Private Invite Link Copied!',
      description: url,
    });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenSettings = () => {
    if (roomDetails) {
      setEditName(roomDetails.name);
      setEditDesc(roomDetails.description);
      setEditCategory(roomDetails.category);
      setEditType(roomDetails.roomType);
    }
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      onToast({ type: 'warning', title: 'Name Required', description: 'Please provide a channel title.' });
      return;
    }
    if (onUpdateRoomDetails) {
      onUpdateRoomDetails({
        name: editName.trim(),
        description: editDesc.trim(),
        category: editCategory,
        roomType: editType,
      });
      onToast({
        type: 'success',
        title: 'Channel Settings Updated',
        description: `Visibility: ${editType.toUpperCase()} | Name: ${editName}`,
      });
    }
    setIsSettingsOpen(false);
  };

  const renderRoleBadge = (role?: Role) => {
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

  const isHost = currentUser?.role === 'HOST';
  const isHostOrMod = currentUser?.role === 'HOST' || currentUser?.role === 'MODERATOR';

  return (
    <header className="navbar">
      <div className="nav-brand" onClick={onLeaveRoom} title="Return to Community Lobby" style={{ cursor: 'pointer' }}>
        <span style={{ fontSize: '1.4rem' }}>🍿</span>
        <span>PartyTube</span>
      </div>

      <div className="nav-center">
        {/* Public vs Private channel pill indicator */}
        <div className={`channel-visibility-pill ${isPublic ? 'visibility-public' : 'visibility-private'}`}>
          {isPublic ? (
            <>
              <Globe size={13} />
              <span>Public Community</span>
              {roomDetails?.category && <span className="cat-chip">{roomDetails.category}</span>}
            </>
          ) : (
            <>
              <Lock size={13} />
              <span>Private Room</span>
            </>
          )}
        </div>

        {/* Room Code Button */}
        <button
          className="room-code-pill"
          onClick={copyRoomCode}
          title="Click to copy room code"
        >
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>CODE:</span>
          <strong>{roomId}</strong>
          {copiedCode ? <Check size={14} color="#10b981" /> : <Copy size={14} color="#94a3b8" />}
        </button>

        {/* Share Link Button */}
        <button
          className="btn btn-secondary"
          onClick={copyShareLink}
          style={{ padding: '7px 12px', fontSize: '0.82rem' }}
          title={isPublic ? 'Share public channel link' : 'Share private invite link with friends'}
        >
          <Share2 size={14} />
          <span>{copiedLink ? 'Copied!' : 'Share Link'}</span>
        </button>

        {/* Host Settings */}
        {isHost && onUpdateRoomDetails && (
          <button
            className="btn btn-secondary"
            onClick={handleOpenSettings}
            style={{ padding: '7px 12px', fontSize: '0.82rem' }}
            title="Channel Settings & Privacy"
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>
        )}
      </div>

      <div className="nav-right">
        {isHostOrMod && (
          <button
            className="btn btn-secondary"
            onClick={onOpenRequests}
            style={{
              padding: '7px 12px',
              fontSize: '0.82rem',
              position: 'relative',
              borderColor: pendingRequestsCount > 0 ? '#f59e0b' : undefined,
            }}
          >
            <Bell size={14} color={pendingRequestsCount > 0 ? '#f59e0b' : '#94a3b8'} />
            <span>Requests</span>
            {pendingRequestsCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '9999px',
                  padding: '1px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  marginLeft: '4px',
                }}
              >
                {pendingRequestsCount}
              </span>
            )}
          </button>
        )}

        {currentUser && (
          <div style={{ display: 'flex', alignContent: 'center', alignItems: 'center', gap: '8px' }}>
            <div
              className="chat-avatar"
              style={{
                background: getAvatarColor(currentUser.username),
                width: '32px',
                height: '32px',
              }}
            >
              {currentUser.username.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{currentUser.username}</span>
            {renderRoleBadge(currentUser.role)}
          </div>
        )}

        <button
          className="btn btn-danger"
          onClick={onLeaveRoom}
          style={{ padding: '7px 12px', fontSize: '0.82rem' }}
          title="Leave Watch Party"
        >
          <LogOut size={14} />
          <span>Leave</span>
        </button>
      </div>

      {/* Host Channel Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Settings size={18} color="#6366f1" />
                <span>Channel Settings</span>
              </h2>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label">Channel Visibility</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className={`privacy-selector-card ${editType === 'public' ? 'active' : ''}`}
                    onClick={() => setEditType('public')}
                  >
                    <Globe size={18} color="#10b981" />
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ fontSize: '0.9rem', display: 'block' }}>Public</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Listed in Community Lobby
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`privacy-selector-card ${editType === 'private' ? 'active' : ''}`}
                    onClick={() => setEditType('private')}
                  >
                    <Lock size={18} color="#f59e0b" />
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ fontSize: '0.9rem', display: 'block' }}>Private</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Only people with code can join
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="input-label">Channel Title</label>
                <input
                  type="text"
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={50}
                  required
                />
              </div>

              <div>
                <label className="input-label">Category</label>
                <select
                  className="input"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  <option value="Study & Lofi">☕ Study & Lofi</option>
                  <option value="Music">🎵 Music & Beats</option>
                  <option value="Cinema">🎬 Cinema & Trailers</option>
                  <option value="Gaming">🎮 Gaming & Esports</option>
                  <option value="Tech">💻 Tech & Coding</option>
                  <option value="General">🌐 General Hangout</option>
                </select>
              </div>

              <div>
                <label className="input-label">Description</label>
                <textarea
                  className="input"
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  maxLength={180}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsSettingsOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  <Sparkles size={16} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
