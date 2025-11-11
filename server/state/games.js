const { v4: uuidv4 } = require('uuid');

// ---- Minimal dealing & envelope (Clue-Less) ----
const SUSPECTS = ['mustard','plum','scarlet','peacock','green','white'];
const WEAPONS  = ['knife','candlestick','revolver','rope','leadpipe','wrench'];
const ROOMS    = ['kitchen','ballroom','conservatory','dining','billiard','library','lounge','hall','study'];

const STARTING_POSITIONS = Object.freeze({
  'Miss Scarlet': { id: 'H2' },
  'Professor Plum': { id: 'V1' },
  'Colonel Mustard': { id: 'V3' },
  'Mrs. Peacock': { id: 'V4' },
  'Mr. Green': { id: 'H5' },
  'Mrs. White': { id: 'H6' },
});

const SECRET_PASSAGES = Object.freeze({
  Study: 'Kitchen',
  Kitchen: 'Study',
  Lounge: 'Conservatory',
  Conservatory: 'Lounge'
});

const RAW_BOARD_CONNECTIONS = Object.freeze({
  Study: ['H1', 'V1', 'Kitchen'],
  H1: ['Hall'],
  Hall: ['H1', 'H2', 'V2'],
  H2: ['Hall', 'Lounge'],
  Lounge: ['H2', 'V3', 'Conservatory'],
  V1: ['Study', 'Library'],
  V2: ['Hall', 'Billiard Room'],
  V3: ['Lounge', 'Dining Room'],
  Library: ['V1', 'H3', 'V4'],
  H3: ['Library', 'Billiard Room'],
  'Billiard Room': ['H3', 'H4', 'V2', 'V5'],
  H4: ['Billiard Room', 'Dining Room'],
  'Dining Room': ['V3', 'V6', 'H4'],
  V4: ['Library', 'Conservatory'],
  V5: ['Billiard Room', 'Ballroom'],
  V6: ['Dining Room', 'Kitchen'],
  Conservatory: ['V4', 'H5', 'Lounge'],
  H5: ['Conservatory', 'Ballroom'],
  Ballroom: ['H5', 'H6', 'V5'],
  H6: ['Ballroom', 'Kitchen'],
  Kitchen: ['H6', 'V6', 'Study']
});

function buildBoardGraph(raw) {
  const map = {};
  for (const [from, neighbors] of Object.entries(raw)) {
    if (!map[from]) map[from] = new Set();
    neighbors.forEach(to => {
      map[from].add(to);
      if (!map[to]) map[to] = new Set();
      map[to].add(from);
    });
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(map).map(([key, set]) => [key, Object.freeze(Array.from(set))])
  ));
}

const BOARD_GRAPH = buildBoardGraph(RAW_BOARD_CONNECTIONS);
const VALID_LOCATIONS = new Set(Object.keys(BOARD_GRAPH));

function initialBoardState() {
  return {
    startingPositions: Object.fromEntries(
      Object.entries(STARTING_POSITIONS).map(([character, pos]) => [
        character,
        { id: pos.id, zone: inferZoneForLocation(pos.id), secret: false }
      ])
    ),
    suspectTokens: {},
    weaponTokens: {}
  };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function inferZoneForLocation(locationId) {
  if (!locationId) return null;
  return (locationId.startsWith('H') || locationId.startsWith('V')) ? 'HALLWAY' : 'ROOM';
}

function isValidLocation(locationId) {
  return VALID_LOCATIONS.has(locationId);
}

function areAdjacentLocations(fromId, toId) {
  if (!fromId || !toId) return false;
  const neighbors = BOARD_GRAPH[fromId];
  return !!(neighbors && neighbors.includes(toId));
}

function isSecretPassageMove(fromId, toId) {
  if (!fromId || !toId) return false;
  return SECRET_PASSAGES[fromId] === toId;
}

function computeLegalMoves(game, playerId, turnState) {
  if (!game || !turnState || !playerId) return [];
  const player = game.players[playerId];
  const startId = player?.position?.id;
  if (!player || !startId || !isValidLocation(startId)) return [];

  const maxSteps = turnState.movesRemaining || 0;
  if (maxSteps <= 0) return [];

  const results = new Set();
  const queue = [{ id: startId, stepsLeft: maxSteps, secretUsed: !!turnState.secretPassageUsed }];
  const visited = new Set([`${startId}:${turnState.secretPassageUsed ? 1 : 0}:${maxSteps}`]);

  while (queue.length > 0) {
    const { id, stepsLeft, secretUsed } = queue.shift();
    if (stepsLeft <= 0) continue;
    const neighbors = BOARD_GRAPH[id] || [];
    for (const next of neighbors) {
      const isSecret = isSecretPassageMove(id, next);
      if (isSecret && secretUsed) continue;
      const cost = isSecret ? stepsLeft : 1;
      if (stepsLeft < cost) continue;
      const nextStepsLeft = stepsLeft - cost;
      const nextSecretUsed = secretUsed || isSecret;
      const visitKey = `${next}:${nextSecretUsed ? 1 : 0}:${nextStepsLeft}`;
      if (visited.has(visitKey)) continue;
      visited.add(visitKey);
      if (next !== startId) results.add(next);
      if (nextStepsLeft > 0) {
        queue.push({ id: next, stepsLeft: nextStepsLeft, secretUsed: nextSecretUsed });
      }
    }
  }

  return Array.from(results);
}

function updateLegalMoves(game) {
  if (!game.turnState || !game.turnState.playerId) {
    if (game.turnState) game.turnState.legalMoves = [];
    return [];
  }
  const legal = computeLegalMoves(game, game.turnState.playerId, game.turnState);
  game.turnState.legalMoves = legal;
  return legal;
}

function rollDice() {
  const die = () => Math.floor(Math.random() * 6) + 1;
  return die() + die();
}

function makeEnvelopeAndDeal(game) {
  const suspectPool = shuffle(SUSPECTS).slice();
  const weaponPool  = shuffle(WEAPONS).slice();
  const roomPool    = shuffle(ROOMS).slice();

  const solution = {
    suspectId: `suspect:${suspectPool.pop()}`,
    weaponId:  `weapon:${weaponPool.pop()}`,
    roomId:    `room:${roomPool.pop()}`
  };

  const remainingCards = shuffle([
    ...suspectPool.map(s => `suspect:${s}`),
    ...weaponPool.map(w => `weapon:${w}`),
    ...roomPool.map(r => `room:${r}`)
  ]);

  const playerIds = Object.keys(game.players);
  playerIds.forEach(pid => { game.players[pid].hand = []; });

  remainingCards.forEach((cardId, idx) => {
    const pid = playerIds[idx % playerIds.length];
    game.players[pid].hand.push(cardId);
  });

  game.solution = solution;
  game.dealt = true;
}


const games = Object.create(null); // gid -> { gameId, players:{pid:{...}}, turnOrder:[], started:false, board, solution, turnIndex }

function ensureGame(gameId) {
  if (!games[gameId]) {
    games[gameId] = { 
      gameId, 
      players: {}, 
      turnOrder: [], 
      started: false,
      board: initialBoardState(),
      solution: null,
      turnIndex: 0,
      leaderId: null,
      dealt: false,
      turnState: null,
      pendingSuggestion: null,
      ended: false,
      winnerId: null,
      currentPlayerId: null
    };
  }
  return games[gameId];
}

function createGame() {
  const gid = uuidv4();
  games[gid] = { 
    gameId: gid, 
    players: {}, 
    turnOrder: [], 
    started: false,
    board: initialBoardState(),
    solution: null,
    turnIndex: 0,
    leaderId: null,
    dealt: false,
    turnState: null,
    pendingSuggestion: null,
    ended: false,
    winnerId: null,
    currentPlayerId: null
  };
  return games[gid];
}

function addPlayer(game, name, ws) {
  const pid = uuidv4();
  const player = { 
    id: pid, 
    name, 
    ws, 
    characterId: null, 
    hand: [], 
    position: null,
    eliminated: false
  };
  game.players[pid] = player;
  game.turnOrder.push(pid);
  if (!game.leaderId) {
    game.leaderId = pid;
  }
  // attach to ws for quick resolution
  ws.playerId = pid;
  ws.gameId = game.gameId;
  return player;
}

function publicPlayers(game) {
  return Object.values(game.players).map(p => ({
    id: p.id, 
    name: p.name, 
    characterId: p.characterId || null,
    position: p.position || null,
    isLeader: game.leaderId === p.id,
    eliminated: !!p.eliminated
  }));
}

function resolveGameAndPlayer(ws, gameId) {
  const game = games[gameId];
  const player = (ws && ws.playerId && game) ? game.players[ws.playerId] : null;
  return { game, player };
}

function ensureTurnMoveState(game) {
  if (!game || !game.started) {
    game.turnState = null;
    return null;
  }

  const currentPlayerId = ensureActivePlayer(game);
  if (!currentPlayerId) {
    game.turnState = null;
    return null;
  }

  if (!game.turnState || game.turnState.playerId !== currentPlayerId) {
    const diceTotal = rollDice();
    game.turnState = {
      playerId: currentPlayerId,
      diceTotal,
      movesRemaining: diceTotal,
      secretPassageUsed: false,
      legalMoves: []
    };
  }

  updateLegalMoves(game);
  return game.turnState;
}

function assignStartingPositions(game) {
  Object.values(game.players).forEach(player => {
    const config = STARTING_POSITIONS[player.characterId];
    if (config) {
      const zone = inferZoneForLocation(config.id);
      player.position = { zone, id: config.id, secret: false };
    } else {
      player.position = player.position || null;
    }
    player.eliminated = false;
  });
}

function startGame(game) {
  if (game.started) return false;

  const playerCount = Object.keys(game.players).length;
  if (playerCount < 4) return false;

  if (!game.dealt) {
    makeEnvelopeAndDeal(game);
  }

  assignStartingPositions(game);
  game.turnIndex = -1;
  game.currentPlayerId = null;
  game.turnState = null;
  game.ended = false;
  game.winnerId = null;
  const firstPlayerId = nextTurn(game); // establish first active player
  if (!firstPlayerId) {
    game.started = false;
    return false;
  }
  game.started = true;
  return true;
}

function ensureActivePlayer(game) {
  if (!game || game.turnOrder.length === 0) {
    game.currentPlayerId = null;
    return null;
  }

  if (game.currentPlayerId) {
    const current = game.players[game.currentPlayerId];
    if (current && !current.eliminated) {
      return game.currentPlayerId;
    }
  }

  let idx = typeof game.turnIndex === 'number' ? game.turnIndex : -1;
  const len = game.turnOrder.length;
  let attempts = 0;
  while (attempts < len) {
    idx = (idx + 1) % len;
    const pid = game.turnOrder[idx];
    const player = pid ? game.players[pid] : null;
    if (player && !player.eliminated) {
      game.turnIndex = idx;
      game.currentPlayerId = pid;
      return pid;
    }
    attempts++;
  }

  game.currentPlayerId = null;
  return null;
}

function getCurrentPlayer(game) {
  return ensureActivePlayer(game);
}

function nextTurn(game) {
  if (!game || game.turnOrder.length === 0) {
    game.turnState = null;
    game.currentPlayerId = null;
    return null;
  }

  let idx = typeof game.turnIndex === 'number' ? game.turnIndex : -1;
  const len = game.turnOrder.length;
  let attempts = 0;
  while (attempts < len) {
    idx = (idx + 1) % len;
    const pid = game.turnOrder[idx];
    const player = pid ? game.players[pid] : null;
    if (player && !player.eliminated) {
      game.turnIndex = idx;
      game.currentPlayerId = pid;
      game.turnState = null;
      return pid;
    }
    attempts++;
  }

  game.turnState = null;
  game.currentPlayerId = null;
  return null;
}

function computeDisproveOrder(game, fromPlayerId) {
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

function ensureTokenStores(game) {
  if (!game.board.suspectTokens) game.board.suspectTokens = {};
  if (!game.board.weaponTokens) game.board.weaponTokens = {};
}

function moveSuspectToken(game, suspectId, locationId) {
  if (!suspectId || !locationId) return;
  ensureTokenStores(game);
  game.board.suspectTokens[suspectId] = locationId;
}

function moveWeaponToken(game, weaponId, locationId) {
  if (!weaponId || !locationId) return;
  ensureTokenStores(game);
  game.board.weaponTokens[weaponId] = locationId;
}

function playerHasCard(player, cardId) {
  if (!player || !cardId) return false;
  return Array.isArray(player.hand) && player.hand.includes(cardId);
}

function isCardRelevantToSuggestion(cardId, suggestion) {
  if (!suggestion || !cardId) return false;
  return (
    cardId === suggestion.suspectId ||
    cardId === suggestion.weaponId ||
    cardId === suggestion.roomId
  );
}

function markPlayerEliminated(game, playerId) {
  const player = game.players[playerId];
  if (player) {
    player.eliminated = true;
    if (game.currentPlayerId === playerId) {
      game.currentPlayerId = null;
    }
  }
}

function getActivePlayerIds(game) {
  if (!game) return [];
  return game.turnOrder.filter(pid => {
    const player = game.players[pid];
    return player && !player.eliminated;
  });
}

function ensureActiveTurn(game) {
  const playerId = getCurrentPlayer(game);
  if (!playerId) {
    game.turnState = null;
    return { playerId: null, turnState: null };
  }
  const turnState = ensureTurnMoveState(game);
  return { playerId, turnState };
}

function advanceTurn(game) {
  const nextPlayerId = nextTurn(game);
  if (!nextPlayerId) {
    game.turnState = null;
    return { playerId: null, turnState: null };
  }
  const turnState = ensureTurnMoveState(game);
  return { playerId: nextPlayerId, turnState };
}

function evaluateGameStatus(game) {
  const activeIds = getActivePlayerIds(game);
  if (activeIds.length === 0) {
    return { ended: true, winnerId: null, reason: 'NO_ACTIVE_PLAYERS' };
  }
  if (activeIds.length === 1) {
    return { ended: true, winnerId: activeIds[0], reason: 'LAST_PLAYER_REMAINING' };
  }
  return { ended: false, winnerId: null, reason: null };
}

module.exports = { 
  games, 
  ensureGame, 
  createGame, 
  addPlayer, 
  publicPlayers, 
  resolveGameAndPlayer,
  startGame,
  getCurrentPlayer,
  nextTurn,
  computeDisproveOrder,
  ensureTurnMoveState,
  isValidLocation,
  areAdjacentLocations,
  isSecretPassageMove,
  inferZoneForLocation,
  moveSuspectToken,
  moveWeaponToken,
  playerHasCard,
  isCardRelevantToSuggestion,
  markPlayerEliminated,
  getActivePlayerIds,
  ensureActiveTurn,
  advanceTurn,
  evaluateGameStatus,
  updateLegalMoves
};
