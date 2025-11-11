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
const { handleEndTurn } = require('./endTurn');
const T = require('../schema/types');

const HANDLERS = Object.freeze({
  [T.JOIN_GAME]: handleJoin,
  [T.CHAT]: handleChat,
  [T.PING]: handlePing,
  [T.SELECT_CHARACTER]: handleSelectCharacter,
  [T.START_GAME]: handleStartGame,
  [T.REQUEST_MOVE]: handleRequestMove,
  [T.MAKE_SUGGESTION]: handleMakeSuggestion,
  [T.RESPOND_DISPROVE]: handleRespondDisprove,
  [T.MAKE_ACCUSATION]: handleMakeAccusation,
  [T.END_TURN]: handleEndTurn,
});

function routeMessage(ws, raw) {
  let env;
  try { env = JSON.parse(raw); }
  catch { return safe(ws, makeEnv(T.ERROR, 'NA', { code: 'BAD_REQUEST', message: 'JSON required' })); }

  const val = validateEnv(env);
  if (!val.ok) {
    return safe(ws, makeEnv(T.ERROR, env.gameId || 'NA', { code: val.code, message: val.reason }, env.requestId));
  }

  const handler = HANDLERS[env.type];
  if (!handler) {
    return safe(ws, makeEnv(T.ERROR, env.gameId || 'NA', { code: 'UNKNOWN_TYPE', message: `Unknown type: ${env.type}` }, env.requestId));
  }

  return handler(ws, env);
}

function safe(ws, msg) {
  try { ws.send(JSON.stringify(msg)); }
  catch (e) { console.error(e); }
}

module.exports = { routeMessage, HANDLERS };

