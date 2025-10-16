const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = parseInt(process.env.PORT || '8080', 10);
const PROTOCOL_VERSION = '1.0';

// ---- HTTP (health) ----
const app = express();
app.get('/healthz', (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString(), version: PROTOCOL_VERSION })
);
const httpServer = app.listen(PORT, () =>
  console.log(`[http] listening on :${PORT}`)
);

// ---- WS helpers ----
function envMsg(type, gameId, payload = {}, requestId = null) {
  const m = { type, gameId, payload, ts: new Date().toISOString(), version: PROTOCOL_VERSION };
  if (requestId) m.requestId = requestId;
  return m;
}
function safeSend(ws, msg) {
  try { ws.send(JSON.stringify(msg)); } catch (e) { console.error('[ws] send error:', e); }
}

// ---- In-memory state ----
const games = Object.create(null); // games[gameId] = { gameId, players: { playerId: {...} }, turnOrder: [] }
function ensureGame(gameId) {
  if (!games[gameId]) games[gameId] = { gameId, players: {}, turnOrder: [], started: false };
  return games[gameId];
}
function broadcast(game, type, payload = {}) {
  const msg = envMsg(type, game.gameId, payload);
  Object.values(game.players).forEach(p => p.ws && p.ws.readyState === 1 && safeSend(p.ws, msg));
}

// ---- WS server ----
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws) => {
  console.log('[ws] client connected');
  safeSend(ws, envMsg('INFO', 'NA', { message: 'Welcome to Clue-Less skeletal!' }));

  ws.on('message', (raw) => {
    const txt = raw.toString();
    let msg;
    try { msg = JSON.parse(txt); }
    catch { return safeSend(ws, envMsg('ERROR', 'NA', { code:'BAD_REQUEST', message:'JSON required' })); }

    const { type, gameId, payload, requestId, version } = msg;
    if (version && version !== PROTOCOL_VERSION) {
      return safeSend(ws, envMsg('ERROR', gameId || 'NA', { code:'INVALID_VERSION', message:`Unsupported ${version}` }, requestId));
    }

    if (type === 'JOIN_GAME') {
      const gid = (!gameId || gameId === 'NEW') ? uuidv4() : gameId;
      const game = ensureGame(gid);

      const name = (payload && typeof payload.name === 'string' && payload.name.trim()) || `Player-${Math.random().toString(36).slice(2,7)}`;
      const playerId = uuidv4();

      ws.playerId = playerId;
      ws.gameId = gid;

      game.players[playerId] = { id: playerId, name, ws, characterId: null, hand: [] };
      game.turnOrder.push(playerId);

      // private state
      safeSend(ws, envMsg('YOUR_HAND', gid, { cards: [] }, requestId));
      safeSend(ws, envMsg('GAME_STATE', gid, {
        board: { rooms: [], hallways: [] },
        players: Object.values(game.players).map(p => ({ id: p.id, name: p.name, characterId: p.characterId })),
        you: { id: playerId, name, characterId: null },
        turn: { currentPlayerId: game.turnOrder[0], phase: 'move', order: game.turnOrder }
      }, requestId));

      // broadcast join
      broadcast(game, 'PLAYER_JOINED', {
        playerId,
        name,
        message: `🎉 Player "${name}" joined the game!`
      });

      broadcast(game, 'LOBBY_STATE', {
        players: Object.values(game.players).map(p => ({
          id: p.id, name: p.name, characterId: p.characterId || null
        }))
      });

      
      // tell the joining client the gid to reuse
      return safeSend(ws, envMsg('INFO', gid, { message: 'Joined game', gameId: gid }, requestId));
    }

    if (!msg.gameId || !games[msg.gameId]) {
      return safeSend(ws, envMsg('ERROR', msg.gameId || 'NA', { code:'GAME_NOT_FOUND', message:'Unknown gameId' }, requestId));
    }

    const game = games[msg.gameId];
    const player = ws.playerId ? game.players[ws.playerId] : null;

    switch (type) {
      case 'PING':
        return safeSend(ws, envMsg('PONG', game.gameId, { ok: true }, requestId));
      case 'CHAT':
        if (!player) return safeSend(ws, envMsg('ERROR', game.gameId, { code:'NOT_JOINED', message:'JOIN_GAME first' }, requestId));
        broadcast(game, 'INFO', { message: `[${player.name}] ${payload?.message || ''}` });
        return;
      default:
        return safeSend(ws, envMsg('ERROR', game.gameId, { code:'UNKNOWN_TYPE', message:`Unknown type: ${type}` }, requestId));
    }
  });

  ws.on('close', () => console.log('[ws] client disconnected'));
});
  
