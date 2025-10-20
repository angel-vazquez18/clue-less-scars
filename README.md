# Clue-Less — Skeletal System Implementation

A complete, modular implementation of the Clue-Less game with a clean architecture designed for independent subsystem development. This project validates the skeletal system architecture through working subsystems that communicate via standardized message protocols.

**Key Highlights:**
- **4 Major Subsystems** with clean separation of concerns
- **27 Message Types** for complete client-server communication
- **Full Web UI** for interactive gameplay demonstration
- **Comprehensive Test Suite** validating architecture
- **Docker Environment** for consistent development

---

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Demo & Testing](#demo--testing)
- [Development](#development)
- [Message Protocol](#message-protocol)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Architecture

This project implements a **message-based modular architecture** with four independent subsystems:

### 📊 Architecture Diagrams

Complete architecture documentation with diagrams available in [`docs/system_diagrams/`](docs/system_diagrams/):

- **[System Overview](docs/system_diagrams/01-system-overview.md)** - High-level subsystem view
- **[Subsystem Decomposition](docs/system_diagrams/02-subsystem-decomposition.md)** - Detailed breakdown
- **[Message Flow](docs/system_diagrams/03-message-flow.md)** - Communication sequences
- **[Layered Architecture](docs/system_diagrams/04-layered-architecture.md)** - 4-tier design
- **[And more...](docs/system_diagrams/00-index.md)** - See index for all diagrams

### 🏗️ Four Major Subsystems

#### 1. Client Subsystem
- **Purpose:** User interface and interaction
- **Technology:** React + Vite
- **Port:** 5173
- **Features:**
  - Real-time game lobby with player management
  - Character selection with visual feedback
  - Interactive game board display
  - Chat system with message history
  - Game controls for all actions

#### 2. Communication Subsystem
- **Purpose:** Protocol and transport management
- **Technology:** WebSocket + HTTP (Express)
- **Port:** 8080
- **Features:**
  - WebSocket for real-time bidirectional communication
  - HTTP fallback API for non-WebSocket clients
  - Message envelope validation
  - Connection lifecycle management

#### 3. Game Logic Subsystem
- **Purpose:** Business rules and game mechanics
- **Components:**
  - Message routing and dispatch
  - Individual handlers for each action type
  - Game rule enforcement
  - Turn management and flow control

#### 4. Data Subsystem
- **Purpose:** State management and persistence
- **Features:**
  - In-memory game state storage
  - Player and turn tracking
  - Board state management
  - Data validation and integrity

### 🔄 Message-Based Communication

All subsystems communicate through **standardized message envelopes**:

```json
{
  "type": "MESSAGE_TYPE",
  "gameId": "game-uuid",
  "payload": { },
  "ts": "2025-10-20T12:00:00.000Z",
  "version": "1.0",
  "requestId": "optional-id"
}
```

**Benefits:**
- Clean subsystem boundaries
- Independent development teams
- Easy testing and validation
- Protocol versioning support
- Extensible design

---

## Features

### Game Features

**Lobby Management:**
- Create and join games with unique Game IDs
- 4-6 player support
- Real-time player list updates
- Player disconnect handling

**Character Selection:**
- 6 unique Clue characters
- Visual selection interface
- Character uniqueness validation
- Change character before game starts
- Real-time synchronization

**Gameplay:**
- Turn-based game flow
- Player movement
- Suggestions and disproving
- Accusations and win detection
- Complete Clue game mechanics

**Communication:**
- Real-time chat system
- Player join/leave notifications
- Game state broadcasts
- Turn notifications

### Technical Features

**Real-Time Communication:**
- WebSocket for instant updates
- Automatic reconnection
- Connection status indicator
- Message queuing

**User Interface:**
- Modern, responsive design
- Real-time message log
- Visual game board
- Interactive controls
- Game ID sharing with one-click copy

**Error Handling:**
- Client-side validation
- Server-side validation
- User-friendly error messages
- Graceful degradation

**Development Experience:**
- Hot reload for both client and server
- Docker Compose orchestration
- Comprehensive logging
- Test suite for validation

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- A web browser

### Run the Application

```bash
# Clone the repository
git clone <repository-url>
cd clue-less-scars

# Start both server and web client
docker compose up --build

# Server will be available at: http://localhost:8080
# Web UI will be available at: http://localhost:5173
```

### Play the Demo

1. **Open the web UI** in your browser: `http://localhost:5173`
2. **Join as first player:**
   - Enter your name (e.g., "Alice")
   - Leave Game ID empty (creates new game)
   - Click "Join Game"
   - Copy the Game ID from the header
3. **Open new browser tabs** for additional players
4. **Join the same game:**
   - Enter different names
   - Paste the Game ID
   - Click "Join Game"
5. **Select characters** (each player chooses a unique character)
6. **Start the game** when 4+ players have characters
7. **Play!** Use chat, make moves, suggestions, and accusations

---

## Demo & Testing

### Running Tests

Tests validate the architecture and message flow:

```bash
# Run all tests
docker compose exec server npm test

# Run specific test suites
docker compose exec server npm run test:envelope
docker compose exec server npm run test:handlers
docker compose exec server npm run test:integration
```

### Test Coverage

**Envelope Tests:** Message structure and validation  
**Handler Tests:** Individual message handlers (join, chat, ping, character, start, move, suggestion, disprove, accusation)  
**Integration Tests:** Multi-player flows and error handling

### What Tests Validate

- **Modular architecture works** - All modules communicate correctly
- **Message flow validated** - Messages route properly between subsystems
- **Error handling robust** - All edge cases handled
- **Independent development ready** - Teams can work on different modules

### Demo Scenarios

The web UI demonstrates:
1. **Multi-player lobby** - 4-6 players joining and chatting
2. **Character selection** - Visual interface with uniqueness validation
3. **Real-time synchronization** - All players see updates instantly
4. **Player disconnect** - Automatic cleanup and notification
5. **Complete game flow** - From lobby to active gameplay

---

## Development

### Recommended VS Code Extensions

For the best development experience, install these extensions:

**Essential:**
- **ES7+ React/Redux/React-Native snippets** (`dsznajder.es7-react-js-snippets`) - React code snippets
- **ESLint** (`dbaeumer.vscode-eslint`) - JavaScript linting
- **Prettier** (`esbenp.prettier-vscode`) - Code formatting
- **Docker** (`ms-azuretools.vscode-docker`) - Docker support

**Helpful:**
- **Markdown Preview Mermaid Support** (`bierner.markdown-mermaid`) - View architecture diagrams
- **GitLens** (`eamodio.gitlens`) - Enhanced Git integration
- **Thunder Client** (`rangav.vscode-thunder-client`) - API testing
- **Error Lens** (`usernamehw.errorlens`) - Inline error display

**Optional:**
- **Auto Rename Tag** (`formulahendry.auto-rename-tag`) - HTML/JSX tag renaming
- **Color Highlight** (`naumovs.color-highlight`) - CSS color preview
- **Path Intellisense** (`christian-kohler.path-intellisense`) - File path autocomplete
- **npm Intellisense** (`christian-kohler.npm-intellisense`) - NPM module imports

### Quick Install (VS Code)

**Automatic (Recommended):**
When you open this project in VS Code, you'll see a notification to install recommended extensions. Click "Install All" to get all extensions at once.

**Manual:**
Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac), type "Extensions: Install Extensions", then search for each extension by name.

**Note:** Extension recommendations are configured in `.vscode/extensions.json`

### Project Structure

```
clue-less-scars/
├── server/                    # Game server (Node.js)
│   ├── handlers/              # Message handlers (10 handlers)
│   │   ├── accusation.js      # Accusation handler
│   │   ├── character.js       # Character selection handler
│   │   ├── chat.js            # Chat handler
│   │   ├── disprove.js        # Disprove handler
│   │   ├── join.js            # Join game handler
│   │   ├── move.js            # Movement handler
│   │   ├── ping.js            # Ping handler
│   │   ├── router.js          # Message router
│   │   ├── start.js           # Start game handler
│   │   └── suggestion.js      # Suggestion handler
│   ├── schema/                # Message types and validation
│   │   ├── envelope.js        # Message envelope validation
│   │   └── types.js           # All message type definitions
│   ├── state/                 # Game state management
│   │   └── games.js           # Game state storage and logic
│   ├── transport/             # WebSocket layer
│   │   └── ws.js              # WebSocket server
│   ├── utils/                 # Helper functions
│   │   └── send.js            # Broadcasting utilities
│   ├── test/                  # Test suite
│   │   ├── envelope.test.js   # Schema validation tests
│   │   ├── handlers.test.js   # Handler unit tests
│   │   ├── integration.test.js # End-to-end tests
│   │   ├── run-tests.js       # Test runner
│   │   ├── test-script.js     # Test orchestrator
│   │   └── README.md          # Test documentation
│   ├── index.js               # Server entry point
│   └── package.json           # Dependencies and scripts
│
├── web/                       # Web client (React + Vite)
│   └── src/
│       ├── components/        # UI components
│       │   ├── Controls.jsx   # Game action controls
│       │   ├── GameBoard.jsx  # Game board display
│       │   ├── GameLobby.jsx  # Lobby and player management
│       │   └── MessageLog.jsx # Real-time message log
│       ├── utils/             # Client utilities
│       │   └── wsClient.js    # WebSocket client manager
│       ├── App.css            # Application styles
│       ├── App.jsx            # Main app component
│       └── main.jsx           # Entry point
│
├── docs/                      # Architecture documentation
│   ├── system_diagrams/       # Abstract architecture diagrams
│   ├── Clue-Less.pdf          # Game rules
│   └── Group Project Assignment.pdf
│
├── docker-compose.yml         # Docker orchestration
├── Dockerfile.server          # Server container definition
├── Dockerfile.web             # Web container definition
└── README.md                  # This file
```

### Local Development

**Start in development mode:**
```bash
docker compose up
```

**View logs:**
```bash
docker compose logs -f server
docker compose logs -f web
```

**Run tests:**
```bash
docker compose exec server npm test
```

**Access containers:**
```bash
docker compose exec server sh
docker compose exec web sh
```

**Stop services:**
```bash
docker compose down
```

### Making Changes

**Server changes:**
- Edit files in `server/`
- Server auto-restarts (nodemon)
- No rebuild needed

**Web changes:**
- Edit files in `web/src/`
- Browser auto-reloads (Vite HMR)
- No rebuild needed

**Dependency changes:**
- Update `package.json`
- Rebuild containers: `docker compose up --build`

---

## Message Protocol

### Message Types (27 total)

**Connection & Info:**
- `INFO`, `ERROR`, `PING`, `PONG`

**Lobby Management:**
- `JOIN_GAME`, `PLAYER_JOINED`, `PLAYER_LEFT`, `LOBBY_STATE`

**Character Selection:**
- `SELECT_CHARACTER`, `CHARACTER_SELECTED`

**Game Setup:**
- `START_GAME`, `GAME_STARTED`, `GAME_STATE`, `YOUR_HAND`

**Turn Management:**
- `TURN_START`

**Movement:**
- `REQUEST_MOVE`, `PLAYER_MOVED`

**Suggestions:**
- `MAKE_SUGGESTION`, `SUGGESTION_MADE`, `PROMPT_DISPROVE`, `RESPOND_DISPROVE`, `DISPROVE_RESULT`

**Accusations:**
- `MAKE_ACCUSATION`, `ACCUSATION_RESOLVED`

**Game End:**
- `GAME_OVER`

**Communication:**
- `CHAT`

### Example: Join Game

**Client sends:**
```json
{
  "type": "JOIN_GAME",
  "gameId": "NEW",
  "payload": { "name": "Alice" },
  "ts": "2025-10-20T12:00:00.000Z",
  "version": "1.0"
}
```

**Server responds:**
```json
{
  "type": "INFO",
  "gameId": "abc-123-def",
  "payload": { "message": "Joined game", "gameId": "abc-123-def" },
  "ts": "2025-10-20T12:00:01.000Z",
  "version": "1.0"
}
```

**Server broadcasts to all players:**
```json
{
  "type": "PLAYER_JOINED",
  "gameId": "abc-123-def",
  "payload": { "playerId": "player-1", "name": "Alice" },
  "ts": "2025-10-20T12:00:01.000Z",
  "version": "1.0"
}
```

### WebSocket Endpoint

```
ws://localhost:8080
```

### HTTP Fallback API

```bash
POST http://localhost:8080/message
Headers: x-player-id: <player-uuid>
Body: <message envelope JSON>
```

---

## Project Structure

### Server Implementation

**Subsystem Mapping:**

| Subsystem | Implementation |
|-----------|----------------|
| Communication Subsystem | `transport/ws.js`, `schema/envelope.js`, `schema/types.js` |
| Game Logic Subsystem | `handlers/*.js` (router + 9 handlers) |
| Data Subsystem | `state/games.js` |

**Key Files:**
- `index.js` - Server entry point, Express + WebSocket setup
- `handlers/router.js` - Message router and dispatcher
- `handlers/*.js` - Individual message handlers
- `schema/types.js` - All message type definitions
- `schema/envelope.js` - Message validation
- `state/games.js` - Game state management
- `utils/send.js` - Broadcasting and messaging utilities

### Web Client Implementation

**Components:**
- `App.jsx` - Main application controller
- `GameLobby.jsx` - Player list, character selection, game start
- `GameBoard.jsx` - Game visualization and information
- `Controls.jsx` - User action controls
- `MessageLog.jsx` - Real-time message display
- `utils/wsClient.js` - WebSocket connection manager

---

## Troubleshooting

### Server won't start

```bash
# Check if port 8080 is in use
lsof -i :8080

# Rebuild containers
docker compose down
docker compose up --build
```

### Web client won't connect

```bash
# Check if server is running
curl http://localhost:8080/healthz

# Check WebSocket connection in browser console
# Should see: "WebSocket connected"
```

### Tests failing

```bash
# Ensure you're in the server container
docker compose exec server sh

# Run tests individually to isolate issues
npm run test:envelope
npm run test:handlers
npm run test:integration
```

### Player not removed on disconnect

- This is a known behavior - disconnect handling is implemented
- Check server logs for disconnect messages
- Verify WebSocket close handler is working

### Game ID not copying

- Ensure browser supports Clipboard API
- Check for HTTPS requirement (localhost should work)
- Try manually selecting and copying text

### Character selection not showing

- Ensure you've joined a game (check Game ID in header)
- Character selection appears after joining
- Must be in lobby (before game starts)

---

## Architecture Validation

This skeletal system successfully demonstrates:

### Independent Development
- **Communication Subsystem** can be developed separately
- **Game Logic Subsystem** can add new rules independently
- **Client Subsystem** can be replaced with different UI
- **Data Subsystem** can switch storage backends

### Message Flow
- All communication via standardized envelopes
- WebSocket provides real-time updates
- HTTP fallback ensures compatibility
- Validation at subsystem boundaries

### Testing
- Each subsystem testable independently
- Integration tests validate communication
- Demo scripts showcase functionality
- Architecture proven through working system

### Key Achievements
- **Complete Clue game implementation** with all mechanics
- **Modular architecture** enabling independent development
- **Comprehensive test suite** with multiple test layers
- **Production-ready code** with robust error handling
- **Dockerized environment** for consistent development
- **Interactive web UI** for demonstration

**This skeletal system successfully validates the architecture and is ready for incremental feature development!**

---

## Credits

**Project:** Clue-Less Skeletal System  
**Course:** Foundations of Software Engineering  
**Institution:** Johns Hopkins University  
**Framework:** Message-based modular architecture

---

## License

Educational project for JHU Foundations of Software Engineering course.
