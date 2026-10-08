'use strict';
/**
 * Voice AI boundary (the realtime speech agent that answers calls).
 *
 * Default: SIMULATION. The interactive receptionist demo on the website and in
 * the dashboard is driven by the local rule-based engine in lib/assistant.js,
 * which needs no API key. This boundary is where a production realtime voice
 * provider (speech-to-speech) would be wired.
 *
 * Verify the chosen provider's current realtime API before wiring. The agent
 * should be configured with: the AI disclosure script, the business FAQs /
 * services, the booking tool, and the human-handoff / transfer tool.
 */
const { mode } = require('../lib/env');

async function startSession(business, opts) {
  if (mode() === 'live') {
    throw new Error('LIVE voice AI not enabled: configure a realtime voice provider and obtain approval before answering real calls.');
  }
  return { ok: true, simulated: true, agentId: process.env.VOICE_AI_AGENT_ID || 'sim-agent' };
}

module.exports = { startSession };
