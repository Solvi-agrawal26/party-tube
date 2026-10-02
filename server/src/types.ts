export type Role = 'HOST' | 'MODERATOR' | 'PARTICIPANT' | 'VIEWER';

export type PlayState = 'PLAYING' | 'PAUSED' | 'BUFFERING';

export type ActionType = 'play' | 'pause' | 'seek' | 'change_video';

export type RoomType = 'public' | 'private';

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

export interface RoomRecord {
  id: string;
  name: string;
  host_user_id: string;
  video_id: string;
  current_time: number;
  play_state: PlayState;
  room_type: RoomType;
  description: string;
  category: string;
  created_at: number;
  updated_at: number;
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

export interface RoomDetailsPayload {
  roomId: string;
  name: string;
  description: string;
  category: string;
  roomType: RoomType;
}

export interface ClientToServerEvents {
  join_room: (data: {
    roomId: string;
    username: string;
    userId?: string;
    roomType?: RoomType;
    name?: string;
    description?: string;
    category?: string;
    videoId?: string;
  }) => void;
  leave_room: (data: { roomId: string }) => void;
  play: () => void;
  pause: () => void;
  seek: (data: { time: number }) => void;
  change_video: (data: { videoId: string }) => void;
  assign_role: (data: { userId: string; role: Role }) => void;
  remove_participant: (data: { userId: string }) => void;
  transfer_host: (data: { userId: string }) => void;
  request_action: (data: { action: ActionType; payload?: { time?: number; videoId?: string } }) => void;
  approve_request: (data: { requestId: string }) => void;
  reject_request: (data: { requestId: string }) => void;
  chat_message: (data: { message: string }) => void;
  send_reaction: (data: { emoji: string }) => void;
  sync_heartbeat: (data: { currentTime: number; playState: PlayState }) => void;
  update_room_details: (data: {
    name?: string;
    description?: string;
    category?: string;
    roomType?: RoomType;
  }) => void;
  get_public_rooms: () => void;
}

export interface ServerToClientEvents {
  sync_state: (data: SyncStatePayload) => void;
  room_details: (data: RoomDetailsPayload) => void;
  public_rooms_updated: (data: PublicRoomSummary[]) => void;
  user_joined: (data: {
    userId: string;
    username: string;
    role: Role;
    participants: ParticipantData[];
    roomDetails?: RoomDetailsPayload;
  }) => void;
  user_left: (data: {
    userId: string;
    username: string;
    participants: ParticipantData[];
  }) => void;
  role_assigned: (data: {
    userId: string;
    username: string;
    role: Role;
    participants: ParticipantData[];
  }) => void;
  participant_removed: (data: {
    userId: string;
    participants: ParticipantData[];
    reason?: string;
  }) => void;
  host_transferred: (data: {
    previousHostId: string;
    newHostId: string;
    newHostName: string;
    participants: ParticipantData[];
  }) => void;
  request_pending: (data: ActionRequest) => void;
  request_resolved: (data: {
    requestId: string;
    status: 'approved' | 'rejected';
    action: ActionType;
    resolvedBy: string;
  }) => void;
  chat_message: (data: ChatMessagePayload) => void;
  reaction_received: (data: ReactionPayload) => void;
  permission_denied: (data: { code: string; message: string; action?: string }) => void;
  error: (data: { code: string; message: string }) => void;
}
