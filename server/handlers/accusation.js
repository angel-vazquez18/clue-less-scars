const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const { 
  resolveGameAndPlayer,
  getCurrentPlayer,
  markPlayerEliminated,
  advanceTurn,
  evaluateGameStatus,
  inferZoneForLocation
} = require('../state/games');
const { broadcastTurnState } = require('./turn');
const T = require('../schema/types');

function handleMakeAccusation(ws, env) {
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
      message: 'Game is not currently active' 
    }, requestId));
  }

  if (player.eliminated) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'PLAYER_ELIMINATED',
      message: 'Eliminated players cannot make accusations'
    }, requestId));
  }

  if (player.id !== getCurrentPlayer(game)) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NOT_YOUR_TURN',
      message: 'Only the active player may make an accusation'
    }, requestId));
  }

  // Rule 1: Cannot make accusation while in hallway - must move to room first
  if (player.position?.zone === 'HALLWAY') {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'CANNOT_ACCUSE_IN_HALLWAY',
      message: 'You cannot make an accusation while in a hallway. You must move to a room first.'
    }, requestId));
  }

  // Note: Accusations are allowed even during pending suggestions (Rule 5)
  // The pendingSuggestion check is removed to allow accusations at any time during turn

  const { suspectId, weaponId, roomId } = payload || {};
  if (!suspectId || !weaponId || !roomId) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'INVALID_ACCUSATION', 
      message: 'must include suspectId, weaponId, roomId' 
    }, requestId));
  }

  // Check against solution
  const correct = (game.solution && 
    game.solution.suspectId === suspectId && 
    game.solution.weaponId === weaponId && 
    game.solution.roomId === roomId);

  broadcast(game, makeEnv(T.ACCUSATION_RESOLVED, gameId, { 
    by: player.id, 
    correct,
    roomId,
    eliminatedPlayerId: correct ? null : player.id
  }));

  if (correct) {
    game.pendingSuggestion = null;
    game.started = false;
    game.ended = true;
    game.winnerId = player.id;
    game.turnState = null;
    game.currentPlayerId = null;
    broadcast(game, makeEnv(T.GAME_OVER, gameId, { 
      winnerId: player.id, 
      solution: game.solution 
    }));
    return;
  } else {
    markPlayerEliminated(game, player.id);
    game.pendingSuggestion = null;
    safe(ws, makeEnv(T.INFO, gameId, { 
      message: 'Your accusation was incorrect — you are eliminated from further turns.' 
    }, requestId));

    const status = evaluateGameStatus(game);
    if (status.ended) {
      game.started = false;
      game.ended = true;
      game.winnerId = status.winnerId;
      game.turnState = null;
      game.currentPlayerId = null;
      broadcast(game, makeEnv(T.GAME_OVER, gameId, { 
        winnerId: status.winnerId, 
        solution: game.solution, 
        reason: status.reason 
      }));
      return;
    }

    const { playerId: nextPlayerId, turnState } = advanceTurn(game);
    if (!nextPlayerId) {
      const fallback = evaluateGameStatus(game);
      if (fallback.ended) {
        game.started = false;
        game.ended = true;
        game.winnerId = fallback.winnerId;
        game.turnState = null;
        game.currentPlayerId = null;
        broadcast(game, makeEnv(T.GAME_OVER, gameId, { 
          winnerId: fallback.winnerId, 
          solution: game.solution, 
          reason: fallback.reason 
        }));
      }
      return;
    }

    broadcastTurnState(game, nextPlayerId, turnState, 'ACCUSATION_FAILED');
  }
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleMakeAccusation };
