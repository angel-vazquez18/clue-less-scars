const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const { resolveGameAndPlayer } = require('../state/games');
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
    correct 
  }));

  if (correct) {
    broadcast(game, makeEnv(T.GAME_OVER, gameId, { 
      winnerId: player.id, 
      solution: game.solution 
    }));
    game.started = false;
  } else {
    // In Clue, incorrect accusation often eliminates player
    // For now, just announce the incorrect accusation
    safe(ws, makeEnv(T.INFO, gameId, { 
      message: 'Your accusation was incorrect — you are out (demo behavior)' 
    }, requestId));
  }
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleMakeAccusation };
