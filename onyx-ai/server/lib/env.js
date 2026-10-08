'use strict';
/**
 * Minimal .env loader (no dependencies).
 * Reads KEY=VALUE lines from <project>/.env if present and populates
 * process.env without overwriting values already set in the environment.
 * Secrets loaded here stay server-side; they are never serialized to clients.
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function mode() {
  return (process.env.ONYX_MODE || 'simulation').toLowerCase() === 'live'
    ? 'live'
    : 'simulation';
}

module.exports = { loadEnv, mode };
