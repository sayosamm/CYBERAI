'use strict';
/**
 * Twilio helpers (no SDK, zero dependencies).
 *   - validateSignature: verify the X-Twilio-Signature header on inbound webhooks
 *   - sendMessage: send an SMS via the Twilio REST API over HTTPS
 *   - twiml / escapeXml: build TwiML responses
 *
 * Verify against current docs before relying in production:
 *   https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *   https://www.twilio.com/docs/messaging/api/message-resource
 */
const crypto = require('crypto');

/**
 * Twilio signs: the full request URL, then every POST param appended in
 * alphabetical order as key+value (no separators), HMAC-SHA1 with the auth
 * token, base64-encoded.
 */
function validateSignature(authToken, url, params, signature) {
  if (!authToken || !signature) return false;
  let data = url;
  for (const key of Object.keys(params || {}).sort()) data += key + params[key];
  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Send an SMS through Twilio's REST API. Requires TWILIO_ACCOUNT_SID +
 * TWILIO_AUTH_TOKEN and either TWILIO_MESSAGING_SERVICE_SID or
 * TWILIO_PHONE_NUMBER. Returns { ok, sid, status, error }.
 */
async function sendMessage({ to, body, statusCallback }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return { ok: false, error: 'missing_twilio_credentials' };

  const form = new URLSearchParams();
  form.set('To', to);
  form.set('Body', body);
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    form.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
  } else if (process.env.TWILIO_PHONE_NUMBER) {
    form.set('From', process.env.TWILIO_PHONE_NUMBER);
  } else {
    return { ok: false, error: 'missing_twilio_sender' };
  }
  if (statusCallback) form.set('StatusCallback', statusCallback);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.message || `http_${res.status}`, code: data.code };
    return { ok: true, sid: data.sid, status: data.status };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

function escapeXml(s) {
  return String(s == null ? '' : s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

/** Wrap inner TwiML verbs in a <Response>. */
function twiml(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner || ''}</Response>`;
}

module.exports = { validateSignature, sendMessage, escapeXml, twiml };
