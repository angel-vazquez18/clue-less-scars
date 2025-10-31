const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const HTTP_PORT = PORT + 1; // fallback HTTP port (or change as desired)
const PROTOCOL_VERSION = '1.0';

const app = express();
app.use(bodyParser.json());

// In-memory storage for game session
const games = {};

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
	const game = games[gameId];
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
	games[gameId] = {
		gameId,
		players: {},
		board: {},
		turnOrder: [],
		turnIndex: 0,
		started: false,
		solution: null,
	};
	return games[gameId];
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
    	sendWs(ws,  makeEnv('ERROR', env && env.gameId ? env.gameId : null, { code: validation.code, message: validation.reason }, env && env.requestId));
		return;
	}

	const { type, gameId, payload, requestId } = env;

	//Create game when JOIN_GAME to non-existent gameId is sent of "NEW" or empty gameId
	if ((type === 'JOIN_GAME') && (gameId === 'NEW' || !games[gameId])) {
		const newGame = createGame();
		await processJoinGame(ws, newGame, payload, requestId);
		return;
	}
	const game = games[gameId];
	if (!game) {
		sendWs(ws,  makeEnv('ERROR', gameId, { code: 'GAME_NOT_FOUND', message: `Game ${gameId} not found` }, requestId));
		return;
	}

	// Find player by ws
	const player = Object.values(game.players).find(p => p.ws === ws);

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
		case 'END_TURN':
  			return processEndTurn(game, player, requestId);
		default:
			console.warn(`[${gameId}] Unknown message type from player ${player?.name || 'unknown'}: ${type}`);
			sendWs(ws, makeEnv('ERROR', gameId, { 
				code: 'UNKNOWN_TYPE', 
				message: `Unknown message type: ${type}` 
			}, requestId));
	}
	if (game && player) {
		game.lastAction = {
			playerId: player.id,
			playerName: player.name,
			type,
			payload,
			ts: new Date().toISOString(),
		};
		console.log(`[ACTION] ${player.name} performed ${type}`);
	}
}

async function processJoinGame(ws, game, payload, requestId) {
	const { name } = payload;
	if (!name || typeof name !== 'string' || name.length < 1 || name.length > 32) {
		sendWs(ws, makeEnv('ERROR',  game.gameId, { code: 'INVALID_NAME', message: 'Name must be 1-32 characters' }, requestId));
		return; 
	}
	if (game.started) {
  		const currentPlayerId = getCurrentPlayerId(game);
  		sendWs(ws, makeEnv('TURN_START', game.gameId, { playerId: currentPlayerId }));
	}

	const player = addPlayer(game, name, ws);
	console.log(`[${game.gameId}] Player joined: ${player.name} (${player.id})`);

	// send YOUR_HAND
	sendWs(ws, makeEnv('YOUR_HAND', game.gameId, { cards: player.hand, }, requestId));

	// send GAME_STATe to joining player
	sendWs(ws, makeEnv('GAME_STATE', game.gameId, {
		board: game.board,
		players: Object.values(game.players).map(p => ({ id: p.id, name: p.name, characterId: p.characterId})),
		you: { playerId: player.id, name: player.name, characterId: player.characterId },
		turn: game.turnOrder[game.turnIndex],
	}, requestId));

	// broadcast PLAYER_JOINED to all
	broadcastGame( game.gameId, 'PLAYER_JOINED', { playerId: player.id, name: player.name });
}	

function processSelectCharacter(game, player, payload, requestId) {
	if (!player) {
		return sendError(null, 'NOT_JOINED', 'You must JOIN_GAME first', game.gameId, requestId);
	}
	const { characterId } = payload || {};
	if (!characterId || typeof characterId !== 'string') {
		sendWs(player.ws, makeEnv('ERROR', game.gameId, { code: 'INVALID_CHARACTER', message: 'characterId must be non-empty string' }, requestId));
		return;
	}
	// uniqueness check (naive)
	const already = Object.values(game.players).find(p => p.characterId === characterId);
	if (already) {
		sendWs(player.ws, makeEnv('ERROR', game.gameId, { code: 'CHARACTER_TAKEN', message: 'Character already taken' }, requestId));
		return;
	}
	player.characterId = characterId;
	broadcastGame( game.gameId, 'CHARACTER_SELECTED', { playerId: player.id, characterId });
}

function processStartGame(game, player, payload, requestId) {	
	// Start game only if game isn't started already
	if (game.started) {
    	if (player && player.ws) {
			sendWs(player.ws,  makeEnv('ERROR', game.gameId, { code: 'ALREADY_STARTED', message: 'Game already started' }, requestId));
		}
		return;
	}

	// ensure more than 1 player
	if (Object.keys(game.players).length < 2) {
		if (player && player.ws) {
			sendWs(player.ws,  makeEnv('ERROR', game.gameId, { code: 'NOT_ENOUGH_PLAYERS', message: 'At least 2 players required to start' }, requestId));
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
	broadcastGame( game.gameId, 'GAME_STARTED', {});
	// notify each player of their hand
	for (const pId in game.players) {
		const p = game.players[pId];
		sendWs(p.ws,  makeEnv('YOUR_HAND', game.gameId, { cards: p.hand }));
	}
	// turn start
	const currentPlayerId = game.turnOrder[game.turnIndex];
	// Log the turn order and starting player
	console.log(`[TURN_ORDER] ${game.turnOrder.map(id => game.players[id].name).join(' -> ')}`);
	console.log(`[TURN] Starting with ${game.players[currentPlayerId].name}`);
	broadcastGame( game.gameId, 'TURN_START', { playerId: currentPlayerId });
}

function processRequestMove(game, player, payload, requestId) {
	if (!player) {
		return sendError(null, 'NOT_JOINED', 'You must JOIN_GAME first', game.gameId, requestId);
	}
	if (!game.started) {
		sendWs(player.ws,  makeEnv('ERROR', game.gameId, { code: 'GAME_NOT_STARTED', message: 'Game has not started' }, requestId));
		return;
	}
	if (!isPlayersTurn(game, player.id)) {
		sendWs(player.ws, makeEnv('ERROR', game.gameId, { code: 'NOT_YOUR_TURN', message: 'It is not your turn' }, requestId));
		return;
	}
	const { to, targetId, useSecretPassage } = payload || {};
	if (!to || !['HALLWAY', 'ROOM'].includes(to)) {
		sendWs(player.ws,  makeEnv('ERROR', game.gameId, { code: 'INVALID_MOVE', message: 'to must be HALLWAY or ROOM' }, requestId));
		return;
	}
	const from = player.position || null;
	player.position = { zone: to, id: targetId || null, secret: !!useSecretPassage };
	broadcastGame( game.gameId, 'PLAYER_MOVED', { playerId: player.id, from, to: player.position });
}

function processMakeSuggestion(game, player, payload, requestId) {
	if (!player) {
		return sendError(null, 'NOT_JOINED', 'You must JOIN_GAME first', game.gameId, requestId);
	}
	if (!game.started) {
		sendWs(player.ws,  makeEnv('ERROR', game.gameId, { code: 'GAME_NOT_STARTED', message: 'Game has not started' }, requestId));
		return;
	}
	if (!isPlayersTurn(game, player.id)) {
		sendWs(player.ws, makeEnv('ERROR', game.gameId, { code: 'NOT_YOUR_TURN', message: 'It is not your turn' }, requestId));
		return;
	}
	const { suspectId, weaponId } = payload || {};
	if (!suspectId || !weaponId) {
		sendWs(player.ws,  makeEnv('ERROR', game.gameId, { code: 'INVALID_SUGGESTION', message: 'must include suspectId and weaponId' }, requestId));
		return;
	}
	// build order starting from next player
	const order = computeDisproveOrder(game, player.id);
	// broadcast suggestion
	broadcastGame( game.gameId, 'SUGGESTION_MADE', { by: player.id, suspectId, weaponId, roomId: (player.position && player.position.zone === 'ROOM') ? player.position.id : null });
	// send PROMPT_DISPROVE to the next player in order with ability to respond flow
	const nextPlayerId = order.length > 0 ? order[0] : null;
	const prompt = {
	suggestion: { suspectId, weaponId, roomId: (player.position && player.position.zone === 'ROOM') ? player.position.id : null },
	order,
	nextPlayerId
	};
	// Send PROMPT_DISPROVE unicast to the original suggester
	// also send PROMPT_DISPROVE to the next player who needs to respond
	sendToPlayer(game, player.id, 'PROMPT_DISPROVE', prompt);
	// Also broadcast the prompt to all? Spec says PROMPT_DISPROVE is server→client unicast messages, so will only send to relevant clients:
	if (nextPlayerId) {
		sendToPlayer(game, nextPlayerId, 'PROMPT_DISPROVE', prompt);
	}
}

function processRespondDisprove(game, player, payload, requestId) {
	if (!player) {
		return sendError(null, 'NOT_JOINED', 'You must JOIN_GAME first', game.gameId, requestId);
	}
	// payload.cardId may be undefined/null to indicate can't disprove
	const { cardId } = payload || {};
	// If cardId present, ensure player has the card ( use empty hands currently so allow any card for demo)
	// For real implementation must check player's hand
	const disproverId = cardId ? player.id : null;
	broadcastGame( game.gameId, 'DISPROVE_RESULT', { disproverId });
	// In a real flow you would send specific info back to suggester if cardId present privately (not broadcast)
	if (cardId) {
	// notify suggester privately of which card disproved (in real game you reveal only to suggester)
	// find suggester by scanning last suggestion ( don't store it in this demo). For now, simulate by sending to all that may be fine.
	// I'll just send INFO to suggester if found in order. Skipping complex flow here.
	}
}

function processMakeAccusation(game, player, payload, requestId) {
	if (!player) {
		return sendError(null, 'NOT_JOINED', 'You must JOIN_GAME first', game.gameId, requestId);
	}
	if (!isPlayersTurn(game, player.id)) {
		sendWs(player.ws, makeEnv('ERROR', game.gameId, { code: 'NOT_YOUR_TURN', message: 'It is not your turn' }, requestId));
		return;
	}
	const { suspectId, weaponId, roomId } = payload || {};
	if (!suspectId || !weaponId || !roomId) {
		sendWs(player.ws,  makeEnv('ERROR', game.gameId, { code: 'INVALID_ACCUSATION', message: 'must include suspectId, weaponId, roomId' }, requestId));
		return;
	}
	// Check against solution
	const correct = (game.solution && game.solution.suspectId === suspectId && game.solution.weaponId === weaponId && game.solution.roomId === roomId);
	broadcastGame( game.gameId, 'ACCUSATION_RESOLVED', { by: player.id, correct });
	if (correct) {
		broadcastGame( game.gameId, 'GAME_OVER', { winnerId: player.id, solution: game.solution });
		game.started = false;
	} else {
		// in Clue, incorrect accusation often eliminates player; we'll simply announce
		// in a fuller implementation mark player as eliminated
		sendWs(player.ws,  makeEnv('INFO', game.gameId, { message: 'Your accusation was incorrect — you are out (demo behavior)' }, requestId));
	}
}

function processChat(game, player, payload, requestId) {
	const { message, to } = payload || {};
	if (!message || typeof message !== 'string' || message.length < 1 || message.length > 256) {
		if (player && player.ws) sendWs(player.ws,  makeEnv('ERROR', game.gameId, { code: 'INVALID_CHAT', message: 'message must be 1..256 chars' }, requestId));
		return;
	}
	if (to) {
		// private chat to playerId 'to'
		const target = game.players[to];
		if (target && target.ws) {
			console.log(`[CHAT:PRIVATE] [${game.gameId}] ${player.name} → ${target.name}: ${message}`);
			sendWs(target.ws,  makeEnv('CHAT', game.gameId, { from: player.id, message }));
		} else {
			sendWs(player.ws,  makeEnv('ERROR', game.gameId, { code: 'PLAYER_NOT_FOUND', message: 'recipient not found' }, requestId));
		}
	} else {
		console.log(`[CHAT] [${game.gameId}] ${player.name}: ${message}`);
		// broadcast chat
		broadcastGame( game.gameId, 'CHAT', { from: player.id, message });
	}
}

function processPing(ws, gameId, payload, requestId) {
	// respond with same seq
	const { seq } = payload || {};
	sendWs(ws,  makeEnv('PING', gameId, { seq }, requestId));
}

function processEndTurn(game, player, requestId) {
	if (!isPlayersTurn(game, player.id)) {
		sendWs(player.ws, makeEnv('ERROR', game.gameId, { code: 'NOT_YOUR_TURN', message: 'Not your turn' }, requestId));
		return;
	}
  nextTurn(game);
}
	
// Helper senders

function sendError(ws, code, message, gameId = null, requestId = null) {
	const env =  makeEnv('ERROR', gameId, { code, message }, requestId);
	if (ws) sendWs(ws, env);
}

function sendToPlayer(game, playerId, type, payload = {}, requestId = null) {
	const p = game.players[playerId];
	if (!p || !p.ws) return;
	sendWs(p.ws,  makeEnv(type, game.gameId, payload, requestId));
}

function computeDisproveOrder(game, fromPlayerId) {
	//Starting from the next player in turnOrder after the suggester, list playerIds in order excluding suggester.
	const order = [];
	const idx = game.turnOrder.indexOf(fromPlayerId);
	if (idx === -1) return order;
	const n = game.turnOrder.length;
	for (let i = 1; i < n; i++) {
		const pid = game.turnOrder[(idx + i) % n];
		order.push(pid);
	}
	return order;
}

// ---- TURN SYSTEM HELPERS ----
function getCurrentPlayerId(game) {
	return game.turnOrder[game.turnIndex];
}

function isPlayersTurn(game, playerId) {
	return getCurrentPlayerId(game) === playerId;
}

function nextTurn(game) {
  if (!game.started || game.turnOrder.length === 0) return;
  
  let loops = 0;
  do {
    game.turnIndex = (game.turnIndex + 1) % game.turnOrder.length;
    loops++;
  } while (game.players[getCurrentPlayerId(game)]?.eliminated && loops < game.turnOrder.length);
  
  const currentPlayerId = getCurrentPlayerId(game);
  console.log(`[TURN] It is now ${game.players[currentPlayerId].name}'s turn`);
  broadcastGame(game.gameId, 'TURN_START', { playerId: currentPlayerId });
}





//WebSocket Server Setup

const wss = new WebSocket.Server({ port: PORT }, () => {
	console.log(`WebSocket server listening on ws://localhost:${PORT}`);
	});

wss.on('connection', (ws, req) => {
	// On new WS connection, expect client to send JOIN_GAME envelope soon.
	ws.on('message', async (data) => {
		let envelope;
		try {
			envelope = JSON.parse(data.toString('utf8'));
		} catch (e) {
			sendWs(ws,  makeEnv('ERROR', null, { code: 'MALFORMED_JSON', message: 'Invalid JSON' }));
			return;
		}
		await handleMessage(ws, envelope);
	});

	ws.on('close', () => {
		// On close, detach ws from any player(s)
		for (const g of Object.values(games)) {
			for (const pId in g.players) {
				const p = g.players[pId];
				if (g.turnOrder[g.turnIndex] === pId) {
					console.log(`[TURN] ${p.name} disconnected during their turn — skipping to next player`);
					nextTurn(g);
				}
				if (p.ws === ws) {
					p.ws = null;
					console.log(`[${g.gameId}] Player disconnected: ${p.name} (${p.id})`);
					broadcastGame(g.gameId, 'INFO', { message: `${p.name} disconnected` });
				}
			}
		}
	});
});

// HTTP Server Setup
// Post /message
// Body: JSON envelope
// Header: player-id to identify sender (optional, for logging)
// Response: env of JSON (same as server would send via WS)
app.post('/message', async (req, res) => {
	const envelope = req.body;
	// No live ws; for HTTP emulate by returning result envelope(s) in an array
	const validation = validateEnv(envelope);
	if (!validation.ok) {
		return res.status(400).json( makeEnv('ERROR', envelope && envelope.gameId ? envelope.gameId : null, { code: validation.code, message: validation.reason }, envelope && envelope.requestId));
	}
	// For HTTP fallback need an associated playerId. Require header x-player-id.
	const playerId = req.header('x-player-id');
	if (!playerId) {
		return res.status(400).json( makeEnv('ERROR', envelope.gameId, { code: 'MISSING_PLAYER_ID', message: 'x-player-id header required for HTTP messages' }, envelope.requestId));
	}
	const game = games[envelope.gameId];
	if (!game) {
		return res.status(404).json( makeEnv('ERROR', envelope.gameId, { code: 'GAME_NOT_FOUND', message: 'game not found' }, envelope.requestId));
	}
	// Attach a dummy ws-like object that responds by collecting outgoing envelopes return
	const player = game.players[playerId];
	if (!player) return res.status(404).json( makeEnv('ERROR', envelope.gameId, { code: 'PLAYER_NOT_FOUND', message: 'player not found' }, envelope.requestId));

	// Temporarily set player's ws to an object that records sent envelopes
	const recorded = [];
	const fakeWs = {
		send: (data) => {
			try {
				recorded.push(JSON.parse(data));
			} catch (e) {}
		},
		readyState: WebSocket.OPEN
	};
	const originalWs = player.ws;
	player.ws = fakeWs;

	// handle message
	await handleMessage(fakeWs, envelope);

	// restore
	player.ws = originalWs;

	// return recorded envelopes (or a success)
	return res.json({ envelopes: recorded });
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP fallback API listening on http://localhost:${HTTP_PORT} (POST /message)`);
});



// Debug Testing 
const demoGame = createGame();
console.log('Created demo gameId:', demoGame.gameId);
console.log('Connect with a WebSocket client and send a JOIN_GAME envelope with gameId="NEW" to create/join a game, or join demo gameId above.');
