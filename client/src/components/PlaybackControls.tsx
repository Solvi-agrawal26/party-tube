import React, { useState } from 'react';
import { PlayState, ParticipantData } from '../types';
import { formatTime, extractYouTubeVideoId } from '../utils/youtube';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Send,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface PlaybackControlsProps {
  playState: PlayState;
  currentTime: number;
  duration: number;
  currentUser: ParticipantData | null;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onChangeVideo: (videoId: string) => void;
  onRequestActionModal: (defaultAction?: 'play' | 'pause' | 'seek' | 'change_video', defaultPayload?: any) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  playState,
  currentTime,
  duration,
  currentUser,
  onPlay,
  onPause,
  onSeek,
  onChangeVideo,
  onRequestActionModal,
}) => {
  const [videoInput, setVideoInput] = useState('');
  const [videoInputError, setVideoInputError] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const canControl = currentUser?.role === 'HOST' || currentUser?.role === 'MODERATOR';
  const effectiveCurrentTime = isScrubbing ? scrubValue : currentTime;
  const isPlaying = playState === 'PLAYING';

  const handlePlayPause = () => {
    if (canControl) {
      if (isPlaying) {
        onPause();
      } else {
        onPlay();
      }
    } else {
      onRequestActionModal(isPlaying ? 'pause' : 'play');
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControl) return;
    setIsScrubbing(true);
    setScrubValue(parseFloat(e.target.value));
  };

  const handleSeekCommit = () => {
    if (!canControl) return;
    if (isScrubbing) {
      setIsScrubbing(false);
      onSeek(scrubValue);
    }
  };

  const handleVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVideoInputError(null);
    if (!videoInput.trim()) return;

    const extractedId = extractYouTubeVideoId(videoInput.trim());
    if (!extractedId) {
      setVideoInputError('Invalid YouTube URL or ID. Please check the link.');
      return;
    }

    if (canControl) {
      onChangeVideo(extractedId);
      setVideoInput('');
    } else {
      onRequestActionModal('change_video', { videoId: extractedId });
      setVideoInput('');
    }
  };

  return (
    <div className="glass-panel controls-bar">
      {/* Top row: Play/Pause button, timeline scrubber, time display */}
      <div className="controls-row-top">
        <button
          className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handlePlayPause}
          style={{ width: '44px', height: '44px', padding: 0, borderRadius: '50%' }}
          title={canControl ? (isPlaying ? 'Pause' : 'Play') : 'Request Play/Pause'}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: '2px' }} />}
        </button>

        {canControl && (
          <button
            className="btn btn-icon"
            onClick={() => onSeek(Math.max(0, currentTime - 10))}
            title="Rewind 10 seconds"
          >
            <RotateCcw size={16} />
          </button>
        )}

        <div className="scrubber-container">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={effectiveCurrentTime}
            onChange={handleSeekChange}
            onPointerDown={(e) => {
              if (canControl) {
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch (err) {}
              }
            }}
            onPointerUp={handleSeekCommit}
            onMouseUp={handleSeekCommit}
            onTouchEnd={handleSeekCommit}
            onBlur={handleSeekCommit}
            disabled={!canControl}
            className="scrubber-slider"
            title={canControl ? 'Drag to scrub video' : 'Restricted: Host and Moderator only'}
          />
          <div className="time-display">
            <span>{formatTime(effectiveCurrentTime)}</span>
            <span style={{ margin: '0 4px', color: '#475569' }}>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {!canControl && (
          <button
            className="btn btn-secondary"
            onClick={() => onRequestActionModal('seek', { time: currentTime })}
            style={{ fontSize: '0.8rem', padding: '6px 12px', gap: '6px' }}
          >
            <Sparkles size={14} color="#8b5cf6" />
            <span>Request Action</span>
          </button>
        )}
      </div>

      {/* Bottom row: Video URL submission form & permission badge */}
      <div className="controls-row-bottom">
        <form onSubmit={handleVideoSubmit} className="video-change-form">
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <input
              type="text"
              className="input"
              placeholder="Paste YouTube URL or Video ID (e.g. https://www.youtube.com/watch?v=...)"
              value={videoInput}
              onChange={(e) => {
                setVideoInput(e.target.value);
                if (videoInputError) setVideoInputError(null);
              }}
            />
            {videoInputError && (
              <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '4px', marginLeft: '4px' }}>
                {videoInputError}
              </div>
            )}
          </div>
          <button
            type="submit"
            className={canControl ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ flexShrink: 0 }}
          >
            <Send size={15} />
            <span>{canControl ? 'Change Video' : 'Request Video'}</span>
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.78rem' }}>
          <HelpCircle size={14} />
          <span>{canControl ? 'Direct Playback Control Active' : 'Controls locked. Submit request for approval.'}</span>
        </div>
      </div>
    </div>
  );
};
