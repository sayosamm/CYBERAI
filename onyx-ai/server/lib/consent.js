'use strict';
/**
 * Messaging consent + de-duplication.
 *
 * This module centralizes the compliance rules that every outbound automated
 * message must pass through:
 *   - Opt-out handling (STOP / UNSUBSCRIBE / CANCEL / END / QUIT)
 *   - Opt-in / resume (START / YES / UNSTOP)
 *   - HELP keyword
 *   - Consent checks before any automated send
 *   - Quiet-hours suppression
 *   - Idempotency keys so the same message or booking is never sent twice
 *
 * It is provider-agnostic: telephony/SMS integrations call into it before doing
 * anything. Keeping it in one place means consent is enforced uniformly.
 */
const { normalizePhone, hashKey } = require('./util');

const STOP_WORDS = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'optout', 'opt-out'];
const START_WORDS = ['start', 'yes', 'unstop', 'optin', 'opt-in'];
const HELP_WORDS = ['help', 'info'];

function classifyInbound(body) {
  const word = String(body || '').trim().toLowerCase().replace(/[^a-z-]/g, '');
  if (STOP_WORDS.includes(word)) return 'stop';
  if (START_WORDS.includes(word)) return 'start';
  if (HELP_WORDS.includes(word)) return 'help';
  return 'message';
}

function getConsent(store, phone) {
  const key = normalizePhone(phone);
  const rec = store.consent[key];
  // Default: unknown numbers are treated as not-opted-out, but a send still
  // requires an explicit per-contact consent flag on the lead/record.
  return rec ? rec.status : 'unknown';
}

function setConsent(store, phone, status, note) {
  const key = normalizePhone(phone);
  if (!key) return;
  store.consent[key] = { status, note: note || '', updatedAt: new Date().toISOString() };
}

function isOptedOut(store, phone) {
  return getConsent(store, phone) === 'opted_out';
}

/** Parse "HH:MM" into minutes since midnight. */
function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Quiet hours check. Returns true if `date` (in the business timezone, best
 * effort) falls within the configured quiet window.
 */
function inQuietHours(business, date = new Date()) {
  const quiet = business?.compliance?.quietHours;
  if (!quiet) return false;
  // Best-effort local time in the business timezone.
  let local;
  try {
    local = new Date(date.toLocaleString('en-US', { timeZone: business.timezone || 'UTC' }));
  } catch {
    local = date;
  }
  const minutes = local.getHours() * 60 + local.getMinutes();
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  if (start === end) return false;
  // Window may wrap past midnight (e.g. 21:00 -> 08:00).
  return start > end ? minutes >= start || minutes < end : minutes >= start && minutes < end;
}

/**
 * Gate an automated outbound message. Returns { ok, reason }.
 * `requireConsent` records whether the record has an explicit consent flag.
 */
function canSend(store, business, { phone, requireConsent = true, respectQuietHours = true } = {}) {
  if (!normalizePhone(phone)) return { ok: false, reason: 'invalid_number' };
  if (isOptedOut(store, phone)) return { ok: false, reason: 'opted_out' };
  if (requireConsent === false) {
    // transactional-style message with its own legal basis
  }
  if (respectQuietHours && inQuietHours(business)) return { ok: false, reason: 'quiet_hours' };
  return { ok: true, reason: 'ok' };
}

/**
 * Idempotency. `kind` + the natural key (e.g. appointment id, "missedcall:phone")
 * form a stable key; a repeat within `windowMs` is treated as a duplicate.
 */
function alreadyDone(store, kind, naturalKey, windowMs = 24 * 3600 * 1000) {
  const key = hashKey(kind, naturalKey);
  const rec = store.sentKeys[key];
  if (!rec) return false;
  return Date.now() - new Date(rec.at).getTime() < windowMs;
}

function markDone(store, kind, naturalKey) {
  const key = hashKey(kind, naturalKey);
  store.sentKeys[key] = { kind, naturalKey, at: new Date().toISOString() };
  return key;
}

module.exports = {
  classifyInbound,
  getConsent,
  setConsent,
  isOptedOut,
  inQuietHours,
  canSend,
  alreadyDone,
  markDone,
};
