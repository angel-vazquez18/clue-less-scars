# Message Flow Architecture

## Abstract Message Flow

```mermaid
sequenceDiagram
    participant Client as Client<br/>Subsystem
    participant Comm as Communication<br/>Subsystem
    participant GameLogic as Game Logic<br/>Subsystem
    participant Data as Data<br/>Subsystem
    
    Client->>Comm: Send Message
    Comm->>Comm: Validate Protocol
    Comm->>GameLogic: Forward Message
    GameLogic->>GameLogic: Process Business Logic
    GameLogic->>Data: Query/Update State
    Data-->>GameLogic: State Data
    GameLogic->>Comm: Response Message(s)
    Comm->>Client: Deliver Response
    Comm->>Client: Broadcast Updates<br/>(to all clients)
```

## Message Flow Patterns

### Request-Response Flow
1. Client sends request message
2. Communication subsystem validates
3. Game logic processes request
4. Data subsystem updates state
5. Response sent back to client

### Broadcast Flow
1. Client sends action message
2. Message validated and processed
3. State updated
4. All connected clients notified of change

### Event-Driven Flow
1. Game event occurs (e.g., player joins)
2. Event handler processes
3. State updated
4. Notifications sent to relevant parties

