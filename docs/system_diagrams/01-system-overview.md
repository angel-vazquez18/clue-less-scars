# System Overview

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Subsystem"
        CLIENT[Client Application]
    end
    
    subgraph "Communication Subsystem"
        COMM[Communication Layer<br/>WebSocket & HTTP]
    end
    
    subgraph "Game Server Subsystem"
        GAME_LOGIC[Game Logic Manager]
        STATE_MGR[State Manager]
    end
    
    subgraph "Data Subsystem"
        DATA[Data Storage & Validation]
    end
    
    CLIENT <-->|Standardized<br/>Message Envelopes| COMM
    COMM <-->|Validated<br/>Messages| GAME_LOGIC
    GAME_LOGIC <-->|State Operations| STATE_MGR
    GAME_LOGIC <-->|Read/Write| DATA
    STATE_MGR <-->|Persist| DATA
```

## Description

The Clue-Less system is built on four major subsystems that communicate through well-defined interfaces:

### Client Subsystem
- Provides user interface for gameplay
- Manages client-side state and user interactions
- Communicates via standardized message envelopes

### Communication Subsystem
- Handles all network communication (WebSocket + HTTP)
- Validates message format and structure
- Routes messages between client and server

### Game Server Subsystem
- Processes game logic and business rules
- Manages game flow and turn order
- Enforces game constraints

### Data Subsystem
- Maintains authoritative game state
- Validates data integrity
- Provides state query and update operations

