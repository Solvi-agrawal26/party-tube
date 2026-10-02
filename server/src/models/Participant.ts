import { Role, ParticipantData } from '../types';

export class Participant {
  public readonly userId: string;
  public socketId: string;
  public username: string;
  public role: Role;
  public readonly joinedAt: number;

  constructor(userId: string, socketId: string, username: string, role: Role = 'PARTICIPANT') {
    this.userId = userId;
    this.socketId = socketId;
    this.username = username.trim() || 'Anonymous';
    this.role = role;
    this.joinedAt = Date.now();
  }

  public updateRole(newRole: Role): void {
    this.role = newRole;
  }

  public updateSocketId(newSocketId: string): void {
    this.socketId = newSocketId;
  }

  public toJSON(): ParticipantData {
    return {
      userId: this.userId,
      socketId: this.socketId,
      username: this.username,
      role: this.role,
      joinedAt: this.joinedAt,
    };
  }
}
