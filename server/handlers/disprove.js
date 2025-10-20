const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const { resolveGameAndPlayer } = require('../state/games');
const T = require('../schema/types');

function handleRespondDisprove(ws, env) {
  const { gameId, payload, requestId } = env;
  const { game, player } = resolveGameAndPlayer(ws, gameId);
  
  if (!game || !player) {
    return safe(ws, makeEnv(T.ERROR, gameId || 'NA', { 
      code: 'NOT_JOINED', 
      message: 'You must JOIN_GAME first' 
    }, requestId));
  }

  // payload.cardId may be undefined/null to indicate can't disprove
  const { cardId } = payload || {};
  
  // If cardId present, ensure player has the card (simplified for now)
  // For real implementation must check player's hand
  const disproverId = cardId ? player.id : null;
  
  broadcast(game, makeEnv(T.DISPROVE_RESULT, gameId, { disproverId }));
  
  // In a real flow you would send specific info back to suggester if cardId present privately
  if (cardId) {
    // For now, just broadcast the result
    // In real game, would notify suggester privately of which card disproved
  }
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleRespondDisprove };
