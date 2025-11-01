# Clue-Less Architecture Documentation

## Overview

This documentation describes the architecture of the Clue-Less skeletal system from an abstract, subsystem-oriented perspective. The architecture is designed to be modular, scalable, and maintainable.

## Architecture Documents

### Core Architecture
1. **[System Overview](01-system-overview.md)** - High-level subsystem view
2. **[Subsystem Decomposition](02-subsystem-decomposition.md)** - Detailed subsystem breakdown
3. **[Layered Architecture](04-layered-architecture.md)** - Four-tier architecture pattern

### Communication & Flow
4. **[Message Flow](03-message-flow.md)** - How messages flow through the system
5. **[Communication Patterns](08-communication-patterns.md)** - Request-response, broadcast, event-driven
6. **[Protocol Structure](09-protocol-structure.md)** - Message envelope and validation
7. **[Data Flow](12-data-flow.md)** - Data transformation through subsystems

### Game Logic
8. **[Game State Lifecycle](07-game-state-lifecycle.md)** - State transitions and game flow
9. **[Subsystem Responsibilities](05-subsystem-responsibilities.md)** - What each subsystem does

### System Design
10. **[Message Processing Pipeline](06-message-processing.md)** - Message handling stages
11. **[Modular Independence](11-modular-independence.md)** - How modules remain independent
12. **[Deployment Architecture](10-deployment-architecture.md)** - Container and network setup
13. **[Scalability & Extension](13-scalability-extension.md)** - Future growth and extension points

## Key Architectural Concepts

### Four Major Subsystems

1. **Client Subsystem**
   - User interface and interaction
   - Client-side state management
   - Real-time display updates

2. **Communication Subsystem**
   - WebSocket and HTTP transport
   - Message validation and routing
   - Protocol enforcement

3. **Game Logic Subsystem**
   - Business rules and game mechanics
   - Turn management and flow control
   - Action processing and validation

4. **Data Subsystem**
   - State storage and retrieval
   - Data integrity and validation
   - Player and game management

### Core Principles

- **Message-Based Communication**: All subsystems communicate via standardized messages
- **Loose Coupling**: Subsystems are independent and replaceable
- **Contract-First**: Interfaces defined before implementation
- **Testability**: Each subsystem can be tested independently
- **Scalability**: Design supports future growth

## Implementation Mapping

| **Abstract Subsystem** | **Implementation Location** |
|------------------------|----------------------------|
| Client Subsystem | `web/src/` |
| Communication Subsystem | `server/transport/`, `server/schema/` |
| Game Logic Subsystem | `server/handlers/` |
| Data Subsystem | `server/state/` |

## For Presentations

When presenting the architecture:

1. **Start with System Overview** (01) - Show the big picture
2. **Explain Subsystem Decomposition** (02) - Break down each subsystem
3. **Demonstrate Message Flow** (03) - Show how messages move through system
4. **Highlight Modular Independence** (11) - Emphasize independent development

The diagrams are designed to be **technology-agnostic** and focus on **architectural concepts** rather than implementation details.

