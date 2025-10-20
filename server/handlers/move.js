const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const { resolveGameAndPlayer } = require('../state/games');
const T = require('../schema/types');

function handleRequestMove(ws, env) {
  const { gameId, payload, requestId } = env;
  const { game, player } = resolveGameAndPlayer(ws, gameId);
  
  if (!game || !player) {
    return safe(ws, makeEnv(T.ERROR, gameId || 'NA', { 
      code: 'NOT_JOINED', 
      message: 'You must JOIN_GAME first' 
    }, requestId));
  }

  if (!game.started) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'GAME_NOT_STARTED', 
      message: 'Game has not started' 
    }, requestId));
  }

  const { to, targetId, useSecretPassage } = payload || {};
  if (!to || !['HALLWAY', 'ROOM'].includes(to)) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'INVALID_MOVE', 
      message: 'to must be HALLWAY or ROOM' 
    }, requestId));
  }

  const from = player.position || null;
  player.position = { 
    zone: to, 
    id: targetId || null, 
    secret: !!useSecretPassage 
  };

  broadcast(game, makeEnv(T.PLAYER_MOVED, gameId, { 
    playerId: player.id, 
    from, 
    to: player.position 
  }));
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleRequestMove };
