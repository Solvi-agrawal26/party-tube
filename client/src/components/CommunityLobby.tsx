import React, { useState } from 'react';
import { PublicRoomSummary } from '../types';
import { extractYouTubeVideoId } from '../utils/youtube';
import {
  Users,
  Search,
  Sparkles,
  PlusCircle,
  Play,
  Flame,
  Music,
  Coffee,
  Film,
  Gamepad2,
  Cpu,
  Globe,
  Radio,
  X,
  ArrowRight,
} from 'lucide-react';

interface CommunityLobbyProps {
  publicRooms: PublicRoomSummary[];
  username: string;
  onUpdateUsername: (name: string) => void;
  onJoinRoom: (
    roomId: string,
    options?: {
      roomType?: 'public' | 'private';
      name?: string;
      description?: string;
      category?: string;
      videoId?: string;
      username?: string;
    }
  ) => void;
  onToast: (toast: { type: 'warning' | 'info' | 'error'; title: string; description?: string }) => void;
}

const CATEGORIES = [
  { id: 'All', label: 'All Lounges', icon: Globe },
  { id: 'Study & Lofi', label: 'Study & Lofi', icon: Coffee },
  { id: 'Music', label: 'Music & Beats', icon: Music },
  { id: 'Cinema', label: 'Cinema & Movies', icon: Film },
  { id: 'Gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'Tech', label: 'Tech & Code', icon: Cpu },
];

export const CommunityLobby: React.FC<CommunityLobbyProps> = ({
  publicRooms,
  username,
  onUpdateUsername,
  onJoinRoom,
  onToast,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New room modal inputs
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState('Study & Lofi');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomVideo, setNewRoomVideo] = useState('');

  // Prompt for username if user hasn't set one when clicking join
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const [promptUsername, setPromptUsername] = useState('');

  // Filtered rooms
  const filteredRooms = publicRooms.filter((room) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      room.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      (selectedCategory === 'Study & Lofi' && room.category.toLowerCase().includes('study'));

    const matchesSearch =
      !searchQuery.trim() ||
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.category.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const handleJoinClick = (roomId: string) => {
    if (!username.trim()) {
      setPendingJoinRoomId(roomId);
      setPromptUsername(localStorage.getItem('wp_username') || '');
      return;
    }
    onJoinRoom(roomId, { roomType: 'public', username: username.trim() });
  };

  const confirmJoinWithPromptName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptUsername.trim()) {
      onToast({ type: 'warning', title: 'Display Name Required', description: 'Please enter a name to join.' });
      return;
    }
    const cleanName = promptUsername.trim();
    onUpdateUsername(cleanName);
    localStorage.setItem('wp_username', cleanName);
    if (pendingJoinRoomId) {
      onJoinRoom(pendingJoinRoomId, { roomType: 'public', username: cleanName });
      setPendingJoinRoomId(null);
    }
  };

  const handleCreatePublicRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() && !promptUsername.trim()) {
      onToast({ type: 'warning', title: 'Display Name Required', description: 'Please enter your display name.' });
      return;
    }

    const effectiveName = username.trim() || promptUsername.trim();
    if (effectiveName !== username) {
      onUpdateUsername(effectiveName);
      localStorage.setItem('wp_username', effectiveName);
    }

    if (!newRoomName.trim()) {
      onToast({ type: 'warning', title: 'Channel Title Required', description: 'Please name your public community lounge.' });
      return;
    }

    let initialVideoId = 'jfKfPfyJRdk';
    if (newRoomVideo.trim()) {
      const extracted = extractYouTubeVideoId(newRoomVideo.trim());
      if (extracted) {
        initialVideoId = extracted;
      } else {
        onToast({
          type: 'warning',
          title: 'Invalid YouTube URL',
          description: 'Using default chill video instead.',
        });
      }
    }

    const roomId = `COMMUNITY-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    onJoinRoom(roomId, {
      roomType: 'public',
      name: newRoomName.trim(),
      description: newRoomDesc.trim() || 'A community lounge open to everyone.',
      category: newRoomCategory,
      videoId: initialVideoId,
      username: effectiveName,
    });

    setIsCreateModalOpen(false);
  };

  return (
    <div className="community-lobby-container">
      {/* Hero Header */}
      <div className="community-hero">
        <div className="community-badge-pill">
          <Sparkles size={14} className="glow-icon" />
          <span>LIVE COMMUNITY LOUNGES</span>
          <span className="live-dot" />
        </div>
        <h1 className="community-title">
          Watch & Chat With The <span className="gradient-text">Community</span>
        </h1>
        <p className="community-subtitle">
          Jump straight into open public watch rooms without invitation codes, vibe to 24/7 study beats, discuss films,
          or create your own community channel for anyone to join!
        </p>

        {/* Action Header bar: Search, Active count, and Create button */}
        <div className="community-header-actions">
          <div className="community-search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search community lounges by name, category, or vibe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="community-search-input"
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary create-community-btn"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <PlusCircle size={18} />
            <span>Create Public Channel</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="community-category-bar">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`category-pill ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Community Channels Grid */}
      <div className="community-grid-section">
        <div className="community-grid-header">
          <div className="grid-count">
            <Radio size={16} color="#10b981" />
            <span>
              Showing <strong>{filteredRooms.length}</strong> public {filteredRooms.length === 1 ? 'lounge' : 'lounges'}
            </span>
          </div>
          {publicRooms.length > 0 && (
            <div className="total-viewers-badge">
              <Users size={14} />
              <span>
                {publicRooms.reduce((acc, r) => acc + (r.participantsCount || 0), 0)} community members online
              </span>
            </div>
          )}
        </div>

        {filteredRooms.length === 0 ? (
          <div className="glass-panel empty-community-state">
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🪐</div>
            <h3>No public lounges found</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 20px' }}>
              {searchQuery
                ? `No channels match "${searchQuery}". Try a different search term or category.`
                : 'Be the first to launch a community lounge in this category!'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setIsCreateModalOpen(true);
              }}
            >
              <PlusCircle size={16} />
              <span>Start a New Public Lounge</span>
            </button>
          </div>
        ) : (
          <div className="community-cards-grid">
            {filteredRooms.map((room) => {
              const thumbnail = `https://img.youtube.com/vi/${room.videoId}/hqdefault.jpg`;
              const isLive = room.playState === 'PLAYING';

              return (
                <div key={room.id} className="glass-panel community-card">
                  {/* Card Thumbnail Stage */}
                  <div className="card-media-wrapper">
                    <img
                      src={thumbnail}
                      alt={room.name}
                      className="card-thumbnail"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <div className="card-media-gradient" />

                    {/* Live & Viewers Badge */}
                    <div className="card-badge-row">
                      <span className={`live-status-pill ${isLive ? 'playing' : 'paused'}`}>
                        <span className="live-status-indicator" />
                        {isLive ? 'LIVE' : 'PAUSED'}
                      </span>
                      <span className="viewer-count-pill">
                        <Users size={12} />
                        {room.participantsCount || 0} watching
                      </span>
                    </div>

                    {/* Category pill */}
                    <div className="card-category-pill">
                      <span>{room.category}</span>
                    </div>

                    {/* Hover play prompt */}
                    <div className="card-hover-overlay" onClick={() => handleJoinClick(room.id)}>
                      <div className="play-circle-btn">
                        <Play size={24} fill="#fff" />
                      </div>
                      <span className="join-hover-text">Join Community</span>
                    </div>
                  </div>

                  {/* Card Content Info */}
                  <div className="card-content">
                    <div className="card-title-row">
                      <h3 className="card-title" title={room.name}>
                        {room.name}
                      </h3>
                    </div>

                    <p className="card-description" title={room.description}>
                      {room.description || 'Open community lounge for chatting and synchronized streaming.'}
                    </p>

                    <div className="card-footer">
                      <div className="host-info">
                        <span className="host-label">HOST</span>
                        <span className="host-name">{room.hostName || 'Community'}</span>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary card-join-btn"
                        onClick={() => handleJoinClick(room.id)}
                      >
                        <span>Join</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Create Public Channel */}
      {isCreateModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Sparkles size={20} color="#a855f7" />
                <span>Create Public Community Channel</span>
              </h2>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '-8px 0 16px' }}>
              Public channels are listed in the community explorer. Anyone can discover and join your party!
            </p>

            <form onSubmit={handleCreatePublicRoom} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!username && (
                <div>
                  <label className="input-label">Your Display Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Alex"
                    value={promptUsername}
                    onChange={(e) => setPromptUsername(e.target.value)}
                    maxLength={25}
                    required
                  />
                </div>
              )}

              <div>
                <label className="input-label">Channel Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 🎵 Friday Lofi & Chill Radio"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  maxLength={50}
                  required
                />
              </div>

              <div>
                <label className="input-label">Category</label>
                <select
                  className="input"
                  value={newRoomCategory}
                  onChange={(e) => setNewRoomCategory(e.target.value)}
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
                <label className="input-label">Description / Topic (Optional)</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Tell people what you are watching together..."
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  maxLength={180}
                  style={{ resize: 'none' }}
                />
              </div>

              <div>
                <label className="input-label">Initial YouTube Video URL or ID (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. https://www.youtube.com/watch?v=jfKfPfyJRdk"
                  value={newRoomVideo}
                  onChange={(e) => setNewRoomVideo(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                  Leave empty to start with our default relaxing Lofi Beats stream.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  <Sparkles size={16} />
                  <span>Launch Channel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Username Prompt when joining from Community without name set */}
      {pendingJoinRoomId && (
        <div className="modal-backdrop" onClick={() => setPendingJoinRoomId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Users size={18} color="#6366f1" />
                <span>Join Community Lounge</span>
              </h2>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setPendingJoinRoomId(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '-8px 0 16px' }}>
              What should we call you in this community room?
            </p>

            <form onSubmit={confirmJoinWithPromptName} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">Display Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Alex"
                  value={promptUsername}
                  onChange={(e) => setPromptUsername(e.target.value)}
                  maxLength={25}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setPendingJoinRoomId(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  <span>Enter Room</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
