const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const { version } = require('os');

const PORT = process.env.PORT || 8080;
const HTTP_PORT = PORT + 1; // fallback HTTP port (or change as desired)
const PROTOCOL_VERSION = '1.0';

const app = express();
app.use(bodyParser.json());

// In-memory storage for game session
const game = {};

// Utility Functions

function nowIso() {
  	return new Date().toISOString();
}

function makeEnv(type, gameId, payload = {}, requestId = null) {
	const env = {
        type,
        gameId,
        payload,
        ts: nowIso(),
        version: PROTOCOL_VERSION,
	};
	if (requestId) {
		env.requestId = requestId;
  	}
  	return env;
}

function sendWs(ws, env) {
	try {
		ws.send(JSON.stringify(env));
	} catch (error) {
		console.error('Failed to send message:', error);
	}
}

function broadcastGame(gameId, type, payload = {}, options = {}) {
	const game = game[gameId];
	if (!game) return;
	const env = makeEnv(type, gameId, payload, options.requestId);
	for (const pId in game.players) {
		const player = game.players[pId];
		if (player.ws && player.ws.readyState === WebSocket.OPEN) {
			sendWs(player.ws, env);
		}
	}
}

// Validation Funcs

function invalidEnv(reason) {
	return { ok: false, code: 'INVALID_ENV', reason };
}

function okEnv() {
	return { ok: true };
}

function validateEnv(obj) {
	if (typeof obj !== 'object' || obj === null) return invalidEnv('envelope must be JSON object');
	const { type, gameId, payload, ts, version } = obj;
	if (typeof type !== 'string' || type.trim() === '') return invalidEnv('type must be non-empty string');
	if (typeof gameId !== 'string' || gameId.trim() === '') return invalidEnv('gameId must be non-empty string');
	if (typeof payload !== 'object' || payload === null) return invalidEnv('payload must be JSON object');
	if (typeof ts !== 'string' || isNaN(Date.parse(ts))) return invalidEnv('ts must be valid ISO timestamp string');
	if (version !== PROTOCOL_VERSION) return invalidEnv(`unsupported protocol version: ${version}`);
	return okEnv();
}

// Game Funcs

function createGame() {
	const gameId = uuidv4();
	game[gameId] = {
		gameId,
		players: {},
		board: {},
		turnOrder: [],
		turnIndex: 0,
		started: false,
		solution: null, // to be set when game starts
	};
	return game[gameId];
}

function addPlayer(game, name, ws) {
	const playerId = uuidv4();
	const player = {id: playerId, name, ws, characterId: null, hand: [], position: null};
	game.players[playerId] = player;
	game.turnOrder.push(playerId);
	return player;
}

// Message Handlers

async function handleMessage(ws, env) {
	const validation = validateEnv(env);
	if (!validation.ok) {
    	sendWs(ws, makeEnvelope('ERROR', env && env.gameId ? env.gameId : null, { code: validation.code, message: validation.message }, env && env.requestId));
		return;
	}

	const { type, gameId, payload, requestId } = env;

	//Create game when JOIN_GAME to non-existent gameId is sent of "NEW" or empty gameId
	if ((type === 'JOIN_GAME') && (gameId === 'NEW' || !game[gameId])) {
		const game = createGame();
		await processJoinGame(ws, game.gameId, payload, requestId);
		return;
	}
	const game = games[gameId];
	if (!game) {
		sendWs(ws, makeEnvelope('ERROR', gameId, { code: 'GAME_NOT_FOUND', message: 'Game ${gameId} not found' }, requestId));
		return;
	}
	switch (type) {
		case 'JOIN_GAME':
			await processJoinGame(ws, game, payload, requestId);
			break;
		case 'SELECT_CHARACTER':
			return processSelectCharacter(game, player, payload, requestId);
		case 'START_GAME':
			return processStartGame(game, player, requestId);
		case 'REQUEST_MOVE':
			return processRequestMove(game, player, payload, requestId);
		case 'MAKE_SUGGESTION':
			return processMakeSuggestion(game, player, payload, requestId);
		case 'RESPOND_DISPROVE':
			return processRespondDisprove(game, player, payload, requestId);
		case 'MAKE_ACCUSATION':
			return processMakeAccusation(game, player, payload, requestId);
		case 'CHAT':
			return processChat(game, player, payload, requestId);
		case 'PING':
			return processPing(ws, gameId, payload, requestId);
		default:
			sendWs(ws, makeEnv('ERROR', gameId, { code: 'UNKNOWN_TYPE', message: 'Unknown message type: ${type}' }, requestId));
	}
}

async function processJoinGame(ws, game, payload, requestId) {
	const { name } = payload;
	if (!name || typeof name !== 'string' || name.length < 1 || name.lenght > 32) {
		sendWs(ws, makeEnv('ERROR', game.id, { code: 'INVALID_NAME', message: 'Name must be 1-32 characters' }, requestId));
		return;
	}

	const player = addPlayer(game, name, ws);
	
	// send YOUR_HAND
	sendWs(ws, makeEnv('YOUR_HAND', game.id, { cards: player.hand, }, requestId));

	// send GAME_STATe to joining player
	sendWs(ws, makeEnv('GAME_STATE', game.id, {
		board: game.board,
		players: Object.values(game.players).map(p => ({ id: p.id, name: p.name, characterId: p.characterId})),
		you: { playerId: player.id, name: player.name, characterId: player.characterId },
		turn: game.turnOrder[game.turnIndex],
	}, requestId));

	// broadcast PLAYER_JOINED to all
	broadcastGame(game.id, 'PLAYER_JOINED', { playerId: player.id, name: player.name });
}	

async function processSelectCharacter(game, player, payload, requestId) {
	if (!player) {
		return broadcastErrorToWs(null, 'NOT_JOINED', 'You must JOIN_GAME first', game.id, requestId);
	}
	const { characterId } = payload || {};
	if (!characterId || typeof characterId !== 'string') {
		sendWs(player.ws, makeEnv('ERROR', game.id, { code: 'INVALID_CHARACTER', message: 'characterId must be non-empty string' }, requestId));
		return;
	}
	// uniqueness check (naive)
	const already = Object.values(game.players).find(p => p.characterId === characterId);
	if (already) {
		sendWs(player.ws, makeEnv('ERROR', game.id, { code: 'CHARACTER_TAKEN', message: 'Character already taken' }, requestId));
		return;
	}
	player.characterId = characterId;
	broadcastGame(game.id, 'CHARACTER_SELECTED', { playerId: player.id, characterId });
}

async function processStartGame(game, player, payload, requestId) {
	// Start game only if game isn't started already
	if (game.started) {
    	if (player && player.ws) {
			sendWs(player.ws, makeEnvelope('ERROR', game.id, { code: 'ALREADY_STARTED', message: 'Game already started' }, requestId));
		}
	}

	// ensure more than 1 player
	if (Object.keys(game.players).length < 2) {
		if (player && player.ws) {
			sendWs(player.ws, makeEnvelope('ERROR', game.id, { code: 'NOT_ENOUGH_PLAYERS', message: 'At least 2 players required to start' }, requestId));
		}
		return;
	}

	// assign start hands and soltuion
	const cards =  ['suspect1','suspect2','suspect3','weapon1','weapon2','weapon3','room1','room2','room3'];
	game.solution = {
		suspectId: cards.find(c => c.startsWith('suspect')),
		weaponId: cards.find(c => c.startsWith('weapon')),
		roomId: cards.find(c => c.startsWith('room'))
  	};
	
	//distribute cards
	for (const pid of Object.keys(game.players)) {
    	game.players[pid].hand = []; // assign cards later if needed
  	}
	game.started = true;
	broadcastGame(game.id, 'GAME_STARTED', {});
	// notify each player of their hand
	for (const pId in game.players) {
		const p = game.players[pId];
		sendWs(p.ws, makeEnvelope('YOUR_HAND', game.id, { cards: p.hand }));
	}
	// turn start
	const currentPlayerId = game.turnOrder[game.turnIndex];
	broadcastGame(game.id, 'TURN_START', { playerId: currentPlayerId });
}


	
