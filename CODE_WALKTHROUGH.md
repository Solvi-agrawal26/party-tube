# 📖 SyncWatch — Code Walkthrough & Technical Explanations

This guide provides in-depth technical explanations of every library, design pattern, architectural trade-off, and implementation decision in the codebase. Use this document to explain and defend every line of code.

---

## 1. Libraries and Tools: Purpose and Usage

### A. Socket.IO (Server & Client)
- **What it is:** A WebSocket-based real-time bidirectional communication engine with automatic fallback to HTTP long-polling.
- **Why we chose it over raw `ws`:**
  - **Native Rooms & Namespaces:** `socket.join(roomId)` and `io.to(roomId).emit(...)` allow easy grouping of clients into isolated rooms without manual set manipulation.
  - **Reconnection Handling:** Automatic reconnection with exponential backoff and buffered message delivery.
  - **Ecosystem Scale:** Drop-in horizontal clustering via `@socket.io/redis-adapter` without restructuring business logic.
- **Where it lives in the code:**
  - Server initialization: `server/src/index.ts`
  - Event dispatching: `server/src/services/MessageHandler.ts`
  - Client state hook: `client/src/hooks/useSocket.ts`

### B. React 18 + TypeScript + Vite
- **What it is:** Component-driven user interface framework with strict compile-time typing and instant ES modules bundling.
- **Why we chose it:**
  - **Type-Safe Socket Contracts:** Shared interfaces (`types/index.ts`) prevent mismatched event payloads between frontend and backend.
  - **Component Isolation:** Decoupled `VideoPlayer`, `PlaybackControls`, `ChatPanel`, `ParticipantList`, and modals.
  - **Vite:** Instant Hot Module Replacement (HMR) and optimized rollup production bundles.

### C. Express.js
- **What it is:** Minimalist Node.js web server.
- **How it is used:**
  - Serves REST API endpoints (`/health`, `/api/rooms`, `/api/rooms/:id`).
  - Acts as the HTTP host for the Socket.IO WebSocket server.
  - Serves the compiled production React static assets (`client/dist`) and provides SPA wildcard routing (`* -> index.html`) in a single deployable port.

### D. SQLite3 (`sqlite3`)
- **What it is:** Serverless, zero-configuration relational database engine stored in a single file.
- **Why we chose it:**
  - Eliminates external database dependencies for local development and self-hosting.
  - Allows rooms and chat history to persist across server restarts.
  - Easily mounted to a persistent volume (e.g., Render Disk at `/var/data`).

### E. YouTube IFrame Player API
- **What it is:** Google's official embedded player API for programmatic video playback control.
- **How it is used:**
  - Loaded dynamically in `client/src/components/VideoPlayer.tsx`.
  - Methods invoked: `player.loadVideoById()`, `player.seekTo()`, `player.playVideo()`, `player.pauseVideo()`, `player.getCurrentTime()`.
  - Event listeners: `onReady`, `onStateChange`.

---

## 2. Real-Time Synchronization Mechanism

### How WebSockets Enable Simultaneous Playback
Traditional HTTP REST requires continuous polling (e.g., querying the server every second), which introduces latency, high network overhead, and clock divergence.

With WebSockets:
1. **Persistent Full-Duplex Connection:** Clients maintain an open TCP socket with the server.
2. **Instant Event Dispatch:** When the Host clicks "Pause", a lightweight JSON frame (`{}`) travels to the server in milliseconds.
3. **Broadcasting:** The server broadcasts `sync_state` to all room members simultaneously.
4. **Late Joiner Catch-Up:** When a new user joins an existing party, the server calculates:
   $$\text{Current Time} = \text{room.currentTime} + \frac{\text{Date.now()} - \text{room.lastUpdated}}{1000}$$
   The joining client starts playing at the exact current second, catching up immediately.

---

## 3. Backend Role-Based Access Control (RBAC)

### Security Principle: Never Trust the Client
Client-side UI disabling is purely for user experience. Malicious users can easily open browser DevTools and execute `socket.emit('change_video', { videoId: 'evil' })`.

### The Backend Defense Layer
Every incoming event is routed through `MessageHandler.ts` and validated against `RoleManager.ts`:
1. **Context Resolution (`getSocketContext`):**
   - Retrieves socket session data.
   - Verifies room exists in memory/database.
   - Verifies user is registered in the room.
2. **Permission Check:**
   ```typescript
   if (!RoleManager.canDirectlyControlPlayback(participant.role)) {
     socket.emit('permission_denied', {
       code: 'FORBIDDEN',
       message: 'Only Host or Moderator can control playback. Use "Request Action" instead.',
     });
     return; // Abort state update
   }
   ```
3. **Audit & Log:** All forbidden attempts are logged and safely rejected with an error payload.

---

## 4. Participant Request & Approval Workflow

To prevent participants from disrupting movies while still giving them a voice:
1. **Request Submission (`request_action`):**
   - A `PARTICIPANT` submits a request (e.g. `seek` to 45s, `change_video` to URL).
   - The server validates the payload (parsing YouTube video ID if applicable).
   - An `ActionRequest` object is created with a unique ID and added to `room.pendingRequests`.
2. **Host/Mod Notification (`request_pending`):**
   - The server pushes the pending request to all users with approval rights (`HOST` and `MODERATOR`).
   - A badge counter and notification banner appears on their UI.
3. **Resolution (`approve_request` or `reject_request`):**
   - If approved: The server applies the requested action to the authoritative room state, deletes the pending request, and broadcasts `sync_state` and `request_resolved { status: 'approved' }` to the room.
   - If rejected: The request is cleared from memory and a `request_resolved { status: 'rejected' }` notification is sent.

---

## 5. Technical Decisions & Trade-Offs

### 1. Player Drift vs. Choppy Seeking
- **Challenge:** If we force `player.seekTo()` on every minor fraction of a second difference, playback stutters, audio clicks, and video frames freeze.
- **Solution:** A 1.5-second tolerance deadband. As long as the local video time is within 1.5 seconds of the server, the local player runs uninterrupted. Only if latency spikes or a seek occurs does the player snap to the authoritative position.

### 2. The Echo Loop Mitigation
- **Challenge:** Programmatic player changes trigger `onStateChange`, which might emit an outgoing socket event back to the server, creating an infinite broadcast loop.
- **Solution:** A lock flag (`isApplyingRemoteRef.current = true`). Before applying server state to the YouTube player, the flag is raised. Any player events during this window are discarded. The flag resets after 600ms.

### 3. Host Disconnect & Auto-Election
- **Challenge:** If the room creator closes their browser tab, the room could be left without a host, locking all participant controls.
- **Solution:** On socket disconnect, `room.removeParticipant(userId)` checks if the departed user was `hostUserId`. If true, `room.autoElectHost()` scans for any existing `MODERATOR`, or promotes the earliest-joined `PARTICIPANT`. The server broadcasts `host_transferred`, ensuring smooth uninterrupted viewing.

### 4. Single-Port Unified Architecture
- **Challenge:** Hosting frontend (e.g., on Vercel) and backend (on Render) separately requires configuring cross-origin CORS, environment variable domain mappings, and managing two deployments.
- **Solution:** In production, Express serves the built Vite bundle (`client/dist`). Both API, WebSockets, and HTML run on one unified port (`PORT=4000`), completely eliminating CORS issues in production and allowing deployment to a single web service.
