/* Onyx AI — marketing site interactivity (vanilla JS, no deps) */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  $('#year').textContent = new Date().getFullYear();

  /* ---- Per-prospect personalization (from ?biz= &trade= &city=) ---- */
  const params = new URLSearchParams(location.search);
  const PERSON = {
    biz: (params.get('biz') || '').slice(0, 80).trim(),
    trade: (params.get('trade') || '').slice(0, 40).trim().toLowerCase(),
    city: (params.get('city') || '').slice(0, 60).trim(),
  };
  // Map a free-text trade to one of the industry cards.
  function tradeKey(t) {
    if (/plumb/.test(t)) return 'Plumbing';
    if (/hvac|heat|cool|air|furnace|ac\b/.test(t)) return 'HVAC';
    if (/electric/.test(t)) return 'Electrical';
    if (/clean|maid|janitor/.test(t)) return 'Cleaning';
    if (/detail|auto|car/.test(t)) return 'Auto detailing';
    if (t) return 'Other trades';
    return '';
  }
  const PERSON_TRADE = tradeKey(PERSON.trade);

  if (PERSON.biz) {
    // "Prepared for ___" ribbon at the very top.
    const ribbon = el('div', 'prospect-ribbon',
      `<span>✦ Prepared for <strong>${esc(PERSON.biz)}</strong>${PERSON.city ? ' · ' + esc(PERSON.city) : ''}</span>`);
    document.body.insertBefore(ribbon, document.body.firstChild);
    document.body.classList.add('has-ribbon');
    // Personalize the hero eyebrow + tab title.
    const eyebrow = $('.hero .eyebrow');
    if (eyebrow) eyebrow.textContent = `AI automation for ${PERSON.biz}`;
    document.title = `${PERSON.biz} × Onyx AI — never miss a call`;
  }

  /* ---- Nav ---- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  $('#navToggle').addEventListener('click', function () {
    const open = nav.classList.toggle('open');
    this.setAttribute('aria-expanded', open);
  });
  $$('.nav-links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));

  /* ---- Reveal on scroll ---- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  $$('.reveal').forEach((e) => io.observe(e));

  /* ---- Services ---- */
  const icons = {
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z"/>',
    sms: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4.5A8.4 8.4 0 1 1 21 11.5Z"/>',
    star: '<path d="m12 2 3 6.5 7 .6-5.3 4.6 1.6 6.8L12 17l-6.1 3.5 1.6-6.8L2 9.1l7-.6Z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
    spark: '<path d="M12 3v4M12 17v4M5 12H1M23 12h-4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
  };
  const services = [
    ['phone', 'AI receptionist / voice agent', 'Answers inbound calls, responds to FAQs, qualifies leads, books appointments, and transfers to a person when needed.'],
    ['sms', 'Missed-call text-back', 'Automatically texts missed callers to find out what they need and help them schedule — within about a minute.'],
    ['star', 'Google review requests', 'Sends a review link after completed service with one gentle follow-up. Honest feedback requested from every customer equally.'],
    ['calendar', 'Reminders & rescheduling', 'Cuts no-shows with 24h and 2h reminders and lets customers confirm or change their appointment by text.'],
    ['doc', 'Estimate follow-up', 'Follows up on unanswered quotes and notifies staff the moment a customer is ready to move forward.'],
    ['refresh', 'Lead reactivation', 'Reconnects with eligible past customers who have opted into messages — perfect for seasonal service.'],
    ['globe', 'Website AI concierge', 'Answers visitor questions, captures contact details, and routes inquiries straight into your pipeline.'],
    ['spark', 'Unique automations', 'Waitlist fill on cancellations, after-hours urgent routing, multilingual intake, renewal reminders, and daily owner summaries.'],
  ];
  const sg = $('#servicesGrid');
  services.forEach(([ic, title, desc]) => {
    const c = el('div', 'svc reveal');
    c.innerHTML = `<div class="svc-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[ic]}</svg></div><h3>${esc(title)}</h3><p>${esc(desc)}</p>`;
    sg.appendChild(c); io.observe(c);
  });

  /* ---- Industries ---- */
  const industries = [
    ['🔥', 'HVAC', 'No-heat and no-cool calls are urgent and seasonal. Onyx triages urgency and books diagnostics fast.', 'Example: after-hours “no heat” call → safety script → warm transfer to on-call tech.'],
    ['🚰', 'Plumbing', 'Burst pipes don’t wait. Capture emergencies, book routine work, and follow up on estimates.', 'Example: missed call at 7pm → text-back → emergency vs. schedulable triage.'],
    ['⚡', 'Electrical', 'Qualify jobs by scope and route panel upgrades or installs to an estimate automatically.', 'Example: “add an EV charger” → captures details → books free estimate.'],
    ['🧽', 'Cleaning', 'Recurring bookings, easy rescheduling, and review requests after every clean.', 'Example: one-time vs. recurring intake → calendar hold → post-service review.'],
    ['🚗', 'Auto detailing', 'Fill the schedule, offer waitlist slots on cancellations, and send renewal reminders.', 'Example: cancellation opens 2pm → waitlist customer auto-offered the slot.'],
    ['🛠️', 'Other trades', 'Landscaping, pest control, garage doors, roofing — the same flows adapt to your services.', 'Example: seasonal reactivation to opted-in past customers.'],
  ];
  const ig = $('#indGrid');
  industries.forEach(([emoji, name, desc, ex]) => {
    const highlight = PERSON_TRADE && name === PERSON_TRADE;
    const c = el('div', 'ind reveal' + (highlight ? ' ind-match' : ''));
    c.innerHTML = `${highlight ? '<span class="ind-badge">Your trade</span>' : ''}<div class="ind-emoji">${emoji}</div><h3>${esc(name)}</h3><p>${esc(desc)}</p><div class="ind-ex">${esc(ex)}</div>`;
    ig.appendChild(c); io.observe(c);
  });

  /* ---- Pricing (DRAFT) ---- */
  const plans = [
    { name: 'Starter', for: 'Solo operators & small shops', price: '$299', pop: false, setup: 'One-time setup: $499',
      feats: ['AI missed-call text-back', 'Website AI concierge', 'Review requests + 1 follow-up', 'Lead capture to dashboard', 'Human handoff + STOP/opt-out'],
      limits: ['Up to 500 conversations/mo', 'Overage: $0.25 / extra conversation', 'SMS/voice carrier fees passed through'] },
    { name: 'Growth', for: 'Busy home-service teams', price: '$699', pop: true, setup: 'One-time setup: $900',
      feats: ['Everything in Starter', 'AI voice receptionist (inbound calls)', 'Appointment booking + reminders', 'Estimate follow-up', 'After-hours urgent routing', 'Daily owner summary'],
      limits: ['Up to 1,500 conversations/mo', 'Up to 1,000 voice minutes/mo', 'Overage: $0.18 / conv, $0.12 / min'] },
    { name: 'Pro', for: 'Multi-crew & multi-location', price: '$1,299', pop: false, setup: 'One-time setup: from $1,500',
      feats: ['Everything in Growth', 'Lead reactivation campaigns', 'Cancellation waitlist fill', 'Multilingual intake', 'CRM two-way sync', 'Priority support & tuning'],
      limits: ['Up to 4,000 conversations/mo', 'Up to 3,000 voice minutes/mo', 'Overage: $0.14 / conv, $0.10 / min'] },
  ];
  const pg = $('#priceGrid');
  plans.forEach((p) => {
    const c = el('div', 'plan reveal' + (p.pop ? ' featured' : ''));
    c.innerHTML =
      (p.pop ? '<span class="pop">Most popular</span>' : '') +
      `<h3>${p.name}</h3><div class="plan-for">${esc(p.for)}</div>` +
      `<div class="price">${p.price}<small>/mo <span class="tag sample">draft</span></small></div>` +
      `<div class="setup">${esc(p.setup)}</div>` +
      '<ul>' + p.feats.map((f) => `<li>${esc(f)}</li>`).join('') +
      p.limits.map((l) => `<li class="limit">${esc(l)}</li>`).join('') + '</ul>' +
      `<a class="btn ${p.pop ? 'btn-primary' : 'btn-ghost'} btn-block" href="#contact">Book a demo</a>`;
    pg.appendChild(c); io.observe(c);
  });

  /* ---- FAQ ---- */
  const faqs = [
    ['Will my customers know they’re talking to an AI?', 'Yes. Onyx clearly discloses that it’s an AI assistant at the start of calls and chats, and always offers to connect the customer with a person.'],
    ['What happens with urgent or complex calls?', 'Onyx detects urgent keywords (like “no heat” or a gas smell) and after-hours situations, reads a safety script when appropriate, and warm-transfers to your on-call contact.'],
    ['Do you send fake or filtered reviews?', 'Never. We request honest feedback from every eligible customer equally. We do not fabricate reviews or suppress unhappy customers.'],
    ['How do you prevent spam or double-texting?', 'Every automated message passes through consent checks, quiet-hours rules, and duplicate-protection, so the same person never gets the same message twice.'],
    ['What do you need to connect?', 'A phone number, a texting number, your calendar, and (optionally) your CRM. We use secure provider integrations and keep all credentials server-side.'],
    ['How fast can we go live?', 'Most setups are ready in about a week. You review everything in simulation first — no live messages go out until you approve.'],
    ['Is the pricing final?', 'No — the figures on this page are draft starting points for discussion. Final pricing depends on your call volume and the tools we connect.'],
  ];
  const fl = $('#faqList');
  faqs.forEach(([q, a]) => {
    const d = el('details', 'faq-item reveal');
    d.innerHTML = `<summary>${esc(q)}</summary><div class="faq-a">${esc(a)}</div>`;
    fl.appendChild(d); io.observe(d);
  });

  /* ---- Chat helpers ---- */
  function bubble(container, who, text) {
    const b = el('div', `bubble ${who}`, esc(text));
    container.appendChild(b); container.scrollTop = container.scrollHeight; return b;
  }
  function typing(container) {
    const b = el('div', 'bubble bot typing', '<i></i><i></i><i></i>');
    container.appendChild(b); container.scrollTop = container.scrollHeight; return b;
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---- Receptionist demo (calls API) ---- */
  const chat = $('#chat');
  let recState = null;
  async function recSend(text) {
    bubble(chat, 'user', text);
    const t = typing(chat);
    try {
      const res = await fetch('/api/demo/receptionist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, state: recState, biz: PERSON.biz || undefined }),
      });
      const data = await res.json();
      await wait(450);
      t.remove();
      bubble(chat, 'bot', data.reply);
      recState = data.state;
    } catch {
      t.remove();
      bubble(chat, 'bot', 'Sorry — the demo server isn’t reachable right now.');
    }
  }
  async function recGreet() {
    const t = typing(chat);
    try {
      const res = await fetch('/api/demo/receptionist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(PERSON.biz ? { biz: PERSON.biz } : {}) });
      const data = await res.json();
      await wait(400); t.remove();
      bubble(chat, 'bot', data.reply);
      recState = data.state;
    } catch { t.remove(); bubble(chat, 'bot', 'Hi! Try asking about hours, pricing, or booking a visit.'); }
  }
  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#chatText'); const v = input.value.trim();
    if (!v) return; input.value = ''; recSend(v);
  });
  $('#chatChips').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    recSend(btn.dataset.msg);
  });
  // Greet when the demo scrolls into view (once).
  const demoIO = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) { recGreet(); demoIO.disconnect(); } });
  }, { threshold: 0.4 });
  demoIO.observe($('#demo'));

  /* ---- Missed-call text-back animation (trade-aware + personalized) ---- */
  const smsChat = $('#smsChat');
  const SCENARIOS = {
    'HVAC': ['My AC stopped cooling this afternoon', 'get a technician out for a diagnostic', 'an AC diagnostic'],
    'Plumbing': ['My water heater is leaking', 'get a plumber out to take a look', 'a plumbing visit'],
    'Electrical': ['Half my outlets just stopped working', 'send an electrician to diagnose it', 'an electrical diagnostic'],
    'Cleaning': ['I need a move-out clean this week', 'get you on the schedule for a clean', 'a cleaning'],
    'Auto detailing': ['I’d like to book a full detail', 'get your vehicle booked in', 'a full detail'],
    'Other trades': ['I need someone to come take a look', 'get a team member out to help', 'a visit'],
  };
  const sc = SCENARIOS[PERSON_TRADE] || SCENARIOS['HVAC'];
  const smsBiz = PERSON.biz || 'Northside Heating & Air';
  const smsScript = [
    ['bot', `Hi, this is ${smsBiz}’s assistant — sorry we missed your call! This is an automated text. How can we help? (Reply STOP to opt out.)`],
    ['user', sc[0]],
    ['bot', `Sorry to hear that! I can ${sc[1]}. Are you available tomorrow morning or afternoon?`],
    ['user', 'Tomorrow afternoon works'],
    ['bot', `Great — I’ve noted tomorrow afternoon for ${sc[2]} and shared your details with the team. You’ll get a confirmation text shortly. 👍`],
  ];
  // Personalize the SMS phone header.
  const smsHeader = $('.phone.sms .phone-top strong');
  if (PERSON.biz && smsHeader) smsHeader.textContent = `Text from ${PERSON.biz}`;
  let smsPlaying = false;
  async function playSms() {
    if (smsPlaying) return; smsPlaying = true;
    smsChat.innerHTML = '';
    for (const [who, text] of smsScript) {
      if (who === 'bot') { const t = typing(smsChat); await wait(900); t.remove(); }
      else { await wait(600); }
      bubble(smsChat, who, text);
    }
    smsPlaying = false;
  }
  $('#smsReplay').addEventListener('click', playSms);
  const smsIO = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) { playSms(); smsIO.disconnect(); } });
  }, { threshold: 0.4 });
  smsIO.observe($('#textback'));

  /* ---- Contact form ---- */
  const form = $('#contactForm');
  const status = $('#contactStatus');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form-status'; status.textContent = '';
    const payload = {
      name: $('#cName').value.trim(),
      email: $('#cEmail').value.trim(),
      phone: $('#cPhone').value.trim(),
      interest: $('#cInterest').value,
      message: $('#cMsg').value.trim(),
      consent: $('#cConsent').checked,
    };
    if (!payload.name) return fail('Please enter your name.');
    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return fail('Please enter a valid email.');
    if (!payload.consent) return fail('Please agree to be contacted to continue.');
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) return fail(data.error ? 'Error: ' + data.error.replace(/_/g, ' ') : 'Something went wrong.');
      status.className = 'form-status ok';
      status.textContent = '✓ Thanks! Your request was captured — view it in the demo dashboard.';
      form.reset();
    } catch { fail('Couldn’t reach the demo server.'); }
    function fail(msg) { status.className = 'form-status err'; status.textContent = msg; }
  });
})();
