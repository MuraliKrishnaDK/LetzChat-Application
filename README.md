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
- **UI** — Styled with styled-components; emoji picker; toast notifications

## Tech stack

| Layer | Technologies |
|--------|----------------|
| Frontend | React 17, React Router 6, Axios, Socket.IO client, styled-components, emoji-picker-react, DiceBear |
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
| `PORT` | API and Socket.IO server port (default used in the client is **5001**) |

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

The example sets `REACT_APP_LOCALHOST_KEY` — the localStorage key used for the logged-in user session object.

Install dependencies and run the React app:

```bash
npm install
npm start
```

By default the UI expects the API at `http://localhost:5001` (see `public/src/utils/APIRoutes.js`). The Socket.IO server allows CORS from `http://localhost:3000` in `server/index.js`.

### 4. Open the app

Visit [http://localhost:3000](http://localhost:3000), register an account, set an avatar if prompted, and start chatting. For DMs between two users, register two accounts (e.g. two browser profiles or incognito).

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| `server/` | `npm start` | Run API with nodemon |
| `public/` | `npm start` | Dev server (port 3000) |
| `public/` | `npm run build` | Production build to `public/build/` |

## Deploying or changing hosts

For production or a non-local API:

1. Update `host` in `public/src/utils/APIRoutes.js` to your backend URL.
2. Update the Socket.IO `cors.origin` in `server/index.js` to your frontend origin.

Ensure `MONGO_URL` and `PORT` are set appropriately on the server environment.

## License

This project is provided as-is for portfolio and learning purposes. Add a license file if you intend to open-source under specific terms.

## Author

[MuraliKrishnaDK](https://github.com/MuraliKrishnaDK)
