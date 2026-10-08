'use strict';
/**
 * Onyx AI — zero-dependency Node HTTP server.
 * Serves the static marketing site + demo dashboard and a JSON API.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadEnv, mode } = require('./lib/env');
const api = require('./routes/api');

loadEnv();

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // CSP: self only; inline styles/scripts allowed for this self-contained demo.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'self'; form-action 'self'"
  );
}

function sendStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath === '/dashboard') urlPath = '/dashboard.html';
  if (urlPath === '/share') urlPath = '/share.html';

  // Prevent path traversal.
  const safePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(safePath, (err, data) => {
    if (err) {
      // SPA-ish fallback: unknown non-asset path -> home page.
      if (!path.extname(safePath)) {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, home) => {
          if (e2) return res.writeHead(404).end('Not found');
          securityHeaders(res);
          res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(home);
        });
        return;
      }
      res.writeHead(404).end('Not found');
      return;
    }
    const ext = path.extname(safePath).toLowerCase();
    securityHeaders(res);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        tooBig = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooBig) return resolve({ _error: 'payload_too_large' });
      if (!raw) return resolve({});
      const ct = (req.headers['content-type'] || '').toLowerCase();
      try {
        if (ct.includes('application/json')) return resolve(JSON.parse(raw));
        if (ct.includes('application/x-www-form-urlencoded')) {
          const obj = {};
          for (const [k, v] of new URLSearchParams(raw)) obj[k] = v;
          return resolve(obj);
        }
        return resolve(JSON.parse(raw));
      } catch {
        return resolve({ _error: 'invalid_body' });
      }
    });
    req.on('error', () => resolve({ _error: 'stream_error' }));
  });
}

// ── Optional password gate ───────────────────────────────────────────────────
// Off unless DASHBOARD_USER + DASHBOARD_PASS are set. When set, it protects the
// owner dashboard and its management API with HTTP Basic Auth, while the public
// marketing site and its public endpoints (chat demo, contact form) stay open.
// This is a lightweight single-password gate, not a full login system.
const PUBLIC_API = new Set([
  '/api/health',
  '/api/contact',
  '/api/demo/receptionist',
  '/api/demo/missedcall',
  '/api/sms/inbound',
]);
function needsAuth(urlPath) {
  if (!process.env.DASHBOARD_USER || !process.env.DASHBOARD_PASS) return false;
  if (urlPath === '/dashboard' || urlPath.startsWith('/dashboard')) return true;
  // Provider webhooks (Twilio, etc.) can't send Basic Auth — always public.
  if (urlPath.startsWith('/api/webhooks/')) return false;
  if (urlPath.startsWith('/api/')) return !PUBLIC_API.has(urlPath);
  return false;
}
function authOk(req) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded = '';
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return false; }
  const i = decoded.indexOf(':');
  const user = decoded.slice(0, i);
  const pass = decoded.slice(i + 1);
  return user === process.env.DASHBOARD_USER && pass === process.env.DASHBOARD_PASS;
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = req.url.split('?')[0];
    if (needsAuth(urlPath) && !authOk(req)) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Onyx AI dashboard", charset="UTF-8"',
        'Content-Type': 'text/plain',
      });
      res.end('Authentication required');
      return;
    }
    if (urlPath.startsWith('/api/')) {
      securityHeaders(res);
      res.setHeader('Cache-Control', 'no-store');
      // CORS for the public endpoints the embeddable chat widget calls from a
      // client's own website (cross-origin). Management endpoints stay same-origin.
      if (PUBLIC_API.has(urlPath)) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '86400');
        if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
      }
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
        ? await readBody(req)
        : {};
      return api.handle(req, res, { body });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end('Method not allowed');
      return;
    }
    return sendStatic(req, res);
  } catch (err) {
    console.error('[server] error:', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'server_error' }));
  }
});

server.listen(PORT, () => {
  console.log('\n  Onyx AI demo server');
  console.log('  ───────────────────');
  console.log(`  Mode:       ${mode().toUpperCase()}  (simulation = no real calls/texts/bookings)`);
  console.log(`  Website:    http://localhost:${PORT}/`);
  console.log(`  Dashboard:  http://localhost:${PORT}/dashboard`);
  console.log('');
});

module.exports = server;
