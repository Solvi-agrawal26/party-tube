import { dbGet, dbRun, dbAll } from './database';
import { RoomRecord, ChatMessagePayload, PlayState, RoomType } from '../types';

export class RoomRepository {
  static async findById(id: string): Promise<RoomRecord | null> {
    const row = await dbGet<RoomRecord>('SELECT * FROM rooms WHERE id = ?', [id]);
    return row || null;
  }

  static async getPublicRooms(): Promise<RoomRecord[]> {
    const rows = await dbAll<RoomRecord>(
      `SELECT * FROM rooms WHERE room_type = 'public' ORDER BY updated_at DESC`
    );
    return rows;
  }

  static async saveRoom(room: {
    id: string;
    name: string;
    hostUserId: string;
    videoId: string;
    currentTime: number;
    playState: PlayState;
    roomType?: RoomType;
    description?: string;
    category?: string;
  }): Promise<void> {
    const now = Date.now();
    const roomType = room.roomType || 'private';
    const description = room.description || '';
    const category = room.category || 'General';

    await dbRun(
      `INSERT INTO rooms (id, name, host_user_id, video_id, current_time, play_state, room_type, description, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         host_user_id = excluded.host_user_id,
         video_id = excluded.video_id,
         current_time = excluded.current_time,
         play_state = excluded.play_state,
         room_type = excluded.room_type,
         description = excluded.description,
         category = excluded.category,
         updated_at = excluded.updated_at`,
      [
        room.id,
        room.name,
        room.hostUserId,
        room.videoId,
        room.currentTime,
        room.playState,
        roomType,
        description,
        category,
        now,
        now,
      ]
    );
  }

  static async updateRoomDetails(
    roomId: string,
    details: { name?: string; description?: string; category?: string; roomType?: RoomType }
  ): Promise<void> {
    const existing = await this.findById(roomId);
    if (!existing) return;

    const name = details.name !== undefined ? details.name : existing.name;
    const description = details.description !== undefined ? details.description : existing.description;
    const category = details.category !== undefined ? details.category : existing.category;
    const roomType = details.roomType !== undefined ? details.roomType : existing.room_type;

    await dbRun(
      `UPDATE rooms SET name = ?, description = ?, category = ?, room_type = ?, updated_at = ? WHERE id = ?`,
      [name, description, category, roomType, Date.now(), roomId]
    );
  }

  static async updatePlayback(
    roomId: string,
    currentTime: number,
    playState: PlayState,
    videoId?: string
  ): Promise<void> {
    const now = Date.now();
    if (videoId) {
      await dbRun(
        'UPDATE rooms SET current_time = ?, play_state = ?, video_id = ?, updated_at = ? WHERE id = ?',
        [currentTime, playState, videoId, now, roomId]
      );
    } else {
      await dbRun(
        'UPDATE rooms SET current_time = ?, play_state = ?, updated_at = ? WHERE id = ?',
        [currentTime, playState, now, roomId]
      );
    }
  }

  static async updateHost(roomId: string, hostUserId: string): Promise<void> {
    await dbRun('UPDATE rooms SET host_user_id = ?, updated_at = ? WHERE id = ?', [
      hostUserId,
      Date.now(),
      roomId,
    ]);
  }

  static async deleteRoom(roomId: string): Promise<void> {
    await dbRun('DELETE FROM rooms WHERE id = ?', [roomId]);
    await dbRun('DELETE FROM chat_messages WHERE room_id = ?', [roomId]);
  }
}

export class ChatRepository {
  static async saveMessage(roomId: string, msg: ChatMessagePayload): Promise<void> {
    await dbRun(
      `INSERT INTO chat_messages (id, room_id, user_id, username, role, message, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [msg.id, roomId, msg.userId, msg.username, msg.role, msg.message, msg.timestamp]
    );
  }

  static async getRecentMessages(roomId: string, limit: number = 50): Promise<ChatMessagePayload[]> {
    const rows = await dbAll<any>(
      `SELECT id, user_id as userId, username, role, message, timestamp
       FROM chat_messages
       WHERE room_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [roomId, limit]
    );
    return rows.reverse();
  }
}
