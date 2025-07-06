#!/usr/bin/env node
const path = require('path');
const ObfuscationEngine = require('../lib/obfuscation-engine');

const args = process.argv.slice(2);
if (args.length !== 1) {
    console.error('Usage: obfuscate <target-directory>');
    process.exit(1);
}

const targetDir = path.resolve(args[0]);
const engine = new ObfuscationEngine(targetDir);

engine.run().catch(err => {
    console.error('Obfuscation failed:', err);
    process.exit(1);
});