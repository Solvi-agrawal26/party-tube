# 🏗️ SyncWatch — Architecture & System Design

This document details the architectural principles, data flow, synchronization algorithms, security model, and scaling design of the **SyncWatch YouTube Watch Party** platform.

---

## 1. System Architecture Overview

The system is architected as an event-driven, single-source-of-truth application where the Node.js backend maintains authoritative room state, validates all incoming actions via strict Role-Based Access Control (RBAC), persists room mutations to an SQLite database, and broadcasts updates over bidirectional WebSockets via Socket.IO.

```
                          ┌───────────────────────────┐
                          │     React + Vite SPA      │
                          │   YouTube IFrame Player   │
                          └─────────────▲─────────────┘
                                        │ WebSocket (Socket.IO)
                                        │ JSON / Bi-directional
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Node.js Express Server                            │
│                                                                             │
│  ┌────────────────────────┐                   ┌──────────────────────────┐  │
│  │   MessageHandler.ts    │                   │      RoleManager.ts      │  │
│  │ Event Routing & Guards ├──────────────────►│ RBAC Validation Matrix   │  │
│  └───────────┬────────────┘                   └──────────────────────────┘  │
│              │                                                              │
│              ▼                                                              │
│  ┌────────────────────────┐                   ┌──────────────────────────┐  │
│  │     RoomManager.ts     │                   │     Room OOP Entity      │  │
│  │ Memory Registry + Sync ├──────────────────►│  Time Drift & Election   │  │
│  └───────────┬────────────┘                   └──────────────────────────┘  │
│              │                                                              │
│              ▼                                                              │
│  ┌────────────────────────┐                   ┌──────────────────────────┐  │
│  │   RoomRepository.ts    ├──────────────────►│    SQLite3 Database      │  │
│  │  Async Persistence     │                   │ (Rooms & Chat Messages)  │  │
│  └────────────────────────┘                   └──────────────────────────┘  │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ (Optional via REDIS_URL)
                                        ▼
                        ┌───────────────────────────────┐
                        │    Redis Pub/Sub Cluster      │
                        │ Socket.IO Redis Adapter Scale │
                        └───────────────────────────────┘
```

---

## 2. Event-Driven Real-Time Flow

Every playback command follows a strict 5-stage lifecycle:
1. **Client Trigger:** The user attempts an action (e.g., clicks play, scrubs seekbar, pastes new YouTube URL).
2. **Server Ingestion:** The `MessageHandler` receives the socket event and checks if the socket belongs to an active room.
3. **RBAC Validation:** `RoleManager.canDirectlyControlPlayback(role)` verifies if the user is authorized (`HOST` or `MODERATOR`).
   - If unauthorized, the event is aborted and a `permission_denied` event is dispatched back to the offending client.
4. **Authoritative State Mutation:** The `Room` model updates its internal `playState`, `currentTime`, and updates `lastUpdated = Date.now()`. The change is asynchronously flushed to SQLite.
5. **Room Broadcast:** A `sync_state` payload is broadcasted to all sockets in `io.to(roomId)`. All clients align their YouTube player.

### Event Flow Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Participant as Participant (Bob)
    actor Host as Host (Alice)
    participant Server as Socket.IO Server
    participant Room as Room Model & RBAC
    participant DB as SQLite Database

    Note over Host, Server: 1. Host Starts Video Playback
    Host->>Server: play {}
    Server->>Room: Validate Host Permissions
    Room-->>Server: Allowed (Role: HOST)
    Server->>Room: updatePlayback('PLAYING', currentTime)
    Server->>DB: Persist Playback State
    Server-->>Host: sync_state { playState: 'PLAYING', currentTime, videoId }
    Server-->>Participant: sync_state { playState: 'PLAYING', currentTime, videoId }

    Note over Participant, Host: 2. Participant Request-Approval Workflow
    Participant->>Server: request_action { action: 'seek', payload: { time: 45 } }
    Server->>Room: Store in Pending Requests
    Server-->>Host: request_pending { requestId, username: "Bob", action: "seek", payload: { time: 45 } }
    Host->>Server: approve_request { requestId }
    Server->>Room: Validate Host/Mod Permissions (Allowed)
    Server->>Room: Apply Action: updatePlayback(state, 45)
    Server->>DB: Persist Updated Seek
    Server-->>Host: sync_state { currentTime: 45, playState }
    Server-->>Participant: sync_state { currentTime: 45, playState }
    Server-->>Participant: request_resolved { requestId, status: 'approved' }

    Note over Host, Participant: 3. Role Promotion & Host Failover
    Host->>Server: assign_role { userId: "bob_02", role: "MODERATOR" }
    Server->>Room: Update Bob Role to MODERATOR
    Server-->>Host: role_assigned { userId: "bob_02", role: "MODERATOR" }
    Server-->>Participant: role_assigned { userId: "bob_02", role: "MODERATOR" }

    Host->>Server: Disconnect (Window Closed)
    Server->>Room: autoElectHost() -> Finds Moderator Bob
    Server->>Room: Set Bob as HOST
    Server->>DB: Persist New Host
    Server-->>Participant: host_transferred { newHostId: "bob_02", newHostName: "Bob" }
```

---

## 3. Playback Synchronization & Echo Loop Prevention

### The Echo Loop Problem
When a client receives a remote `sync_state` from the server, it commands its local YouTube IFrame player:
```typescript
player.seekTo(serverTime);
player.playVideo();
```
The YouTube IFrame API triggers an asynchronous `onStateChange` event (`YT.PlayerState.PLAYING`). If the client naively listens to `onStateChange` and emits a `play` socket event back to the server, an infinite broadcast ping-pong loop ensues, flooding the network and causing stuttering.

### Solution: The Remote Execution Lock Flag
```typescript
const isApplyingRemoteRef = useRef<boolean>(false);

const applySyncState = (state: SyncStatePayload) => {
  isApplyingRemoteRef.current = true;

  // Apply state to YouTube player...
  player.seekTo(state.currentTime, true);
  if (state.playState === 'PLAYING') player.playVideo();
  else if (state.playState === 'PAUSED') player.pauseVideo();

  setTimeout(() => {
    isApplyingRemoteRef.current = false;
  }, 600);
};

// YouTube player listener:
onStateChange: (event) => {
  if (isApplyingRemoteRef.current) {
    return; // Suppress programmatic events!
  }
  // Process human user interaction...
}
```

### Time Drift & Elastic Catch-Up
Network latency and client CPU differences cause playback clocks to diverge slightly over time.
- **Tolerance Window (1.5 seconds):** If the client's current time differs from the server's authoritative time by $\le 1.5$ seconds, the player is **not** scrubbed. This prevents jarring audio clicks and stutters.
- **Drift Correction (> 1.5 seconds):** When drift exceeds 1.5 seconds (e.g., network lag spike or tab suspension), the client issues an instantaneous `player.seekTo()` to re-align with the room.
- **Wall-Clock Extrapolation:** The server calculates authoritative time dynamically without polling:
  $$\text{Current Time} = \text{recordedTime} + \frac{\text{Date.now()} - \text{lastUpdated}}{1000} \quad (\text{if PLAYING})$$

---

## 4. Object-Oriented Backend Model

The backend leverages OOP encapsulation:

- **`Room` (`server/src/models/Room.ts`):** Encapsulates room state (`videoId`, `currentTime`, `playState`, `lastUpdated`), participant registry (`Map<string, Participant>`), pending action requests (`Map<string, ActionRequest>`), time extrapolation, and the host failover algorithm (`autoElectHost()`).
- **`Participant` (`server/src/models/Participant.ts`):** Encapsulates user session, socket mapping, role assignment, and identity.
- **`RoleManager` (`server/src/services/RoleManager.ts`):** Pure static RBAC service defining role capabilities and guarding all sensitive operations.
- **`RoomManager` (`server/src/services/RoomManager.ts`):** Singleton manager coordinating in-memory room instances with the SQLite persistence layer.
- **`MessageHandler` (`server/src/services/MessageHandler.ts`):** Decoupled WebSocket dispatcher that routes incoming client socket messages, validates context, and triggers room state updates.

---

## 5. Horizontal Scaling Strategy

To scale SyncWatch beyond a single Node.js process to multiple instances across a cluster or Kubernetes pods:

```
                          ┌───────────────────────────┐
                          │   Cloud Load Balancer     │
                          │     (Sticky Sessions)     │
                          └─────────────┬─────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
   ┌───────────────────────────┐                 ┌───────────────────────────┐
   │    Node.js Instance 1     │                 │    Node.js Instance 2     │
   │  Socket.IO Server (:4000) │                 │  Socket.IO Server (:4000) │
   └─────────────┬─────────────┘                 └─────────────┬─────────────┘
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │      Redis Cluster (Pub/Sub)  │
                        │   @socket.io/redis-adapter    │
                        └───────────────────────────────┘
```

1. **Redis Pub/Sub Adapter:** Enabled via `REDIS_URL`. When instance 1 broadcasts a `sync_state` to room `PARTY-1`, Socket.IO publishes the payload to Redis. Instance 2 receives the Redis message and forwards it to any clients connected to instance 2 in room `PARTY-1`.
2. **Sticky Sessions (Session Affinity):** Required by Socket.IO during HTTP long-polling handshakes prior to WebSocket upgrade. The load balancer hashes client IP or sets an affinity cookie (`Set-Cookie: SERVERID=...`).
3. **Shared Database:** In a multi-server setup, SQLite is swapped for PostgreSQL or MySQL by swapping `database.ts` with connection pooling (`pg` or `mysql2`).

---

## 6. Public Community Channels & Private Watch Parties Architecture

The application bifurcates watch environments into two distinct channels:

### 1. Public Community Channels (Open Lounges)
- **Discovery Mechanism:** Listed in the Community Lobby (`GET /api/rooms/public` and WebSocket `public_rooms_updated` event).
- **Direct Entry:** Any user can click "Join" on a public card without an invitation code. If no display name is entered yet, an inline prompt captures their name before seamless entry.
- **Categorization & Filtering:** Lounges are tagged by category (`Study & Lofi`, `Music & Beats`, `Cinema & Movies`, `Gaming`, `Tech & Code`, `General`), enabling real-time filtering and keyword search.
- **Persistent Seed Lounges:** Default high-fidelity public community lounges (`COMMUNITY-LOFI`, `COMMUNITY-SYNTH`, `COMMUNITY-CINEMA`, `COMMUNITY-GAMING`) are seeded in SQLite on initial database migration, guaranteeing a vibrant community from the moment the server boots.
- **Live Metadata Sync:** Public cards display live viewer counts, current video thumbnail, and playback status (`LIVE` vs `PAUSED`) aggregated across in-memory active rooms and SQLite records.

### 2. Private Watch Parties (Code-Sharing)
- **Isolation:** Private rooms are strictly unlisted from the public API (`GET /api/rooms/public` excludes `room_type = 'private'`).
- **Entry Authentication:** Accessible exclusively via a secret alphanumeric room code (e.g. `PARTY-7X9K2B`) or a direct URL containing `?room=PARTY-7X9K2B`.
- **Use Cases:** Intimate friend watch sessions, private study groups, watch parties with private viewing queues.

### 3. Dynamic On-the-Fly Privacy Toggling
- **Host Empowerment:** Room Hosts can switch their room between `private` and `public` on the fly via the `update_room_details` socket event.
- **Instant Propagation:** When a Host makes a private room public, it immediately broadcasts `room_details` to members and dispatches `public_rooms_updated` to all connected clients browsing the Community Lobby, instantly showing up with live participant counts.
- **RBAC Enforcement:** Non-host participants attempting to toggle visibility or edit metadata receive a `permission_denied` (`HOST_ONLY`) response.
