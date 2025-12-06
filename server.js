const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const HTTP_PORT = PORT + 1; // fallback HTTP port (or change as desired)
const PROTOCOL_VERSION = '1.0';


const TurnPhase = {
  START: 'Start',
  MOVE_OR_SUGGEST: 'MoveOrSuggest',
  DISPROVAL: 'Disproval',
  ACCUSATION_OPTION: 'AccusationOption',
  END: 'End'
};

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
		board: buildDefaultBoard(),
		turnOrder: [],
		turnIndex: 0,
		started: false,
		solution: null,
		turnPhase: TurnPhase.START,
		currentSuggestion: null,
		waitingForDisprove: null
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
		case 'RECCONNECT':
			return processReconnect(ws, game, payload, requestId);
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
		game.lastActivePlayer = player.id;
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
	beginTurn(game, currentPlayerId);
	// Log the turn order and starting player
	console.log(`[TURN_ORDER] ${game.turnOrder.map(id => game.players[id].name).join(' -> ')}`);
	console.log(`[TURN] Starting with ${game.players[currentPlayerId].name}`);
}

function buildDefaultBoard() {
	// Room IDs (3x3 grid)
	// Row 1: STUDY, HALL, LOUNGE
	// Row 2: LIBRARY, BILLIARD_ROOM, DINING_ROOM
	// Row 3: CONSERVATORY, BALLROOM, KITCHEN
	//
	// Hallways (edges) are single-occupancy connectors between adjacent rooms.
	// Horizontal hallways:
	//   H_STUDY_HALL, H_HALL_LOUNGE,
	//   H_LIBRARY_BILLIARD, H_BILLIARD_DINING,
	//   H_CONSERVATORY_BALLROOM, H_BALLROOM_KITCHEN
	// Vertical hallways:
	//   H_STUDY_LIBRARY, H_HALL_BILLIARD, H_LOUNGE_DINING,
	//   H_LIBRARY_CONSERVATORY, H_BILLIARD_BALLROOM, H_DINING_KITCHEN
	//
	// Secret passages (corners):
	//   STUDY <-> KITCHEN
	//   LOUNGE <-> CONSERVATORY
	const hallways = {
		// horizontals (row 1)
		H_STUDY_HALL: { id: 'H_STUDY_HALL', capacity: 1, occupiedBy: null },
		H_HALL_LOUNGE: { id: 'H_HALL_LOUNGE', capacity: 1, occupiedBy: null },
		// horizontals (row 2)
		H_LIBRARY_BILLIARD: { id: 'H_LIBRARY_BILLIARD', capacity: 1, occupiedBy: null },
		H_BILLIARD_DINING: { id: 'H_BILLIARD_DINING', capacity: 1, occupiedBy: null },
		// horizontals (row 3)
		H_CONSERVATORY_BALLROOM: { id: 'H_CONSERVATORY_BALLROOM', capacity: 1, occupiedBy: null },
		H_BALLROOM_KITCHEN: { id: 'H_BALLROOM_KITCHEN', capacity: 1, occupiedBy: null },

		// verticals (col 1)
		H_STUDY_LIBRARY: { id: 'H_STUDY_LIBRARY', capacity: 1, occupiedBy: null },
		H_LIBRARY_CONSERVATORY: { id: 'H_LIBRARY_CONSERVATORY', capacity: 1, occupiedBy: null },
		// verticals (col 2)
		H_HALL_BILLIARD: { id: 'H_HALL_BILLIARD', capacity: 1, occupiedBy: null },
		H_BILLIARD_BALLROOM: { id: 'H_BILLIARD_BALLROOM', capacity: 1, occupiedBy: null },
		// verticals (col 3)
		H_LOUNGE_DINING: { id: 'H_LOUNGE_DINING', capacity: 1, occupiedBy: null },
		H_DINING_KITCHEN: { id: 'H_DINING_KITCHEN', capacity: 1, occupiedBy: null },
	};

	const rooms = {
		// Row 1
		STUDY: {
			id: 'STUDY',
			adj: ['H_STUDY_HALL', 'H_STUDY_LIBRARY'],
			secret: 'KITCHEN',
		},
		HALL: {
			id: 'HALL',
			adj: ['H_STUDY_HALL', 'H_HALL_LOUNGE', 'H_HALL_BILLIARD'],
			secret: null,
		},
		LOUNGE: {
			id: 'LOUNGE',
			adj: ['H_HALL_LOUNGE', 'H_LOUNGE_DINING'],
			secret: 'CONSERVATORY',
		},

		// Row 2
		LIBRARY: {
			id: 'LIBRARY',
			adj: ['H_STUDY_LIBRARY', 'H_LIBRARY_BILLIARD', 'H_LIBRARY_CONSERVATORY'],
			secret: null,
		},
		BILLIARD_ROOM: {
			id: 'BILLIARD_ROOM',
			adj: ['H_LIBRARY_BILLIARD', 'H_BILLIARD_DINING', 'H_HALL_BILLIARD', 'H_BILLIARD_BALLROOM'],
			secret: null,
		},
		DINING_ROOM: {
			id: 'DINING_ROOM',
			adj: ['H_BILLIARD_DINING', 'H_LOUNGE_DINING', 'H_DINING_KITCHEN'],
			secret: null,
		},

		// Row 3
		CONSERVATORY: {
			id: 'CONSERVATORY',
			adj: ['H_LIBRARY_CONSERVATORY', 'H_CONSERVATORY_BALLROOM'],
			secret: 'LOUNGE',
		},
		BALLROOM: {
			id: 'BALLROOM',
			adj: ['H_CONSERVATORY_BALLROOM', 'H_BALLROOM_KITCHEN', 'H_BILLIARD_BALLROOM'],
			secret: null,
		},
		KITCHEN: {
			id: 'KITCHEN',
			adj: ['H_BALLROOM_KITCHEN', 'H_DINING_KITCHEN'],
			secret: 'STUDY',
		},
	};
  	return { rooms, hallways };
}

function getAdjacent(board, from) {
	if (!from) return [];
	if (from.zone === 'ROOM') {
		// from a room → list of hallways or connected rooms
		const adj = board.rooms[from.id]?.adj || [];
		return adj.map(id => ({ zone: 'HALLWAY', id }));
	}
	if (from.zone === 'HALLWAY') {
		// from a hallway → which rooms are connected
		return Object.keys(board.rooms)
			.filter(r => board.rooms[r].adj.includes(from.id))
			.map(id => ({ zone: 'ROOM', id }));
	}
	return [];
}

function isBlocked(board, hallwayId) {
	const h = board.hallways?.[hallwayId];
	if (!h) return true; // treat unknown hallway as blocked/invalid
	return Boolean(h.occupiedBy);
}

function processRequestMove(game, player, payload, requestId) {
	if (!player || !game.started) return;

	if (!isPlayersTurn(game, player.id)) {
		return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
			code: 'NOT_YOUR_TURN',
			message: 'It is not your turn'
		}, requestId));
	}

	if (game.movedThisTurn) {
		return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
      		code: 'ALREADY_MOVED', message: 'You have already moved this turn'
    	}, requestId));
  	}

	const { to, useSecretPassage = false } = payload || {};
	if (!to || !to.zone || !to.id) {
		return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
			code: 'INVALID_PAYLOAD',
			message: 'Missing move target'
		}, requestId));
	}

	// if not set yet, initialize players in the "LOUNGE" (or any default room)
	if (!player.position) {
		player.position = { zone: 'ROOM', id: 'LOUNGE' };
	}
	const from = player.position;

	const adj = getAdjacent(game.board, from);
	let canMove = adj.some(a => a.zone === to.zone && a.id === to.id);
	 // Enforce shape of move
	if (from.zone === 'ROOM' && to.zone === 'ROOM') {
	const passage = game.board.rooms[from.id]?.secret;
	if (passage !== to.id) {
		return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
			code: 'NO_PASSAGE', message: 'Rooms not connected by secret passage'
		}, requestId));
	}
	}
	if (from.zone === 'HALLWAY' && to.zone === 'HALLWAY') {
	return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
		code: 'INVALID_MOVE', message: 'Cannot move hallway to hallway'
	}, requestId));
	}
	if (!canMove && useSecretPassage) {
		const passage = game.board.rooms[from.id]?.secret;
		if (passage === to.id) canMove = true;
	}

	if (!canMove) {
		return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
			code: 'INVALID_MOVE',
			message: `Cannot move from ${from.id} to ${to.id}`
		}, requestId));
	}

	if (to.zone === 'HALLWAY' && isBlocked(game.board, to.id)) {
		return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
			code: 'BLOCKED',
			message: 'That hallway is currently occupied'
		}, requestId));
	}

	// Clear old hallway occupancy
	if (from.zone === 'HALLWAY') game.board.hallways[from.id].occupiedBy = null;
	// Set new hallway occupancy
	if (to.zone === 'HALLWAY') game.board.hallways[to.id].occupiedBy = player.id;

	player.position = to;

	broadcastGame(game.gameId, 'PLAYER_MOVED', {
		playerId: player.id,
		from,
		to
	});

	// After moving, player may still Suggest or End Turn
	game.turnPhase = TurnPhase.MOVE_OR_SUGGEST;
	//will add limited movement later
	//game.movedThisTurn = true;
	// Recompute legal actions for the active player (optional: re-emit TURN_START or a lighter UPDATE_LEGAL)
	const active = getCurrentPlayerId(game);
	sendToPlayer(game, active, 'TURN_START', { playerId: active, legal: computeLegalActions(game, active) });
}

function processMakeSuggestion(game, player, payload, requestId) {
	if (!isPlayersTurn(game, player.id)) return;
	if (game.turnPhase !== TurnPhase.MOVE_OR_SUGGEST) {
    	return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
      		code: 'ILLEGAL_PHASE', message: 'You can only suggest during MoveOrSuggest'
		}, requestId));
	}
	const { suspectId, weaponId } = payload || {};
	if (!suspectId || !weaponId) {
	   	return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
	    	code: 'INVALID_SUGGESTION', message: 'Must include suspectId and weaponId'
   		}, requestId));
	}
	if (player.position?.zone !== 'ROOM') {
    return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
      		code: 'NOT_IN_ROOM', message: 'You must be in a room to make a suggestion'
    	}, requestId));
  	}
	const roomId = player.position.id;

	// Move suspect to that room
	const suspect = Object.values(game.players).find(p => p.characterId === suspectId);
	if (suspect) {
		suspect.position = { zone: 'ROOM', id: roomId };
		broadcastGame(game.gameId, 'PLAYER_MOVED', { playerId: suspect.id, to: suspect.position });
	}
	else {
		// Optionally emit a neutral event so UIs can update tokens/NPCs.
		broadcastGame(game.gameId, 'SUSPECT_SUMMONED', { suspectId, roomId });
	}

	game.currentSuggestion = { by: player.id, suspectId, weaponId, roomId };
	const order = computeDisproveOrder(game, player.id);
	const nextPlayerId = order[0];

	broadcastGame(game.gameId, 'SUGGESTION_MADE', { by: player.id, suspectId, weaponId, roomId });
	if (order.length === 0) {
		// No one to ask → straight to accusation option
		game.turnPhase = TurnPhase.ACCUSATION_OPTION;
		const active = getCurrentPlayerId(game);
		return sendToPlayer(game, active, 'TURN_START', { playerId: active, legal: computeLegalActions(game, active) });
	}
	game.waitingForDisprove = nextPlayerId;
	game.turnPhase = TurnPhase.DISPROVAL;
	sendToPlayer(game, nextPlayerId, 'PROMPT_DISPROVE', { suggestion: game.currentSuggestion });

}

function processRespondDisprove(game, player, payload, requestId) {
	const { cardId } = payload || {};
	if (game.waitingForDisprove !== player.id) {
		return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
			code: 'NOT_YOUR_DISPROVAL', message: 'It is not your turn to disprove'
		}, requestId));
	}

	const suggester = game.players[game.currentSuggestion.by];
	const matches = [game.currentSuggestion.suspectId, game.currentSuggestion.weaponId, game.currentSuggestion.roomId];
 	const hasMatch = player.hand.some(c => matches.includes(c));
	const cardMatchesSuggestion = matches.includes(cardId);
	if (cardId && hasMatch && cardMatchesSuggestion && player.hand.includes(cardId)) {
		sendToPlayer(game, suggester.id, 'REVEAL_TO_YOU', { from: player.id, card: cardId });
		broadcastGame(game.gameId, 'DISPROVED', { by: player.id, cardHidden: true });
		game.turnPhase = TurnPhase.ACCUSATION_OPTION;
		game.waitingForDisprove = null;
		// let active player know options now
		const active = getCurrentPlayerId(game);
		sendToPlayer(game, active, 'TURN_START', { playerId: active, legal: computeLegalActions(game, active) });
	} else {
		// If a cardId was provided but is illegal, tell them why (optional quality-of-life)
		if (cardId && (!player.hand.includes(cardId) || !cardMatchesSuggestion)) {
	    	return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
				code: 'INVALID_DISPROVAL_CARD', message: 'You must reveal a card that matches the suggestion'
      		}, requestId));
    	}
		// advance to next player in chain
		const order = computeDisproveOrder(game, game.currentSuggestion.by);
		if (order.length === 0) {
			broadcastGame(game.gameId, 'NO_DISPROOF', { suggestion: game.currentSuggestion });
			game.turnPhase = TurnPhase.ACCUSATION_OPTION;
			game.waitingForDisprove = null;
			const active = getCurrentPlayerId(game);
			return sendToPlayer(game, active, 'TURN_START', { playerId: active, legal: computeLegalActions(game, active) });
    	}
		const currentIdx = order.indexOf(player.id);
		const next = order[(currentIdx + 1) % order.length];
		if (next && next !== game.currentSuggestion.by) {
			game.waitingForDisprove = next;
			sendToPlayer(game, next, 'PROMPT_DISPROVE', { suggestion: game.currentSuggestion });
		} else {
			broadcastGame(game.gameId, 'NO_DISPROOF', { suggestion: game.currentSuggestion });
			game.turnPhase = TurnPhase.ACCUSATION_OPTION;
			game.waitingForDisprove = null;
			const active = getCurrentPlayerId(game);
			sendToPlayer(game, active, 'TURN_START', { playerId: active, legal: computeLegalActions(game, active) });
		}
	}
}

function processMakeAccusation(game, player, payload, requestId) {
	if (!isPlayersTurn(game, player.id)) return;
	if (game.turnPhase !== TurnPhase.ACCUSATION_OPTION) {
		return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
			code: 'ILLEGAL_PHASE', message: 'You may accuse only after the suggestion/disproval step'
		}, requestId));
  	}
	const { suspectId, weaponId, roomId } = payload || {};
	broadcastGame(game.gameId, 'ACCUSED', { by: player.id, suspectId, weaponId, roomId });
	const correct =
		game.solution.suspectId === suspectId &&
		game.solution.weaponId === weaponId &&
		game.solution.roomId === roomId;

	if (correct) {
		broadcastGame(game.gameId, 'GAME_WON', { winnerId: player.id });
		game.started = false;
	} else {
		player.eliminated = true;
		broadcastGame(game.gameId, 'PLAYER_ELIMINATED', { playerId: player.id });
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
	// Check legality by phase
  	const legal = computeLegalActions(game, player.id);
  	if (!legal.includes('END_TURN')) {
    	return sendWs(player.ws, makeEnv('ERROR', game.gameId, {
      		code: 'ILLEGAL_PHASE', message: 'You cannot end your turn right now'
    	}, requestId));
  	}
  	advanceTurn(game);
}
function processReconnect(ws, game, payload, requestId) {
	const { playerId } = payload || {};
	if (!playerId) {
		return sendWs(ws, makeEnv('ERROR', game.gameId, {
			code: 'MISSING_PLAYER_ID', message: 'playerId required to reconnect'
		}, requestId));
	}

	const player = game.players[playerId];
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

function computeLegalActions(game, playerId) {
	const legal = [];
	const phase = game.turnPhase;
	const player = game.players[playerId];
	if (!player || player.eliminated) return legal;

	switch (phase) {
		case TurnPhase.START:
		case TurnPhase.MOVE_OR_SUGGEST: {
		// Movement always allowed (server will validate adjacency/capacity)
		if (!game.movedThisTurn) legal.push('REQUEST_MOVE');

		// You can suggest only if you are in a room
		if (player.position?.zone === 'ROOM') {
			legal.push('MAKE_SUGGESTION');
		}

		// End turn is allowed during MoveOrSuggest if you want to pass
		legal.push('END_TURN');
		break;
		}

		case TurnPhase.DISPROVAL: {
		// Only the waiting player can respond
		if (game.waitingForDisprove === playerId) {
			legal.push('RESPOND_DISPROVE');
		}
		break;
		}

		case TurnPhase.ACCUSATION_OPTION: {
		// After suggestion/disproval chain, active player may accuse or end
		legal.push('MAKE_ACCUSATION');
		legal.push('END_TURN');
		break;
		}

		case TurnPhase.END: {
		// Safety: only END_TURN makes sense here
		legal.push('END_TURN');
		break;
		}
	}
	return legal;
}

function beginTurn(game, playerId) {
	game.turnPhase = TurnPhase.START;

	// Move immediately into the interaction phase players actually see
	// (kept as two steps to make future “on start” effects easy)
	game.turnPhase = TurnPhase.MOVE_OR_SUGGEST;
	game.movedThisTurn = false;
	const legal = computeLegalActions(game, playerId);
	console.log(`[TURN] It is now ${game.players[playerId].name}'s turn (phase=${game.turnPhase})`);
	broadcastGame(game.gameId, 'TURN_START', { playerId, legal });
}

function advanceTurn(game) {
	if (!game?.started) return;
	if (!game.turnOrder || game.turnOrder.length === 0) return;

	// Clear any leftover chain state from the previous turn
	game.currentSuggestion = null;
	game.waitingForDisprove = null;

	// Rotate to next non-eliminated player (bounded loop)
	const n = game.turnOrder.length;
	let hops = 0;
	do {
		game.turnIndex = (game.turnIndex + 1) % n;
		hops++;
		const pid = game.turnOrder[game.turnIndex];
		const p = game.players[pid];
		if (p && !p.eliminated) {
		beginTurn(game, pid);
		return;
		}
	} while (hops <= n);

	// If we got here, everyone is eliminated or missing — end the game
	broadcastGame(game.gameId, 'INFO', { message: 'No active players remain — game over.' });
	game.started = false;
}


//WebSocket Server Setup

const wss = new WebSocket.Server({ port: PORT }, () => {
	console.log(`WebSocket server listening on ws://localhost:${PORT}`);
	});

const HEARTBEAT_INTERVAL_MS = 30_000;

function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', (ws, req) => {
	// mark as alive on connect
  	ws.isAlive = true;

  	// whenever get a pong, mark the connection as alive again
  	ws.on('pong', heartbeat);

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
				if (p.ws === ws) {
					p.ws = null;
					console.log(`[${g.gameId}] Player disconnected: ${p.name} (${p.id})`);
					broadcastGame(g.gameId, 'INFO', { message: `${p.name} disconnected` });
				}
			}
		}
	});
});

// periodic ping to all clients
const heartbeatInterval = setInterval(() => {
	wss.clients.forEach((ws) => {
		if (ws.isAlive === false) {
			console.log('[WS] Terminating dead connection');
			return ws.terminate();
		}
		ws.isAlive = false;
		ws.ping();   // will trigger 'pong' on the client if alive
  	});
}, HEARTBEAT_INTERVAL_MS);

//  clean up on process exit
wss.on('close', () => {
  clearInterval(heartbeatInterval);
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
