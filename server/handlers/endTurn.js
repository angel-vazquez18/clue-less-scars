const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const { 
  resolveGameAndPlayer,
  getCurrentPlayer,
  advanceTurn,
  evaluateGameStatus
} = require('../state/games');
const { broadcastTurnState } = require('./turn');
const T = require('../schema/types');

function handleEndTurn(ws, env) {
  const { gameId, requestId } = env;
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
      message: 'Eliminated players cannot act'
    }, requestId));
  }

  if (game.pendingSuggestion) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'SUGGESTION_PENDING',
      message: 'Resolve the current suggestion before ending the turn'
    }, requestId));
  }

  if (player.id !== getCurrentPlayer(game)) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NOT_YOUR_TURN',
      message: 'Only the active player may end the turn'
    }, requestId));
  }

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

  broadcastTurnState(game, nextPlayerId, turnState, 'TURN_ENDED');
}

function safe(ws, msg) {
  try { ws.send(JSON.stringify(msg)); }
  catch (e) { console.error(e); }
}

module.exports = { handleEndTurn };

