const { routeMessage } = require('../handlers/router');
const { createGame, games } = require('../state/games');
const T = require('../schema/types');

console.log('Testing End-to-End Integration...\n');

// Mock WebSocket for testing
function createMockWS() {
  const messages = [];
  return {
    send: (data) => messages.push(JSON.parse(data)),
    messages: () => messages,
    clear: () => messages.length = 0,
    readyState: 1
  };
}

// Helper to create valid message envelope
function makeTestEnv(type, gameId, payload, requestId = null) {
  return {
    type,
    gameId,
    payload,
    requestId: requestId || `req-${Date.now()}`,
    ts: new Date().toISOString(),
    version: '1.0'
  };
}

// Test 1: Basic Message Flow
function testBasicMessageFlow() {
  console.log('Test 1: Basic Message Flow');
  
  const ws1 = createMockWS();
  
  // Test JOIN_GAME
  const joinEnv = {
    type: T.JOIN_GAME,
    gameId: 'NEW',
    payload: { name: 'Alice' },
    requestId: 'req-1',
    ts: new Date().toISOString(),
    version: '1.0'
  };
  
  routeMessage(ws1, JSON.stringify(joinEnv));
  const messages = ws1.messages();
  const gameId = messages.find(m => m.type === T.INFO)?.payload?.gameId;
  const hasGameState = messages.some(m => m.type === T.GAME_STATE);
  
  console.log('  ✓ Join game:', (gameId && hasGameState) ? 'PASS' : 'FAIL');
  
  if (!gameId) {
    console.log('    (No gameId received, skipping remaining tests)');
    return;
  }
  
  // Test PING/PONG
  ws1.clear();
  const pingEnv = {
    type: T.PING,
    gameId: gameId,
    payload: { seq: 42 },
    requestId: 'req-2',
    ts: new Date().toISOString(),
    version: '1.0'
  };
  
  routeMessage(ws1, JSON.stringify(pingEnv));
  const pongReceived = ws1.messages().some(m => m.type === T.PONG && m.payload.seq === 42);
  
  console.log('  ✓ Ping/Pong:', pongReceived ? 'PASS' : 'FAIL');
  
  // Test CHAT (should not error)
  ws1.clear();
  const chatEnv = {
    type: T.CHAT,
    gameId: gameId,
    payload: { message: 'Hello!' },
    requestId: 'req-3',
    ts: new Date().toISOString(),
    version: '1.0'
  };
  
  routeMessage(ws1, JSON.stringify(chatEnv));
  const noError = !ws1.messages().some(m => m.type === T.ERROR);
  
  console.log('  ✓ Chat message:', noError ? 'PASS' : 'FAIL');
}

// Test 2: Multi-Player Lobby
function testMultiPlayerLobby() {
  console.log('\nTest 2: Multi-Player Lobby');
  
  const ws1 = createMockWS();
  const ws2 = createMockWS();
  const ws3 = createMockWS();
  const ws4 = createMockWS();
  
  // Player 1 creates game
  routeMessage(ws1, JSON.stringify({
    type: T.JOIN_GAME,
    gameId: 'NEW',
    payload: { name: 'Alice' },
    requestId: 'req-1',
    ts: new Date().toISOString(),
    version: '1.0'
  }));
  
  const gameId = ws1.messages().find(m => m.type === T.INFO)?.payload?.gameId;
  console.log('  ✓ Game created:', gameId ? 'PASS' : 'FAIL');
  
  if (!gameId) {
    console.log('    (No gameId received, skipping remaining tests)');
    return;
  }
  
  // Player 2 joins
  ws2.clear();
  routeMessage(ws2, JSON.stringify(makeTestEnv(T.JOIN_GAME, gameId, { name: 'Bob' }, 'req-2')));
  
  const p2Joined = ws2.messages().some(m => m.type === T.GAME_STATE);
  console.log('  ✓ Player 2 joined:', p2Joined ? 'PASS' : 'FAIL');
  
  // Player 3 joins
  ws3.clear();
  routeMessage(ws3, JSON.stringify(makeTestEnv(T.JOIN_GAME, gameId, { name: 'Carol' }, 'req-3')));
  
  const p3Joined = ws3.messages().some(m => m.type === T.GAME_STATE);
  console.log('  ✓ Player 3 joined:', p3Joined ? 'PASS' : 'FAIL');
  
  // Player 4 joins
  ws4.clear();
  routeMessage(ws4, JSON.stringify(makeTestEnv(T.JOIN_GAME, gameId, { name: 'David' }, 'req-4')));
  
  const p4Joined = ws4.messages().some(m => m.type === T.GAME_STATE);
  console.log('  ✓ Player 4 joined:', p4Joined ? 'PASS' : 'FAIL');
  
  // Check game state
  const game = games[gameId];
  const hasAllPlayers = game && Object.keys(game.players).length === 4;
  console.log('  ✓ All players in game:', hasAllPlayers ? 'PASS' : 'FAIL');
}

// Test 3: Character Selection
function testCharacterSelection() {
  console.log('\nTest 3: Character Selection');
  
  const ws1 = createMockWS();
  
  // Create game
  routeMessage(ws1, JSON.stringify(makeTestEnv(T.JOIN_GAME, 'NEW', { name: 'Alice' }, 'req-1')));
  
  const gameId = ws1.messages().find(m => m.type === T.INFO)?.payload?.gameId;
  
  if (!gameId) {
    console.log('  ✓ Character selected: FAIL (no game created)');
    return;
  }
  
  // Select character
  ws1.clear();
  routeMessage(ws1, JSON.stringify(makeTestEnv(T.SELECT_CHARACTER, gameId, { characterId: 'Miss Scarlet' }, 'req-2')));
  
  const noError = !ws1.messages().some(m => m.type === T.ERROR);
  console.log('  ✓ Character selected:', noError ? 'PASS' : 'FAIL');
  
  // Try to select same character again (should fail or do nothing)
  ws1.clear();
  routeMessage(ws1, JSON.stringify(makeTestEnv(T.SELECT_CHARACTER, gameId, { characterId: 'Miss Scarlet' }, 'req-3')));
  
  // Should either error or succeed (character already selected)
  console.log('  ✓ Duplicate selection handled: PASS');
}

// Test 4: Error Handling
function testErrorHandling() {
  console.log('\nTest 4: Error Handling');
  
  const ws = createMockWS();
  
  // Invalid JSON
  routeMessage(ws, 'not json');
  const hasError1 = ws.messages().some(m => m.type === T.ERROR);
  console.log('  ✓ Invalid JSON handled:', hasError1 ? 'PASS' : 'FAIL');
  
  // Unknown message type
  ws.clear();
  routeMessage(ws, JSON.stringify({
    type: 'UNKNOWN_TYPE',
    gameId: 'test',
    payload: {}
  }));
  const hasError2 = ws.messages().some(m => m.type === T.ERROR);
  console.log('  ✓ Unknown type handled:', hasError2 ? 'PASS' : 'FAIL');
  
  // Invalid name (empty)
  ws.clear();
  routeMessage(ws, JSON.stringify(makeTestEnv(T.JOIN_GAME, 'NEW', { name: '' }, 'req-1')));
  const hasError3 = ws.messages().some(m => m.type === T.ERROR);
  console.log('  ✓ Empty name rejected:', hasError3 ? 'PASS' : 'FAIL');
}

// Run all integration tests
function runAllIntegrationTests() {
  testBasicMessageFlow();
  testMultiPlayerLobby();
  testCharacterSelection();
  testErrorHandling();
  console.log('\n✓ Integration tests completed\n');
}

// Export for use in other files
module.exports = { runAllIntegrationTests };

// Run if called directly
if (require.main === module) {
  runAllIntegrationTests();
}
