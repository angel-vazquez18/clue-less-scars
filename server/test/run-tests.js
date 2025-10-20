#!/usr/bin/env node

const { runTests } = require('./test-script');

console.log('Clue-Less Skeletal System Test Suite');
console.log('========================================\n');

// Check if we're in the right directory
const fs = require('fs');
const path = require('path');

if (!fs.existsSync(path.join(__dirname, '../index.js'))) {
  console.error('Error: Please run this from the server directory');
  process.exit(1);
}

// Run the demo
runTests();
