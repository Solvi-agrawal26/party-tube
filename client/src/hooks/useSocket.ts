import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Role,
  PlayState,
  ActionType,
  ActionRequest,
  ParticipantData,
  SyncStatePayload,
  ChatMessagePayload,
  ReactionPayload,
  ToastMessage,
  RoomType,
  PublicRoomSummary,
  RoomDetailsPayload,
} from '../types';

const BACKEND_URL = ((import.meta as any).env?.VITE_BACKEND_URL as string) || '';

export function useSocket(onToast: (toast: Omit<ToastMessage, 'id'>) => void) {
  const socketRef = useRef<Socket | null>(null);

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<ParticipantData | null>(null);
  const [roomDetails, setRoomDetails] = useState<RoomDetailsPayload | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [syncState, setSyncState] = useState<SyncStatePayload>({
    playState: 'PAUSED',
    currentTime: 0,
    videoId: 'jfKfPfyJRdk',
    updatedAt: Date.now(),
  });
  const [chatMessages, setChatMessages] = useState<ChatMessagePayload[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ActionRequest[]>([]);
  const [activeReactions, setActiveReactions] = useState<ReactionPayload[]>([]);

  // Keep fresh references to avoid stale closures in socket event handlers
  const currentUserRef = useRef<ParticipantData | null>(null);
  currentUserRef.current = currentUser;

  const currentRoomIdRef = useRef<string | null>(null);
  currentRoomIdRef.current = currentRoomId;

  // Stable client userId persisted across refreshes
  const myUserIdRef = useRef<string>(
    (() => {
      let stored = localStorage.getItem('wp_user_id');
      if (!stored) {
        stored = `user_${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem('wp_user_id', stored);
      }
      return stored;
    })()
  );

  // Initialize socket connection
  useEffect(() => {
    // In dev / unified mode, connect to window.location.origin; or to VITE_BACKEND_URL if deployed on Vercel
    const socketOptions = {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    };
    const socket = BACKEND_URL ? io(BACKEND_URL, socketOptions) : io(socketOptions);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected with ID:', socket.id);
      socket.emit('get_public_rooms');

      // Auto-rejoin room if socket reconnected during an active party
      if (currentRoomIdRef.current && currentUserRef.current) {
        console.log('[Socket] Reconnected - rejoining active room:', currentRoomIdRef.current);
        socket.emit('join_room', {
          roomId: currentRoomIdRef.current,
          username: currentUserRef.current.username,
          userId: myUserIdRef.current,
        });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket] Disconnected');
    });

    // Public rooms list updates
    socket.on('public_rooms_updated', (rooms: PublicRoomSummary[]) => {
      setPublicRooms(rooms);
    });

    // Room metadata updates
    socket.on('room_details', (details: RoomDetailsPayload) => {
      setRoomDetails(details);
    });

    socket.on('sync_state', (state: SyncStatePayload) => {
      setSyncState(state);
    });

    socket.on('user_joined', ({ userId, username, role, participants, roomDetails: incomingDetails }) => {
      setParticipants(participants);
      if (incomingDetails) {
        setRoomDetails(incomingDetails);
      }
      // If this was our own user, store our record
      const me = participants.find(
        (p: ParticipantData) => p.socketId === socket.id || p.userId === myUserIdRef.current
      );
      if (me) {
        setCurrentUser(me);
      }
      onToast({
        type: 'info',
        title: 'User Joined',
        description: `${username} joined as ${role.toLowerCase()}`,
      });
    });

    socket.on('user_left', ({ username, participants }) => {
      setParticipants(participants);
      onToast({
        type: 'info',
        title: 'User Left',
        description: `${username} left the room`,
      });
    });

    socket.on('role_assigned', ({ userId, username, role, participants }) => {
      setParticipants(participants);
      const isMe = currentUserRef.current?.userId === userId || myUserIdRef.current === userId;
      if (isMe) {
        setCurrentUser((prev) => (prev ? { ...prev, role } : null));
        if (role === 'PARTICIPANT' || role === 'VIEWER') {
          setPendingRequests([]);
        }
        onToast({
          type: 'success',
          title: 'Role Updated',
          description: `Your role is now ${role}`,
        });
      } else {
        onToast({
          type: 'info',
          title: 'Role Updated',
          description: `${username} is now ${role}`,
        });
      }
    });

    socket.on('host_transferred', ({ newHostName, participants, newHostId }) => {
      setParticipants(participants);
      const isMe = currentUserRef.current?.userId === newHostId || myUserIdRef.current === newHostId;
      if (isMe) {
        setCurrentUser((prev) => (prev ? { ...prev, role: 'HOST' } : null));
        onToast({
          type: 'success',
          title: 'You are now Host! 👑',
          description: 'Full room controls have been transferred to you.',
        });
      } else {
        onToast({
          type: 'warning',
          title: 'Host Transferred',
          description: `${newHostName} is now the Host.`,
        });
      }
    });

    socket.on('participant_removed', ({ userId, participants, reason }) => {
      const isMe = currentUserRef.current?.userId === userId || myUserIdRef.current === userId;
      if (isMe) {
        // We were removed
        setCurrentRoomId(null);
        setCurrentUser(null);
        setRoomDetails(null);
        setParticipants([]);
        setPendingRequests([]);
        setChatMessages([]);
        window.history.replaceState({}, '', window.location.pathname);
        onToast({
          type: 'error',
          title: 'Removed from Room',
          description: reason || 'You were removed by the host.',
        });
      } else {
        setParticipants(participants);
      }
    });

    socket.on('request_pending', (req: ActionRequest) => {
      setPendingRequests((prev) => [...prev.filter((r) => r.id !== req.id), req]);
      onToast({
        type: 'warning',
        title: 'Action Request',
        description: `${req.username} requested to ${req.action.replace('_', ' ')}`,
      });
    });

    socket.on('request_resolved', ({ requestId, status, action, resolvedBy }) => {
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      onToast({
        type: status === 'approved' ? 'success' : 'warning',
        title: `Request ${status.toUpperCase()}`,
        description: `Action "${action}" was ${status} by ${resolvedBy}`,
      });
    });

    socket.on('chat_message', (msg: ChatMessagePayload) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('reaction_received', (rxn: ReactionPayload) => {
      setActiveReactions((prev) => [...prev, rxn]);
      // Remove reaction after 3 seconds
      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((r) => r.id !== rxn.id));
      }, 3000);
    });

    socket.on('permission_denied', (err) => {
      onToast({
        type: 'error',
        title: 'Permission Denied',
        description: err.message,
      });
    });

    socket.on('error', (err) => {
      onToast({
        type: 'error',
        title: 'Error',
        description: err.message,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Actions
  const joinRoom = useCallback(
    (
      roomId: string,
      username: string,
      options?: {
        userId?: string;
        roomType?: RoomType;
        name?: string;
        description?: string;
        category?: string;
        videoId?: string;
      }
    ) => {
      if (!socketRef.current) return;
      const cleanRoomId = roomId.trim().toUpperCase();
      setCurrentRoomId(cleanRoomId);
      const effectiveUserId = options?.userId || myUserIdRef.current;
      socketRef.current.emit('join_room', {
        roomId: cleanRoomId,
        username,
        userId: effectiveUserId,
        roomType: options?.roomType,
        name: options?.name,
        description: options?.description,
        category: options?.category,
        videoId: options?.videoId,
      });

      // Update URL query parameter
      window.history.replaceState({}, '', `?room=${cleanRoomId}`);

      // Fetch persistent recent messages for this room
      fetch(`${BACKEND_URL}/api/rooms/${cleanRoomId}/messages`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages && Array.isArray(data.messages)) {
            setChatMessages(data.messages);
          }
        })
        .catch((err) => console.warn('[Chat] Failed to fetch recent messages:', err));
    },
    []
  );

  const leaveRoom = useCallback(() => {
    if (!socketRef.current || !currentRoomId) return;
    socketRef.current.emit('leave_room', { roomId: currentRoomId });
    setCurrentRoomId(null);
    setCurrentUser(null);
    setRoomDetails(null);
    setParticipants([]);
    setPendingRequests([]);
    setChatMessages([]);
    window.history.replaceState({}, '', window.location.pathname);
    socketRef.current.emit('get_public_rooms');
  }, [currentRoomId]);

  const updateRoomDetails = useCallback(
    (details: { name?: string; description?: string; category?: string; roomType?: RoomType }) => {
      socketRef.current?.emit('update_room_details', details);
    },
    []
  );

  const fetchPublicRooms = useCallback(() => {
    socketRef.current?.emit('get_public_rooms');
    fetch(`${BACKEND_URL}/api/rooms/public`)
      .then((res) => res.json())
      .then((data) => {
        if (data.rooms) setPublicRooms(data.rooms);
      })
      .catch((err) => console.warn('Failed to fetch public rooms via API:', err));
  }, []);

  const play = useCallback(() => {
    socketRef.current?.emit('play');
  }, []);

  const pause = useCallback(() => {
    socketRef.current?.emit('pause');
  }, []);

  const seek = useCallback((time: number) => {
    socketRef.current?.emit('seek', { time });
  }, []);

  const changeVideo = useCallback((videoId: string) => {
    socketRef.current?.emit('change_video', { videoId });
  }, []);

  const assignRole = useCallback((userId: string, role: Role) => {
    socketRef.current?.emit('assign_role', { userId, role });
  }, []);

  const removeParticipant = useCallback((userId: string) => {
    socketRef.current?.emit('remove_participant', { userId });
  }, []);

  const transferHost = useCallback((userId: string) => {
    socketRef.current?.emit('transfer_host', { userId });
  }, []);

  const requestAction = useCallback((action: ActionType, payload?: { time?: number; videoId?: string }) => {
    socketRef.current?.emit('request_action', { action, payload });
    onToast({
      type: 'info',
      title: 'Request Sent',
      description: 'Your request was sent to the Host/Moderator for approval.',
    });
  }, [onToast]);

  const approveRequest = useCallback((requestId: string) => {
    socketRef.current?.emit('approve_request', { requestId });
  }, []);

  const rejectRequest = useCallback((requestId: string) => {
    socketRef.current?.emit('reject_request', { requestId });
  }, []);

  const sendMessage = useCallback((message: string) => {
    socketRef.current?.emit('chat_message', { message });
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    socketRef.current?.emit('send_reaction', { emoji });
  }, []);

  const sendHeartbeat = useCallback((currentTime: number, playState: PlayState) => {
    socketRef.current?.emit('sync_heartbeat', { currentTime, playState });
  }, []);

  return {
    isConnected,
    currentRoomId,
    currentUser,
    roomDetails,
    publicRooms,
    participants,
    syncState,
    chatMessages,
    pendingRequests,
    activeReactions,
    joinRoom,
    leaveRoom,
    updateRoomDetails,
    fetchPublicRooms,
    play,
    pause,
    seek,
    changeVideo,
    assignRole,
    removeParticipant,
    transferHost,
    requestAction,
    approveRequest,
    rejectRequest,
    sendMessage,
    sendReaction,
    sendHeartbeat,
  };
}
