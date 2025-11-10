const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const { resolveGameAndPlayer, startGame, getCurrentPlayer } = require('../state/games');
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

  // Check minimum players
  if (Object.keys(game.players).length < 4) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'NOT_ENOUGH_PLAYERS', 
      message: 'At least 4 players required to start' 
    }, requestId));
  }

  // Start the game
  if (!startGame(game)) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'START_FAILED', 
      message: 'Failed to start game' 
    }, requestId));
  }

  // Broadcast game started
  broadcast(game, makeEnv(T.GAME_STARTED, gameId, {}));

  // Send hands to all players
  for (const pId in game.players) {
    const p = game.players[pId];
    safe(p.ws, makeEnv(T.YOUR_HAND, gameId, { cards: p.hand }));
  }

  // Start first turn
  const currentPlayerId = getCurrentPlayer(game);
  const currentPlayerName = game.players[currentPlayerId]?.name || 'Unknown';
  broadcast(game, makeEnv(T.TURN_START, gameId, { 
    playerId: currentPlayerId,
    playerName: currentPlayerName 
  }));
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleStartGame };
