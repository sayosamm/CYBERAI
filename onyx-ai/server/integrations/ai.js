'use strict';
/**
 * Smart assistant powered by Claude (Anthropic Messages API).
 *
 * Enabled only when ANTHROPIC_API_KEY is set. It makes the receptionist /
 * concierge able to answer almost any question — grounded in the business's
 * own services, hours, FAQs and policies — while still booking, qualifying,
 * disclosing that it's an AI, and offering a human. When no key is set (or a
 * call fails), callers fall back to the local rule-based engine in
 * lib/assistant.js, so the demo always works for free.
 *
 * Zero-dependency: calls the API over HTTPS via global fetch (no SDK), to keep
 * `npm start` install-free. Model reference: https://docs.anthropic.com
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
// Cheap + fast is ideal for a receptionist chatbot. Override with ANTHROPIC_MODEL.
const DEFAULT_MODEL = 'claude-haiku-5-5';

function enabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function buildSystem(business) {
  const b = business || {};
  const hours = b.hours
    ? Object.entries(b.hours)
        .map(([d, h]) => `${d}: ${h ? `${h.open}–${h.close}` : 'closed'}`)
        .join(', ')
    : 'not specified';
  const services = (b.services || []).map((s) => `- ${s.name}${s.priceNote ? ` (${s.priceNote})` : ''}`).join('\n') || '- (not specified)';
  const faqs = (b.faqs || []).map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n') || '(none)';
  const escalation = (b.escalation || []).map((e) => `${e.name} (${e.role})`).join(', ') || 'the owner';
  const persona = (b.persona || 'Warm, professional, and concise.').trim();
  const knowledge = (b.knowledge || '').trim();

  return `You are the AI receptionist for "${b.name || 'this business'}", a ${b.industry || 'home-service'} company${b.timezone ? ` (timezone ${b.timezone})` : ''}.

PERSONALITY: ${persona}

Your job: answer questions, qualify leads, and help customers book — like the best front-desk person they've ever dealt with. Be genuinely helpful and move the conversation toward booking a visit, without being pushy.

BUSINESS HOURS: ${hours}

SERVICES:
${services}

FAQS:
${faqs}
${knowledge ? `\nADDITIONAL KNOWLEDGE (prices, policies, service area, financing, etc. — use this to answer):\n${knowledge}\n` : ''}
ESCALATION CONTACTS (for urgent/after-hours or when a human is needed): ${escalation}

RULES:
- You already disclosed you're an AI at the start; don't repeat the disclosure every message.
- Be concise and warm — 1–3 short sentences, like a text. No markdown, no bullet lists.
- Answer from the info above. If a specific price/policy isn't given, say you'll have the team confirm — never invent numbers, guarantees, or details.
- Gently steer toward booking: when someone has a need, offer to get them on the schedule and ask for their name and best phone number.
- If it sounds urgent (no heat/no cool, gas smell, flooding, electrical hazard) or they ask for a person, offer to connect them to ${escalation} now. For safety hazards (gas, carbon monoxide), tell them to leave and call 911.
- If asked in another language, reply in that language.
- Never promise specific revenue or outcomes. No fake reviews. Stay on topic as this business's receptionist.

LEAD CAPTURE (important): As soon as you have the customer's NAME and a PHONE NUMBER (or email), append this on its very last line — the customer will NOT see it, it is stripped before sending:
[[LEAD name="..." phone="..." email="..." service="..." summary="one short line about what they need"]]
Include it only once you actually have at least a name AND a phone or email. Put real values (leave a field empty if unknown). Never mention this tag or show it to the customer.`;
}

/**
 * history: array of { role: 'user'|'assistant', content: string }
 * Returns { ok, reply } or { ok:false, reason }.
 */
async function chat(business, history, userText) {
  if (!enabled()) return { ok: false, reason: 'not_configured' };

  const messages = [];
  for (const m of (history || []).slice(-12)) {
    if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
      messages.push({ role: m.role, content: m.content.slice(0, 2000) });
    }
  }
  messages.push({ role: 'user', content: String(userText || '').slice(0, 2000) });
  // The API requires the first message to be from the user.
  while (messages.length && messages[0].role !== 'user') messages.shift();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 500,
        system: buildSystem(business),
        messages,
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: data.error ? data.error.message : `http_${res.status}` };
    if (data.stop_reason === 'refusal') {
      return { ok: true, reply: "I'm sorry, I can't help with that — but I'm happy to answer questions about our services or connect you with our team." };
    }
    const text = (data.content || [])
      .filter((b) => b && b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!text) return { ok: false, reason: 'empty_response' };
    const { reply, lead } = extractLead(text);
    return { ok: true, reply, lead };
  } catch (err) {
    return { ok: false, reason: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pull the hidden [[LEAD ...]] tag out of a reply. Returns the cleaned reply
 * (tag removed) and a lead object when enough info is present (name + a phone
 * or email).
 */
function extractLead(text) {
  const m = text.match(/\[\[LEAD\b([^\]]*)\]\]/i);
  if (!m) return { reply: text.trim(), lead: null };
  const reply = text.replace(m[0], '').trim();
  const attrs = {};
  const re = /(\w+)\s*=\s*"([^"]*)"/g;
  let a;
  while ((a = re.exec(m[1])) !== null) attrs[a[1].toLowerCase()] = a[2].trim();
  const name = attrs.name || '';
  const phone = attrs.phone || '';
  const email = attrs.email || '';
  if (!name || (!phone && !email)) return { reply, lead: null };
  return { reply, lead: { name, phone, email, service: attrs.service || '', summary: attrs.summary || '' } };
}

module.exports = { enabled, chat, extractLead };
