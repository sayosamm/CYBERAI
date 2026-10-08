'use strict';
/**
 * CRM boundary (lead sync, estimate follow-up state, reactivation source list).
 *
 * Default: SIMULATION — the local store is the system of record for the demo.
 * In production this adapter syncs leads/appointments to the client's CRM
 * (Jobber, Housecall Pro, ServiceTitan, HubSpot, etc.). Each provider has a
 * different API — verify current docs per provider before wiring, and map to
 * this common interface.
 */
const { mode } = require('../lib/env');

async function upsertLead(lead) {
  if (mode() === 'live' && process.env.CRM_PROVIDER) {
    throw new Error(`LIVE CRM (${process.env.CRM_PROVIDER}) not enabled: implement upsertLead() against the provider API and obtain approval.`);
  }
  return { ok: true, simulated: true, externalId: null };
}

async function listReactivationCandidates() {
  // In production: query the CRM for opted-in past customers outside a recency
  // window. Here the demo seeds candidates directly.
  return { ok: true, simulated: true, candidates: [] };
}

module.exports = { upsertLead, listReactivationCandidates };
