import { Participant } from './Participant';
import {
  PlayState,
  ActionRequest,
  SyncStatePayload,
  ParticipantData,
  Role,
  RoomType,
  PublicRoomSummary,
  RoomDetailsPayload,
} from '../types';
import { config } from '../config';

export class Room {
  public readonly id: string;
  public name: string;
  public hostUserId: string;
  public videoId: string;
  public currentTime: number;
  public playState: PlayState;
  public lastUpdated: number;
  public roomType: RoomType;
  public description: string;
  public category: string;

  private participants: Map<string, Participant> = new Map();
  private pendingRequests: Map<string, ActionRequest> = new Map();

  constructor(
    id: string,
    name: string = 'Watch Party Room',
    hostUserId: string = '',
    videoId: string = config.defaultVideoId,
    currentTime: number = 0,
    playState: PlayState = 'PAUSED',
    lastUpdated: number = Date.now(),
    roomType: RoomType = 'private',
    description: string = '',
    category: string = 'General'
  ) {
    this.id = id;
    this.name = name;
    this.hostUserId = hostUserId;
    this.videoId = videoId;
    this.currentTime = currentTime;
    this.playState = playState;
    this.lastUpdated = lastUpdated;
    this.roomType = roomType;
    this.description = description;
    this.category = category;
  }

  /**
   * Calculates the authoritative current playback time by extrapolating
   * elapsed wall-clock time if the video is actively playing.
   */
  public getEstimatedCurrentTime(): number {
    if (this.playState === 'PLAYING') {
      const elapsedSeconds = (Date.now() - this.lastUpdated) / 1000;
      if (elapsedSeconds < 0.02) {
        return this.currentTime;
      }
      return Math.max(0, this.currentTime + elapsedSeconds);
    }
    return this.currentTime;
  }

  /**
   * Updates playback state, position, and optional video ID
   */
  public updatePlayback(playState: PlayState, currentTime: number, videoId?: string): void {
    this.playState = playState;
    this.currentTime = currentTime;
    this.lastUpdated = Date.now();
    if (videoId) {
      this.videoId = videoId;
    }
  }

  /**
   * Participant management
   */
  public addParticipant(participant: Participant): void {
    // If the room doesn't have an active host, the first user becomes Host
    if (!this.hostUserId || this.participants.size === 0) {
      this.hostUserId = participant.userId;
      participant.updateRole('HOST');
    }
    this.participants.set(participant.userId, participant);
  }

  public removeParticipant(userId: string): Participant | undefined {
    const participant = this.participants.get(userId);
    if (participant) {
      this.participants.delete(userId);
    }
    return participant;
  }

  public getParticipant(userId: string): Participant | undefined {
    return this.participants.get(userId);
  }

  public getParticipantBySocketId(socketId: string): Participant | undefined {
    for (const participant of this.participants.values()) {
      if (participant.socketId === socketId) {
        return participant;
      }
    }
    return undefined;
  }

  public getParticipantsList(): ParticipantData[] {
    return Array.from(this.participants.values()).map((p) => p.toJSON());
  }

  public getParticipantCount(): number {
    return this.participants.size;
  }

  /**
   * Host transfer & election
   */
  public transferHost(targetUserId: string): Participant | null {
    const target = this.participants.get(targetUserId);
    if (!target) return null;

    const currentHost = this.participants.get(this.hostUserId);
    if (currentHost && currentHost.userId !== targetUserId) {
      currentHost.updateRole('MODERATOR');
    }

    this.hostUserId = targetUserId;
    target.updateRole('HOST');
    return target;
  }

  /**
   * If the host disconnects or leaves, auto-promote the next best user:
   * 1. Any existing MODERATOR
   * 2. Earliest joined PARTICIPANT
   */
  public autoElectHost(): Participant | null {
    if (this.participants.size === 0) {
      this.hostUserId = '';
      return null;
    }

    const participantsArray = Array.from(this.participants.values());

    // Check if there is already another Moderator
    const moderator = participantsArray.find((p) => p.role === 'MODERATOR');
    const newHost = moderator || participantsArray[0];

    this.hostUserId = newHost.userId;
    newHost.updateRole('HOST');
    return newHost;
  }

  /**
   * Pending Action Requests
   */
  public addPendingRequest(request: ActionRequest): void {
    this.pendingRequests.set(request.id, request);
  }

  public getPendingRequest(requestId: string): ActionRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  public removePendingRequest(requestId: string): ActionRequest | undefined {
    const req = this.pendingRequests.get(requestId);
    if (req) {
      this.pendingRequests.delete(requestId);
    }
    return req;
  }

  public getPendingRequestsList(): ActionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Returns authoritative sync state payload for broadcast to clients
   */
  public getSyncState(): SyncStatePayload {
    return {
      playState: this.playState,
      currentTime: this.getEstimatedCurrentTime(),
      videoId: this.videoId,
      updatedAt: this.lastUpdated,
    };
  }

  public updateDetails(name?: string, description?: string, category?: string, roomType?: RoomType): void {
    if (name !== undefined && name.trim()) this.name = name.trim();
    if (description !== undefined) this.description = description.trim();
    if (category !== undefined && category.trim()) this.category = category.trim();
    if (roomType !== undefined) this.roomType = roomType;
    this.lastUpdated = Date.now();
  }

  public getRoomDetails(): RoomDetailsPayload {
    return {
      roomId: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      roomType: this.roomType,
    };
  }

  public toSummaryJSON(): PublicRoomSummary {
    const hostParticipant = this.participants.get(this.hostUserId);
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      roomType: this.roomType,
      videoId: this.videoId,
      playState: this.playState,
      currentTime: this.getEstimatedCurrentTime(),
      participantsCount: this.getParticipantCount(),
      hostName: hostParticipant?.username || 'Community Host',
      createdAt: this.lastUpdated,
    };
  }
}
