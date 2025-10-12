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
		case 'START_GAME':
			await processStartGame(ws, game, payload, requestId);
			break;
		case 'SELECT_CHARACTER':
			await processSelectCharacter(ws, game, payload, requestId);
			break;
		case 'REQUEST_MOVE':
			await processRequestMove(ws, game, payload, requestId);
			break;
		case 'MAKE_SUGGESTION':
			await processMakeSuggestion(ws, game, payload, requestId);
			break;
		case 'RESPOND_DISPROVAL':
			await processRespondDisproval(ws, game, payload, requestId);
			break;
		case 'MAKE_ACCUSATION':
			await processMakeAccusation(ws, game, payload, requestId);
			break;
		case 'CHAT':
			await processChat(ws, game, payload, requestId);
			break;
		case 'PING':
			sendWs(ws, makeEnv('PONG', gameId, {}, requestId));
			break;
		default:
			sendWs(ws, makeEnv('ERROR', gameId, { code: 'UNKNOWN_TYPE', message: 'Unknown message type: ${type}' }, requestId));
	}

	


}

