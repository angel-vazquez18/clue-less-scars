const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const { resolveGameAndPlayer, startGame, ensureActiveTurn } = require('../state/games');
const { broadcastTurnState } = require('./turn');
const T = require('../schema/types');

function handleStartGame(ws, env) {
  const { gameId, requestId } = env;
  const { game, player } = resolveGameAndPlayer(ws, gameId);
  
  if (!game || !player) {
    return safe(ws, makeEnv(T.ERROR, gameId || 'NA', { 
      code: 'NOT_JOINED', 
      message: 'You must JOIN_GAME first' 
    }, requestId));
  }

  // Check if game already started
  if (game.started) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'ALREADY_STARTED', 
      message: 'Game already started' 
    }, requestId));
  }

  // Only lobby leader can start the game
  if (game.leaderId !== player.id) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'NOT_LEADER',
      message: 'Only the lobby leader can start the game'
    }, requestId));
  }

  // Check minimum players
  if (Object.keys(game.players).length < 4) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'NOT_ENOUGH_PLAYERS', 
      message: 'At least 4 players required to start' 
    }, requestId));
  }

  // Require all players to have selected a character
  const missingCharacter = Object.values(game.players).filter(p => !p.characterId);
  if (missingCharacter.length > 0) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'CHARACTERS_NOT_SELECTED',
      message: 'All players must select a character before starting'
    }, requestId));
  }

  // Start the game
  if (!startGame(game)) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'START_FAILED', 
      message: 'Failed to start game' 
    }, requestId));
  }

  const { playerId: currentPlayerId, turnState } = ensureActiveTurn(game);
  if (!currentPlayerId) {
    return safe(ws, makeEnv(T.ERROR, gameId, {
      code: 'START_FAILED',
      message: 'Could not determine a starting player'
    }, requestId));
  }

  // Broadcast game started
  broadcast(game, makeEnv(T.GAME_STARTED, gameId, {}));

  // Send hands to all players
  for (const pId in game.players) {
    const p = game.players[pId];
    safe(p.ws, makeEnv(T.YOUR_HAND, gameId, { cards: p.hand }));
  }

  // Share initial turn state
  broadcastTurnState(game, currentPlayerId, turnState, 'GAME_STARTED');
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleStartGame };
