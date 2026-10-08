'use strict';
/**
 * Onyx AI JSON API.
 *
 * All demo actions route through here. Automated messaging/booking goes through
 * the consent + de-dupe gates and the simulation integrations, so nothing real
 * is ever sent. Responses carry `simulated: true` where an action was simulated.
 */
const { mode } = require('../lib/env');
const store = require('../data/store');
const consent = require('../lib/consent');
const assistant = require('../lib/assistant');
const sms = require('../integrations/sms');
const telephony = require('../integrations/telephony');
const calendar = require('../integrations/calendar');
const { id, normalizePhone, isValidEmail, clampStr } = require('../lib/util');

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function logActivity(db, type, text) {
  db.activity.unshift({ id: id('act'), ts: new Date().toISOString(), type, text, sample: false });
  db.activity = db.activity.slice(0, 60);
}

function overview(db) {
  const today = new Date().toDateString();
  const isToday = (iso) => new Date(iso).toDateString() === today;
  return {
    mode: mode(),
    business: { name: db.business.name, industry: db.business.industry },
    stats: {
      callsToday: db.calls.filter((c) => isToday(c.startedAt)).length,
      callsTotal: db.calls.length,
      missedHandled: db.calls.filter((c) => c.outcome === 'missed_then_texted').length,
      newLeads: db.leads.filter((l) => l.status === 'new').length,
      leadsTotal: db.leads.length,
      upcomingAppointments: db.appointments.filter(
        (a) => a.status !== 'cancelled' && new Date(a.start) >= new Date(Date.now() - 3600000)
      ).length,
      reviewsPending: db.reviews.filter((r) => r.status === 'pending').length,
      automationsOn: db.automations.filter((a) => a.enabled).length,
      automationRunsToday: db.automations.reduce((n, a) => n + (a.runsToday || 0), 0),
    },
    needsAttention: [
      ...db.leads.filter((l) => l.status === 'new').map((l) => ({ kind: 'lead', id: l.id, label: `New lead: ${l.name}`, detail: l.service })),
      ...db.appointments.filter((a) => a.status === 'pending').map((a) => ({ kind: 'appointment', id: a.id, label: `Unconfirmed: ${a.customer}`, detail: a.service })),
      ...db.reviews.filter((r) => r.status === 'pending').map((r) => ({ kind: 'review', id: r.id, label: `Review request to send: ${r.customer}`, detail: r.service })),
    ].slice(0, 8),
  };
}

async function handle(req, res, ctx) {
  const db = store.get();
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const resource = parts[1];
  const idParam = parts[2];
  const action = parts[3];
  const method = req.method;
  const body = ctx.body || {};

  if (body._error) return send(res, 400, { error: body._error });

  try {
    // ---- health / overview ----
    if (resource === 'health') return send(res, 200, { ok: true, mode: mode() });
    if (resource === 'overview') return send(res, 200, overview(db));

    // ---- calls ----
    if (resource === 'calls' && method === 'GET') {
      return send(res, 200, { calls: db.calls });
    }

    // ---- leads ----
    if (resource === 'leads') {
      if (method === 'GET') return send(res, 200, { leads: db.leads });
      if (method === 'POST') {
        const name = clampStr(body.name, 80).trim();
        const phone = normalizePhone(body.phone);
        if (!name) return send(res, 400, { error: 'name_required' });
        if (!phone) return send(res, 400, { error: 'valid_phone_required' });
        if (!isValidEmail(body.email)) return send(res, 400, { error: 'invalid_email' });
        const lead = {
          id: id('lead'),
          name,
          phone,
          email: clampStr(body.email, 120).trim(),
          source: clampStr(body.source || 'dashboard', 40),
          service: clampStr(body.service || 'General inquiry', 80),
          status: 'new',
          value: ['low', 'medium', 'high'].includes(body.value) ? body.value : 'medium',
          note: clampStr(body.note, 500),
          smsConsent: body.smsConsent === true || body.smsConsent === 'true',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sample: false,
        };
        db.leads.unshift(lead);
        if (lead.smsConsent) consent.setConsent(db, lead.phone, 'opted_in', 'form opt-in');
        logActivity(db, 'lead', `New lead captured: ${lead.name} (${lead.service}).`);
        store.persist();
        return send(res, 201, { lead });
      }
      if (method === 'PATCH' && idParam) {
        const lead = db.leads.find((l) => l.id === idParam);
        if (!lead) return send(res, 404, { error: 'lead_not_found' });
        const allowed = ['new', 'contacted', 'booked', 'won', 'lost'];
        if (body.status) {
          if (!allowed.includes(body.status)) return send(res, 400, { error: 'invalid_status' });
          lead.status = body.status;
        }
        if (typeof body.note === 'string') lead.note = clampStr(body.note, 500);
        if (['low', 'medium', 'high'].includes(body.value)) lead.value = body.value;
        lead.updatedAt = new Date().toISOString();
        logActivity(db, 'lead', `Lead ${lead.name} updated to "${lead.status}".`);
        store.persist();
        return send(res, 200, { lead });
      }
    }

    // ---- appointments ----
    if (resource === 'appointments') {
      if (method === 'GET') return send(res, 200, { appointments: db.appointments });
      if (method === 'POST') {
        const customer = clampStr(body.customer, 80).trim();
        const phone = normalizePhone(body.phone);
        const startISO = body.start;
        if (!customer || !phone || !startISO) return send(res, 400, { error: 'customer_phone_start_required' });
        const start = new Date(startISO);
        if (isNaN(start)) return send(res, 400, { error: 'invalid_start' });
        const durationMin = Number(body.durationMin) || 60;
        const end = new Date(start.getTime() + durationMin * 60000);

        // Prevent double-booking.
        if (calendar.hasConflict(db.appointments, { start, end })) {
          return send(res, 409, { error: 'slot_conflict' });
        }
        // Idempotency: same customer+slot within window is a duplicate.
        const natKey = `${phone}:${start.toISOString()}`;
        if (consent.alreadyDone(db, 'booking', natKey)) {
          return send(res, 409, { error: 'duplicate_booking' });
        }
        await calendar.createEvent(db.business, { start, end });
        const appt = {
          id: id('appt'),
          customer,
          phone,
          service: clampStr(body.service || 'Appointment', 80),
          start: start.toISOString(),
          end: end.toISOString(),
          status: 'pending',
          remindersSent: [],
          source: clampStr(body.source || 'dashboard', 40),
          sample: false,
        };
        db.appointments.push(appt);
        consent.markDone(db, 'booking', natKey);
        logActivity(db, 'booking', `Appointment created for ${customer} (${appt.service}).`);
        store.persist();
        return send(res, 201, { appointment: appt, simulated: true });
      }
      if (method === 'PATCH' && idParam) {
        const appt = db.appointments.find((a) => a.id === idParam);
        if (!appt) return send(res, 404, { error: 'appointment_not_found' });
        // Reschedule
        if (body.start) {
          const start = new Date(body.start);
          if (isNaN(start)) return send(res, 400, { error: 'invalid_start' });
          const dur = new Date(appt.end) - new Date(appt.start);
          const end = new Date(start.getTime() + dur);
          if (calendar.hasConflict(db.appointments, { start, end, excludeId: appt.id })) {
            return send(res, 409, { error: 'slot_conflict' });
          }
          appt.start = start.toISOString();
          appt.end = end.toISOString();
          appt.status = 'confirmed';
          logActivity(db, 'scheduling', `Appointment for ${appt.customer} rescheduled.`);
        }
        if (body.status) {
          const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];
          if (!allowed.includes(body.status)) return send(res, 400, { error: 'invalid_status' });
          appt.status = body.status;
          logActivity(db, 'scheduling', `Appointment for ${appt.customer} marked ${body.status}.`);
        }
        store.persist();
        return send(res, 200, { appointment: appt });
      }
    }

    // ---- reviews ----
    if (resource === 'reviews') {
      if (method === 'GET') return send(res, 200, { reviews: db.reviews });
      if (method === 'POST' && idParam && action === 'send') {
        const rev = db.reviews.find((r) => r.id === idParam);
        if (!rev) return send(res, 404, { error: 'review_not_found' });
        // Honest review policy: request from everyone equally, no filtering.
        const isFollowUp = rev.status === 'requested';
        const natKey = `review:${rev.id}:${isFollowUp ? 'followup' : 'initial'}`;
        const result = await sms.sendSms(db, db.business, {
          phone: rev.phone,
          kind: 'review',
          naturalKey: natKey,
          requireConsent: rev.smsConsent === true,
          body: isFollowUp
            ? `Hi! Just following up — if you have a moment, we'd really value your honest feedback on your recent ${rev.service}. Share it here: [review link]`
            : `Thanks for choosing us for your ${rev.service}! We'd appreciate your honest feedback. Leave a review here: [review link]`,
        });
        if (!result.ok) return send(res, 409, { error: result.reason, simulated: true });
        rev.status = isFollowUp ? 'followed_up' : 'requested';
        if (isFollowUp) rev.followUpAt = new Date().toISOString();
        else rev.requestedAt = new Date().toISOString();
        logActivity(db, 'review', `${isFollowUp ? 'Follow-up' : 'Review request'} sent to ${rev.customer}.`);
        store.persist();
        return send(res, 200, { review: rev, message: result.body, simulated: true });
      }
    }

    // ---- automations ----
    if (resource === 'automations') {
      if (method === 'GET') return send(res, 200, { automations: db.automations, activity: db.activity });
      if (method === 'PATCH' && idParam) {
        const auto = db.automations.find((a) => a.id === idParam);
        if (!auto) return send(res, 404, { error: 'automation_not_found' });
        if (typeof body.enabled === 'boolean') auto.enabled = body.enabled;
        logActivity(db, auto.category, `${auto.name} turned ${auto.enabled ? 'on' : 'off'}.`);
        store.persist();
        return send(res, 200, { automation: auto });
      }
    }

    // ---- settings ----
    if (resource === 'settings') {
      if (method === 'GET') return send(res, 200, { business: db.business });
      if (method === 'PUT') {
        const b = db.business;
        if (typeof body.name === 'string') b.name = clampStr(body.name, 80);
        if (body.hours && typeof body.hours === 'object') b.hours = body.hours;
        if (Array.isArray(body.faqs)) {
          b.faqs = body.faqs
            .filter((f) => f && f.q && f.a)
            .map((f) => ({ q: clampStr(f.q, 160), a: clampStr(f.a, 600) }))
            .slice(0, 30);
        }
        if (Array.isArray(body.services)) {
          b.services = body.services
            .filter((s) => s && s.name)
            .map((s) => ({
              id: clampStr(s.id || id('svc'), 40),
              name: clampStr(s.name, 80),
              durationMin: Number(s.durationMin) || 60,
              priceNote: clampStr(s.priceNote || '', 80),
            }))
            .slice(0, 30);
        }
        if (Array.isArray(body.escalation)) {
          b.escalation = body.escalation
            .filter((e) => e && e.name && e.phone)
            .map((e) => ({ name: clampStr(e.name, 60), phone: normalizePhone(e.phone), role: clampStr(e.role || 'staff', 30) }))
            .slice(0, 10);
        }
        logActivity(db, 'reporting', 'Business settings updated.');
        store.persist();
        return send(res, 200, { business: b });
      }
    }

    // ---- interactive receptionist demo ----
    if (resource === 'demo' && idParam === 'receptionist' && method === 'POST') {
      const state = body.state || null;
      const text = clampStr(body.message, 500);
      // Optional per-prospect personalization: override the business name only.
      const bizOverride = clampStr(body.biz, 80).trim();
      let business = db.business;
      if (bizOverride) {
        business = {
          ...db.business,
          name: bizOverride,
          compliance: {
            ...db.business.compliance,
            aiDisclosure: `Hi! You're chatting with ${bizOverride}'s AI assistant. I can answer questions and help you book — I'll connect you to a person anytime you ask.`,
          },
        };
      }
      if (!state && !text) {
        return send(res, 200, {
          reply: assistant.greeting(business),
          state: { step: 'open', lead: {}, booked: false },
          disclosure: true,
        });
      }
      const result = assistant.reply(business, state, text);
      return send(res, 200, { ...result, simulated: true });
    }

    // ---- missed-call text-back simulation ----
    if (resource === 'demo' && idParam === 'missedcall' && method === 'POST') {
      // Simulates the automated text that fires after a missed call, and the
      // assistant's reply to the caller's response. No real SMS is sent.
      const step = body.step || 'start';
      const business = db.business;
      if (step === 'start') {
        const gate = consent.canSend(db, business, { phone: body.phone || '+15550000', requireConsent: false });
        const first = `Hi, this is ${business.name}'s assistant — sorry we missed your call! This is an automated text. How can we help? (Reply STOP to opt out.)`;
        return send(res, 200, {
          simulated: true,
          blocked: !gate.ok ? gate.reason : null,
          messages: [{ from: 'business', text: first }],
          state: { step: 'awaiting_reply' },
        });
      }
      // caller replied -> run through assistant
      const result = assistant.reply(business, body.state && body.state.asst, clampStr(body.message, 500));
      return send(res, 200, {
        simulated: true,
        messages: [{ from: 'business', text: result.reply }],
        state: { step: result.booked ? 'done' : 'awaiting_reply', asst: result.state },
        captured: !!result.captured,
      });
    }

    // ---- inbound SMS webhook simulation (STOP/START/HELP handling) ----
    if (resource === 'sms' && idParam === 'inbound' && method === 'POST') {
      const phone = normalizePhone(body.from);
      const kind = consent.classifyInbound(body.body);
      if (!phone) return send(res, 400, { error: 'from_required' });
      if (kind === 'stop') {
        consent.setConsent(db, phone, 'opted_out', 'inbound STOP');
        store.persist();
        return send(res, 200, { action: 'opted_out', reply: 'You have been unsubscribed and will not receive further automated messages. Reply START to resubscribe.' });
      }
      if (kind === 'start') {
        consent.setConsent(db, phone, 'opted_in', 'inbound START');
        store.persist();
        return send(res, 200, { action: 'opted_in', reply: 'You are resubscribed to text updates. Reply STOP to opt out anytime.' });
      }
      if (kind === 'help') {
        return send(res, 200, { action: 'help', reply: `${db.business.name}: msg & data rates may apply. Reply STOP to opt out.` });
      }
      return send(res, 200, { action: 'message', consent: consent.getConsent(db, phone) });
    }

    // ---- contact / book a demo ----
    if (resource === 'contact' && method === 'POST') {
      const name = clampStr(body.name, 80).trim();
      const email = clampStr(body.email, 120).trim();
      const phone = normalizePhone(body.phone);
      if (!name) return send(res, 400, { error: 'name_required' });
      if (!isValidEmail(email) || !email) return send(res, 400, { error: 'valid_email_required' });
      if (body.consent !== true && body.consent !== 'true') {
        return send(res, 400, { error: 'consent_required' });
      }
      const lead = {
        id: id('lead'),
        name,
        phone,
        email,
        source: 'website_contact',
        service: clampStr(body.interest || 'Book a demo', 80),
        status: 'new',
        value: 'high',
        note: clampStr(body.message, 500),
        smsConsent: !!phone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sample: false,
      };
      db.leads.unshift(lead);
      logActivity(db, 'lead', `Website contact: ${name} — ${lead.service}.`);
      store.persist();
      // NOTE: no real email/text is sent; the dashboard shows the captured lead.
      return send(res, 201, { ok: true, leadId: lead.id, simulated: true });
    }

    // ---- reset demo ----
    if (resource === 'demo' && idParam === 'reset' && method === 'POST') {
      store.reset();
      return send(res, 200, { ok: true, message: 'Demo data reset to sample state.' });
    }

    return send(res, 404, { error: 'not_found', path: url.pathname, method });
  } catch (err) {
    console.error('[api] error:', err);
    return send(res, 500, { error: 'server_error', detail: err.message });
  }
}

module.exports = { handle };
