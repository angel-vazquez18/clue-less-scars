const { makeEnv } = require('../schema/envelope');
const { broadcast, safeSend } = require('../utils/send');
const { resolveGameAndPlayer } = require('../state/games');
const T = require('../schema/types');

function handleChat(ws, env) {
  const { gameId, payload, requestId } = env;
  const { game, player } = resolveGameAndPlayer(ws, gameId);
  
  if (!game || !player) {
    return safe(ws, makeEnv(T.ERROR, gameId || 'NA', { 
      code: 'NOT_JOINED', 
      message: 'JOIN_GAME first' 
    }, requestId));
  }

  const { message, to } = payload || {};
  if (!message || typeof message !== 'string' || message.length < 1 || message.length > 256) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'INVALID_CHAT', 
      message: 'message must be 1..256 chars' 
    }, requestId));
  }

  if (to) {
    // private chat to playerId 'to'
    const target = game.players[to];
    if (target && target.ws) {
      console.log(`[CHAT:PRIVATE] [${gameId}] ${player.name} → ${target.name}: ${message}`);
      safeSend(target.ws, makeEnv(T.CHAT, gameId, { 
        from: player.id, 
        fromName: player.name,
        message 
      }));
    } else {
      return safe(ws, makeEnv(T.ERROR, gameId, { 
        code: 'PLAYER_NOT_FOUND', 
        message: 'recipient not found' 
      }, requestId));
    }
  } else {
    console.log(`[CHAT] [${gameId}] ${player.name}: ${message}`);
    // broadcast chat
    broadcast(game, makeEnv(T.CHAT, gameId, { 
      from: player.id, 
      fromName: player.name,
      message 
    }));
  }
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleChat };
