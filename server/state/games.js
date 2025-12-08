const { v4: uuidv4 } = require("uuid");

const BOARD_CONFIG = require("../data/boardConfig.json");

// ---- Minimal dealing & envelope (Clue-Less) ----
// Canonical Clue character sequence for turn order (official rules)
const CANONICAL_CHARACTER_ORDER = Object.freeze([
  "Miss Scarlet",
  "Colonel Mustard",
  "Mrs. White",
  "Mr. Green",
  "Mrs. Peacock",
  "Professor Plum",
]);

const SUSPECTS = [
  "Colonel Mustard",
  "Professor Plum",
  "Miss Scarlet",
  "Mrs. Peacock",
  "Mr. Green",
  "Mrs. White",
];
const WEAPONS = [
  "Knife",
  "Candlestick",
  "Revolver",
  "Rope",
  "Leadpipe",
  "Wrench",
];
const ROOMS = [
  "Kitchen",
  "Ballroom",
  "Conservatory",
  "Dining Room",
  "Billiard Room",
  "Library",
  "Lounge",
  "Hall",
  "Study",
];

const DEFAULT_MOVES_PER_TURN = 4; // Fallback only - should use dice roll

/**
 * Roll 2 six-sided dice for movement allowance (Clue rules)
 * Returns a value between 2 and 12
 */
function rollDice() {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return die1 + die2;
}

function inferZoneForLocation(locationId) {
  if (!locationId) return null;
  const cells = BOARD_CONFIG.cells || [];
  const cell = cells.find((c) => c.id === locationId);
  if (!cell) return null;
  if (cell.type === 'room') return 'ROOM';
  if (cell.type === 'hallway') return 'HALLWAY';
  return null;
}

const STARTING_POSITIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(BOARD_CONFIG.startingPositions || {}).map(
      ([character, positionId]) => [character, { id: positionId }]
    )
  )
);

const ROOM_DOOR_LOOKUP = Object.freeze(
  (BOARD_CONFIG.roomDoors || []).reduce((acc, { roomId, hallwayId }) => {
    if (!acc[roomId]) acc[roomId] = new Set();
    acc[roomId].add(hallwayId);
    return acc;
  }, Object.create(null))
);

const SECRET_PASSAGES = Object.freeze(
  (BOARD_CONFIG.secretPassages || []).reduce((acc, { fromId, toId }) => {
    if (fromId && toId) {
      acc[fromId] = toId;
    }
    return acc;
  }, Object.create(null))
);

function buildBoardGraphFromConfig(config) {
  const columns = config.gridSize?.columns ?? 0;
  const rows = config.gridSize?.rows ?? 0;
  const grid = Array.from({ length: rows }, () => Array(columns).fill(null));

  (config.cells || []).forEach((cell) => {
    const width = cell.width ?? 1;
    const height = cell.height ?? 1;
    for (let dy = 0; dy < height; dy += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        if (grid[y] && x >= 0 && x < columns) {
          grid[y][x] = cell.id;
        }
      }
    }
  });

  const adjacency = new Map();
  const addEdge = (from, to) => {
    if (!from || !to || from === to) return;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    adjacency.get(from).add(to);
  };

  const allowDoor = (roomId, hallwayId) =>
    !!ROOM_DOOR_LOOKUP[roomId] && ROOM_DOOR_LOOKUP[roomId].has(hallwayId);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const id = grid[y]?.[x];
      if (!id) continue;
      const neighbors = [
        [x, y - 1],
        [x + 1, y],
        [x, y + 1],
        [x - 1, y],
      ];
      neighbors.forEach(([nx, ny]) => {
        const neighborId = grid[ny]?.[nx];
        if (!neighborId || neighborId === id) return;
        const zoneA = inferZoneForLocation(id);
        const zoneB = inferZoneForLocation(neighborId);

        let connect = false;
        if (zoneA === "HALLWAY" && zoneB === "HALLWAY") {
          connect = true;
        } else if (zoneA === "ROOM" && zoneB === "HALLWAY") {
          connect = allowDoor(id, neighborId);
        } else if (zoneA === "HALLWAY" && zoneB === "ROOM") {
          connect = allowDoor(neighborId, id);
        }

        if (connect) {
          addEdge(id, neighborId);
          addEdge(neighborId, id);
        }
      });
    }
  }

  (config.secretPassages || []).forEach(({ fromId, toId }) => {
    if (fromId && toId) {
      addEdge(fromId, toId);
      addEdge(toId, fromId);
    }
  });

  const allIds = new Set((config.cells || []).map((cell) => cell.id));
  allIds.forEach((id) => {
    if (!adjacency.has(id)) {
      adjacency.set(id, new Set());
    }
  });

  return Object.freeze(
    Object.fromEntries(
      Array.from(adjacency.entries(), ([key, set]) => [
        key,
        Object.freeze(Array.from(set)),
      ])
    )
  );
}

const BOARD_GRAPH = buildBoardGraphFromConfig(BOARD_CONFIG);
const VALID_LOCATIONS = new Set(Object.keys(BOARD_GRAPH));

function initialBoardState() {
  return {
    startingPositions: Object.fromEntries(
      Object.entries(STARTING_POSITIONS).map(([character, pos]) => [
        character,
        { id: pos.id, zone: inferZoneForLocation(pos.id), secret: false },
      ])
    ),
    suspectTokens: {},
    weaponTokens: {},
    config: BOARD_CONFIG,
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

  const occupiedHallways = new Set();
  Object.values(game.players).forEach((other) => {
    if (!other || other.id === playerId) return;
    const locId = other.position?.id;
    if (!locId) return;
    const zone = inferZoneForLocation(locId);
    if (zone === "HALLWAY") {
      occupiedHallways.add(locId);
    }
  });

  const results = new Set();
  const queue = [
    {
      id: startId,
      stepsLeft: maxSteps,
      secretUsed: !!turnState.secretPassageUsed,
    },
  ];
  const visited = new Set([
    `${startId}:${turnState.secretPassageUsed ? 1 : 0}:${maxSteps}`,
  ]);

  while (queue.length > 0) {
    const { id, stepsLeft, secretUsed } = queue.shift();
    if (stepsLeft <= 0) continue;
    const neighbors = BOARD_GRAPH[id] || [];
    for (const next of neighbors) {
      const isSecret = isSecretPassageMove(id, next);
      if (isSecret && secretUsed) continue;
      const cost = isSecret ? stepsLeft : 1;
      if (stepsLeft < cost) continue;
      const zone = inferZoneForLocation(next);
      if (!zone) continue;
      if (zone === "HALLWAY" && occupiedHallways.has(next)) continue;
      const nextStepsLeft = stepsLeft - cost;
      const nextSecretUsed = secretUsed || isSecret;
      const visitKey = `${next}:${nextSecretUsed ? 1 : 0}:${nextStepsLeft}`;
      if (visited.has(visitKey)) continue;
      visited.add(visitKey);
      if (next !== startId) results.add(next);

      const enteringRoom = zone === "ROOM";
      if (!enteringRoom && nextStepsLeft > 0) {
        queue.push({
          id: next,
          stepsLeft: nextStepsLeft,
          secretUsed: nextSecretUsed,
        });
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
  const legal = computeLegalMoves(
    game,
    game.turnState.playerId,
    game.turnState
  );
  game.turnState.legalMoves = legal;
  return legal;
}

function makeEnvelopeAndDeal(game) {
  const suspectPool = shuffle(SUSPECTS).slice();
  const weaponPool = shuffle(WEAPONS).slice();
  const roomPool = shuffle(ROOMS).slice();

  const solution = {
    suspectId: `suspect:${suspectPool.pop()}`,
    weaponId: `weapon:${weaponPool.pop()}`,
    roomId: `room:${roomPool.pop()}`,
  };

  const remainingCards = shuffle([
    ...suspectPool.map((s) => `suspect:${s}`),
    ...weaponPool.map((w) => `weapon:${w}`),
    ...roomPool.map((r) => `room:${r}`),
  ]);

  const playerIds = Object.keys(game.players);
  playerIds.forEach((pid) => {
    game.players[pid].hand = [];
  });

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
      currentPlayerId: null,
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
    currentPlayerId: null,
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
    eliminated: false,
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
  return Object.values(game.players).map((p) => ({
    id: p.id,
    name: p.name,
    characterId: p.characterId || null,
    position: p.position || null,
    isLeader: game.leaderId === p.id,
    eliminated: !!p.eliminated,
  }));
}

function resolveGameAndPlayer(ws, gameId) {
  const game = games[gameId];
  const player = ws && ws.playerId && game ? game.players[ws.playerId] : null;
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
    // Initialize turn state without dice roll - player must roll manually
    game.turnState = {
      playerId: currentPlayerId,
      diceRoll: null,
      movementAllowance: null,
      movesRemaining: null,
      secretPassageUsed: false,
      legalMoves: [],
    };
  }

  // Only update legal moves if dice has been rolled
  if (game.turnState.diceRoll != null) {
    updateLegalMoves(game);
  }
  
  return game.turnState;
}

/**
 * Establishes turn order based on the canonical Clue character sequence.
 * Turn order follows: Miss Scarlet → Colonel Mustard → Mrs. White → 
 * Mr. Green → Mrs. Peacock → Professor Plum
 * 
 * If Miss Scarlet is not selected, the first selected character in the 
 * canonical sequence becomes the starting player.
 * 
 * Only players who have selected characters are included in the turn order.
 * 
 * @param {Object} game - The game object
 * @returns {Array<string>} Ordered array of player IDs
 */
function establishTurnOrder(game) {
  if (!game || !game.players) return [];
  
  // Get all players who have selected characters
  const playersWithCharacters = Object.values(game.players).filter(
    p => p && p.characterId && !p.eliminated
  );
  
  if (playersWithCharacters.length === 0) return [];
  
  // Create a map of characterId -> player for quick lookup
  const characterToPlayer = new Map();
  playersWithCharacters.forEach(player => {
    characterToPlayer.set(player.characterId, player);
  });
  
  // Build turn order following canonical sequence
  const orderedPlayerIds = [];
  for (const character of CANONICAL_CHARACTER_ORDER) {
    const player = characterToPlayer.get(character);
    if (player) {
      orderedPlayerIds.push(player.id);
    }
  }
  
  return orderedPlayerIds;
}

function assignStartingPositions(game) {
  Object.values(game.players).forEach((player) => {
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

  // Verify all players have selected characters
  const playersWithoutCharacters = Object.values(game.players).filter(
    p => !p.characterId
  );
  if (playersWithoutCharacters.length > 0) {
    return false;
  }

  if (!game.dealt) {
    makeEnvelopeAndDeal(game);
  }

  assignStartingPositions(game);
  
  // Establish turn order based on canonical character sequence
  game.turnOrder = establishTurnOrder(game);
  if (game.turnOrder.length === 0) {
    return false;
  }
  
  // Set turn index to -1 so nextTurn will select the first player (index 0)
  // This ensures Miss Scarlet (or first in canonical sequence) goes first
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

  let idx = typeof game.turnIndex === "number" ? game.turnIndex : -1;
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

  let idx = typeof game.turnIndex === "number" ? game.turnIndex : -1;
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
    const player = game.players[pid];
    // Exclude eliminated players from disprove order (official Clue rules)
    if (player && !player.eliminated) {
      order.push(pid);
    }
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

function normalizeCardKey(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/^[^:]+:/, '').toLowerCase().trim();
}

function isCardRelevantToSuggestion(cardId, suggestion) {
  if (!suggestion || !cardId) return false;
  const key = normalizeCardKey(cardId);
  return (
    key === normalizeCardKey(suggestion.suspectId) ||
    key === normalizeCardKey(suggestion.weaponId) ||
    key === normalizeCardKey(suggestion.roomId)
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
  return game.turnOrder.filter((pid) => {
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
    return { ended: true, winnerId: null, reason: "NO_ACTIVE_PLAYERS" };
  }
  if (activeIds.length === 1) {
    return {
      ended: true,
      winnerId: activeIds[0],
      reason: "LAST_PLAYER_REMAINING",
    };
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
  updateLegalMoves,
  rollDice,
};
