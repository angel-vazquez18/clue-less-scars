const { runAllTests: runEnvelopeTests } = require('./envelope.test');
const { runAllHandlerTests } = require('./handlers.test');
const { runAllIntegrationTests } = require('./integration.test');


// Run all tests with timing
function runTests() {
  const startTime = Date.now();
  
  console.log('1) Envelope Validation Tests');
  console.log('-----------------------------');
  runEnvelopeTests();
  
  console.log('\n2) Message Handler Tests');
  console.log('-------------------------');
  runAllHandlerTests();
  
  console.log('\n3) Integration Tests');
  console.log('---------------------');
  runAllIntegrationTests();
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`\nAll tests completed in ${duration}ms`);
}

// Export for use in other files
module.exports = { runTests };

// Run if called directly
if (require.main === module) {
  runTests();
}
