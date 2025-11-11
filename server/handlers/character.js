const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const { resolveGameAndPlayer } = require('../state/games');
const T = require('../schema/types');

function handleSelectCharacter(ws, env) {
  const { gameId, payload, requestId } = env;
  const { game, player } = resolveGameAndPlayer(ws, gameId);
  
  if (!game || !player) {
    return safe(ws, makeEnv(T.ERROR, gameId || 'NA', { 
      code: 'NOT_JOINED', 
      message: 'You must JOIN_GAME first' 
    }, requestId));
  }

  if (game.started || game.ended) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'GAME_ALREADY_STARTED', 
      message: 'Cannot change character after the game has started' 
    }, requestId));
  }

  if (player.eliminated) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'PLAYER_ELIMINATED', 
      message: 'Eliminated players cannot select characters' 
    }, requestId));
  }

  const { characterId } = payload || {};
  if (!characterId || typeof characterId !== 'string') {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'INVALID_CHARACTER', 
      message: 'characterId must be non-empty string' 
    }, requestId));
  }

  // Check if character is already taken
  const already = Object.values(game.players).find(p => p.characterId === characterId);
  if (already) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'CHARACTER_TAKEN', 
      message: 'Character already taken' 
    }, requestId));
  }

  player.characterId = characterId;
  broadcast(game, makeEnv(T.CHARACTER_SELECTED, gameId, { 
    playerId: player.id, 
    characterId 
  }));
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleSelectCharacter };
