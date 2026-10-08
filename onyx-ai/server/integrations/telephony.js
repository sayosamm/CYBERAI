'use strict';
/**
 * Telephony boundary (inbound call handling + warm transfer / human handoff).
 *
 * Default: SIMULATION. Live path uses Twilio Programmable Voice with TwiML.
 * Verify current docs before wiring: https://www.twilio.com/docs/voice
 *
 * Shape of a live inbound-call webhook handler (returns TwiML):
 *   // POST ${PUBLIC_BASE_URL}/api/webhooks/twilio/voice
 *   // <Response>
 *   //   <Say>AI disclosure...</Say>
 *   //   <Connect><Stream url="wss://...voice-ai..."/></Connect>   // realtime AI
 *   //   ... or <Dial>${ESCALATION_PHONE_NUMBER}</Dial>            // human handoff
 *   // </Response>
 * Validate X-Twilio-Signature on every webhook.
 */
const { mode } = require('../lib/env');

/** Decide whether an inbound call should be escalated to a human now. */
function shouldEscalate(business, { intent = '', afterHours = false } = {}) {
  const urgent = /no heat|no-heat|no cool|no-cool|emergency|gas|smell|carbon|urgent|leak|flood/i.test(intent);
  if (urgent) return { escalate: true, reason: 'urgent_keyword' };
  if (afterHours) return { escalate: true, reason: 'after_hours' };
  return { escalate: false, reason: 'handled_by_ai' };
}

function escalationTarget(business, reason) {
  const contacts = business?.escalation || [];
  if (reason === 'urgent_keyword' || reason === 'after_hours') {
    return contacts.find((c) => c.role === 'technician') || contacts[0] || null;
  }
  return contacts[0] || null;
}

/** Simulate placing/transferring a call. Never dials in simulation mode. */
async function transferCall(business, { to }) {
  if (mode() === 'live') {
    throw new Error('LIVE telephony not enabled: wire Twilio Voice and obtain approval before placing calls.');
  }
  return { ok: true, simulated: true, transferredTo: to };
}

module.exports = { shouldEscalate, escalationTarget, transferCall };
