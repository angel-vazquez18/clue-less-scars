const { makeEnv } = require('../schema/envelope');
const T = require('../schema/types');

function handlePing(ws, env) {
  const { gameId, payload, requestId } = env;
  // respond with same seq
  const { seq } = payload || {};
  safe(ws, makeEnv(T.PONG, gameId || 'NA', { seq }, requestId));
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handlePing };
