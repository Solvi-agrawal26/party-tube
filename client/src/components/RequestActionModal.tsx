import React, { useState, useEffect } from 'react';
import { ActionType } from '../types';
import { extractYouTubeVideoId, formatTime } from '../utils/youtube';
import { Sparkles, X, Play, Pause, FastForward, Film } from 'lucide-react';

interface RequestActionModalProps {
  isOpen: boolean;
  defaultAction?: ActionType;
  defaultPayload?: any;
  currentVideoDuration: number;
  currentTime?: number;
  onClose: () => void;
  onSubmitRequest: (action: ActionType, payload?: { time?: number; videoId?: string }) => void;
}

export const RequestActionModal: React.FC<RequestActionModalProps> = ({
  isOpen,
  defaultAction = 'play',
  defaultPayload,
  currentVideoDuration,
  currentTime = 0,
  onClose,
  onSubmitRequest,
}) => {
  const [selectedAction, setSelectedAction] = useState<ActionType>(defaultAction);
  const [seekSeconds, setSeekSeconds] = useState<string>('0');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAction(defaultAction);
    setValidationError(null);
    if (defaultPayload?.videoId) {
      setVideoUrl(defaultPayload.videoId);
    }
    if (defaultPayload?.time !== undefined) {
      setSeekSeconds(defaultPayload.time.toString());
    } else if (currentTime !== undefined) {
      setSeekSeconds(Math.floor(currentTime).toString());
    }
  }, [defaultAction, defaultPayload, isOpen, currentTime]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (selectedAction === 'seek') {
      const parsedTime = Math.max(0, parseFloat(seekSeconds) || 0);
      onSubmitRequest('seek', { time: parsedTime });
    } else if (selectedAction === 'change_video') {
      if (!videoUrl.trim()) return;
      const cleanId = extractYouTubeVideoId(videoUrl.trim());
      if (!cleanId) {
        setValidationError('Invalid YouTube URL or ID. Please check the link.');
        return;
      }
      onSubmitRequest('change_video', { videoId: cleanId });
    } else {
      onSubmitRequest(selectedAction);
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Sparkles size={20} color="#8b5cf6" />
            <span>Request Playback Action</span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
              Select Action to Request:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className={`btn ${selectedAction === 'play' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedAction('play')}
                style={{ justifyContent: 'center' }}
              >
                <Play size={15} /> Play
              </button>
              <button
                type="button"
                className={`btn ${selectedAction === 'pause' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedAction('pause')}
                style={{ justifyContent: 'center' }}
              >
                <Pause size={15} /> Pause
              </button>
              <button
                type="button"
                className={`btn ${selectedAction === 'seek' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedAction('seek')}
                style={{ justifyContent: 'center' }}
              >
                <FastForward size={15} /> Seek
              </button>
              <button
                type="button"
                className={`btn ${selectedAction === 'change_video' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedAction('change_video')}
                style={{ justifyContent: 'center' }}
              >
                <Film size={15} /> Change Video
              </button>
            </div>
          </div>

          {selectedAction === 'seek' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Seek Position (seconds):
                </label>
                <span style={{ fontSize: '0.85rem', color: '#a855f7', fontWeight: 600 }}>
                  Target: {formatTime(parseFloat(seekSeconds) || 0)}
                </span>
              </div>
              <input
                type="number"
                min={0}
                max={Math.floor(currentVideoDuration || 3600)}
                className="input"
                value={seekSeconds}
                onChange={(e) => setSeekSeconds(e.target.value)}
                placeholder="e.g. 120"
                required
              />
            </div>
          )}

          {selectedAction === 'change_video' && (
            <div>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>
                YouTube Video URL or ID:
              </label>
              <input
                type="text"
                className="input"
                value={videoUrl}
                onChange={(e) => {
                  setVideoUrl(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
              {validationError && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '6px' }}>
                  {validationError}
                </div>
              )}
            </div>
          )}

          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            ℹ️ Your request will be sent to the Host or Moderator for approval before taking effect for everyone.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
