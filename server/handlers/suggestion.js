const { makeEnv } = require('../schema/envelope');
const { broadcast, sendToPlayer } = require('../utils/send');
const { 
  resolveGameAndPlayer, 
  computeDisproveOrder,
  getCurrentPlayer,
  moveSuspectToken,
  moveWeaponToken,
  ensureActiveTurn
} = require('../state/games');
const { broadcastTurnState } = require('./turn');
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

  if (!game.started || game.ended) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'GAME_NOT_ACTIVE', 
      message: 'Game is not active' 
    }, requestId));
  }

  if (player.eliminated) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'PLAYER_ELIMINATED',
      message: 'Eliminated players cannot make suggestions'
    }, requestId));
  }

  if (player.id !== getCurrentPlayer(game)) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NOT_YOUR_TURN',
      message: 'Only the active player may make a suggestion'
    }, requestId));
  }

  if (game.pendingSuggestion) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'SUGGESTION_IN_PROGRESS',
      message: 'A suggestion is already awaiting resolution'
    }, requestId));
  }

  if (!player.position || player.position.zone !== 'ROOM') {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NOT_IN_ROOM',
      message: 'You must be in a room to make a suggestion'
    }, requestId));
  }

  const { suspectId, weaponId } = payload || {};
  if (!suspectId || !weaponId) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'INVALID_SUGGESTION', 
      message: 'must include suspectId and weaponId' 
    }, requestId));
  }

  const roomId = player.position.id;

  // Move tokens into the suggested room within server state
  moveSuspectToken(game, suspectId, roomId);
  moveWeaponToken(game, weaponId, roomId);

  // Build disprove order starting from next player
  const order = computeDisproveOrder(game, player.id);

  // Broadcast suggestion (room forced to player's current location)
  broadcast(game, makeEnv(T.SUGGESTION_MADE, gameId, { 
    by: player.id, 
    suspectId, 
    weaponId, 
    roomId 
  }));

  if (order.length === 0) {
    // Nobody else to disprove; immediate no-refutation outcome
    broadcast(game, makeEnv(T.DISPROVE_RESULT, gameId, { 
      disproverId: null,
      resolved: false,
      reason: 'NO_PLAYERS_TO_DISPROVE'
    }));
    return;
  }

  // Store pending suggestion state for disproval sequence
  game.pendingSuggestion = {
    suggesterId: player.id,
    suspectId,
    weaponId,
    roomId,
    order,
    index: 0,
    resolved: false
  };

  promptNextDisprover(game);
}

function promptNextDisprover(game) {
  const pending = game.pendingSuggestion;
  if (!pending) return;

  const nextPlayerId = pending.order[pending.index];

  if (!nextPlayerId) {
    concludeNoRefutation(game);
    return;
  }

  const payload = {
    suggestion: {
      suspectId: pending.suspectId,
      weaponId: pending.weaponId,
      roomId: pending.roomId
    },
    nextPlayerId,
    order: pending.order
  };

  sendToPlayer(game, pending.suggesterId, T.PROMPT_DISPROVE, payload);
  sendToPlayer(game, nextPlayerId, T.PROMPT_DISPROVE, payload);
}

function concludeNoRefutation(game) {
  if (!game.pendingSuggestion) return;
  const { suggesterId } = game.pendingSuggestion;
  broadcast(game, makeEnv(T.DISPROVE_RESULT, game.gameId, { 
    disproverId: null,
    resolved: false
  }));
  sendToPlayer(game, suggesterId, T.DISPROVE_RESULT, { disproverId: null, resolved: false });
  game.pendingSuggestion = null;

  const { playerId, turnState } = ensureActiveTurn(game);
  if (playerId) {
    broadcastTurnState(game, playerId, turnState, 'SUGGESTION_NO_REFUTE');
  }
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleMakeSuggestion, promptNextDisprover, concludeNoRefutation };
