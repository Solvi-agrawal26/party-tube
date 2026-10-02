export type Role = 'HOST' | 'MODERATOR' | 'PARTICIPANT' | 'VIEWER';

export type PlayState = 'PLAYING' | 'PAUSED' | 'BUFFERING';

export type ActionType = 'play' | 'pause' | 'seek' | 'change_video';

export interface ActionRequest {
  id: string;
  userId: string;
  username: string;
  action: ActionType;
  payload?: {
    time?: number;
    videoId?: string;
  };
  timestamp: number;
}

export interface ParticipantData {
  userId: string;
  socketId: string;
  username: string;
  role: Role;
  joinedAt: number;
}

export interface SyncStatePayload {
  playState: PlayState;
  currentTime: number;
  videoId: string;
  updatedAt: number;
}

export interface ChatMessagePayload {
  id: string;
  userId: string;
  username: string;
  role: Role;
  message: string;
  timestamp: number;
}

export interface ReactionPayload {
  id: string;
  userId: string;
  username: string;
  emoji: string;
  timestamp: number;
}

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description?: string;
}

export type RoomType = 'public' | 'private';

export interface RoomDetailsPayload {
  roomId: string;
  name: string;
  description: string;
  category: string;
  roomType: RoomType;
}

export interface PublicRoomSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  roomType: RoomType;
  videoId: string;
  playState: PlayState;
  currentTime: number;
  participantsCount: number;
  hostName?: string;
  createdAt: number;
}
