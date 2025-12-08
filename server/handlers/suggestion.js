const { makeEnv } = require('../schema/envelope');
const SUSPECT_ID_TO_CHARACTER = {
  "suspect:scarlet": "Miss Scarlet",
  "suspect:mustard": "Colonel Mustard",
  "suspect:white": "Mrs. White",
  "suspect:green": "Mr. Green",
  "suspect:peacock": "Mrs. Peacock",
  "suspect:plum": "Professor Plum",
};

// Valid suspect and weapon IDs for validation
const VALID_SUSPECT_IDS = Object.keys(SUSPECT_ID_TO_CHARACTER);
const VALID_WEAPON_IDS = [
  "weapon:candlestick",
  "weapon:knife",
  "weapon:leadpipe",
  "weapon:revolver",
  "weapon:rope",
  "weapon:wrench",
  // Also accept weapon names without prefix for compatibility
  "Candlestick",
  "Knife",
  "Leadpipe",
  "Revolver",
  "Rope",
  "Wrench",
];

const { broadcast, sendToPlayer } = require('../utils/send');
const { 
  resolveGameAndPlayer, 
  computeDisproveOrder,
  getCurrentPlayer,
  moveSuspectToken,
  moveWeaponToken,
  inferZoneForLocation,
  ensureActiveTurn,
  areAllExitsBlocked
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

  const { suspectId, weaponId, roomId: payloadRoomId } = payload || {};
  if (!suspectId || !weaponId) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'INVALID_SUGGESTION', 
      message: 'must include suspectId and weaponId' 
    }, requestId));
  }

  // Validate suspect and weapon IDs (case-insensitive for robustness)
  const normalizeId = (id) => typeof id === 'string' ? id.toLowerCase().trim() : '';
  const normalizedSuspectId = normalizeId(suspectId);
  const normalizedWeaponId = normalizeId(weaponId);
  
  const isValidSuspect = VALID_SUSPECT_IDS.some(valid => normalizeId(valid) === normalizedSuspectId);
  if (!isValidSuspect) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'INVALID_SUSPECT',
      message: 'Invalid suspect ID'
    }, requestId));
  }

  const isValidWeapon = VALID_WEAPON_IDS.some(valid => normalizeId(valid) === normalizedWeaponId);
  if (!isValidWeapon) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'INVALID_WEAPON',
      message: 'Invalid weapon ID'
    }, requestId));
  }

  // Room ID must match player's current room (official Clue rules)
  const roomId = player.position.id;
  if (payloadRoomId && payloadRoomId !== roomId) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'ROOM_MISMATCH',
      message: 'Suggestion room must match your current room'
    }, requestId));
  }

  // Rule 6: Blocked Exits Rule - cannot make suggestion if all exits blocked
  if (areAllExitsBlocked(game, roomId, player.id)) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'ALL_EXITS_BLOCKED',
      message: 'All exits are blocked. You cannot make a suggestion, but you may make an accusation.'
    }, requestId));
  }

  // Move the suggested suspect's character (if any player is using them)
  // Use normalized ID for dictionary lookup (keys are lowercase)
  const characterName = SUSPECT_ID_TO_CHARACTER[normalizedSuspectId];
  if (characterName) {
    Object.values(game.players || {}).forEach((p) => {
      if (p && p.characterId === characterName) {
        // Rule 5A: Track that this player was moved by suggestion
        // They will get choice to suggest or move when their turn comes
        p.movedBySuggestion = true;
        p.position = {
          zone: inferZoneForLocation(roomId) || 'ROOM',
          id: roomId,
          secret: false,
        };
      }
    });
  }

  // Move tokens into the suggested room within server state
  // Use normalized IDs for consistent token storage (lowercase keys)
  moveSuspectToken(game, normalizedSuspectId, roomId);
  moveWeaponToken(game, normalizedWeaponId, roomId);

  // Build disprove order starting from next player
  const order = computeDisproveOrder(game, player.id);

  // Broadcast suggestion (room forced to player's current location)
  // Use normalized IDs for consistent messaging
  broadcast(game, makeEnv(T.SUGGESTION_MADE, gameId, { 
    by: player.id,
    byName: player.name || player.id,
    suspectId: normalizedSuspectId, 
    weaponId: normalizedWeaponId, 
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

  // Clear forced suggestion flags after making suggestion
  if (game.turnState) {
    game.turnState.mustSuggestAfterHallwayMove = false;
    game.turnState.mustSuggestAfterSecretPassage = false;
    // Clear suggestion movement flag if this was their choice after being moved
    if (game.turnState.enteredRoomViaSuggestion || player.movedBySuggestion) {
      game.turnState.enteredRoomViaSuggestion = false;
      player.movedBySuggestion = false;
    }
  }

  // Store pending suggestion state for disproval sequence
  // Use normalized IDs for consistent storage and lookups
  game.pendingSuggestion = {
    suggesterId: player.id,
    suspectId: normalizedSuspectId,
    weaponId: normalizedWeaponId,
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
    order: pending.order,
    index: pending.index  // Include index so client can match server's check
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
