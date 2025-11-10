const { ensureGame, createGame, addPlayer, publicPlayers } = require('../state/games');
const { makeEnv } = require('../schema/envelope');
const { broadcast } = require('../utils/send');
const T = require('../schema/types');

function handleJoin(ws, env) {
  const { gameId, payload, requestId } = env;
  const gid = (!gameId || gameId === 'NEW') ? createGame().gameId : gameId;
  const game = ensureGame(gid);

  const { name } = payload;
  if (!name || typeof name !== 'string' || name.length < 1 || name.length > 32) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'INVALID_NAME', 
      message: 'Name must be 1-32 characters' 
    }, requestId));
  }

  // Check maximum players
  if (Object.keys(game.players).length >= 6) {
    return safe(ws, makeEnv(T.ERROR, gameId, { 
      code: 'GAME_FULL', 
      message: 'Game is full (maximum 6 players)' 
    }, requestId));
  }

  const player = addPlayer(game, name.trim(), ws);
  console.log(`[${game.gameId}] Player joined: ${player.name} (${player.id})`);

  // private state to joining player
  safe(ws, makeEnv(T.YOUR_HAND, gid, { cards: player.hand || [] }, requestId));
  safe(ws, makeEnv(T.GAME_STATE, gid, {
    board: game.board,
    players: publicPlayers(game),
    you: { id: player.id, name: player.name, characterId: player.characterId },
    turn: { currentPlayerId: game.turnOrder[game.turnIndex], phase: game.started ? 'move' : 'lobby', order: game.turnOrder }
  }, requestId));

  // broadcast join + lobby roster to all
  broadcast(game, makeEnv(T.PLAYER_JOINED, gid, { playerId: player.id, name: player.name, message: `Player "${player.name}" joined` }));
  broadcast(game, makeEnv(T.LOBBY_STATE, gid, { players: publicPlayers(game) }));

  // tell the joining client what gid to reuse
  safe(ws, makeEnv(T.INFO, gid, { message: 'Joined game', gameId: gid }, requestId));
}

function safe(ws, msg){ try{ ws.send(JSON.stringify(msg)); }catch(e){ console.error(e); } }

module.exports = { handleJoin };
