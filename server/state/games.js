const { v4: uuidv4 } = require('uuid');

// ---- Minimal dealing & envelope (Clue-Less) ----
const SUSPECTS = ['mustard','plum','scarlet','peacock','green','white'];
const WEAPONS  = ['knife','candlestick','revolver','rope','leadpipe','wrench'];
const ROOMS    = ['kitchen','ballroom','conservatory','dining','billiard','library','lounge','hall','study'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createDeck() {
  const toCards = (arr, type) => arr.map(id => ({ id: `${type}:${id}`, type, name: id }));
  return [
    ...toCards(SUSPECTS, 'suspect'),
    ...toCards(WEAPONS, 'weapon'),
    ...toCards(ROOMS, 'room')
  ];
}

function makeEnvelopeAndDeal(game) {
  // pick 1 of each for the solution
  const suspects = shuffle(SUSPECTS).slice();
  const weapons  = shuffle(WEAPONS).slice();
  const rooms    = shuffle(ROOMS).slice();
  const solution = {
    suspect: `suspect:${suspects.pop()}`,
    weapon:  `weapon:${weapons.pop()}`,
    room:    `room:${rooms.pop()}`
  };

  // remaining deck
  const remaining = [
    ...suspects.map(s => ({ id:`suspect:${s}`, type:'suspect'})),
    ...weapons.map(w => ({ id:`weapon:${w}`, type:'weapon'})),
    ...rooms.map(r => ({ id:`room:${r}`, type:'room'})),
  ];
  const deck = shuffle(remaining);

  // init hands
  const pids = Object.keys(game.players);
  pids.forEach(pid => { game.players[pid].hand = []; });

  // deal round-robin
  let i = 0;
  for (const card of deck) {
    const pid = pids[i % pids.length];
    game.players[pid].hand.push(card.id);
    i++;
  }

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
      board: {},
      solution: null,
      turnIndex: 0
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
    board: {},
    solution: null,
    turnIndex: 0
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
    position: null 
  };
  game.players[pid] = player;
  game.turnOrder.push(pid);
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
    position: p.position || null
  }));
}

function resolveGameAndPlayer(ws, gameId) {
  const game = games[gameId];
  const player = (ws && ws.playerId && game) ? game.players[ws.playerId] : null;
  return { game, player };
}

function startGame(game) {
  if (!game.dealt) { makeEnvelopeAndDeal(game); }

  if (game.started) return false;
  if (Object.keys(game.players).length < 4) return false;
  
  // Generate solution
  const cards = ['suspect1', 'suspect2', 'suspect3', 'weapon1', 'weapon2', 'weapon3', 'room1', 'room2', 'room3'];
  game.solution = {
    suspectId: cards.find(c => c.startsWith('suspect')),
    weaponId: cards.find(c => c.startsWith('weapon')),
    roomId: cards.find(c => c.startsWith('room'))
  };
  
  // Distribute cards (simplified for now)
  for (const pid of Object.keys(game.players)) {
    game.players[pid].hand = []; // Will be populated with actual cards later
  }
  
  game.started = true;
  return true;
}

function getCurrentPlayer(game) {
  return game.turnOrder[game.turnIndex];
}

function nextTurn(game) {
  game.turnIndex = (game.turnIndex + 1) % game.turnOrder.length;
  return getCurrentPlayer(game);
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
  computeDisproveOrder
};
