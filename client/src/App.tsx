import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { ToastMessage, ActionType } from './types';
import { Navbar } from './components/Navbar';
import { VideoPlayer } from './components/VideoPlayer';
import { PlaybackControls } from './components/PlaybackControls';
import { ParticipantList } from './components/ParticipantList';
import { ChatPanel } from './components/ChatPanel';
import { PendingRequestsModal } from './components/PendingRequests';
import { RequestActionModal } from './components/RequestActionModal';
import { CommunityLobby } from './components/CommunityLobby';
import { ToastContainer } from './components/Toast';
import { extractYouTubeVideoId } from './utils/youtube';
import {
  Users,
  MessageSquare,
  Sparkles,
  Play,
  Shield,
  Zap,
  Globe,
  Lock,
  Radio,
  ArrowRight,
} from 'lucide-react';

export const App: React.FC = () => {
  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Socket & Room State
  const {
    isConnected,
    currentRoomId,
    currentUser,
    roomDetails,
    publicRooms,
    participants,
    syncState,
    chatMessages,
    pendingRequests,
    activeReactions,
    joinRoom,
    leaveRoom,
    updateRoomDetails,
    play,
    pause,
    seek,
    changeVideo,
    assignRole,
    removeParticipant,
    transferHost,
    requestAction,
    approveRequest,
    rejectRequest,
    sendMessage,
    sendReaction,
    sendHeartbeat,
  } = useSocket(addToast);

  // Landing tab: 'community' (Public Lounges) vs 'private' (Private Code Watch Party)
  const [activeLandingTab, setActiveLandingTab] = useState<'community' | 'private'>('community');

  // Landing form states for Private Room
  const [privateMode, setPrivateMode] = useState<'create' | 'join'>('create');
  const [username, setUsername] = useState(() => localStorage.getItem('wp_username') || '');
  const [inputRoomId, setInputRoomId] = useState('');
  const [privatePartyName, setPrivatePartyName] = useState('');
  const [privatePartyVideo, setPrivatePartyVideo] = useState('');

  // UI States
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'participants'>('chat');
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestModalAction, setRequestModalAction] = useState<ActionType>('play');
  const [requestModalPayload, setRequestModalPayload] = useState<any>(undefined);

  // Player timing states
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);

  // Check URL query param for room code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInputRoomId(roomParam.toUpperCase());
      setPrivateMode('join');
      setActiveLandingTab('private');
    }
  }, []);

  const handleUpdateUsername = (name: string) => {
    setUsername(name);
    localStorage.setItem('wp_username', name);
  };

  const handleJoinOrCreatePrivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      addToast({ type: 'warning', title: 'Username Required', description: 'Please enter a display name.' });
      return;
    }

    handleUpdateUsername(username.trim());

    if (privateMode === 'create') {
      const generatedId = `PARTY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      let cleanVideoId: string | undefined = undefined;
      if (privatePartyVideo.trim()) {
        cleanVideoId = extractYouTubeVideoId(privatePartyVideo.trim()) || undefined;
        if (!cleanVideoId) {
          addToast({
            type: 'warning',
            title: 'Invalid YouTube Link',
            description: 'Using default chill video instead.',
          });
        }
      }
      joinRoom(generatedId, username.trim(), {
        roomType: 'private',
        name: privatePartyName.trim() || 'Private Watch Party',
        videoId: cleanVideoId,
      });
    } else {
      if (!inputRoomId.trim()) {
        addToast({ type: 'warning', title: 'Room Code Required', description: 'Please enter a room code.' });
        return;
      }
      joinRoom(inputRoomId.trim().toUpperCase(), username.trim(), { roomType: 'private' });
    }
  };

  const openRequestModal = (action: ActionType = 'play', payload?: any) => {
    setRequestModalAction(action);
    setRequestModalPayload(payload);
    setIsRequestModalOpen(true);
  };

  return (
    <div>
      {/* Dynamic Background Atmosphere */}
      <div className="bg-glow-container">
        <div className="bg-glow-1" />
        <div className="bg-glow-2" />
      </div>

      {/* Landing View (If not currently in room) */}
      {!currentRoomId ? (
        <div className="landing-wrapper">
          {/* Main Top Header Navigation */}
          <header className="landing-top-bar">
            <div className="landing-brand">
              <span className="brand-icon">🍿</span>
              <span className="brand-name">PartyTube</span>
            </div>

            {/* Public vs Private Primary Switcher */}
            <div className="landing-type-toggle">
              <button
                type="button"
                className={`type-toggle-btn ${activeLandingTab === 'community' ? 'active' : ''}`}
                onClick={() => setActiveLandingTab('community')}
              >
                <Globe size={16} />
                <span>Public Lounges</span>
                {publicRooms.length > 0 && (
                  <span className="type-badge-count">{publicRooms.length}</span>
                )}
              </button>

              <button
                type="button"
                className={`type-toggle-btn ${activeLandingTab === 'private' ? 'active' : ''}`}
                onClick={() => setActiveLandingTab('private')}
              >
                <Lock size={16} />
                <span>Private Party</span>
              </button>
            </div>

            {/* Display Name Input / Status */}
            <div className="landing-user-preview">
              <input
                type="text"
                placeholder="Your Display Name..."
                value={username}
                onChange={(e) => handleUpdateUsername(e.target.value)}
                className="input top-username-input"
                maxLength={25}
              />
            </div>
          </header>

          {/* Conditional View: Community Explorer vs Private Party Creator */}
          {activeLandingTab === 'community' ? (
            <CommunityLobby
              publicRooms={publicRooms}
              username={username}
              onUpdateUsername={handleUpdateUsername}
              onJoinRoom={(roomId, options) => {
                const effectiveUser = options?.username || username || 'Guest';
                joinRoom(roomId, effectiveUser, options);
              }}
              onToast={addToast}
            />
          ) : (
            <div className="private-party-hero-container">
              <div className="glass-panel private-party-panel">
                <div className="private-panel-icon">🔒</div>
                <h1 className="private-panel-title">Private Watch Party</h1>
                <p className="private-panel-subtitle">
                  Create a private room with a secret code, or join an invite-only party. Unlisted from the community explorer.
                </p>

                {/* Create vs Join Subtabs */}
                <div className="mode-selector-tabs">
                  <button
                    type="button"
                    className={`mode-tab-btn ${privateMode === 'create' ? 'active' : ''}`}
                    onClick={() => setPrivateMode('create')}
                  >
                    Create Private Party
                  </button>
                  <button
                    type="button"
                    className={`mode-tab-btn ${privateMode === 'join' ? 'active' : ''}`}
                    onClick={() => setPrivateMode('join')}
                  >
                    Join with Code
                  </button>
                </div>

                <form onSubmit={handleJoinOrCreatePrivate} className="private-form">
                  <div className="form-group">
                    <label className="input-label">Your Display Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Alice"
                      value={username}
                      onChange={(e) => handleUpdateUsername(e.target.value)}
                      maxLength={25}
                      required
                    />
                  </div>

                  {privateMode === 'create' ? (
                    <>
                      <div className="form-group">
                        <label className="input-label">Party Name (Optional)</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g. Friday Night Movie Hangout"
                          value={privatePartyName}
                          onChange={(e) => setPrivatePartyName(e.target.value)}
                          maxLength={50}
                        />
                      </div>

                      <div className="form-group">
                        <label className="input-label">Initial YouTube URL (Optional)</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g. https://www.youtube.com/watch?v=..."
                          value={privatePartyVideo}
                          onChange={(e) => setPrivatePartyVideo(e.target.value)}
                        />
                      </div>

                      <div className="private-perks-box">
                        <div className="perk-item">
                          <Lock size={15} color="#f59e0b" />
                          <span>Secret Room Code generated automatically</span>
                        </div>
                        <div className="perk-item">
                          <Shield size={15} color="#06b6d4" />
                          <span>Only invited friends with the link can join</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="form-group">
                      <label className="input-label">Party Room Code</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. PARTY-W9K2Q1"
                        value={inputRoomId}
                        onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: '14px', fontSize: '1rem', marginTop: '6px' }}
                  >
                    {privateMode === 'create' ? (
                      <>
                        <Sparkles size={16} />
                        <span>Create Private Watch Party</span>
                      </>
                    ) : (
                      <>
                        <span>Join Private Party</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                {/* Features bottom badges */}
                <div className="feature-highlights-row">
                  <div>
                    <Zap size={18} color="#ec4899" style={{ margin: '0 auto 6px' }} />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Zero-Drift Sync</div>
                  </div>
                  <div>
                    <Shield size={18} color="#06b6d4" style={{ margin: '0 auto 6px' }} />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Host & Moderator Roles</div>
                  </div>
                  <div>
                    <Sparkles size={18} color="#f59e0b" style={{ margin: '0 auto 6px' }} />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Chat & Reactions</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Room View */
        <div style={{ position: 'relative', zIndex: 10 }}>
          <Navbar
            roomId={currentRoomId}
            currentUser={currentUser}
            roomDetails={roomDetails}
            pendingRequestsCount={pendingRequests.length}
            onOpenRequests={() => setIsPendingModalOpen(true)}
            onLeaveRoom={leaveRoom}
            onUpdateRoomDetails={updateRoomDetails}
            onToast={addToast}
          />

          <main className="party-container">
            {/* Left: Video Stage & Controls */}
            <div className="video-stage">
              <VideoPlayer
                syncState={syncState}
                currentUser={currentUser}
                activeReactions={activeReactions}
                onPlay={play}
                onPause={pause}
                onSeek={seek}
                onHeartbeat={sendHeartbeat}
                onPlayerTimeUpdate={(current, dur) => {
                  setPlayerCurrentTime(current);
                  setPlayerDuration(dur);
                }}
              />

              <PlaybackControls
                playState={syncState.playState}
                currentTime={playerCurrentTime}
                duration={playerDuration}
                currentUser={currentUser}
                onPlay={play}
                onPause={pause}
                onSeek={seek}
                onChangeVideo={changeVideo}
                onRequestActionModal={openRequestModal}
              />
            </div>

            {/* Right: Sidebar with Chat & Participants */}
            <aside className="glass-panel sidebar">
              <div className="sidebar-tabs">
                <button
                  className={`sidebar-tab-btn ${activeSidebarTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('chat')}
                >
                  <MessageSquare size={16} />
                  <span>Chat</span>
                </button>
                <button
                  className={`sidebar-tab-btn ${activeSidebarTab === 'participants' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('participants')}
                >
                  <Users size={16} />
                  <span>Party ({participants.length})</span>
                </button>
              </div>

              {activeSidebarTab === 'chat' ? (
                <ChatPanel
                  messages={chatMessages}
                  currentUser={currentUser}
                  onSendMessage={sendMessage}
                  onSendReaction={sendReaction}
                />
              ) : (
                <ParticipantList
                  participants={participants}
                  currentUser={currentUser}
                  onAssignRole={assignRole}
                  onRemoveParticipant={removeParticipant}
                  onTransferHost={transferHost}
                />
              )}
            </aside>
          </main>

          {/* Pending Requests Modal (Host & Moderator) */}
          <PendingRequestsModal
            isOpen={isPendingModalOpen}
            requests={pendingRequests}
            onClose={() => setIsPendingModalOpen(false)}
            onApprove={(id) => {
              approveRequest(id);
              if (pendingRequests.length <= 1) setIsPendingModalOpen(false);
            }}
            onReject={(id) => {
              rejectRequest(id);
              if (pendingRequests.length <= 1) setIsPendingModalOpen(false);
            }}
          />

          {/* Request Action Modal (Participants & Viewers) */}
          <RequestActionModal
            isOpen={isRequestModalOpen}
            defaultAction={requestModalAction}
            defaultPayload={requestModalPayload}
            currentVideoDuration={playerDuration}
            currentTime={playerCurrentTime}
            onClose={() => setIsRequestModalOpen(false)}
            onSubmitRequest={(action, payload) => requestAction(action, payload)}
          />
        </div>
      )}

      {/* Floating Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;
