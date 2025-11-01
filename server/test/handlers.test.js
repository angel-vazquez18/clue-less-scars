const { handleJoin } = require('../handlers/join');
const { handleChat } = require('../handlers/chat');
const { handlePing } = require('../handlers/ping');
const { handleSelectCharacter } = require('../handlers/character');
const { handleStartGame } = require('../handlers/start');
const { createGame } = require('../state/games');
const T = require('../schema/types');

console.log('Testing Message Handlers...\n');

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

// Test 1: Join Game Handler
function testJoinHandler() {
  console.log('Test 1: Join Game Handler');
  
  const ws = createMockWS();
  const game = createGame();
  const env = {
    type: T.JOIN_GAME,
    gameId: game.gameId,
    payload: { name: 'Alice' },
    requestId: 'req-123'
  };
  
  handleJoin(ws, env);
  
  const messages = ws.messages();
  const hasYourHand = messages.some(m => m.type === T.YOUR_HAND);
  const hasGameState = messages.some(m => m.type === T.GAME_STATE);
  const hasPlayerJoined = messages.some(m => m.type === T.PLAYER_JOINED);
  const hasLobbyState = messages.some(m => m.type === T.LOBBY_STATE);
  
  console.log('Join handler sends all required messages:', 
    (hasYourHand && hasGameState && hasPlayerJoined && hasLobbyState) ? 'PASS' : 'FAIL');
  
  if (!hasYourHand) console.log('   Missing YOUR_HAND message');
  if (!hasGameState) console.log('   Missing GAME_STATE message');
  if (!hasPlayerJoined) console.log('   Missing PLAYER_JOINED message');
  if (!hasLobbyState) console.log('   Missing LOBBY_STATE message');
}

// Test 2: Chat Handler
function testChatHandler() {
  console.log('\nTest 2: Chat Handler');
  
  const ws = createMockWS();
  const game = createGame();
  const player = { id: 'player-1', name: 'Alice', ws };
  game.players['player-1'] = player;
  ws.playerId = 'player-1';
  ws.gameId = game.gameId;
  
  const env = {
    type: T.CHAT,
    gameId: game.gameId,
    payload: { message: 'Hello everyone!' },
    requestId: 'req-123'
  };
  
  handleChat(ws, env);
  
  const messages = ws.messages();
  const hasChatMessage = messages.some(m => m.type === T.CHAT && m.payload.message === 'Hello everyone!');
  
  console.log('Chat handler processes message:', hasChatMessage ? 'PASS' : 'FAIL');
  if (!hasChatMessage) console.log('   Chat message not processed correctly');
}

// Test 3: Ping Handler
function testPingHandler() {
  console.log('\nTest 3: Ping Handler');
  
  const ws = createMockWS();
  const env = {
    type: T.PING,
    gameId: 'test-game',
    payload: { seq: 123 },
    requestId: 'req-123'
  };
  
  handlePing(ws, env);
  
  const messages = ws.messages();
  const hasPong = messages.some(m => m.type === T.PONG && m.payload.seq === 123);
  
  console.log('Ping handler returns PONG:', hasPong ? 'PASS' : 'FAIL');
  if (!hasPong) console.log('   PONG response not sent');
}

// Test 4: Character Selection Handler
function testCharacterHandler() {
  console.log('\nTest 4: Character Selection Handler');
  
  const ws = createMockWS();
  const game = createGame();
  const player = { id: 'player-1', name: 'Alice', ws, characterId: null };
  game.players['player-1'] = player;
  ws.playerId = 'player-1';
  ws.gameId = game.gameId;
  
  const env = {
    type: T.SELECT_CHARACTER,
    gameId: game.gameId,
    payload: { characterId: 'Miss Scarlet' },
    requestId: 'req-123'
  };
  
  handleSelectCharacter(ws, env);
  
  const messages = ws.messages();
  const hasCharacterSelected = messages.some(m => m.type === T.CHARACTER_SELECTED);
  const characterAssigned = player.characterId === 'Miss Scarlet';
  
  console.log('Character selection works:', 
    (hasCharacterSelected && characterAssigned) ? 'PASS' : 'FAIL');
  if (!hasCharacterSelected) console.log('   CHARACTER_SELECTED message not sent');
  if (!characterAssigned) console.log('   Character not assigned to player');
}

// Test 5: Start Game Handler
function testStartGameHandler() {
  console.log('\nTest 5: Start Game Handler');
  
  const ws = createMockWS();
  const game = createGame();
  
  // Add four players (minimum required)
  const ws1 = createMockWS();
  const ws2 = createMockWS();
  const ws3 = createMockWS();
  const ws4 = createMockWS();
  
  const player1 = { id: 'player-1', name: 'Alice', ws: ws1 };
  const player2 = { id: 'player-2', name: 'Bob', ws: ws2 };
  const player3 = { id: 'player-3', name: 'Carol', ws: ws3 };
  const player4 = { id: 'player-4', name: 'David', ws: ws4 };
  game.players['player-1'] = player1;
  game.players['player-2'] = player2;
  game.players['player-3'] = player3;
  game.players['player-4'] = player4;
  game.turnOrder = ['player-1', 'player-2', 'player-3', 'player-4'];
  
  ws.playerId = 'player-1';
  ws.gameId = game.gameId;
  
  const env = {
    type: T.START_GAME,
    gameId: game.gameId,
    requestId: 'req-123'
  };
  
  handleStartGame(ws, env);
  
  // Check messages in player1's WebSocket (broadcasts go to game.players[].ws)
  const messages = ws1.messages();
  const hasGameStarted = messages.some(m => m.type === T.GAME_STARTED);
  const gameStarted = game.started === true;
  
  console.log('Start game works:', (hasGameStarted && gameStarted) ? 'PASS' : 'FAIL');
  if (!hasGameStarted) console.log('   GAME_STARTED message not sent');
  if (!gameStarted) console.log('   Game not marked as started');
}

// Test 6: Error Handling
function testErrorHandling() {
  console.log('\nTest 6: Error Handling');
  
  const ws = createMockWS();
  const env = {
    type: T.JOIN_GAME,
    gameId: 'test-game',
    payload: { name: '' }, // Invalid name
    requestId: 'req-123'
  };
  
  handleJoin(ws, env);
  
  const messages = ws.messages();
  const hasError = messages.some(m => m.type === T.ERROR);
  
  console.log('Error handling works:', hasError ? 'PASS' : 'FAIL');
  if (!hasError) console.log('   Error not handled properly');
}

// Run all handler tests
function runAllHandlerTests() {
  testJoinHandler();
  testChatHandler();
  testPingHandler();
  testCharacterHandler();
  testStartGameHandler();
  testErrorHandling();
  
  console.log('\nHandler tests completed!');
}

// Export for use in other test files
module.exports = { runAllHandlerTests };

// Run if called directly
if (require.main === module) {
  runAllHandlerTests();
}
