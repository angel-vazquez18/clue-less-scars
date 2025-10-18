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




RUNNING INSTRUCTION:

Run:

    npm install (only needs to be done once)
    node server.js


In another terminal Run:

    npm i -g wscat (only needs to be done once)
    wscat -c ws://localhost:8080

Then in the wscat terminal, you can run the following commands below


Basic JSON commands for testing the Server (Paste as one line)

(1) JOIN_GAME
Creates or joins a new game
{  
    "type": "JOIN_GAME",  
    "gameId": "NEW",  
    "payload": { "name": "Alice" },  
    "ts": "2025-10-12T00:00:00.000Z",  
    "version": "1.0",  
    "requestId": "r1"
}

After this, you will recieve a gameId which you will use for subsequent commands

(2) SELECT_CHARACTER
Pick a unique character (after joining)

{
  "type": "SELECT_CHARACTER",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": { "characterId": "MISS_SCARLET" },
  "ts": "2025-10-16T00:00:10.000Z",
  "version": "1.0",
  "requestId": "r2"
}

(3) START_GAME
Start the game (once at least 2 players have joined)

{
  "type": "START_GAME",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {},
  "ts": "2025-10-16T00:00:20.000Z",
  "version": "1.0",
  "requestId": "r3"
}

(4) REQUEST_MOVE
Move to a new location

{
  "type": "REQUEST_MOVE",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {
    "to": "ROOM",
    "targetId": "KITCHEN",
    "useSecretPassage": false
  },
  "ts": "2025-10-16T00:00:30.000Z",
  "version": "1.0",
  "requestId": "r4"
}

(5) MAKE_SUGGESTION
Make a suggestion (suspect, weapon, current room)

{
  "type": "MAKE_SUGGESTION",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {
    "suspectId": "PROF_PLUM",
    "weaponId": "CANDLESTICK"
  },
  "ts": "2025-10-16T00:00:40.000Z",
  "version": "1.0",
  "requestId": "r5"
}

(6) RESPOND_DISPROVE
Respond to a suggestion

{
  "type": "RESPOND_DISPROVE",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {
    "cardId": "PROF_PLUM"
  },
  "ts": "2025-10-16T00:00:50.000Z",
  "version": "1.0",
  "requestId": "r6"
}

(omit cardId to indicate you cannot disprove)

(7) MAKE_ACCUSATION
Make a final accusation

{
  "type": "MAKE_ACCUSATION",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {
    "suspectId": "PROF_PLUM",
    "weaponId": "ROPE",
    "roomId": "KITCHEN"
  },
  "ts": "2025-10-16T00:01:00.000Z",
  "version": "1.0",
  "requestId": "r7"
}

(8) CHAT (broadcast)
Send a chat message to all players

{
  "type": "CHAT",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": { "message": "Good luck everyone!" },
  "ts": "2025-10-16T00:01:10.000Z",
  "version": "1.0",
  "requestId": "r8"
}

(9) CHAT (private)
Send a private chat message to a specific player

{
  "type": "CHAT",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {
    "message": "Don’t tell anyone, but I think it’s Plum.",
    "to": "PLAYER_ID_OF_TARGET"
  },
  "ts": "2025-10-16T00:01:20.000Z",
  "version": "1.0",
  "requestId": "r9"
}

(10) PING
Keepalive / latency test

{
  "type": "PING",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": { "seq": 1 },
  "ts": "2025-10-16T00:01:30.000Z",
  "version": "1.0",
  "requestId": "r10"
}


RUNNING INSTRUCTION:

Run:

    npm install (only needs to be done once)
    node server.js


In another terminal Run:

    npm i -g wscat (only needs to be done once)
    wscat -c ws://localhost:8080

Then in the wscat terminal, you can run the following commands below


Basic JSON commands for testing the Server (Paste as one line)

(1) JOIN_GAME
Creates or joins a new game
{  
    "type": "JOIN_GAME",  
    "gameId": "NEW",  
    "payload": { "name": "Alice" },  
    "ts": "2025-10-12T00:00:00.000Z",  
    "version": "1.0",  
    "requestId": "r1"
}

After this, you will recieve a gameId which you will use for subsequent commands

(2) SELECT_CHARACTER
Pick a unique character (after joining)

{
  "type": "SELECT_CHARACTER",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": { "characterId": "MISS_SCARLET" },
  "ts": "2025-10-16T00:00:10.000Z",
  "version": "1.0",
  "requestId": "r2"
}

(3) START_GAME
Start the game (once at least 2 players have joined)

{
  "type": "START_GAME",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {},
  "ts": "2025-10-16T00:00:20.000Z",
  "version": "1.0",
  "requestId": "r3"
}

(4) REQUEST_MOVE
Move to a new location

{
  "type": "REQUEST_MOVE",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {
    "to": "ROOM",
    "targetId": "KITCHEN",
    "useSecretPassage": false
  },
  "ts": "2025-10-16T00:00:30.000Z",
  "version": "1.0",
  "requestId": "r4"
}

(5) MAKE_SUGGESTION
Make a suggestion (suspect, weapon, current room)

{
  "type": "MAKE_SUGGESTION",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {
    "suspectId": "PROF_PLUM",
    "weaponId": "CANDLESTICK"
  },
  "ts": "2025-10-16T00:00:40.000Z",
  "version": "1.0",
  "requestId": "r5"
}

(6) RESPOND_DISPROVE
Respond to a suggestion

{
  "type": "RESPOND_DISPROVE",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {
    "cardId": "PROF_PLUM"
  },
  "ts": "2025-10-16T00:00:50.000Z",
  "version": "1.0",
  "requestId": "r6"
}

(omit cardId to indicate you cannot disprove)

(7) MAKE_ACCUSATION
Make a final accusation

{
  "type": "MAKE_ACCUSATION",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {
    "suspectId": "PROF_PLUM",
    "weaponId": "ROPE",
    "roomId": "KITCHEN"
  },
  "ts": "2025-10-16T00:01:00.000Z",
  "version": "1.0",
  "requestId": "r7"
}

(8) CHAT (broadcast)
Send a chat message to all players

{
  "type": "CHAT",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": { "message": "Good luck everyone!" },
  "ts": "2025-10-16T00:01:10.000Z",
  "version": "1.0",
  "requestId": "r8"
}

(9) CHAT (private)
Send a private chat message to a specific player

{
  "type": "CHAT",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": {
    "message": "Don’t tell anyone, but I think it’s Plum.",
    "to": "PLAYER_ID_OF_TARGET"
  },
  "ts": "2025-10-16T00:01:20.000Z",
  "version": "1.0",
  "requestId": "r9"
}

(10) PING
Keepalive / latency test

{
  "type": "PING",
  "gameId": "YOUR_GAME_ID_HERE",
  "payload": { "seq": 1 },
  "ts": "2025-10-16T00:01:30.000Z",
  "version": "1.0",
  "requestId": "r10"
}