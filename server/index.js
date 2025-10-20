const express = require('express');
const bodyParser = require('body-parser');
const { createWSS } = require('./transport/ws');
const { routeMessage } = require('./handlers/router');
const { validateEnv, makeEnv } = require('./schema/envelope');
const { games, createGame } = require('./state/games');
const T = require('./schema/types');

const PORT = parseInt(process.env.PORT || '8080', 10);
const PROTOCOL_VERSION = '1.0';

const app = express();
app.use(bodyParser.json());

app.get('/healthz', (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString(), version: PROTOCOL_VERSION })
);

// HTTP fallback API endpoint
app.post('/message', async (req, res) => {
  const envelope = req.body;
  
  // Validate envelope
  const validation = validateEnv(envelope);
  if (!validation.ok) {
    return res.status(400).json(makeEnv(T.ERROR, envelope && envelope.gameId ? envelope.gameId : null, { 
      code: validation.code, 
      message: validation.reason 
    }, envelope && envelope.requestId));
  }

  // Require player ID header for HTTP messages
  const playerId = req.header('x-player-id');
  if (!playerId) {
    return res.status(400).json(makeEnv(T.ERROR, envelope.gameId, { 
      code: 'MISSING_PLAYER_ID', 
      message: 'x-player-id header required for HTTP messages' 
    }, envelope.requestId));
  }

  const game = games[envelope.gameId];
  if (!game) {
    return res.status(404).json(makeEnv(T.ERROR, envelope.gameId, { 
      code: 'GAME_NOT_FOUND', 
      message: 'game not found' 
    }, envelope.requestId));
  }

  const player = game.players[playerId];
  if (!player) {
    return res.status(404).json(makeEnv(T.ERROR, envelope.gameId, { 
      code: 'PLAYER_NOT_FOUND', 
      message: 'player not found' 
    }, envelope.requestId));
  }

  // Create fake WebSocket that records responses
  const recorded = [];
  const fakeWs = {
    send: (data) => {
      try {
        recorded.push(JSON.parse(data));
      } catch (e) {
        console.error('Failed to parse recorded message:', e);
      }
    },
    readyState: 1 // WebSocket.OPEN
  };

  // Temporarily replace player's WebSocket
  const originalWs = player.ws;
  player.ws = fakeWs;

  try {
    // Handle the message
    await routeMessage(fakeWs, JSON.stringify(envelope));
  } finally {
    // Restore original WebSocket
    player.ws = originalWs;
  }

  // Return recorded responses
  return res.json({ envelopes: recorded });
});

const httpServer = app.listen(PORT, () =>
  console.log(`[http] listening on :${PORT}`)
);

createWSS(httpServer);

// Debug Testing - Create demo game
const demoGame = createGame();
console.log('Created demo gameId:', demoGame.gameId);
console.log('Connect with a WebSocket client and send a JOIN_GAME envelope with gameId="NEW" to create/join a game, or join demo gameId above.');
