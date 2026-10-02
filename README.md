# 🍿 PartyTube — Real-Time YouTube Watch Party

A full-stack, production-ready collaborative video streaming platform that lets multiple users watch YouTube videos together in real time. Features zero-drift synchronization, strict role-based access control (RBAC), a participant request-and-approval workflow, live chat, floating emoji reactions, and persistent SQLite storage.

---

## 🌐 Live Public Deployment

> **Live Demo URL:** `https://party-tube.onrender.com` *(Follow the instructions below to make this live)*
>
> *(To deploy your own live instance in under 3 minutes, follow the [Deployment Guide](#-deployment-guide) below!)*

---

## ✨ Features

- **🌐 Public Community Channels & Lounges:** Open public watch spaces discoverable by anyone in the Community Explorer. Users can filter lounges by category (`Study & Lofi`, `Music & Beats`, `Cinema & Movies`, `Gaming`, `Tech & Code`), search by vibe/topic, and see live viewer counts and video thumbnails.
- **🔒 Private Watch Parties (Code-Sharing):** Private, unlisted watch rooms protected by a secret room code and shareable invite link (`?room=PARTY-XXXXXX`). Only users with the code or direct invitation URL can join.
- **⚙️ Dynamic Host Privacy Controls:** Hosts can toggle their channels between Private and Public on the fly, edit room titles, descriptions, and categories in real time without disconnecting viewers.
- **⚡ Real-Time Playback Synchronization:** Host actions (Play, Pause, Seek scrubbing, Change Video) synchronize seamlessly to all room participants via WebSockets.
- **🛡️ Role-Based Access Control (RBAC):**
  - **Host (Admin):** Room creator with full authority. Can control playback, promote/demote participants, transfer host ownership, toggle visibility, and kick participants.
  - **Moderator:** Can directly control playback (play, pause, seek, switch video) and approve/reject participant action requests.
  - **Participant:** Default role for joiners. View-only mode with action request capabilities.
  - **Viewer:** Dedicated spectator role.
- **🤝 Participant Request & Approval Workflow:** Restricted participants can request to play, pause, seek to a specific timestamp, or load a new YouTube video. Hosts and Moderators receive an actionable modal/toast to approve or reject the request before it takes effect for everyone.
- **🔄 YouTube URL & ID Parser:** Paste standard watch URLs (`youtube.com/watch?v=...`), short links (`youtu.be/...`), embed URLs (`youtube.com/embed/...`), shorts (`youtube.com/shorts/...`), or direct 11-character video IDs.
- **💬 Real-Time Chat & Floating Reactions:** Integrated chat room with unique user avatars, role badges, and timestamps. Floating emoji reactions (`❤️`, `🔥`, `😂`, `👏`, `🎉`, `🍿`) float across the video canvas in real-time.
- **💾 Persistent Room Storage (SQLite):** Room state, video position, playback status, channel visibility, and chat messages are persisted to SQLite so rooms survive server restarts.
- **🔁 Automatic Host Failover:** If the host leaves or disconnects, the server automatically promotes an active Moderator or the earliest-joined Participant to Host, ensuring rooms are never left hostless.
- **📈 Scalable Architecture:** Supports optional Redis pub/sub (`@socket.io/redis-adapter`) via `REDIS_URL` for multi-instance horizontal scaling behind a load balancer with sticky sessions.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Vanilla Modern CSS (Design Tokens, Glassmorphism, Dark Theme) |
| **Icons & Effects** | Lucide React, Canvas Confetti |
| **Video Player** | Official YouTube IFrame Player API |
| **Backend** | Node.js, Express, Socket.IO (v4), TypeScript |
| **Database** | SQLite3 (`sqlite3`) with schema migrations and async repository layer |
| **Horizontal Scaling**| `@socket.io/redis-adapter` + `ioredis` (conditional via `REDIS_URL`) |

---

## 🚀 Quickstart: Running Locally

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone <repository-url>
cd WEB

# Install all dependencies for both client and server
npm run install:all
```

### 2. Configure Environment Variables
Copy the example environment files:
```bash
cp .env.example .env
cp server/.env.example server/.env
```

### 3. Build & Run
```bash
# Build both frontend and backend
npm run build

# Start the unified production server
npm start
```
Open **[http://localhost:4000](http://localhost:4000)** in your browser!

### Development Mode (Hot-Reload)
To run with hot-reload during active development:
```bash
# In Terminal 1 (Backend dev server):
npm run dev:server

# In Terminal 2 (Frontend Vite dev server with proxy):
npm run dev:client
```
Visit `http://localhost:5173` for Vite client with HMR.

---

## ⚙️ Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP & WebSocket server port |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `CLIENT_ORIGIN` | `*` | Allowed CORS origins (e.g. `http://localhost:5173`) |
| `DB_PATH` | `./watch_party.db` | Absolute or relative path to the SQLite database file |
| `DEFAULT_VIDEO_ID` | `jfKfPfyJRdk` | Default initial YouTube video ID when creating a room |
| `REDIS_URL` | *(empty)* | Optional Redis connection string for horizontal multi-instance scaling |

---

## 🚢 Deployment Guide

The application is structured as a **single-service deployment**: the Node.js Express server serves both the Socket.IO WebSocket server, the REST API, and the compiled React production bundle from `client/dist`.

### Option A: Deploy to Render (Recommended)
1. Fork or push this repository to GitHub.
2. Sign in to **[Render](https://render.com)**.
3. Click **New +** -> **Blueprint**, and connect your GitHub repository.
4. Render will automatically detect [`render.yaml`](./render.yaml).
5. Review the plan settings:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Disk:** 1 GB persistent disk mounted to `/var/data` for SQLite persistence.
6. Click **Apply**. Once built, copy your live Render URL (e.g. `https://your-app.onrender.com`) and paste it into the placeholder at the top of this README.

### Option B: Deploy to Railway
1. Sign in to **[Railway](https://railway.app)**.
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select your repository.
4. Railway will automatically detect [`railway.json`](./railway.json) and execute `npm run build` followed by `npm start`.
5. Under service **Variables**, set:
   - `NODE_ENV`: `production`
   - `PORT`: `${{PORT}}`
6. Under **Networking**, generate a public domain (e.g. `your-app.up.railway.app`).

### Option C: Platform Limits & Considerations
- **Cold Starts:** Free-tier instances (e.g., Render free tier) sleep after 15 minutes of inactivity. Initial page load may take 30-50 seconds to spin up.
- **WebSockets on Vercel:** Vercel serverless functions do not maintain persistent WebSocket connections. This is why the unified Express + Socket.IO server is deployed to Render or Railway.
- **Ephemeral Filesystems:** Without a persistent disk mount, SQLite files are reset on redeployments. On Render, the included `render.yaml` attaches a persistent disk mount at `/var/data`.

---

## 🔒 Role-Permission Matrix

| Capability | Host (Admin) | Moderator | Participant | Viewer |
|---|:---:|:---:|:---:|:---:|
| Play / Pause Playback | ✅ Direct | ✅ Direct | ⚠️ Request | ⚠️ Request |
| Seek Timeline | ✅ Direct | ✅ Direct | ⚠️ Request | ⚠️ Request |
| Change YouTube Video | ✅ Direct | ✅ Direct | ⚠️ Request | ⚠️ Request |
| Approve / Reject Requests | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| Promote / Demote Roles | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Remove (Kick) Participant | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Transfer Host Role | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Chat & Send Reactions | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

---

## 🧪 Testing & Verification

Run the automated 29-test WebSocket integration test suite:
```bash
node test_e2e_socket.js
```
Run the multi-browser Puppeteer visual capture test:
```bash
node capture_browser_e2e.js
```

---

## 📄 License
MIT
