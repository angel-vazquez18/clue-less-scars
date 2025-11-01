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