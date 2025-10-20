function safeSend(ws, msg) {
    try { ws.send(JSON.stringify(msg)); }
    catch (e) { console.error('[ws] send error:', e); }
}

function broadcast(game, msg) {
    Object.values(game.players).forEach(p => {
      if (p.ws && p.ws.readyState === 1) safeSend(p.ws, msg);
    });
}

function sendToPlayer(game, playerId, type, payload = {}, requestId = null) {
    const { makeEnv } = require('../schema/envelope');
    const p = game.players[playerId];
    if (!p || !p.ws) return;
    safeSend(p.ws, makeEnv(type, game.gameId, payload, requestId));
}

function sendError(ws, code, message, gameId = null, requestId = null) {
    const { makeEnv } = require('../schema/envelope');
    const env = makeEnv('ERROR', gameId, { code, message }, requestId);
    if (ws) safeSend(ws, env);
}

module.exports = { safeSend, broadcast, sendToPlayer, sendError };
  