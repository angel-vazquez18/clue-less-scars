const { makeEnv } = require('../schema/envelope');
const T = require('../schema/types');
const { resolveGameAndPlayer, playerHasCard, isCardRelevantToSuggestion, ensureActiveTurn } = require('../state/games');


function handleReconnect(ws, env) {
	const { gameId, payload, requestId } = env;
	// respond with same seq
	const { game, player } = resolveGameAndPlayer(ws, gameId);
	if (!playerId) {
		return sendWs(ws, makeEnv('ERROR', game.gameId, {
			code: 'MISSING_PLAYER_ID', message: 'playerId required to reconnect'
		}, requestId));
	}
	if (!player) {
		return sendWs(ws, makeEnv('ERROR', game.gameId, {
			code: 'PLAYER_NOT_FOUND', message: 'No such player in this game'
		}, requestId));
	}

	// reattach ws
	player.ws = ws;
	console.log(`[${game.gameId}] Player reconnected: ${player.name} (${player.id})`);

	// send them their current hand and game state snapshot
	sendWs(ws, makeEnv('YOUR_HAND', game.gameId, { cards: player.hand }, requestId));
	sendWs(ws, makeEnv('GAME_STATE', game.gameId, {
		board: game.board,
		players: Object.values(game.players).map(p => ({
			id: p.id, name: p.name, characterId: p.characterId
		})),
		you: { playerId: player.id, name: player.name, characterId: player.characterId },
		turn: game.turnOrder[game.turnIndex],
	}, requestId));

	// If it's currently their turn, remind them & include legal actions
	const currentId = getCurrentPlayerId(game);
	if (currentId === player.id) {
		const legal = computeLegalActions(game, player.id);
		sendWs(ws, makeEnv('TURN_START', game.gameId, {
			playerId: player.id, legal
		}, requestId));
	}
    safe(ws, makeEnv(T.RECONNECT, gameId || 'NA', { seq }, requestId));
}

function safe(ws, msg) { 
  try { ws.send(JSON.stringify(msg)); } 
  catch (e) { console.error(e); } 
}

module.exports = { handleReconnect };
