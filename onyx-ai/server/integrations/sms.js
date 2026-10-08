'use strict';
/**
 * SMS integration boundary (missed-call text-back, reminders, review requests,
 * reactivation, concierge follow-ups).
 *
 * Default implementation: SIMULATION. It validates consent + de-dupes, then
 * records the message in the demo activity log WITHOUT contacting any provider.
 *
 * LIVE implementation (Twilio) — verify against current docs before enabling:
 *   https://www.twilio.com/docs/messaging
 *   const twilio = require('twilio');
 *   const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
 *   await client.messages.create({
 *     to,
 *     body,
 *     // one of:
 *     from: process.env.TWILIO_PHONE_NUMBER,
 *     messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
 *     statusCallback: `${process.env.PUBLIC_BASE_URL}/api/webhooks/twilio/status`,
 *   });
 * Inbound messages (incl. STOP/START/HELP) arrive via a Twilio webhook; verify
 * the X-Twilio-Signature header before trusting the request.
 */
const { mode } = require('../lib/env');
const consent = require('../lib/consent');
const { clampStr } = require('../lib/util');

/**
 * Send an automated SMS through the compliance gate.
 * opts: { phone, body, kind, naturalKey, requireConsent, respectQuietHours }
 * Returns { ok, status, reason, simulated, body }.
 */
async function sendSms(store, business, opts) {
  const { phone, body, kind = 'sms', naturalKey } = opts;

  // 1) Consent + quiet hours gate.
  const gate = consent.canSend(store, business, {
    phone,
    requireConsent: opts.requireConsent !== false,
    respectQuietHours: opts.respectQuietHours !== false,
  });
  if (!gate.ok) return { ok: false, status: 'blocked', reason: gate.reason, simulated: true };

  // 2) De-dupe.
  const dedupeKey = naturalKey || `${phone}:${clampStr(body, 40)}`;
  if (consent.alreadyDone(store, kind, dedupeKey)) {
    return { ok: false, status: 'duplicate', reason: 'already_sent', simulated: true };
  }

  // 3) Ensure every automated message carries an opt-out footer.
  const footer = business?.compliance?.smsOptOutFooter || 'Reply STOP to opt out.';
  const finalBody = body.includes('STOP') ? body : `${body}\n\n${footer}`;

  if (mode() === 'live') {
    // LIVE path intentionally not wired. Requires credentials + explicit
    // approval to send real messages. See the header for the Twilio call.
    throw new Error('LIVE SMS not enabled: wire Twilio in sendSms() and obtain approval before sending real messages.');
  }

  // 4) Simulation: record and mark done.
  consent.markDone(store, kind, dedupeKey);
  return { ok: true, status: 'sent', simulated: true, body: finalBody };
}

module.exports = { sendSms };
