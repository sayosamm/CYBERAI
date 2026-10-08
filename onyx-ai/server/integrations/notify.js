'use strict';
/**
 * Owner notifications — tells the business the moment a new lead comes in.
 *
 * Channels (each optional, enabled by env):
 *   - Webhook  : POST the lead JSON to NOTIFY_WEBHOOK_URL
 *                (Slack/Discord/Zapier/Make incoming webhooks — instant, free,
 *                 no provider signup). Best default for a new client.
 *   - Email    : via Resend HTTPS API (RESEND_API_KEY + NOTIFY_EMAIL_TO +
 *                NOTIFY_FROM_EMAIL). Verify: https://resend.com/docs
 *   - SMS      : text the owner via Twilio (NOTIFY_SMS_TO).
 *
 * These are OWNER notifications (internal/transactional), so they are gated by
 * whether a channel is configured — NOT by ONYX_MODE. On the public demo no
 * channels are set, so nothing is sent; it just records a simulated entry.
 */
const twilio = require('../lib/twilio');

// Where lead notifications go by default (override with NOTIFY_EMAIL_TO).
// Resend's shared sender (onboarding@resend.dev) can email the account owner
// with no domain setup — so once RESEND_API_KEY is set, emails just work.
const DEFAULT_NOTIFY_EMAIL = 'sayosamuels@yahoo.com';
const DEFAULT_FROM_EMAIL = 'onboarding@resend.dev';

function emailTo() {
  return process.env.NOTIFY_EMAIL_TO || DEFAULT_NOTIFY_EMAIL;
}
function emailFrom() {
  return process.env.NOTIFY_FROM_EMAIL || DEFAULT_FROM_EMAIL;
}

function channelsConfigured() {
  return {
    webhook: !!process.env.NOTIFY_WEBHOOK_URL,
    // Email only needs the API key now — recipient/sender fall back to defaults.
    email: !!process.env.RESEND_API_KEY,
    sms: !!(process.env.NOTIFY_SMS_TO && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
  };
}

function leadSummary(business, lead) {
  const lines = [
    `New lead for ${business.name}`,
    `Name: ${lead.name}`,
    `Phone: ${lead.phone || '—'}`,
    lead.email ? `Email: ${lead.email}` : null,
    `Service: ${lead.service}`,
    `Source: ${lead.source}`,
    lead.note ? `Note: ${lead.note}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

async function postWebhook(url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` key makes Slack/Discord/Make render it nicely; full lead included too.
      body: JSON.stringify({ text: payload.text, lead: payload.lead }),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function sendEmail(subject, text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: emailTo().split(',').map((s) => s.trim()),
        subject,
        text,
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, id: data.id, error: res.ok ? undefined : data.message || `http_${res.status}` };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Notify the owner of a new lead. Returns { sent:[], simulated:bool, results }.
 * Never throws — a failed notification must not break lead capture.
 */
async function notifyNewLead(business, lead) {
  const cfg = channelsConfigured();
  const text = leadSummary(business, lead);
  const results = {};
  const sent = [];

  if (!cfg.webhook && !cfg.email && !cfg.sms) {
    return { simulated: true, sent, results };
  }

  const tasks = [];
  if (cfg.webhook) {
    tasks.push(
      postWebhook(process.env.NOTIFY_WEBHOOK_URL, { text, lead }).then((r) => {
        results.webhook = r; if (r.ok) sent.push('webhook');
      })
    );
  }
  if (cfg.email) {
    tasks.push(
      sendEmail(`New lead: ${lead.name} (${lead.service})`, text).then((r) => {
        results.email = r; if (r.ok) sent.push('email');
      })
    );
  }
  if (cfg.sms) {
    tasks.push(
      twilio.sendMessage({ to: process.env.NOTIFY_SMS_TO, body: `Onyx AI — ${text}` }).then((r) => {
        results.sms = r; if (r.ok) sent.push('sms');
      })
    );
  }
  try { await Promise.all(tasks); } catch { /* individual results captured */ }
  return { simulated: false, sent, results };
}

module.exports = { notifyNewLead, channelsConfigured };
