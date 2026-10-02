import { Room } from '../models/Room';
import { Participant } from '../models/Participant';
import { RoomRepository } from '../db/repository';
import { RoomType, PublicRoomSummary } from '../types';
import { config } from '../config';
import { Server } from 'socket.io';

export class RoomManager {
  private static instance: RoomManager;
  private rooms: Map<string, Room> = new Map();

  private constructor() {}

  public static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  /**
   * Retrieves an existing active room from memory, or restores it from SQLite,
   * or creates a new persistent room record.
   */
  public async getOrCreateRoom(
    roomId: string,
    roomName: string = 'Watch Party',
    creatorUserId?: string,
    roomType: RoomType = 'private',
    description: string = '',
    category: string = 'General',
    initialVideoId?: string
  ): Promise<Room> {
    const normalizedId = roomId.trim().toUpperCase();

    // 1. Check in-memory cache
    if (this.rooms.has(normalizedId)) {
      const existing = this.rooms.get(normalizedId)!;
      // If caller explicitly provided name or details when joining/creating, update if empty
      if (roomName && existing.name === 'Watch Party') existing.name = roomName;
      if (description && !existing.description) existing.description = description;
      if (category && existing.category === 'General') existing.category = category;
      return existing;
    }

    // 2. Check SQLite persistent database
    const dbRecord = await RoomRepository.findById(normalizedId);
    if (dbRecord) {
      // For community lounges keep saved state, for others default to PAUSED on server restore to prevent wall-clock drift
      const playState = dbRecord.id.startsWith('COMMUNITY-') ? dbRecord.play_state : 'PAUSED';
      const room = new Room(
        dbRecord.id,
        dbRecord.name,
        dbRecord.host_user_id,
        dbRecord.video_id,
        dbRecord.current_time,
        playState,
        Date.now(),
        dbRecord.room_type || 'private',
        dbRecord.description || '',
        dbRecord.category || 'General'
      );
      this.rooms.set(normalizedId, room);
      console.log(`[RoomManager] Restored room ${normalizedId} (${room.roomType}) from SQLite`);
      return room;
    }

    // 3. Create fresh room
    const video = initialVideoId || config.defaultVideoId;
    const newRoom = new Room(
      normalizedId,
      roomName,
      creatorUserId || '',
      video,
      0,
      'PAUSED',
      Date.now(),
      roomType,
      description,
      category
    );
    this.rooms.set(normalizedId, newRoom);

    // Save to SQLite
    await RoomRepository.saveRoom({
      id: newRoom.id,
      name: newRoom.name,
      hostUserId: newRoom.hostUserId,
      videoId: newRoom.videoId,
      currentTime: newRoom.currentTime,
      playState: newRoom.playState,
      roomType: newRoom.roomType,
      description: newRoom.description,
      category: newRoom.category,
    });

    console.log(`[RoomManager] Created new ${roomType} room ${normalizedId}`);
    return newRoom;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.trim().toUpperCase());
  }

  public findRoomBySocketId(socketId: string): { room: Room; participant: Participant } | null {
    for (const room of this.rooms.values()) {
      const participant = room.getParticipantBySocketId(socketId);
      if (participant) {
        return { room, participant };
      }
    }
    return null;
  }

  /**
   * Retrieves all public rooms, combining live in-memory rooms and persistent SQLite rooms.
   */
  public async getPublicRooms(): Promise<PublicRoomSummary[]> {
    const dbPublicRooms = await RoomRepository.getPublicRooms();
    const result: Map<string, PublicRoomSummary> = new Map();

    // 1. Populate from SQLite records
    for (const record of dbPublicRooms) {
      result.set(record.id, {
        id: record.id,
        name: record.name,
        description: record.description || '',
        category: record.category || 'General',
        roomType: 'public',
        videoId: record.video_id,
        playState: record.play_state,
        currentTime: record.current_time,
        participantsCount: 0,
        createdAt: record.created_at,
      });
    }

    // 2. Override/enrich with active in-memory rooms
    for (const room of this.rooms.values()) {
      if (room.roomType === 'public') {
        result.set(room.id, room.toSummaryJSON());
      }
    }

    // Sort: active rooms with participants first, then recently updated
    return Array.from(result.values()).sort((a, b) => {
      if (b.participantsCount !== a.participantsCount) {
        return b.participantsCount - a.participantsCount;
      }
      return b.createdAt - a.createdAt;
    });
  }

  public async broadcastPublicRooms(io: Server): Promise<void> {
    try {
      const publicRooms = await this.getPublicRooms();
      io.emit('public_rooms_updated', publicRooms);
    } catch (err: any) {
      console.error('[RoomManager] Failed to broadcast public rooms:', err.message);
    }
  }

  public async persistRoom(room: Room): Promise<void> {
    await RoomRepository.updatePlayback(
      room.id,
      room.getEstimatedCurrentTime(),
      room.playState,
      room.videoId
    );
    await RoomRepository.updateRoomDetails(room.id, {
      name: room.name,
      description: room.description,
      category: room.category,
      roomType: room.roomType,
    });
    if (room.hostUserId) {
      await RoomRepository.updateHost(room.id, room.hostUserId);
    }
  }

  public async deleteRoom(roomId: string): Promise<void> {
    const normalizedId = roomId.trim().toUpperCase();
    this.rooms.delete(normalizedId);
    await RoomRepository.deleteRoom(normalizedId);
  }
}
