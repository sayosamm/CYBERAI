'use strict';
/**
 * Tiny JSON-file data store (no dependencies).
 *
 * The demo state lives in memory and is persisted to server/data/store.json so
 * changes you make in the dashboard (new leads, status updates, etc.) survive a
 * restart. Call reset() to wipe back to the clearly-labeled sample data.
 *
 * This is deliberately simple — for a production multi-tenant deployment you'd
 * swap this module for a real database behind the same interface.
 */
const fs = require('fs');
const path = require('path');
const { buildSeed } = require('./seed');

const STORE_PATH = path.join(__dirname, 'store.json');

let state = null;
let writeTimer = null;

function load() {
  if (state) return state;
  try {
    if (fs.existsSync(STORE_PATH)) {
      state = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      // Make sure newer seed keys exist even on an older store file.
      const seed = buildSeed();
      for (const key of Object.keys(seed)) {
        if (!(key in state)) state[key] = seed[key];
      }
      return state;
    }
  } catch (err) {
    // Corrupt file — fall back to a fresh seed rather than crashing.
    console.warn('[store] could not read store.json, reseeding:', err.message);
  }
  state = buildSeed();
  persistNow();
  return state;
}

function persistNow() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn('[store] write failed:', err.message);
  }
}

/** Debounced write so bursts of updates don't thrash the disk. */
function persist() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(persistNow, 150);
}

function get() {
  return load();
}

function reset() {
  state = buildSeed();
  persistNow();
  return state;
}

module.exports = { get, persist, persistNow, reset, STORE_PATH };
