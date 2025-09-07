#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dbDir = path.join(process.cwd(), 'data');
const dbFile = path.join(dbDir, 'app.db');

if (fs.existsSync(dbFile)) {
  fs.unlinkSync(dbFile);
  console.log('Removed', dbFile);
} else {
  console.log('No DB file at', dbFile);
}

