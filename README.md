# LetzChat

LetzChat is a full-stack real-time chat application built with the **MERN** stack (MongoDB, Express, React, Node.js) and **Socket.IO** for live messaging. It supports direct messages, group chats, file sharing, and a range of messaging features such as replies, reactions, pins, edits, and user blocking.

**Repository:** [https://github.com/MuraliKrishnaDK/LetzChat-Application](https://github.com/MuraliKrishnaDK/LetzChat-Application)

## Features

- **Authentication** — Register, login, and logout with password hashing (bcrypt)
- **User profiles** — Username, email, optional phone, and DiceBear-based avatars
- **Direct messages (DMs)** — Real-time text and file messages via Socket.IO
- **Group chats** — Create groups, add members, group avatars, leave group, shared content view
- **Messaging** — Reply threads, emoji reactions, pin messages, edit and delete (with live sync)
- **Search** — Search messages in conversations
- **Privacy** — Block users; blocked senders cannot deliver new DMs to the blocker
- **Chat management** — Clear chat history (per user), delete chats, forward messages
- **Voice & video calls** — 1:1 WebRTC calls with Socket.IO signaling (DMs only)
- **UI** — Styled with styled-components; emoji picker; toast notifications

## Tech stack

| Layer | Technologies |
|--------|----------------|
| Frontend | React 17, React Router 6, Axios, Socket.IO client, WebRTC, styled-components, emoji-picker-react, DiceBear |
| Backend | Node.js, Express, Mongoose, Socket.IO, bcrypt, multer (file uploads), CORS |
| Database | MongoDB |

## Project structure

```
LetzChat Application/
├── public/                 # React app (Create React App)
│   ├── src/
│   │   ├── components/     # Chat UI, contacts, profile, groups, etc.
│   │   ├── pages/          # Login, Register, Chat
│   │   ├── context/        # Chat appearance / theme
│   │   └── utils/          # API route constants (includes API host)
│   └── package.json
├── server/                 # Express + Socket.IO API
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── uploads/            # Served at /uploads (user files; not committed)
│   ├── index.js
│   └── package.json
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [MongoDB](https://www.mongodb.com/) — local instance or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) connection string

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/MuraliKrishnaDK/LetzChat-Application.git
cd LetzChat-Application
```

### 2. Backend (`server/`)

Create a `.env` file in `server/` (see `server/.env.example`):

| Variable | Description |
|----------|-------------|
| `MONGO_URL` | MongoDB connection string |
| `PORT` | API and Socket.IO server port (default **5002**) |
| `CLIENT_ORIGIN` | Frontend URL(s), comma-separated for multiple origins |
| `SERVER_URL` | Public backend URL used for uploaded file links |

Install dependencies and start the server:

```bash
cd server
npm install
npm start
```

The server exposes REST routes under `/api/auth`, `/api/messages`, and `/api/groups`, and attaches Socket.IO to the same HTTP server.

### 3. Frontend (`public/`)

Create a `.env` file in `public/` from the example:

```bash
cd ../public
cp .env.example .env
```

The example sets `REACT_APP_LOCALHOST_KEY` and `REACT_APP_API_HOST` — the backend URL the React app uses for REST and Socket.IO.

Install dependencies and run the React app:

```bash
npm install
npm start
```

By default the UI runs on port **3001** and connects to `http://localhost:5002` (see `REACT_APP_API_HOST` in `public/.env.example`). The server allows CORS from `CLIENT_ORIGIN` (default `http://localhost:3001`).

### 4. Open the app

Visit [http://localhost:3001](http://localhost:3001), register an account, set an avatar if prompted, and start chatting. For DMs between two users, register two accounts (e.g. two browser profiles or incognito).

### 5. Voice and video calls

In a **direct message** chat, use the phone and camera icons in the chat header to start a voice or video call. The other user must be **online** in the app to receive the call.

- Calls use **WebRTC** for media and **Socket.IO** for signaling (offer/answer/ICE).
- **Google STUN** is used by default for NAT traversal.
- For reliable calls across **different networks**, configure a **TURN server** in `public/.env` (see `.env.example`).

## Cross-network access (different computers)

To use LetzChat from computers on **different networks**, both machines must reach the **same backend** over the internet.

### Option A — Tunnel (quickest for demos)

1. Start the backend locally (`npm start` in `server/`).
2. Expose it with [ngrok](https://ngrok.com/) or similar:
   ```bash
   ngrok http 5002
   ```
3. Set on the **server** `.env`:
   ```
   SERVER_URL=https://YOUR-NGROK-URL.ngrok-free.app
   CLIENT_ORIGIN=http://localhost:3001,https://YOUR-FRONTEND-URL
   ```
4. Set on the **frontend** `.env`:
   ```
   REACT_APP_API_HOST=https://YOUR-NGROK-URL.ngrok-free.app
   ```
5. Restart both servers. Share the frontend URL (or run frontend locally on each machine pointing at the same `REACT_APP_API_HOST`).

### Option B — Deploy backend publicly

Deploy the Express server (Render, Railway, AWS, etc.) with MongoDB Atlas. Set:

| Where | Variable | Example |
|-------|----------|---------|
| Server | `MONGO_URL` | Atlas connection string |
| Server | `SERVER_URL` | `https://api.yourdomain.com` |
| Server | `CLIENT_ORIGIN` | `https://app.yourdomain.com` |
| Frontend | `REACT_APP_API_HOST` | `https://api.yourdomain.com` |

### Option C — Same LAN (different computers, same Wi‑Fi)

1. Find the host machine's LAN IP (e.g. `192.168.1.100`).
2. Server `.env`: `CLIENT_ORIGIN=http://192.168.1.50:3001,http://192.168.1.100:3001`
3. Frontend `.env` on each PC: `REACT_APP_API_HOST=http://192.168.1.100:5002`
4. Allow inbound port **5002** on the host firewall.

**Note:** Browsers require **HTTPS** (or `localhost`) for camera/microphone access. For remote users, serve the frontend over HTTPS or use localhost on each machine with a public API tunnel.

## Deploy on Render (recommended)

LetzChat is configured for a **single Render Web Service** that runs the Express API, Socket.IO, and the React production build together.

### Prerequisites

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free cluster — copy the connection string.
2. Push this repo to GitHub (`MuraliKrishnaDK/LetzChat-Application`).

### Render setup

1. On Render, click **New → Web Service** and connect `LetzChat-Application`.
2. Use these settings:

| Setting | Value |
|---------|--------|
| **Root Directory** | *(leave blank — repo root)* |
| **Runtime** | Node |
| **Build Command** | `npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/ping` |

3. Add **Environment Variables**:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `MONGO_URL` | Your MongoDB Atlas connection string |
| `CLIENT_ORIGIN` | `https://YOUR-SERVICE-NAME.onrender.com` |
| `SERVER_URL` | `https://YOUR-SERVICE-NAME.onrender.com` |

Replace `YOUR-SERVICE-NAME` with the URL Render assigns (e.g. `letzchat-api`). **Use the same URL** for both `CLIENT_ORIGIN` and `SERVER_URL` on the monolith deploy.

4. Click **Deploy**. First build takes a few minutes (installs + React build).

5. Open `https://YOUR-SERVICE-NAME.onrender.com` in a browser — register and chat.

Alternatively, import `render.yaml` via **New → Blueprint** for the same configuration.

### Render notes

- **Free tier** services spin down after inactivity; first load may take ~30 seconds.
- **File uploads** are stored on ephemeral disk and are **lost on redeploy** — use cloud storage (S3, Cloudinary) for production persistence.
- **Voice/video calls** work over HTTPS on Render; add TURN credentials in a future build env if calls fail across strict networks.
- **Do not** set Root Directory to `server/` only — the build must compile the React app in `public/` first.

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| *(root)* | `npm run build` | Build React app + install server deps (Render) |
| *(root)* | `npm start` | Start production server |
| `server/` | `npm run dev` | Run API with nodemon (local dev) |
| `public/` | `npm start` | Dev server (port from `.env`) |
| `public/` | `npm run build` | Production build to `public/build/` |

## Deploying or changing hosts

For production or a non-local API:

1. Set `REACT_APP_API_HOST` in `public/.env` to your backend URL.
2. Set `CLIENT_ORIGIN` and `SERVER_URL` in `server/.env` to match your frontend and public API URLs.
3. For video calls across networks, add TURN credentials to `public/.env` (`REACT_APP_TURN_*`).

Ensure `MONGO_URL` and `PORT` are set appropriately on the server environment.

## License

This project is provided as-is for portfolio and learning purposes. Add a license file if you intend to open-source under specific terms.

## Author

[MuraliKrishnaDK](https://github.com/MuraliKrishnaDK)
