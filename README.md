# Clue-Less — Dockerized Development Environment (Skeletal Increment)

This repository provides a **browser-based, Dockerized development setup** for the Clue-Less project’s.

- **Server:** Node.js (Express + `ws`) WebSocket backend  
- **Web Client:** React + Vite single-page application  
- **Dev Experience:** Hot reload for both services via Docker Compose  


---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Folder Structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running the Environment](#running-the-environment)
- [Using the Web App](#using-the-web-app)
- [Health Checks & Logs](#health-checks--logs)
- [Configuration](#configuration)
- [Implemented Features (Skeletal Increment)](#implemented-features-skeletal-increment)
- [Next Steps](#next-steps)
- [Troubleshooting](#troubleshooting)
- [Credits](#credits)

---

## Architecture Overview

This development environment runs **two containers** side by side:

### Server (`clue-less-server`)
- Port **8080**
- **Express** HTTP API with `/healthz`
- **WebSocket** endpoint using `ws`
- Maintains an **in-memory game registry**
- Broadcasts state updates to all connected players in a game

### Web Client (`clue-less-web`)
- Port **5173**
- Built with **React + Vite**
- Connects to the WebSocket server
- Supports Join, Chat, Ping, and displays the live Lobby roster

---

## Folder Structure

```
.
├─ Dockerfile.server             # Node.js dev image (nodemon)
├─ Dockerfile.web                # React + Vite image
├─ docker-compose.yml            # Defines both containers
├─ .dockerignore
├─ server/
│  ├─ package.json               # Server dependencies
│  └─ server.js                  # Express + WebSocket implementation
└─ web/
   ├─ package.json               # Client dependencies
   ├─ index.html
   └─ src/
      ├─ main.jsx
      └─ App.jsx
```

---

## Prerequisites

- Docker Desktop or Docker Engine + Compose plugin
- Open local ports **8080** (server) and **5173** (client)

> Node.js is not required locally — all builds run inside Docker.

---

## Running the Environment

Start the entire environment:

```bash
docker compose up --build
```

Access the services:
- Web Client: [http://localhost:5173](http://localhost:5173)
- Server Health Check: [http://localhost:8080/healthz](http://localhost:8080/healthz)

Stop containers:
```bash
docker compose down
```

Reset (remove volumes, containers, cache):
```bash
docker compose down -v
```

---

## Using the Web App

1. Open [http://localhost:5173](http://localhost:5173)
2. In the first tab:
   - Leave **Game ID** as `NEW`
   - Enter your **Display Name**
   - Click **Join**
   - The server assigns a `gameId` and returns it.
3. In other browser tabs or windows:
   - Paste the assigned `gameId`
   - Enter another name
   - Click **Join** again

You’ll see:
- `PLAYER_JOINED` messages with player names
- A **Lobby** list with all joined players
- Working Ping and Chat interactions

---

## Health Checks & Logs

**Check server health:**
```bash
curl http://localhost:8080/healthz
# -> { "ok": true, "ts": "...", "version": "1.0" }
```

**View logs:**
```bash
docker compose logs -f server
docker compose logs -f web
```

**Rebuild after dependency updates:**
```bash
docker compose build
docker compose up
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|-----------|--------------|----------|
| `PORT` | Server port | `8080` |
| `VITE_WS_URL` | WebSocket URL (client) | `ws://localhost:8080` |

### Ports
- Server: `8080` (HTTP + WebSocket)
- Client: `5173` (Vite dev server)

---

## Implemented Features (Skeletal Increment)

### Message Envelope
```json
{
  "type": "STRING",
  "gameId": "UUID or 'NEW'",
  "payload": {},
  "ts": "ISO-8601",
  "version": "1.0",
  "requestId": "STRING?"
}
```

### Supported Message Types

**Client → Server**
- `JOIN_GAME` `{ name }`
- `PING`
- `CHAT` `{ message }`

**Server → Client**
- `INFO` `{ message, gameId? }`
- `ERROR` `{ code, message }`
- `YOUR_HAND` `{ cards: [] }`
- `GAME_STATE` `{ players, you, turn }`
- `PLAYER_JOINED` `{ playerId, name, message }`
- `LOBBY_STATE` `{ players: [{ id, name, characterId }] }`

> The Skeletal Increment focuses on **message flow validation** rather than full game logic.

---

## Next Steps

### Planned for the Minimal Increment
- Character selection (`SELECT_CHARACTER`) with uniqueness rules
- Turn loop and move/suggestion handling
- Basic GUI board visualization
- Reconnect handling and game state recovery

---

## Troubleshooting

**Port already in use:**  
Free ports 8080/5173 or update `docker-compose.yml` mappings.

**Client can’t connect:**  
Ensure the server container is healthy (`docker ps`) and `VITE_WS_URL` is reachable.

**No live reload:**  
Rebuild containers if dependencies changed:
```bash
docker compose build && docker compose up
```

**Authentication issues pushing to GitHub:**  
Use SSH keys or a GitHub personal access token (PAT).

---

## Credits

Developed by **SCARS Software Solutions** as part of the Clue-Less project (EN.605.601.84.FA25).

**Technologies:**
- Server: Node.js, Express, ws, uuid  
- Client: React, Vite  
- Dev Environment: Docker, Docker Compose with live reload

