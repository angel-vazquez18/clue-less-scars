# Subsystem Decomposition

## Detailed Subsystem Breakdown

```mermaid
graph TB
    subgraph "Presentation Layer"
        UI[User Interface<br/>Subsystem]
        UI_COMPONENTS[UI Components]
        UI_STATE[UI State Management]
        
        UI --> UI_COMPONENTS
        UI --> UI_STATE
    end
    
    subgraph "Communication Layer"
        COMM_SUB[Communication<br/>Subsystem]
        PROTOCOL[Protocol Handler]
        CONNECTION[Connection Manager]
        
        COMM_SUB --> PROTOCOL
        COMM_SUB --> CONNECTION
    end
    
    subgraph "Application Layer"
        GAME_SUB[Game Logic<br/>Subsystem]
        MESSAGE_PROC[Message Processor]
        BUSINESS_LOGIC[Business Rules]
        
        GAME_SUB --> MESSAGE_PROC
        GAME_SUB --> BUSINESS_LOGIC
    end
    
    subgraph "Data Layer"
        DATA_SUB[Data Management<br/>Subsystem]
        STATE_STORE[State Storage]
        VALIDATION[Data Validation]
        
        DATA_SUB --> STATE_STORE
        DATA_SUB --> VALIDATION
    end
    
    UI <==>|Messages| COMM_SUB
    COMM_SUB <==>|Validated Messages| GAME_SUB
    GAME_SUB <==>|State Queries/Updates| DATA_SUB
```

## Component Descriptions

### Presentation Layer
- **UI Components**: Visual elements for game board, lobby, controls
- **UI State Management**: Client-side state and rendering logic

### Communication Layer
- **Protocol Handler**: Message envelope validation and parsing
- **Connection Manager**: WebSocket lifecycle and reconnection logic

### Application Layer
- **Message Processor**: Routes messages to appropriate handlers
- **Business Rules**: Game logic, turn management, win conditions

### Data Layer
- **State Storage**: In-memory game state persistence
- **Data Validation**: Schema validation and integrity checks

