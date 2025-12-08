const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const { 
  resolveGameAndPlayer,
  getCurrentPlayer,
  advanceTurn,
  evaluateGameStatus,
  inferZoneForLocation
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

  // Rule 5B: Cannot end turn while in hallway - must move to room first
  if (player.position?.zone === 'HALLWAY') {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'MUST_LEAVE_HALLWAY',
      message: 'You must move to a room from a hallway before ending your turn'
    }, requestId));
  }

  // Check if player must make suggestion after secret passage or hallway move
  const currentTurnState = game.turnState;
  if (currentTurnState && (currentTurnState.mustSuggestAfterHallwayMove || currentTurnState.mustSuggestAfterSecretPassage)) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'MUST_SUGGEST',
      message: 'You must make a suggestion after using a secret passage or entering a room from a hallway'
    }, requestId));
  }

  // Clear movedBySuggestion flag for this specific player when they end their turn
  // This ensures players who were moved by suggestion but didn't move/suggest this turn
  // don't retain the flag indefinitely, but other players keep their flags until their turn
  if (player.movedBySuggestion) {
    player.movedBySuggestion = false;
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

  const { playerId: nextPlayerId, turnState: nextTurnState } = advanceTurn(game);
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

  broadcastTurnState(game, nextPlayerId, nextTurnState, 'TURN_ENDED');
}

function safe(ws, msg) {
  try { ws.send(JSON.stringify(msg)); }
  catch (e) { console.error(e); }
}

module.exports = { handleEndTurn };

