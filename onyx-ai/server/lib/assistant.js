'use strict';
/**
 * Local, rule-based receptionist/concierge engine.
 *
 * Powers the interactive demos with NO external API key. It answers over the
 * business's configured FAQs and services, detects common intents, qualifies a
 * lead, offers to book, and always offers a human handoff. In production you can
 * swap this for an LLM (see ANTHROPIC_API_KEY in .env.example) behind the same
 * reply(state, userText) -> { reply, ... } interface.
 *
 * This is a DEMO assistant. It never places calls or sends messages itself; it
 * only returns the text a real agent would say.
 */

function scoreFaq(faq, text) {
  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const hay = (faq.q + ' ' + faq.a).toLowerCase();
  let score = 0;
  for (const w of words) if (hay.includes(w)) score += 1;
  return score;
}

function detectIntent(text) {
  const t = text.toLowerCase();
  if (/(no heat|no-heat|no cool|no-cool|emergency|gas|smell|carbon|urgent|leak|flood)/.test(t))
    return 'urgent';
  if (/(human|person|agent|representative|someone|call me|talk to)/.test(t)) return 'handoff';
  if (/(book|schedule|appointment|come out|set up|availability|slot|tomorrow|today)/.test(t))
    return 'book';
  if (/(quote|estimate|install|replace|new system|how much to install)/.test(t)) return 'quote';
  if (/(price|cost|how much|fee|charge)/.test(t)) return 'pricing';
  if (/(hours|open|closed|when are you)/.test(t)) return 'hours';
  if (/(area|serve|location|near|zip|come to)/.test(t)) return 'area';
  if (/(yes|yeah|sure|ok|okay|sounds good|please do|go ahead)/.test(t)) return 'affirm';
  if (/(no|not now|later|nope)/.test(t)) return 'decline';
  return 'other';
}

function greeting(business) {
  return (
    business?.compliance?.aiDisclosure ||
    `Hi! You're chatting with ${business?.name || 'our'} AI assistant. How can I help today?`
  );
}

/**
 * Main turn function.
 * state: { step, lead: {name, phone, service, note}, booked }
 * Returns { reply, state, suggestion, offerBooking, handoff, captured }
 */
function reply(business, state, userText) {
  const text = String(userText || '').trim();
  const s = state || { step: 'open', lead: {}, booked: false };
  s.lead = s.lead || {};
  const intent = detectIntent(text);

  // Mid-flow: collecting booking details.
  if (s.step === 'collect_name') {
    s.lead.name = text.slice(0, 80) || s.lead.name;
    s.step = 'collect_phone';
    return out(`Thanks${s.lead.name ? ', ' + s.lead.name.split(' ')[0] : ''}! What's the best phone number to reach you?`, s);
  }
  if (s.step === 'collect_phone') {
    s.lead.phone = text.slice(0, 20);
    s.step = 'confirm_book';
    const svc = s.lead.service || 'a visit';
    return out(
      `Got it. I can get you on the schedule for ${svc}. Our next openings are tomorrow morning or tomorrow afternoon — which works better? (Reply "morning" or "afternoon", or say "human" to talk to our team.)`,
      s,
      { offerBooking: true }
    );
  }
  if (s.step === 'confirm_book') {
    if (intent === 'handoff') return handoff(business, s);
    const when = /afternoon|pm|after/.test(text.toLowerCase()) ? 'afternoon' : 'morning';
    s.lead.slot = when;
    s.step = 'done';
    s.booked = true;
    return out(
      `Perfect — I've noted a ${s.lead.service || 'visit'} for tomorrow ${when} and shared your details with the team. You'll get a text confirmation shortly. Anything else I can help with?`,
      s,
      { captured: true, booked: true }
    );
  }

  // Intent routing from any open step.
  switch (intent) {
    case 'urgent':
      s.step = 'handoff';
      return out(
        `That sounds like it may be urgent. For safety, if you smell gas or suspect carbon monoxide, leave the home and call 911. I'm connecting you to our on-call team right now so a person can help immediately.`,
        s,
        { handoff: true, reason: 'urgent' }
      );
    case 'handoff':
      return handoff(business, s);
    case 'hours': {
      return out(faqAnswer(business, 'hours') || 'We are open Monday to Friday, 8am to 5pm.', s);
    }
    case 'area':
      return out(faqAnswer(business, 'area') || 'We serve the greater metro area — tell me your ZIP and I can confirm.', s);
    case 'pricing':
      return out(
        `${faqAnswer(business, 'diagnostic') || 'Pricing depends on the service.'} Would you like me to book a visit? (yes/no)`,
        s,
        { offerBooking: true }
      );
    case 'quote':
      s.lead.service = 'System Install Estimate';
      s.step = 'collect_name';
      return out(
        `Happy to help with an estimate for a new system — those include a free in-home visit. Can I grab your name to set it up?`,
        s,
        { offerBooking: true }
      );
    case 'book': {
      s.lead.service = s.lead.service || guessService(business, text);
      s.step = 'collect_name';
      return out(`I can set that up. First, what's your name?`, s, { offerBooking: true });
    }
    case 'affirm':
      if (!s.booked) {
        s.step = 'collect_name';
        return out(`Great — what's your name?`, s, { offerBooking: true });
      }
      break;
    case 'decline':
      return out(`No problem. I'm here whenever you need — just ask for "hours", "pricing", to "book", or a "human".`, s);
    default:
      break;
  }

  // FAQ fallback (best match), else a helpful menu.
  const faqs = business?.faqs || [];
  let best = null;
  let bestScore = 0;
  for (const f of faqs) {
    const sc = scoreFaq(f, text);
    if (sc > bestScore) {
      best = f;
      bestScore = sc;
    }
  }
  if (best && bestScore >= 1) {
    return out(`${best.a} Would you like to book a visit, or talk to a person?`, s, { offerBooking: true });
  }
  return out(
    `I can help with hours, service areas, pricing, booking an appointment, or connecting you to a person. What would you like to do?`,
    s
  );
}

function guessService(business, text) {
  const t = text.toLowerCase();
  const services = business?.services || [];
  if (/tune|maintenance|check/.test(t)) return name(services, 'tuneup') || 'AC / Furnace Tune-up';
  if (/install|replace|new/.test(t)) return name(services, 'install') || 'System Install Estimate';
  if (/repair|fix|broken|not cooling|not heating/.test(t)) return name(services, 'repair') || 'Diagnostic & Repair';
  return name(services, 'repair') || 'Diagnostic & Repair';
}
function name(services, frag) {
  const s = services.find((x) => x.id.includes(frag));
  return s ? s.name : null;
}

function faqAnswer(business, frag) {
  const f = (business?.faqs || []).find((x) => (x.q + x.a).toLowerCase().includes(frag));
  return f ? f.a : null;
}

function handoff(business, s) {
  s.step = 'handoff';
  const contact = (business?.escalation || [])[0];
  return out(
    `Of course — I'll connect you with ${contact ? contact.name : 'our team'} now. If it's after hours, I'll take a message and have someone reach out right away. What's the best number for you?`,
    s,
    { handoff: true, reason: 'requested' }
  );
}

function out(reply, state, extra = {}) {
  return { reply, state, ...extra };
}

module.exports = { reply, greeting, detectIntent };
