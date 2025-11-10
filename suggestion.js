const { makeEnv } = require('../schema/envelope');
const { broadcast, sendToPlayer } = require('../utils/send');
const { resolveGameAndPlayer, computeDisproveOrder } = require('../state/games');
const T = require('../schema/types');

function handleMakeSuggestion(ws, env) {
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

  const { suspectId, weaponId } = payload || {};
  if (!suspectId || !weaponId) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'INVALID_SUGGESTION', 
      message: 'must include suspectId and weaponId' 
    }, requestId));
  }

  // Build disprove order starting from next player
  const order = computeDisproveOrder(game, player.id);
  
  // Broadcast suggestion
  broadcast(game, makeEnv(T.SUGGESTION_MADE, gameId, { 
    by: player.id, 
    suspectId, 
    weaponId, 
    roomId: (player.position && player.position.zone === 'ROOM') ? player.position.id : null 
  }));

  // Store pending suggestion state for disproval sequence
  game.pendingSuggestion = {
    suggesterId: player.id,
    suspectId,
    weaponId,
    roomId: (player.position && player.position.zone === 'ROOM') ? player.position.id : payload.roomId || null,
    order,
    index: 0,
    resolved: false
  };

  // Send PROMPT_DISPROVE to the next player in order
  const nextPlayerId = order.length > 0 ? order[0] : null;
  const prompt = {
    suggestion: { 
      suspectId, 
      weaponId, 
      roomId: (player.position && player.position.zone === 'ROOM') ? player.position.id : null 
    },
    order,
    nextPlayerId
  };

  // Send to suggester and next player
  sendToPlayer(game, player.id, T.PROMPT_DISPROVE, prompt);
  if (nextPlayerId) {
    sendToPlayer(game, nextPlayerId, T.PROMPT_DISPROVE, prompt);
  }
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleMakeSuggestion };
