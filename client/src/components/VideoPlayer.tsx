import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayState, SyncStatePayload, ParticipantData, ReactionPayload } from '../types';
import { ReactionOverlay } from './ReactionOverlay';
import { AlertTriangle, ExternalLink } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface VideoPlayerProps {
  syncState: SyncStatePayload;
  currentUser: ParticipantData | null;
  activeReactions: ReactionPayload[];
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onHeartbeat: (currentTime: number, playState: PlayState) => void;
  onPlayerTimeUpdate: (currentTime: number, duration: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  syncState,
  currentUser,
  activeReactions,
  onPlay,
  onPause,
  onSeek,
  onHeartbeat,
  onPlayerTimeUpdate,
}) => {
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const isApplyingRemoteRef = useRef<boolean>(false);
  const remoteTimeoutRef = useRef<any>(null);
  const previousStateRef = useRef<number>(-1);
  const currentVideoIdRef = useRef<string>(syncState.videoId);
  const isPlayerReadyRef = useRef<boolean>(false);
  const pendingSyncRef = useRef<SyncStatePayload | null>(null);

  const [playerError, setPlayerError] = useState<string | null>(null);

  // Keep all props in fresh refs so handlers never go stale or force re-mounts
  const syncStateRef = useRef<SyncStatePayload>(syncState);
  syncStateRef.current = syncState;

  const currentUserRef = useRef<ParticipantData | null>(currentUser);
  currentUserRef.current = currentUser;

  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;

  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;

  const onPlayerTimeUpdateRef = useRef(onPlayerTimeUpdate);
  onPlayerTimeUpdateRef.current = onPlayerTimeUpdate;

  const onHeartbeatRef = useRef(onHeartbeat);
  onHeartbeatRef.current = onHeartbeat;

  // Synchronize remote server sync_state to YouTube player
  const applySyncState = useCallback((state: SyncStatePayload, force: boolean = false) => {
    if (!playerRef.current || !isPlayerReadyRef.current) {
      pendingSyncRef.current = state;
      return;
    }

    const isNewVideo = state.videoId !== currentVideoIdRef.current || force;

    if (isNewVideo) {
      currentVideoIdRef.current = state.videoId;
      setPlayerError(null);
      isApplyingRemoteRef.current = true;

      if (remoteTimeoutRef.current) {
        clearTimeout(remoteTimeoutRef.current);
      }
      // Keep lock for 3s to let YouTube iframe buffer and initialize without echoing
      remoteTimeoutRef.current = setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 3000);

      try {
        if (state.playState === 'PLAYING') {
          if (typeof playerRef.current.loadVideoById === 'function') {
            playerRef.current.loadVideoById({
              videoId: state.videoId,
              startSeconds: Math.max(0, state.currentTime),
            });
          }
          if (typeof playerRef.current.playVideo === 'function') {
            playerRef.current.playVideo();
          }
        } else {
          if (typeof playerRef.current.cueVideoById === 'function') {
            playerRef.current.cueVideoById({
              videoId: state.videoId,
              startSeconds: Math.max(0, state.currentTime),
            });
          }
        }
      } catch (err) {
        console.error('[YouTube Player] Failed to load/cue video:', err);
      }
      return; // Do NOT run seek drift or play/pause in the same tick!
    }

    // Same video sync:
    isApplyingRemoteRef.current = true;
    if (remoteTimeoutRef.current) {
      clearTimeout(remoteTimeoutRef.current);
    }
    remoteTimeoutRef.current = setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 1200);

    try {
      // Seek Drift Correction (low tolerance when paused for exact scrubbing, 2.0s when playing)
      if (typeof playerRef.current.getCurrentTime === 'function') {
        const localTime = playerRef.current.getCurrentTime() || 0;
        const drift = Math.abs(localTime - state.currentTime);
        const tolerance = state.playState === 'PAUSED' ? 0.35 : 2.0;
        if (drift > tolerance && typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(state.currentTime, true);
        }
      }

      // Play / Pause State
      if (typeof playerRef.current.getPlayerState === 'function') {
        const currentYTState = playerRef.current.getPlayerState();
        if (state.playState === 'PLAYING') {
          if (currentYTState !== 1 && currentYTState !== 3 && typeof playerRef.current.playVideo === 'function') {
            playerRef.current.playVideo();
          }
        } else if (state.playState === 'PAUSED') {
          if (currentYTState === 1 && typeof playerRef.current.pauseVideo === 'function') {
            playerRef.current.pauseVideo();
          }
        }
      }
    } catch (e) {
      console.warn('[YouTube Sync] Sync apply warning:', e);
    }
  }, []);

  // Initialize YouTube Player ONLY ONCE on mount
  useEffect(() => {
    let isMounted = true;

    const setupPlayer = () => {
      if (!isMounted) return;
      if (playerRef.current) return;

      // Ensure the mount container element exists
      if (!document.getElementById('youtube-watch-player') && playerContainerRef.current) {
        const div = document.createElement('div');
        div.id = 'youtube-watch-player';
        playerContainerRef.current.appendChild(div);
      }

      try {
        playerRef.current = new window.YT.Player('youtube-watch-player', {
          height: '100%',
          width: '100%',
          videoId: syncStateRef.current.videoId || 'jfKfPfyJRdk',
          playerVars: {
            autoplay: syncStateRef.current.playState === 'PLAYING' ? 1 : 0,
            controls: 1, // Enable YouTube player controls for full accessibility & autoplay unblocking
            disablekb: 0,
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              console.log('[YouTube Player] Ready');
              isPlayerReadyRef.current = true;
              const stateToApply = pendingSyncRef.current || syncStateRef.current;
              applySyncState(stateToApply, true);
              pendingSyncRef.current = null;
            },
            onError: (event: any) => {
              const errCode = event.data;
              let message = 'An error occurred while loading this video.';
              if (errCode === 2) {
                message = 'Invalid YouTube video ID or link.';
              } else if (errCode === 5) {
                message = 'HTML5 player error. The video cannot be played in this browser.';
              } else if (errCode === 100) {
                message = 'Video not found or has been marked as private/removed.';
              } else if (errCode === 101 || errCode === 150) {
                message = 'The owner of this video has disabled playback outside of YouTube (embedding restricted). Please try another video.';
              }
              console.error('[YouTube Player] Error code:', errCode, message);
              setPlayerError(message);
            },
            onStateChange: (event: any) => {
              const newState = event.data;
              const oldState = previousStateRef.current;
              previousStateRef.current = newState;

              // If applying remote sync or video is currently loading, don't echo to server
              if (isApplyingRemoteRef.current) {
                if (newState === 1) {
                  isApplyingRemoteRef.current = false;
                }
                return;
              }

              const canControl = currentUserRef.current?.role === 'HOST' || currentUserRef.current?.role === 'MODERATOR';
              if (!canControl) {
                // Re-enforce server state if unauthorized participant triggered state change
                applySyncState(syncStateRef.current);
                return;
              }

              // YT.PlayerState: -1: UNSTARTED, 0: ENDED, 1: PLAYING, 2: PAUSED, 3: BUFFERING, 5: CUED
              if (newState === 0 && syncStateRef.current.playState === 'PLAYING') {
                // Video finished playing, pause playback on server
                onPauseRef.current();
              } else if (newState === 1 && syncStateRef.current.playState !== 'PLAYING') {
                onPlayRef.current();
              } else if (newState === 2 && syncStateRef.current.playState === 'PLAYING') {
                if (oldState === 1 || oldState === 3) {
                  onPauseRef.current();
                }
              }
            },
          },
        });
      } catch (err) {
        console.error('[YouTube Player] Initialization failed:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      setupPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        setupPlayer();
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }
    }

    return () => {
      isMounted = false;
      if (remoteTimeoutRef.current) {
        clearTimeout(remoteTimeoutRef.current);
      }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
      isPlayerReadyRef.current = false;
    };
  }, [applySyncState]); // Stays mounted for entire lifetime of component

  // Respond to prop updates from server
  useEffect(() => {
    if (isPlayerReadyRef.current) {
      applySyncState(syncState);
    } else {
      pendingSyncRef.current = syncState;
    }
  }, [syncState, applySyncState]);

  // Periodic Progress Updates & Host Heartbeats
  useEffect(() => {
    const interval = setInterval(() => {
      if (!playerRef.current || !isPlayerReadyRef.current) return;

      try {
        const currentTime = typeof playerRef.current.getCurrentTime === 'function' ? playerRef.current.getCurrentTime() : 0;
        const duration = typeof playerRef.current.getDuration === 'function' ? playerRef.current.getDuration() : 0;
        onPlayerTimeUpdateRef.current(currentTime, duration);

        // Host emits periodic heartbeat to server
        if (currentUserRef.current?.role === 'HOST' && syncStateRef.current.playState === 'PLAYING') {
          onHeartbeatRef.current(currentTime, 'PLAYING');
        }
      } catch (err) {
        // Player might be switching videos
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="player-wrapper">
      <div className="player-iframe-container" ref={playerContainerRef}>
        <div id="youtube-watch-player" />
      </div>

      {/* Floating Reactions Overlay */}
      <ReactionOverlay reactions={activeReactions} />

      {/* Error / Blocked Overlay */}
      {playerError && (
        <div className="player-error-overlay">
          <AlertTriangle size={40} color="#f59e0b" />
          <div style={{ fontWeight: 600, fontSize: '1.15rem', marginTop: '12px' }}>
            Video Playback Unavailable
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '440px', margin: '8px auto 16px', lineHeight: 1.5 }}>
            {playerError}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <a
              href={`https://www.youtube.com/watch?v=${syncState.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem' }}
            >
              <ExternalLink size={14} /> Open on YouTube
            </a>
            <button
              className="btn btn-primary"
              onClick={() => setPlayerError(null)}
              style={{ fontSize: '0.85rem' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
