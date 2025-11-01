const PROTOCOL_VERSION = '1.0';

function makeEnv(type, gameId, payload = {}, requestId = null) {
  const env = { type, gameId, payload, ts: new Date().toISOString(), version: PROTOCOL_VERSION };
  if (requestId) env.requestId = requestId;
  return env;
}

function ok() { return { ok: true }; }
function bad(code, reason) { return { ok: false, code, reason }; }

function validateEnv(obj) {
  if (typeof obj !== 'object' || obj === null) return bad('INVALID_ENV', 'Envelope must be JSON object');
  const { type, gameId, payload, ts, version } = obj;
  if (!type || typeof type !== 'string' || type.trim() === '') return bad('INVALID_ENV', 'type must be non-empty string');
  if (!gameId || typeof gameId !== 'string' || gameId.trim() === '') return bad('INVALID_ENV', 'gameId must be non-empty string');
  if (typeof payload !== 'object' || payload === null) return bad('INVALID_ENV', 'payload must be JSON object');
  if (!ts || isNaN(Date.parse(ts))) return bad('INVALID_ENV', 'ts must be valid ISO timestamp string');
  if (version && version !== PROTOCOL_VERSION) return bad('INVALID_VERSION', `Unsupported protocol version: ${version}`);
  return ok();
}

module.exports = { makeEnv, validateEnv, PROTOCOL_VERSION };
