import { Server, Socket } from 'socket.io';
import { nanoid } from 'nanoid';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  Role,
  ActionType,
  ActionRequest,
  ChatMessagePayload,
  ReactionPayload,
} from '../types';
import { RoomManager } from './RoomManager';
import { RoleManager } from './RoleManager';
import { Participant } from '../models/Participant';
import { extractYouTubeVideoId } from '../utils/youtube';
import { ChatRepository } from '../db/repository';

export class MessageHandler {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private roomManager: RoomManager;

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
    this.roomManager = RoomManager.getInstance();
  }

  public registerEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    // 0. Get Public Rooms (for lobby discovery)
    socket.on('get_public_rooms', async () => {
      const publicRooms = await this.roomManager.getPublicRooms();
      socket.emit('public_rooms_updated', publicRooms);
    });

    // 1. Join Room
    socket.on('join_room', async ({ roomId, username, userId, roomType, name, description, category, videoId }) => {
      try {
        if (!roomId || !username) {
          socket.emit('error', { code: 'INVALID_INPUT', message: 'Room ID and username are required.' });
          return;
        }

        const normalizedRoomId = roomId.trim().toUpperCase();
        const effectiveUserId = userId || `user_${nanoid(8)}`;
        const trimmedUsername = username.trim() || 'Guest';

        let cleanVideoId: string | undefined = undefined;
        if (videoId) {
          cleanVideoId = extractYouTubeVideoId(videoId) || undefined;
        }

        const room = await this.roomManager.getOrCreateRoom(
          normalizedRoomId,
          name || (roomType === 'public' ? 'Public Community Lounge' : 'Watch Party'),
          effectiveUserId,
          roomType || 'private',
          description || '',
          category || 'General',
          cleanVideoId
        );

        // Check if user is already in room or reconnecting
        let participant = room.getParticipant(effectiveUserId);
        if (participant) {
          participant.updateSocketId(socket.id);
          participant.username = trimmedUsername;
        } else {
          // If first user, role becomes HOST; else PARTICIPANT
          const role: Role = room.getParticipantCount() === 0 ? 'HOST' : 'PARTICIPANT';
          participant = new Participant(effectiveUserId, socket.id, trimmedUsername, role);
          room.addParticipant(participant);
        }

        // Join Socket.io room channel
        socket.join(normalizedRoomId);

        // Attach room info to socket data
        socket.data = { roomId: normalizedRoomId, userId: effectiveUserId };

        const participantsList = room.getParticipantsList();
        const roomDetails = room.getRoomDetails();

        // Broadcast to all room members
        this.io.to(normalizedRoomId).emit('user_joined', {
          userId: participant.userId,
          username: participant.username,
          role: participant.role,
          participants: participantsList,
          roomDetails,
        });

        // Send current authoritative sync_state and room details to late joiner immediately
        socket.emit('room_details', roomDetails);
        socket.emit('sync_state', room.getSyncState());

        // Send existing pending requests if the user is Host/Mod
        if (RoleManager.canApproveRequests(participant.role)) {
          for (const req of room.getPendingRequestsList()) {
            socket.emit('request_pending', req);
          }
        }

        // Broadcast updated public rooms if public room
        if (room.roomType === 'public') {
          await this.roomManager.broadcastPublicRooms(this.io);
        }

        console.log(`[Socket] User ${participant.username} (${participant.role}) joined ${normalizedRoomId} (${room.roomType})`);
      } catch (err: any) {
        console.error('[Socket] join_room error:', err);
        socket.emit('error', { code: 'JOIN_FAILED', message: err.message || 'Failed to join room' });
      }
    });

    // 2. Play
    socket.on('play', async () => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (!RoleManager.canDirectlyControlPlayback(participant.role)) {
        socket.emit('permission_denied', {
          code: 'FORBIDDEN',
          message: 'Only Host or Moderator can directly start playback. Use "Request Action" instead.',
          action: 'play',
        });
        return;
      }

      room.updatePlayback('PLAYING', room.getEstimatedCurrentTime());
      this.io.to(room.id).emit('sync_state', room.getSyncState());
      await this.roomManager.persistRoom(room);
    });

    // 3. Pause
    socket.on('pause', async () => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (!RoleManager.canDirectlyControlPlayback(participant.role)) {
        socket.emit('permission_denied', {
          code: 'FORBIDDEN',
          message: 'Only Host or Moderator can pause playback. Use "Request Action" instead.',
          action: 'pause',
        });
        return;
      }

      room.updatePlayback('PAUSED', room.getEstimatedCurrentTime());
      this.io.to(room.id).emit('sync_state', room.getSyncState());
      await this.roomManager.persistRoom(room);
    });

    // 4. Seek
    socket.on('seek', async ({ time }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (!RoleManager.canDirectlyControlPlayback(participant.role)) {
        socket.emit('permission_denied', {
          code: 'FORBIDDEN',
          message: 'Only Host or Moderator can seek video timeline. Use "Request Action" instead.',
          action: 'seek',
        });
        return;
      }

      const validTime = Math.max(0, Number(time) || 0);
      room.updatePlayback(room.playState, validTime);
      this.io.to(room.id).emit('sync_state', room.getSyncState());
      await this.roomManager.persistRoom(room);
    });

    // 5. Change Video
    socket.on('change_video', async ({ videoId }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (!RoleManager.canDirectlyControlPlayback(participant.role)) {
        socket.emit('permission_denied', {
          code: 'FORBIDDEN',
          message: 'Only Host or Moderator can change video. Use "Request Action" instead.',
          action: 'change_video',
        });
        return;
      }

      const cleanVideoId = extractYouTubeVideoId(videoId);
      if (!cleanVideoId) {
        socket.emit('error', {
          code: 'INVALID_VIDEO',
          message: 'Invalid YouTube link or Video ID. Please check the URL.',
        });
        return;
      }

      room.updatePlayback('PLAYING', 0, cleanVideoId);
      this.io.to(room.id).emit('sync_state', room.getSyncState());
      await this.roomManager.persistRoom(room);
    });

    // 6. Assign Role (Host Only)
    socket.on('assign_role', async ({ userId, role }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (!RoleManager.canAssignRole(participant.role)) {
        socket.emit('permission_denied', {
          code: 'HOST_ONLY',
          message: 'Only the Host can assign or change participant roles.',
          action: 'assign_role',
        });
        return;
      }

      const targetParticipant = room.getParticipant(userId);
      if (!targetParticipant) {
        socket.emit('error', { code: 'NOT_FOUND', message: 'Target participant not found in room.' });
        return;
      }

      // If assigning HOST, transfer host instead
      if (role === 'HOST') {
        const previousHostId = room.hostUserId;
        room.transferHost(userId);
        this.io.to(room.id).emit('host_transferred', {
          previousHostId,
          newHostId: userId,
          newHostName: targetParticipant.username,
          participants: room.getParticipantsList(),
        });
        await this.roomManager.persistRoom(room);
        return;
      }

      targetParticipant.updateRole(role);
      this.io.to(room.id).emit('role_assigned', {
        userId: targetParticipant.userId,
        username: targetParticipant.username,
        role: targetParticipant.role,
        participants: room.getParticipantsList(),
      });

      // If promoted to MODERATOR, deliver any existing pending requests
      if (RoleManager.canApproveRequests(targetParticipant.role)) {
        for (const req of room.getPendingRequestsList()) {
          this.io.to(targetParticipant.socketId).emit('request_pending', req);
        }
      }
    });

    // 7. Remove Participant (Host Only)
    socket.on('remove_participant', async ({ userId }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (!RoleManager.canRemoveParticipant(participant.role)) {
        socket.emit('permission_denied', {
          code: 'HOST_ONLY',
          message: 'Only the Host can remove participants.',
          action: 'remove_participant',
        });
        return;
      }

      if (userId === participant.userId) {
        socket.emit('error', { code: 'INVALID_ACTION', message: 'Host cannot kick themselves. Transfer host first.' });
        return;
      }

      const removed = room.removeParticipant(userId);
      if (removed) {
        // Clear socket data so subsequent disconnect does not re-trigger leave error
        const targetSocket = this.io.sockets.sockets.get(removed.socketId);
        if (targetSocket) {
          targetSocket.data = {};
          targetSocket.leave(room.id);
        }

        // Disconnect or notify target socket
        this.io.to(removed.socketId).emit('participant_removed', {
          userId: removed.userId,
          participants: room.getParticipantsList(),
          reason: 'You were removed by the room host.',
        });

        // Notify remaining room members
        this.io.to(room.id).emit('participant_removed', {
          userId: removed.userId,
          participants: room.getParticipantsList(),
        });
      }
    });

    // 8. Transfer Host (Host Only)
    socket.on('transfer_host', async ({ userId }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (!RoleManager.canTransferHost(participant.role)) {
        socket.emit('permission_denied', {
          code: 'HOST_ONLY',
          message: 'Only the current Host can transfer room ownership.',
          action: 'transfer_host',
        });
        return;
      }

      const previousHostId = participant.userId;
      const target = room.transferHost(userId);
      if (target) {
        this.io.to(room.id).emit('host_transferred', {
          previousHostId,
          newHostId: target.userId,
          newHostName: target.username,
          participants: room.getParticipantsList(),
        });
        await this.roomManager.persistRoom(room);
        // Deliver pending requests to new host
        for (const req of room.getPendingRequestsList()) {
          this.io.to(target.socketId).emit('request_pending', req);
        }
      } else {
        socket.emit('error', { code: 'NOT_FOUND', message: 'Target participant not found in room.' });
      }
    });

    // 9. Participant Request Action Flow
    socket.on('request_action', async ({ action, payload }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      // Validate payload for specific actions
      let cleanPayload = payload;
      if (action === 'change_video' && payload?.videoId) {
        const cleanId = extractYouTubeVideoId(payload.videoId);
        if (!cleanId) {
          socket.emit('error', { code: 'INVALID_VIDEO', message: 'Invalid YouTube URL or ID.' });
          return;
        }
        cleanPayload = { ...payload, videoId: cleanId };
      } else if (action === 'seek') {
        const validTime = Math.max(0, Number(payload?.time) || 0);
        cleanPayload = { ...payload, time: validTime };
      }

      const actionRequest: ActionRequest = {
        id: `req_${nanoid(10)}`,
        userId: participant.userId,
        username: participant.username,
        action,
        payload: cleanPayload,
        timestamp: Date.now(),
      };

      room.addPendingRequest(actionRequest);

      // Broadcast pending request to Host and Moderators
      for (const p of room.getParticipantsList()) {
        if (RoleManager.canApproveRequests(p.role)) {
          this.io.to(p.socketId).emit('request_pending', actionRequest);
        }
      }

      console.log(`[Request] ${participant.username} requested action: ${action}`);
    });

    // 10. Approve Request
    socket.on('approve_request', async ({ requestId }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (!RoleManager.canApproveRequests(participant.role)) {
        socket.emit('permission_denied', {
          code: 'FORBIDDEN',
          message: 'Only Host or Moderator can approve participant requests.',
          action: 'approve_request',
        });
        return;
      }

      const request = room.getPendingRequest(requestId);
      if (!request) {
        socket.emit('error', { code: 'NOT_FOUND', message: 'Request not found or already resolved.' });
        return;
      }

      room.removePendingRequest(requestId);

      // Execute requested action
      if (request.action === 'play') {
        room.updatePlayback('PLAYING', room.getEstimatedCurrentTime());
      } else if (request.action === 'pause') {
        room.updatePlayback('PAUSED', room.getEstimatedCurrentTime());
      } else if (request.action === 'seek' && typeof request.payload?.time === 'number') {
        room.updatePlayback(room.playState, request.payload.time);
      } else if (request.action === 'change_video' && request.payload?.videoId) {
        room.updatePlayback('PLAYING', 0, request.payload.videoId);
      }

      // Broadcast sync_state and resolution to everyone
      this.io.to(room.id).emit('sync_state', room.getSyncState());
      this.io.to(room.id).emit('request_resolved', {
        requestId,
        status: 'approved',
        action: request.action,
        resolvedBy: participant.username,
      });

      await this.roomManager.persistRoom(room);
    });

    // 11. Reject Request
    socket.on('reject_request', async ({ requestId }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (!RoleManager.canApproveRequests(participant.role)) {
        socket.emit('permission_denied', {
          code: 'FORBIDDEN',
          message: 'Only Host or Moderator can reject participant requests.',
          action: 'reject_request',
        });
        return;
      }

      const request = room.getPendingRequest(requestId);
      if (!request) return;

      room.removePendingRequest(requestId);

      this.io.to(room.id).emit('request_resolved', {
        requestId,
        status: 'rejected',
        action: request.action,
        resolvedBy: participant.username,
      });
    });

    // 12. Chat Messages
    socket.on('chat_message', async ({ message }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (!message || typeof message !== 'string' || !message.trim()) return;

      const chatPayload: ChatMessagePayload = {
        id: `msg_${nanoid(10)}`,
        userId: participant.userId,
        username: participant.username,
        role: participant.role,
        message: message.trim().slice(0, 500),
        timestamp: Date.now(),
      };

      this.io.to(room.id).emit('chat_message', chatPayload);
      await ChatRepository.saveMessage(room.id, chatPayload);
    });

    // 13. Emoji Reactions
    socket.on('send_reaction', async ({ emoji }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (!emoji || typeof emoji !== 'string') return;

      const reactionPayload: ReactionPayload = {
        id: `rxn_${nanoid(10)}`,
        userId: participant.userId,
        username: participant.username,
        emoji: emoji.slice(0, 8),
        timestamp: Date.now(),
      };

      this.io.to(room.id).emit('reaction_received', reactionPayload);
    });

    // 14. Sync Heartbeat (Host sends every ~5s to keep drift minimized)
    socket.on('sync_heartbeat', async ({ currentTime, playState }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      // Only accept authoritative heartbeats from Host
      if (participant.role === 'HOST') {
        room.updatePlayback(playState, Math.max(0, currentTime));
      }
    });

    // 15. Update Room Details (Host Only: toggle Public/Private, rename, change category)
    socket.on('update_room_details', async ({ name, description, category, roomType }) => {
      const context = this.getSocketContext(socket);
      if (!context) return;
      const { room, participant } = context;

      if (participant.role !== 'HOST') {
        socket.emit('permission_denied', {
          code: 'HOST_ONLY',
          message: 'Only the Host can update room settings and visibility.',
          action: 'update_room_details',
        });
        return;
      }

      room.updateDetails(name, description, category, roomType);
      await this.roomManager.persistRoom(room);

      const updatedDetails = room.getRoomDetails();
      this.io.to(room.id).emit('room_details', updatedDetails);

      // Always broadcast public rooms update to keep explorer updated
      await this.roomManager.broadcastPublicRooms(this.io);
      console.log(`[Socket] Room ${room.id} updated: visibility is now ${room.roomType}`);
    });

    // 16. Leave Room / Disconnect
    const handleLeave = async () => {
      const context = this.getSocketContext(socket, false);
      if (!context) return;
      const { room, participant } = context;

      // Clear socket data to avoid re-triggering error on subsequent disconnect
      socket.data = {};
      room.removeParticipant(participant.userId);
      socket.leave(room.id);

      console.log(`[Socket] ${participant.username} left room ${room.id}`);

      // If room is now empty, pause playback to prevent runaway drift & persist
      if (room.getParticipantCount() === 0) {
        room.updatePlayback('PAUSED', room.getEstimatedCurrentTime());
        await this.roomManager.persistRoom(room);
      } else if (room.hostUserId === participant.userId) {
        // If user was Host and participants remain, auto-promote someone else
        const newHost = room.autoElectHost();
        if (newHost) {
          this.io.to(room.id).emit('host_transferred', {
            previousHostId: participant.userId,
            newHostId: newHost.userId,
            newHostName: newHost.username,
            participants: room.getParticipantsList(),
          });
          await this.roomManager.persistRoom(room);
          for (const req of room.getPendingRequestsList()) {
            this.io.to(newHost.socketId).emit('request_pending', req);
          }
        }
      }

      this.io.to(room.id).emit('user_left', {
        userId: participant.userId,
        username: participant.username,
        participants: room.getParticipantsList(),
      });

      // Update public rooms listing if this was a public room
      if (room.roomType === 'public') {
        await this.roomManager.broadcastPublicRooms(this.io);
      }
    };

    socket.on('leave_room', handleLeave);
    socket.on('disconnect', handleLeave);
  }

  private getSocketContext(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    emitError: boolean = true
  ): { room: any; participant: Participant } | null {
    const roomId = socket.data?.roomId;
    const userId = socket.data?.userId;

    if (!roomId || !userId) {
      const match = this.roomManager.findRoomBySocketId(socket.id);
      if (!match) {
        if (emitError) {
          socket.emit('error', { code: 'NOT_IN_ROOM', message: 'You are not in an active room.' });
        }
        return null;
      }
      return match;
    }

    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      if (emitError) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
      }
      return null;
    }

    const participant = room.getParticipant(userId);
    if (!participant) {
      if (emitError) {
        socket.emit('error', { code: 'USER_NOT_IN_ROOM', message: 'User not registered in room.' });
      }
      return null;
    }

    return { room, participant };
  }
}
