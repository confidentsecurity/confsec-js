#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Copy the built native module to dist directory after installation
const sourceFile = path.join(
  __dirname,
  '..',
  'build',
  'Release',
  'confsec.node'
);
const destFile = path.join(__dirname, '..', 'dist', 'confsec.node');

try {
  // Check if source file exists
  if (!fs.existsSync(sourceFile)) {
    console.warn('Warning: confsec.node not found at', sourceFile);
    process.exit(0);
  }

  // Ensure dist directory exists
  const distDir = path.dirname(destFile);
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy the file
  fs.copyFileSync(sourceFile, destFile);
  console.log('Successfully copied confsec.node to dist directory');
} catch (error) {
  console.error('Failed to copy confsec.node:', error.message);
  // Don't fail the installation, just warn
  process.exit(0);
}
