'use strict';
const crypto = require('crypto');

/** Short, readable unique id with a type prefix. */
function id(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

/** Stable hash used for message/booking idempotency keys. */
function hashKey(...parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

/** Normalize a phone number to a loose E.164-ish form for matching. */
function normalizePhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

function isValidEmail(email) {
  if (!email) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

function clampStr(s, max = 2000) {
  return String(s == null ? '' : s).slice(0, max);
}

module.exports = { id, hashKey, normalizePhone, isValidEmail, clampStr };
