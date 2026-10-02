import React from 'react';
import { ReactionPayload } from '../types';

interface ReactionOverlayProps {
  reactions: ReactionPayload[];
}

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ reactions }) => {
  return (
    <div className="reactions-overlay">
      {reactions.map((rxn) => {
        // Derive pseudo-random horizontal offset based on rxn id
        const hash = rxn.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const leftPercent = 15 + (hash % 70); // Between 15% and 85% width

        return (
          <div
            key={rxn.id}
            className="floating-emoji"
            style={{ left: `${leftPercent}%` }}
          >
            <span>{rxn.emoji}</span>
          </div>
        );
      })}
    </div>
  );
};
