# Communication Patterns

## Message Communication Patterns

```mermaid
graph TB
    subgraph "Request-Response Pattern"
        RR_CLIENT[Client]
        RR_SERVER[Server]
        
        RR_CLIENT -->|Request| RR_SERVER
        RR_SERVER -->|Response| RR_CLIENT
    end
    
    subgraph "Broadcast Pattern"
        BR_CLIENT1[Client 1]
        BR_CLIENT2[Client 2]
        BR_CLIENT3[Client 3]
        BR_SERVER[Server]
        
        BR_CLIENT1 -->|Action| BR_SERVER
        BR_SERVER -->|Update| BR_CLIENT1
        BR_SERVER -->|Update| BR_CLIENT2
        BR_SERVER -->|Update| BR_CLIENT3
    end
    
    subgraph "Event-Driven Pattern"
        EV_SOURCE[Event Source]
        EV_HANDLER[Event Handler]
        EV_LISTENER1[Listener 1]
        EV_LISTENER2[Listener 2]
        
        EV_SOURCE -->|Trigger| EV_HANDLER
        EV_HANDLER -->|Notify| EV_LISTENER1
        EV_HANDLER -->|Notify| EV_LISTENER2
    end
```

## Pattern Descriptions

### Request-Response Pattern
**Use Case:** Direct client-server interaction
- Client sends request (e.g., PING, JOIN_GAME)
- Server processes and responds
- Response goes only to requesting client
- Synchronous-style communication

**Examples:**
- PING → PONG
- JOIN_GAME → INFO, GAME_STATE, YOUR_HAND
- Invalid message → ERROR

### Broadcast Pattern
**Use Case:** State synchronization across all clients
- One client performs action
- Server updates state
- All clients in game receive update
- Keeps all players synchronized

**Examples:**
- Player joins → PLAYER_JOINED broadcast
- Character selected → CHARACTER_SELECTED broadcast
- Chat message → CHAT broadcast
- Game started → GAME_STARTED broadcast

### Event-Driven Pattern
**Use Case:** Asynchronous notifications
- Event occurs in system
- Handler processes event
- Relevant listeners notified
- Decoupled components

**Examples:**
- Player disconnects → Remove from game → Notify others
- Turn ends → Next turn starts → Notify current player
- Suggestion made → Prompt disprove → Notify specific player

## Pattern Selection Criteria

### Use Request-Response When:
- Single client needs information
- Direct confirmation required
- No other clients affected

### Use Broadcast When:
- All players need same information
- State change affects everyone
- Synchronization required

### Use Event-Driven When:
- Asynchronous processing needed
- Specific subset of clients affected
- Decoupling desired

