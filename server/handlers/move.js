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

  // Check if player has already moved this turn (deterministic: one move per turn)
  // Exception: If player was moved by suggestion, they can still move normally
  if (turnState.hasMoved && !turnState.enteredRoomViaSuggestion) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'ALREADY_MOVED',
      message: 'You have already moved this turn'
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

  // Check if player is in hallway - must move to room
  if (fromPosition.zone === 'HALLWAY' && inferredZone !== 'ROOM') {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'MUST_LEAVE_HALLWAY',
      message: 'When in a hallway, you must move to an adjacent room'
    }, requestId));
  }

  const from = { ...fromPosition };
  const wasInHallway = fromPosition.zone === 'HALLWAY';
  player.position = { 
    zone: inferredZone, 
    id: trimmedTargetId, 
    secret: !!isSecret 
  };

  // Mark that player has moved this turn
  turnState.hasMoved = true;
  
  // Clear suggestion movement flag after player chooses to move
  if (turnState.enteredRoomViaSuggestion) {
    turnState.enteredRoomViaSuggestion = false;
    // Clear the movedBySuggestion flag on player
    if (player.movedBySuggestion) {
      player.movedBySuggestion = false;
    }
  }

  // If using secret passage, must make suggestion immediately
  if (isSecret) {
    turnState.secretPassageUsed = true;
    turnState.mustSuggestAfterSecretPassage = true;
  }

  // If moved from hallway to room, must make suggestion immediately
  if (wasInHallway && inferredZone === 'ROOM') {
    turnState.mustSuggestAfterHallwayMove = true;
  }

  // Update legal moves (if any remain, though with deterministic movement, typically none)
  const legalMoves = updateLegalMoves(game);

  broadcast(game, makeEnv(T.PLAYER_MOVED, gameId, { 
    playerId: player.id, 
    from, 
    to: player.position,
    mustSuggest: turnState.mustSuggestAfterHallwayMove || turnState.mustSuggestAfterSecretPassage,
    legalMoves
  }));
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleRequestMove };
