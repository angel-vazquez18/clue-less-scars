const { validateEnv, makeEnv } = require('../schema/envelope');
const { handleJoin } = require('./join');
const { handleChat } = require('./chat');
const { handlePing } = require('./ping');
const { handleSelectCharacter } = require('./character');
const { handleStartGame } = require('./start');
const { handleRequestMove } = require('./move');
const { handleMakeSuggestion } = require('./suggestion');
const { handleRespondDisprove } = require('./disprove');
const { handleMakeAccusation } = require('./accusation');
const T = require('../schema/types');

function routeMessage(ws, raw) {
  let env;
  try { env = JSON.parse(raw); }
  catch { return safe(ws, makeEnv(T.ERROR, 'NA', { code:'BAD_REQUEST', message:'JSON required' })); }

  const val = validateEnv(env);
  if (!val.ok) return safe(ws, makeEnv(T.ERROR, env.gameId || 'NA', { code: val.code, message: val.reason }, env.requestId));

  switch (env.type) {
    case T.JOIN_GAME: return handleJoin(ws, env);
    case T.CHAT: return handleChat(ws, env);
    case T.PING: return handlePing(ws, env);
    case T.SELECT_CHARACTER: return handleSelectCharacter(ws, env);
    case T.START_GAME: return handleStartGame(ws, env);
    case T.REQUEST_MOVE: return handleRequestMove(ws, env);
    case T.MAKE_SUGGESTION: return handleMakeSuggestion(ws, env);
    case T.RESPOND_DISPROVE: return handleRespondDisprove(ws, env);
    case T.MAKE_ACCUSATION: return handleMakeAccusation(ws, env);
    default:
      return safe(ws, makeEnv(T.ERROR, env.gameId, { code:'UNKNOWN_TYPE', message:`Unknown type: ${env.type}` }, env.requestId));
  }
}

function safe(ws, msg){ try{ ws.send(JSON.stringify(msg)); }catch(e){ console.error(e); } }

module.exports = { routeMessage };
