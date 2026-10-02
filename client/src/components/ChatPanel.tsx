import React, { useState, useRef, useEffect } from 'react';
import { ChatMessagePayload, ParticipantData, Role } from '../types';
import { getAvatarColor } from '../utils/youtube';
import confetti from 'canvas-confetti';
import { Send, Smile, Crown, Shield, User, Eye } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessagePayload[];
  currentUser: ParticipantData | null;
  onSendMessage: (message: string) => void;
  onSendReaction: (emoji: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUser,
  onSendMessage,
  onSendReaction,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickReactions = ['❤️', '🔥', '😂', '👏', '🎉', '🍿'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    onSendMessage(inputMessage.trim());
    setInputMessage('');
  };

  const handleQuickReaction = (emoji: string) => {
    onSendReaction(emoji);
    if (emoji === '🎉') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    }
  };

  const renderRoleBadge = (role: Role) => {
    switch (role) {
      case 'HOST':
        return (
          <span className="badge badge-host" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
            <Crown size={9} /> Host
          </span>
        );
      case 'MODERATOR':
        return (
          <span className="badge badge-moderator" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
            <Shield size={9} /> Mod
          </span>
        );
      case 'VIEWER':
        return (
          <span className="badge badge-viewer" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
            <Eye size={9} /> Viewer
          </span>
        );
      default:
        return (
          <span className="badge badge-participant" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
            <User size={9} />
          </span>
        );
    }
  };

  return (
    <div className="sidebar-content">
      {/* Messages Scroll Area */}
      <div className="chat-messages-list">
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px', fontSize: '0.85rem' }}>
            No messages yet. Say hello to the party! 👋
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = currentUser?.userId === msg.userId;
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={msg.id} className="chat-message-item">
                <div
                  className="chat-avatar"
                  style={{ background: getAvatarColor(msg.username) }}
                >
                  {msg.username.charAt(0).toUpperCase()}
                </div>
                <div className="chat-body">
                  <div className="chat-header">
                    <span className="chat-username">
                      {msg.username}
                      {isSelf && ' (You)'}
                    </span>
                    {renderRoleBadge(msg.role)}
                    <span className="chat-timestamp">{timeStr}</span>
                  </div>
                  <div className="chat-text">{msg.message}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar & Reaction Bar */}
      <div className="chat-input-container">
        <div className="reaction-quick-bar">
          {quickReactions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="reaction-bubble-btn"
              onClick={() => handleQuickReaction(emoji)}
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="input"
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            maxLength={500}
            style={{ padding: '8px 12px', fontSize: '0.88rem' }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '8px 14px' }}
            disabled={!inputMessage.trim()}
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
