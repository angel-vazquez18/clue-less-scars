# Subsystem Responsibilities

## Responsibility Distribution

```mermaid
graph LR
    subgraph "Client Subsystem"
        direction TB
        C1[Render UI]
        C2[Handle User Input]
        C3[Display Game State]
        C4[Manage Local State]
    end
    
    subgraph "Communication Subsystem"
        direction TB
        CM1[WebSocket Management]
        CM2[HTTP Fallback]
        CM3[Message Validation]
        CM4[Protocol Enforcement]
    end
    
    subgraph "Game Logic Subsystem"
        direction TB
        G1[Process Game Actions]
        G2[Enforce Game Rules]
        G3[Manage Turn Order]
        G4[Handle Win Conditions]
    end
    
    subgraph "Data Subsystem"
        direction TB
        D1[Store Game State]
        D2[Manage Players]
        D3[Track Positions]
        D4[Validate Data]
    end
```

## Detailed Responsibilities

### Client Subsystem
- **Render UI**: Display game board, lobby, controls, and messages
- **Handle User Input**: Process clicks, form submissions, and keyboard input
- **Display Game State**: Show current game state, player positions, and turn info
- **Manage Local State**: Maintain client-side state for responsiveness

### Communication Subsystem
- **WebSocket Management**: Real-time bidirectional communication
- **HTTP Fallback**: Alternative communication for non-WebSocket clients
- **Message Validation**: Ensure messages conform to protocol
- **Protocol Enforcement**: Maintain message envelope standards

### Game Logic Subsystem
- **Process Game Actions**: Handle moves, suggestions, accusations
- **Enforce Game Rules**: Validate actions according to Clue rules
- **Manage Turn Order**: Track whose turn it is and advance turns
- **Handle Win Conditions**: Detect and process game endings

### Data Subsystem
- **Store Game State**: Maintain authoritative game data
- **Manage Players**: Track player information and connections
- **Track Positions**: Monitor player locations on the board
- **Validate Data**: Ensure data integrity and consistency

## Subsystem Independence

Each subsystem can be:
- Developed independently by different teams
- Tested in isolation
- Deployed separately (if needed)
- Modified without affecting other subsystems
- Replaced with alternative implementations

## Inter-Subsystem Communication

All communication between subsystems happens through:
- **Well-defined interfaces**
- **Standardized message formats**
- **Validated contracts**
- **Documented protocols**

