'use strict';
/**
 * Onyx AI — zero-dependency Node HTTP server.
 * Serves the static marketing site + demo dashboard and a JSON API.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
  if (urlPath === '/login') urlPath = '/login.html';
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

// ── Dashboard login (optional) ───────────────────────────────────────────────
// Off unless DASHBOARD_USER + DASHBOARD_PASS are set. When set, the dashboard and
// its management API require a login; visitors get a branded /login page and a
// signed session cookie. The public marketing site, chat demo, contact form, and
// provider webhooks always stay open.
const PUBLIC_API = new Set([
  '/api/health',
  '/api/contact',
  '/api/demo/receptionist',
  '/api/demo/missedcall',
  '/api/sms/inbound',
  '/api/login',
  '/api/logout',
]);
function gateOn() {
  return !!(process.env.DASHBOARD_USER && process.env.DASHBOARD_PASS);
}
function needsAuth(urlPath) {
  if (!gateOn()) return false;
  if (urlPath === '/dashboard' || urlPath.startsWith('/dashboard')) return true;
  if (urlPath.startsWith('/api/webhooks/')) return false; // provider webhooks
  if (urlPath.startsWith('/api/')) return !PUBLIC_API.has(urlPath);
  return false;
}
function sessionSecret() {
  return process.env.SESSION_SECRET || `${process.env.DASHBOARD_USER || ''}:${process.env.DASHBOARD_PASS || ''}:onyx-session-v1`;
}
function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + 7 * 86400000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyToken(tok) {
  if (!tok) return false;
  const i = tok.indexOf('.');
  if (i < 0) return false;
  const payload = tok.slice(0, i);
  const sig = tok.slice(i + 1);
  const expect = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  if (sig.length !== expect.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return false;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return p.exp > Date.now() ? p.u : false;
  } catch { return false; }
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}
function isAuthed(req) {
  return !!verifyToken(parseCookies(req).onyx_session);
}
function cookieHeader(value, maxAge) {
  const secure = String(process.env.PUBLIC_BASE_URL || '').startsWith('https') ? '; Secure' : '';
  return `onyx_session=${value}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = req.url.split('?')[0];

    // ---- login / logout ----
    if (urlPath === '/api/login' && req.method === 'POST') {
      securityHeaders(res);
      res.setHeader('Cache-Control', 'no-store');
      const body = await readBody(req);
      if (gateOn() && body.user === process.env.DASHBOARD_USER && body.pass === process.env.DASHBOARD_PASS) {
        res.writeHead(200, { 'Set-Cookie': cookieHeader(makeToken(body.user), 7 * 86400), 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_credentials' }));
      return;
    }
    if (urlPath === '/api/logout' && req.method === 'POST') {
      res.writeHead(200, { 'Set-Cookie': cookieHeader('', 0), 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ---- auth gate ----
    if (needsAuth(urlPath) && !isAuthed(req)) {
      if (urlPath.startsWith('/api/')) {
        res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: 'login_required' }));
        return;
      }
      res.writeHead(302, { Location: '/login' });
      res.end();
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
