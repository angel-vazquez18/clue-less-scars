const { validateEnv, makeEnv } = require('../schema/envelope');

console.log('Testing Envelope Validation...\n');

// Test 1: Valid envelope
function testValidEnvelope() {
  console.log('Test 1: Valid envelope');
  const validEnv = {
    type: 'JOIN_GAME',
    gameId: 'test-game-123',
    payload: { name: 'Alice' },
    ts: new Date().toISOString(),
    version: '1.0',
    requestId: 'req-123'
  };
  
  const result = validateEnv(validEnv);
  console.log('Valid envelope:', result.ok ? 'PASS' : 'FAIL');
  if (!result.ok) console.log('   Error:', result.reason);
}

// Test 2: Invalid type
function testInvalidType() {
  console.log('\nTest 2: Invalid type');
  const invalidEnv = {
    type: '',
    gameId: 'test-game-123',
    payload: { name: 'Alice' },
    ts: new Date().toISOString(),
    version: '1.0'
  };
  
  const result = validateEnv(invalidEnv);
  console.log('Invalid type rejected:', !result.ok ? 'PASS' : 'FAIL');
  if (result.ok) console.log('   Should have failed but passed');
}

// Test 3: Missing gameId
function testMissingGameId() {
  console.log('\nTest 3: Missing gameId');
  const invalidEnv = {
    type: 'JOIN_GAME',
    gameId: '',
    payload: { name: 'Alice' },
    ts: new Date().toISOString(),
    version: '1.0'
  };
  
  const result = validateEnv(invalidEnv);
  console.log('Missing gameId rejected:', !result.ok ? 'PASS' : 'FAIL');
  if (result.ok) console.log('   Should have failed but passed');
}

// Test 4: Invalid timestamp
function testInvalidTimestamp() {
  console.log('\nTest 4: Invalid timestamp');
  const invalidEnv = {
    type: 'JOIN_GAME',
    gameId: 'test-game-123',
    payload: { name: 'Alice' },
    ts: 'not-a-date',
    version: '1.0'
  };
  
  const result = validateEnv(invalidEnv);
  console.log('Invalid timestamp rejected:', !result.ok ? 'PASS' : 'FAIL');
  if (result.ok) console.log('   Should have failed but passed');
}

// Test 5: Wrong protocol version
function testWrongVersion() {
  console.log('\nTest 5: Wrong protocol version');
  const invalidEnv = {
    type: 'JOIN_GAME',
    gameId: 'test-game-123',
    payload: { name: 'Alice' },
    ts: new Date().toISOString(),
    version: '2.0'
  };
  
  const result = validateEnv(invalidEnv);
  console.log('Wrong version rejected:', !result.ok ? 'PASS' : 'FAIL');
  if (result.ok) console.log('   Should have failed but passed');
}

// Test 6: makeEnv function
function testMakeEnv() {
  console.log('\nTest 6: makeEnv function');
  const env = makeEnv('JOIN_GAME', 'test-game', { name: 'Alice' }, 'req-123');
  
  const hasRequiredFields = env.type === 'JOIN_GAME' && 
                           env.gameId === 'test-game' && 
                           env.payload.name === 'Alice' &&
                           env.requestId === 'req-123' &&
                           env.version === '1.0' &&
                           env.ts && !isNaN(Date.parse(env.ts));
  
  console.log('makeEnv creates valid envelope:', hasRequiredFields ? 'PASS' : 'FAIL');
  if (!hasRequiredFields) console.log('   Missing required fields');
}

// Run all tests
function runAllTests() {
  testValidEnvelope();
  testInvalidType();
  testMissingGameId();
  testInvalidTimestamp();
  testWrongVersion();
  testMakeEnv();
  
  console.log('\nEnvelope validation tests completed!');
}

// Export for use in other test files
module.exports = { runAllTests };

// Run if called directly
if (require.main === module) {
  runAllTests();
}
