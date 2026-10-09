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
const notify = require('../integrations/notify');
const ai = require('../integrations/ai');
const twilioLib = require('../lib/twilio');
const { id, normalizePhone, isValidEmail, clampStr } = require('../lib/util');

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function sendXml(res, xml) {
  res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
  res.end(xml);
}

/** Notify the owner of a new lead and record the outcome in the activity feed. */
async function announceLead(db, lead) {
  try {
    const out = await notify.notifyNewLead(db.business, lead);
    if (out.simulated) {
      logActivity(db, 'lead', `Owner notification queued for ${lead.name} (no channel configured — simulated).`);
    } else if (out.sent.length) {
      logActivity(db, 'lead', `Owner notified of new lead ${lead.name} via ${out.sent.join(', ')}.`);
    } else {
      logActivity(db, 'lead', `Owner notification attempted for ${lead.name} but all channels failed.`);
    }
    store.persist();
  } catch { /* never block lead capture on notification */ }
}

function logActivity(db, type, text) {
  db.activity.unshift({ id: id('act'), ts: new Date().toISOString(), type, text, sample: false });
  db.activity = db.activity.slice(0, 60);
}

/** Create a lead captured during a chat (deduped by phone/email within 24h). */
async function captureChatLead(db, info, source) {
  const phone = normalizePhone(info.phone);
  const email = clampStr(info.email, 120).trim();
  const name = clampStr(info.name, 80).trim();
  if (!name || (!phone && !email)) return null;
  const recent = db.leads.find(
    (l) => ((phone && l.phone === phone) || (email && l.email && l.email.toLowerCase() === email.toLowerCase())) &&
      Date.now() - new Date(l.createdAt) < 24 * 3600 * 1000
  );
  if (recent) return recent;
  const lead = {
    id: id('lead'), name, phone, email,
    source: source || 'website_chat', service: clampStr(info.service || 'Website chat', 80),
    status: 'new', value: 'high', note: clampStr(info.summary || '', 500), smsConsent: !!phone,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sample: false,
  };
  db.leads.unshift(lead);
  if (phone) consent.setConsent(db, phone, 'opted_in', 'provided in chat');
  logActivity(db, 'lead', `Lead captured in chat: ${name}.`);
  store.persist();
  await announceLead(db, lead);
  return lead;
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
        await announceLead(db, lead);
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
        if (typeof body.persona === 'string') b.persona = clampStr(body.persona, 300);
        if (typeof body.knowledge === 'string') b.knowledge = clampStr(body.knowledge, 6000);
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
      const smart = ai.enabled();

      // Greeting (first turn): return the AI disclosure, seed state.
      if (!state && !text) {
        const greeting = assistant.greeting(business);
        return send(res, 200, {
          reply: greeting,
          state: smart ? { mode: 'ai', history: [{ role: 'assistant', content: greeting }] } : { step: 'open', lead: {}, booked: false },
          disclosure: true,
          smart,
        });
      }

      // Smart mode: Claude-powered, grounded in the business config.
      if (smart && (!state || state.mode === 'ai')) {
        const history = (state && state.history) || [];
        const out = await ai.chat(business, history, text);
        if (out.ok) {
          let captured = false;
          // Don't capture leads on a personalized prospect demo (?biz=...).
          if (!bizOverride && out.lead) {
            const lead = await captureChatLead(db, out.lead, 'website_chat');
            captured = !!lead;
          }
          const newHistory = [...history, { role: 'user', content: text }, { role: 'assistant', content: out.reply }].slice(-16);
          return send(res, 200, { reply: out.reply, state: { mode: 'ai', history: newHistory }, source: 'ai', captured, simulated: true });
        }
        // Fall back to the rule engine for this reply, keep the AI conversation going.
        const rule = assistant.reply(business, null, text);
        const newHistory = [...history, { role: 'user', content: text }, { role: 'assistant', content: rule.reply }].slice(-16);
        return send(res, 200, { reply: rule.reply, state: { mode: 'ai', history: newHistory }, source: 'rule_fallback', simulated: true });
      }

      // Rule-based mode (no API key configured).
      const result = assistant.reply(business, state, text);
      if (!bizOverride && result.booked && result.state && result.state.lead && result.state.lead.name) {
        await captureChatLead(db, {
          name: result.state.lead.name, phone: result.state.lead.phone,
          service: result.state.lead.service, summary: `Booked ${result.state.lead.slot || ''} via website chat`,
        }, 'website_chat');
        result.captured = true;
      }
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

    // ---- Twilio webhooks (live missed-call text-back + two-way SMS) ----
    // Configure these URLs in the Twilio console:
    //   Voice "A call comes in"  -> POST {PUBLIC_BASE_URL}/api/webhooks/twilio/voice
    //   Messaging "A message..."  -> POST {PUBLIC_BASE_URL}/api/webhooks/twilio/sms
    //   (status callbacks)        -> POST {PUBLIC_BASE_URL}/api/webhooks/twilio/status
    if (resource === 'webhooks' && idParam === 'twilio' && method === 'POST') {
      // Verify the request really came from Twilio (enforced in live mode).
      const token = process.env.TWILIO_AUTH_TOKEN;
      if (mode() === 'live' && token) {
        const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
        const ok = twilioLib.validateSignature(token, base + url.pathname, body, req.headers['x-twilio-signature']);
        if (!ok) { res.writeHead(403, { 'Content-Type': 'text/plain' }); res.end('invalid signature'); return; }
      }
      const business = db.business;

      // (a) Missed / forwarded inbound call -> fire the text-back to the caller.
      if (action === 'voice') {
        const caller = normalizePhone(body.From);
        if (caller) {
          const first = `Hi, this is ${business.name}'s assistant — sorry we missed your call! This is an automated text. How can we help?`;
          const r = await sms.sendSms(db, business, {
            phone: caller, body: first, kind: 'missedcall', naturalKey: `missedcall:${caller}`, requireConsent: false,
          });
          if (r.ok) logActivity(db, 'messaging', `Missed-call text-back ${r.simulated ? '(simulated) ' : ''}sent to ${caller}.`);
          store.persist();
        }
        return sendXml(res, twilioLib.twiml(
          `<Say voice="alice">Thanks for calling ${twilioLib.escapeXml(business.name)}. We just texted you so we can help right away — please reply to that message.</Say>`
        ));
      }

      // (b) Inbound SMS -> consent keywords, else assistant reply + lead capture.
      if (action === 'sms') {
        const from = normalizePhone(body.From);
        const inbound = clampStr(body.Body, 500);
        const kind = consent.classifyInbound(inbound);
        if (kind === 'stop') {
          consent.setConsent(db, from, 'opted_out', 'inbound STOP'); store.persist();
          return sendXml(res, twilioLib.twiml(`<Message>You're unsubscribed and won't get more automated texts. Reply START to resubscribe.</Message>`));
        }
        if (kind === 'start') {
          consent.setConsent(db, from, 'opted_in', 'inbound START'); store.persist();
          return sendXml(res, twilioLib.twiml(`<Message>You're resubscribed to text updates. Reply STOP to opt out anytime.</Message>`));
        }
        if (kind === 'help') {
          return sendXml(res, twilioLib.twiml(`<Message>${twilioLib.escapeXml(business.name)}: msg & data rates may apply. Reply STOP to opt out.</Message>`));
        }
        // Multi-turn: keep per-caller conversation so booking works over SMS.
        // Uses the Claude-powered assistant when configured, else the rule engine.
        db.convos = db.convos || {};
        let replyText;
        if (ai.enabled()) {
          const conv = db.convos[from] && db.convos[from].mode === 'ai' ? db.convos[from] : { mode: 'ai', history: [] };
          const out = await ai.chat(business, conv.history, inbound);
          replyText = out.ok ? out.reply : assistant.reply(business, null, inbound).reply;
          conv.history = [...conv.history, { role: 'user', content: inbound }, { role: 'assistant', content: replyText }].slice(-16);
          db.convos[from] = conv;
        } else {
          const result = assistant.reply(business, db.convos[from] || null, inbound);
          db.convos[from] = result.state;
          replyText = result.reply;
        }
        // Capture a lead on first contact from this number (deduped to 24h).
        const recentLead = db.leads.find((l) => l.phone === from && Date.now() - new Date(l.createdAt) < 24 * 3600 * 1000);
        if (from && !recentLead) {
          const lead = {
            id: id('lead'), name: `Text lead ${from}`, phone: from, email: '',
            source: 'missed_call_text', service: 'Inbound text',
            status: 'new', value: 'medium', note: inbound, smsConsent: true,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sample: false,
          };
          db.leads.unshift(lead);
          consent.setConsent(db, from, 'opted_in', 'replied to text-back');
          logActivity(db, 'lead', `Lead from text-back conversation: ${from}.`);
          store.persist();
          await announceLead(db, lead);
        } else {
          store.persist();
        }
        return sendXml(res, twilioLib.twiml(`<Message>${twilioLib.escapeXml(replyText)}</Message>`));
      }

      // (c) Delivery status callback.
      if (action === 'status') {
        logActivity(db, 'messaging', `SMS ${clampStr(body.MessageStatus, 20)} (${clampStr(body.MessageSid, 14)}).`);
        store.persist();
        res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return;
      }
      return send(res, 404, { error: 'unknown_webhook' });
    }

    // ---- contact / book a demo ----
    if (resource === 'contact' && method === 'POST') {
      const name = clampStr(body.name, 80).trim();
      const email = clampStr(body.email, 120).trim();
      const phone = normalizePhone(body.phone);
      if (!name) return send(res, 400, { error: 'name_required' });
      if (email && !isValidEmail(email)) return send(res, 400, { error: 'invalid_email' });
      // Accept an email OR a phone (the chat widget collects a callback number).
      if (!email && !phone) return send(res, 400, { error: 'email_or_phone_required' });
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
      // Notify the owner (email/webhook/SMS if configured; simulated otherwise).
      await announceLead(db, lead);
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
