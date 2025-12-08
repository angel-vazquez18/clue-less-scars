const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const { 
  resolveGameAndPlayer,
  getCurrentPlayer,
  ensureTurnMoveState,
  isValidLocation,
  areAdjacentLocations,
  isSecretPassageMove,
  inferZoneForLocation,
  updateLegalMoves,
  advanceTurn,
  evaluateGameStatus
} = require('../state/games');
const { broadcastTurnState } = require('./turn');
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

  if (!game.started || game.ended) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'GAME_NOT_ACTIVE', 
      message: 'Game is not active' 
    }, requestId));
  }

  if (player.eliminated) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'PLAYER_ELIMINATED',
      message: 'Eliminated players cannot move'
    }, requestId));
  }

  const currentPlayerId = getCurrentPlayer(game);
  if (player.id !== currentPlayerId) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NOT_YOUR_TURN',
      message: 'Only the active player may move'
    }, requestId));
  }

  const turnState = ensureTurnMoveState(game);
  if (!turnState) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NO_TURN_STATE',
      message: 'Turn state not available'
    }, requestId));
  }

  // Check if dice has been rolled
  if (turnState.diceRoll == null) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'DICE_NOT_ROLLED',
      message: 'You must roll the dice before moving'
    }, requestId));
  }

  if (turnState.movesRemaining <= 0) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NO_MOVES_LEFT',
      message: 'No movement points remaining this turn'
    }, requestId));
  }

  const fromPosition = player.position;
  if (!fromPosition || !fromPosition.id) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'POSITION_UNKNOWN',
      message: 'Player has no current position'
    }, requestId));
  }

  const { targetId, useSecretPassage } = payload || {};
  const trimmedTargetId = typeof targetId === 'string' ? targetId.trim() : null;

  if (!trimmedTargetId || !isValidLocation(trimmedTargetId)) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'INVALID_TARGET',
      message: 'Target location is not valid'
    }, requestId));
  }

  if (fromPosition.id === trimmedTargetId) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'ALREADY_THERE',
      message: 'You are already at that location'
    }, requestId));
  }

  const inferredZone = inferZoneForLocation(trimmedTargetId);
  if (!inferredZone) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'UNKNOWN_ZONE',
      message: 'Unable to determine zone for target location'
    }, requestId));
  }

  if (payload && payload.to && payload.to !== inferredZone) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'ZONE_MISMATCH',
      message: 'Target zone does not match inferred location type'
    }, requestId));
  }

  if (inferredZone === 'HALLWAY') {
    const occupied = Object.values(game.players).some(other => {
      if (!other || other.id === player.id) return false;
      return other.position?.id === trimmedTargetId;
    });
    if (occupied) {
      return safe(ws, makeEnv(T.ERROR, gameId, {
        code: 'SPACE_OCCUPIED',
        message: 'Another player is already occupying that hallway'
      }, requestId));
    }
  }

  const adjacent = areAdjacentLocations(fromPosition.id, trimmedTargetId);
  if (!adjacent) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NOT_ADJACENT',
      message: 'Target location is not adjacent'
    }, requestId));
  }

  const isSecret = isSecretPassageMove(fromPosition.id, trimmedTargetId);
  if (useSecretPassage && !isSecret) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NO_SECRET_PASSAGE',
      message: 'No secret passage connects these rooms'
    }, requestId));
  }
  if (isSecret && !useSecretPassage) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'SECRET_PASSAGE_REQUIRED',
      message: 'Secret passage moves must be flagged explicitly'
    }, requestId));
  }
  if (isSecret && turnState.secretPassageUsed) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'PASSAGE_ALREADY_USED',
      message: 'Secret passage may only be used once per turn'
    }, requestId));
  }

  const moveCost = isSecret ? turnState.movesRemaining : 1;
  if (turnState.movesRemaining < moveCost) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NO_MOVES_LEFT',
      message: 'Not enough movement points remaining'
    }, requestId));
  }

  const from = { ...fromPosition };
  player.position = { 
    zone: inferredZone, 
    id: trimmedTargetId, 
    secret: !!isSecret 
  };

  turnState.movesRemaining -= moveCost;
  if (isSecret) {
    turnState.secretPassageUsed = true;
  }
  if (inferredZone === 'ROOM') {
    turnState.movesRemaining = 0;
  }
  const legalMoves = updateLegalMoves(game);

  broadcast(game, makeEnv(T.PLAYER_MOVED, gameId, { 
    playerId: player.id, 
    from, 
    to: player.position,
    movesRemaining: turnState.movesRemaining,
    movementAllowance: turnState.movementAllowance,
    legalMoves
  }));

  // Auto-advance turn if player has no moves left and can't do anything else
  if (turnState.movesRemaining === 0 && !game.pendingSuggestion) {
    const playerZone = inferZoneForLocation(player.position.id);
    const canSuggest = playerZone === 'ROOM';
    
    // If player can't suggest (not in room) and has no moves, auto-advance turn
    if (!canSuggest) {
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
      if (nextPlayerId) {
        const previousPlayerName = player.name || player.id;
        broadcast(game, makeEnv(T.INFO, gameId, {
          message: `${previousPlayerName} ran out of moves and their turn ended automatically.`
        }));
        broadcastTurnState(game, nextPlayerId, nextTurnState, 'TURN_AUTO_ADVANCED');
      }
    }
  }
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleRequestMove };
