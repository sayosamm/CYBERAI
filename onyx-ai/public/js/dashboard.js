/* Onyx AI — demo dashboard (vanilla JS, no deps) */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const views = $('#views');

  /* ---- API ---- */
  async function api(path, method = 'GET', body) {
    const opt = { method, headers: {} };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const res = await fetch('/api' + path, opt);
    let data = {};
    try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { data, status: res.status });
    return data;
  }

  /* ---- Toast ---- */
  let toastT;
  function toast(msg, kind = 'ok') {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast show ' + kind;
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), 2600);
  }

  /* ---- Formatting ---- */
  const fmtDateTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const fmtTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
  function ago(iso) {
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return 'just now'; const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; return Math.floor(h / 24) + 'd ago';
  }
  const dur = (sec) => sec ? `${Math.floor(sec / 60)}m ${sec % 60}s` : '—';
  const sampleTag = (o) => (o && o.sample ? ' <span class="tag sample">sample</span>' : '');

  /* ---- Views registry ---- */
  const TITLES = {
    overview: ['Overview', 'A live snapshot of calls, leads, and automations'],
    calls: ['Calls', 'Inbound calls and AI-generated summaries'],
    leads: ['Leads', 'Captured leads and follow-up status'],
    appointments: ['Appointments', 'Bookings, confirmations, and rescheduling'],
    reviews: ['Reviews', 'Post-service review requests (honest feedback, all customers)'],
    automations: ['Automations', 'What’s running, and the latest activity'],
    settings: ['Settings', 'Business hours, services, FAQs, and escalation'],
  };

  async function render(view) {
    $$('.side-link').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    const [title, sub] = TITLES[view] || TITLES.overview;
    $('#viewTitle').textContent = title; $('#viewSub').textContent = sub;
    location.hash = view;
    views.innerHTML = '<div class="loading">Loading…</div>';
    try {
      await RENDERERS[view]();
    } catch (err) {
      views.innerHTML = `<div class="empty">Couldn’t load this view (${esc(err.message)}). Is the demo server running?</div>`;
    }
  }

  const RENDERERS = {};

  /* ===== OVERVIEW ===== */
  RENDERERS.overview = async function () {
    const o = await api('/overview');
    const s = o.stats;
    const stat = (label, val, sub, grad) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-val${grad ? ' grad' : ''}">${val}</div><div class="stat-sub">${sub}</div></div>`;
    const attn = o.needsAttention.length
      ? o.needsAttention.map((a) => `<li class="attn-item"><span class="kind ${a.kind}">${a.kind}</span><div class="at-main"><strong>${esc(a.label)}</strong><small>${esc(a.detail || '')}</small></div><button class="btn btn-ghost btn-sm" data-goto="${a.kind === 'appointment' ? 'appointments' : a.kind + 's'}">Open</button></li>`).join('')
      : '<li class="empty">Nothing needs attention 🎉</li>';
    const acts = await api('/automations');
    const feed = acts.activity.slice(0, 10).map((a) => `<li class="act-item"><span class="act-time">${ago(a.ts)}</span><span>${esc(a.text)}</span></li>`).join('');
    views.innerHTML = `
      <div class="stat-grid">
        ${stat('Calls today', s.callsToday, `${s.callsTotal} total · ${s.missedHandled} missed handled`, true)}
        ${stat('New leads', s.newLeads, `${s.leadsTotal} leads total`)}
        ${stat('Upcoming appts', s.upcomingAppointments, `${s.reviewsPending} review(s) to send`)}
        ${stat('Automations on', s.automationsOn + '/8', `${s.automationRunsToday} runs today`)}
      </div>
      <div class="cols-2">
        <div class="panel"><h3>Needs attention <span class="count">${o.needsAttention.length}</span></h3><ul class="attn-list">${attn}</ul></div>
        <div class="panel"><h3>Automation activity</h3><ul class="act-list">${feed || '<li class="empty">No activity yet.</li>'}</ul></div>
      </div>`;
    $$('[data-goto]', views).forEach((b) => b.addEventListener('click', () => render(b.dataset.goto)));
  };

  /* ===== CALLS ===== */
  RENDERERS.calls = async function () {
    const { calls } = await api('/calls');
    const rows = calls.map((c) => `
      <tr>
        <td><strong>${esc(c.callerName)}</strong>${sampleTag(c)}<div class="muted">${esc(c.from)} · ${fmtDateTime(c.startedAt)}</div></td>
        <td><span class="by ${c.handledBy}">${c.handledBy}</span></td>
        <td>${esc(c.intent)}<div class="muted">${dur(c.durationSec)}</div></td>
        <td><div class="call-summary">${esc(c.summary)}</div></td>
        <td><span class="pill ${c.outcome.includes('book') ? 'booked' : c.outcome.includes('transfer') ? 'contacted' : c.outcome.includes('missed') ? 'pending' : 'new'}">${esc(c.outcome.replace(/_/g, ' '))}</span>${c.transferredTo ? `<div class="muted">→ ${esc(c.transferredTo)}</div>` : ''}</td>
      </tr>`).join('');
    views.innerHTML = `
      <div class="toolbar"><input class="search" id="callSearch" placeholder="Search calls…" /><div class="spacer"></div><span class="muted">${calls.length} calls</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Caller</th><th>Handled by</th><th>Intent</th><th>AI summary</th><th>Outcome</th></tr></thead>
        <tbody id="callBody">${rows || emptyRow(5)}</tbody>
      </table></div>`;
    wireSearch('#callSearch', '#callBody');
  };

  /* ===== LEADS ===== */
  const LEAD_STATUSES = ['new', 'contacted', 'booked', 'won', 'lost'];
  RENDERERS.leads = async function () {
    const { leads } = await api('/leads');
    views.innerHTML = `
      <div class="toolbar">
        <input class="search" id="leadSearch" placeholder="Search leads…" />
        <div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="addLeadBtn">+ Add lead</button>
      </div>
      <div id="addLeadForm"></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Service</th><th>Source</th><th>Value</th><th>Created</th><th>Status</th></tr></thead>
        <tbody id="leadBody">${leads.map(leadRow).join('') || emptyRow(6)}</tbody>
      </table></div>`;
    wireSearch('#leadSearch', '#leadBody');
    $('#addLeadBtn').addEventListener('click', toggleAddLead);
    wireLeadBody();
  };
  function leadRow(l) {
    return `<tr data-id="${l.id}">
      <td><strong>${esc(l.name)}</strong>${sampleTag(l)}<div class="muted">${esc(l.phone)}${l.email ? ' · ' + esc(l.email) : ''}</div></td>
      <td>${esc(l.service)}${l.note ? `<div class="muted">${esc(l.note)}</div>` : ''}</td>
      <td><span class="muted">${esc(l.source.replace(/_/g, ' '))}</span></td>
      <td><span class="pill value-${l.value}">${l.value}</span></td>
      <td><span class="muted">${ago(l.createdAt)}</span></td>
      <td><select class="inline-select lead-status" aria-label="Lead status">${LEAD_STATUSES.map((s) => `<option value="${s}"${s === l.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
    </tr>`;
  }
  function wireLeadBody() {
    $('#leadBody').addEventListener('change', async (e) => {
      const sel = e.target.closest('.lead-status'); if (!sel) return;
      const id = sel.closest('tr').dataset.id;
      try { await api('/leads/' + id, 'PATCH', { status: sel.value }); toast('Lead status updated → ' + sel.value); refreshBadges(); }
      catch (err) { toast('Update failed: ' + err.message, 'err'); }
    });
  }
  function toggleAddLead() {
    const host = $('#addLeadForm');
    if (host.innerHTML) { host.innerHTML = ''; return; }
    host.innerHTML = `
      <div class="form-card">
        <h3>Add a lead</h3>
        <div class="fg-row">
          <div class="fg"><label>Name *</label><input id="nlName" maxlength="80" /></div>
          <div class="fg"><label>Phone *</label><input id="nlPhone" maxlength="20" placeholder="(555) 010-0199" /></div>
        </div>
        <div class="fg-row">
          <div class="fg"><label>Service</label><input id="nlService" maxlength="80" placeholder="e.g. AC Tune-up" /></div>
          <div class="fg"><label>Value</label><select id="nlValue"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select></div>
        </div>
        <div class="fg"><label>Note</label><textarea id="nlNote" rows="2" maxlength="500"></textarea></div>
        <label class="consent" style="margin-bottom:12px"><input type="checkbox" id="nlConsent" /> <span>Customer consented to receive text messages.</span></label>
        <div class="save-bar"><button class="btn btn-primary btn-sm" id="nlSave">Save lead</button><button class="btn btn-ghost btn-sm" id="nlCancel">Cancel</button></div>
      </div>`;
    $('#nlCancel').addEventListener('click', toggleAddLead);
    $('#nlSave').addEventListener('click', async () => {
      const payload = {
        name: $('#nlName').value.trim(), phone: $('#nlPhone').value.trim(),
        service: $('#nlService').value.trim() || 'General inquiry',
        value: $('#nlValue').value, note: $('#nlNote').value.trim(),
        smsConsent: $('#nlConsent').checked, source: 'dashboard',
      };
      if (!payload.name) return toast('Name is required', 'err');
      if (!payload.phone) return toast('A valid phone is required', 'err');
      try {
        const { lead } = await api('/leads', 'POST', payload);
        const body = $('#leadBody'); if (body.querySelector('.empty-row')) body.innerHTML = '';
        body.insertAdjacentHTML('afterbegin', leadRow(lead));
        toggleAddLead(); toast('Lead added'); refreshBadges();
      } catch (err) { toast('Could not add lead: ' + err.message.replace(/_/g, ' '), 'err'); }
    });
  }

  /* ===== APPOINTMENTS ===== */
  RENDERERS.appointments = async function () {
    const { appointments } = await api('/appointments');
    const sorted = appointments.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    views.innerHTML = `
      <div class="toolbar"><input class="search" id="apSearch" placeholder="Search appointments…" /><div class="spacer"></div><button class="btn btn-primary btn-sm" id="addApBtn">+ New booking</button></div>
      <div id="addApForm"></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Customer</th><th>Service</th><th>When</th><th>Source</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="apBody">${sorted.map(apRow).join('') || emptyRow(6)}</tbody>
      </table></div>`;
    wireSearch('#apSearch', '#apBody');
    $('#addApBtn').addEventListener('click', toggleAddAp);
    wireApBody();
  };
  function apRow(a) {
    return `<tr data-id="${a.id}">
      <td><strong>${esc(a.customer)}</strong>${sampleTag(a)}<div class="muted">${esc(a.phone)}</div></td>
      <td>${esc(a.service)}</td>
      <td>${fmtDateTime(a.start)}<div class="muted">to ${fmtTime(a.end)}</div></td>
      <td><span class="muted">${esc(a.source.replace(/_/g, ' '))}</span></td>
      <td><span class="pill ${a.status}">${a.status}</span>${a.remindersSent && a.remindersSent.length ? `<div class="muted">reminder: ${a.remindersSent.join(', ')}</div>` : ''}</td>
      <td><div class="row-actions">
        ${a.status !== 'confirmed' && a.status !== 'cancelled' ? '<button class="btn btn-ghost btn-sm" data-act="confirm">Confirm</button>' : ''}
        ${a.status !== 'cancelled' ? '<button class="btn btn-ghost btn-sm" data-act="reschedule">Reschedule</button>' : ''}
        ${a.status !== 'cancelled' && a.status !== 'completed' ? '<button class="btn btn-ghost btn-sm" data-act="cancel">Cancel</button>' : ''}
      </div></td>
    </tr>`;
  }
  function wireApBody() {
    $('#apBody').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const tr = btn.closest('tr'); const id = tr.dataset.id; const act = btn.dataset.act;
      try {
        if (act === 'confirm') { const { appointment } = await api('/appointments/' + id, 'PATCH', { status: 'confirmed' }); tr.outerHTML = apRow(appointment); rewire(); toast('Appointment confirmed'); }
        else if (act === 'cancel') { const { appointment } = await api('/appointments/' + id, 'PATCH', { status: 'cancelled' }); tr.outerHTML = apRow(appointment); rewire(); toast('Appointment cancelled'); }
        else if (act === 'reschedule') {
          const def = new Date(Date.now() + 86400000); def.setHours(13, 0, 0, 0);
          const input = prompt('Reschedule to (YYYY-MM-DD HH:MM):', def.toISOString().slice(0, 16).replace('T', ' '));
          if (!input) return;
          const iso = new Date(input.replace(' ', 'T')).toISOString();
          const { appointment } = await api('/appointments/' + id, 'PATCH', { start: iso });
          tr.outerHTML = apRow(appointment); rewire(); toast('Rescheduled & confirmed');
        }
        refreshBadges();
      } catch (err) {
        toast(err.data && err.data.error === 'slot_conflict' ? 'That slot conflicts with another booking' : 'Action failed: ' + err.message, 'err');
      }
    });
    function rewire() { /* outerHTML replacement keeps delegation on #apBody, nothing to do */ }
  }
  function toggleAddAp() {
    const host = $('#addApForm');
    if (host.innerHTML) { host.innerHTML = ''; return; }
    const def = new Date(Date.now() + 86400000); def.setHours(10, 0, 0, 0);
    host.innerHTML = `
      <div class="form-card"><h3>New booking</h3>
        <div class="fg-row">
          <div class="fg"><label>Customer *</label><input id="naCust" maxlength="80" /></div>
          <div class="fg"><label>Phone *</label><input id="naPhone" maxlength="20" /></div>
        </div>
        <div class="fg-row">
          <div class="fg"><label>Service</label><input id="naService" maxlength="80" placeholder="e.g. Diagnostic & Repair" /></div>
          <div class="fg"><label>Start *</label><input id="naStart" type="datetime-local" value="${def.toISOString().slice(0, 16)}" /></div>
        </div>
        <div class="save-bar"><button class="btn btn-primary btn-sm" id="naSave">Create booking</button><button class="btn btn-ghost btn-sm" id="naCancel">Cancel</button><span class="muted">Double-booking is prevented automatically.</span></div>
      </div>`;
    $('#naCancel').addEventListener('click', toggleAddAp);
    $('#naSave').addEventListener('click', async () => {
      const payload = {
        customer: $('#naCust').value.trim(), phone: $('#naPhone').value.trim(),
        service: $('#naService').value.trim() || 'Appointment',
        start: $('#naStart').value ? new Date($('#naStart').value).toISOString() : null,
      };
      if (!payload.customer || !payload.phone || !payload.start) return toast('Customer, phone, and start are required', 'err');
      try {
        await api('/appointments', 'POST', payload);
        toggleAddAp(); toast('Booking created (simulated)'); render('appointments');
      } catch (err) {
        toast(err.data && err.data.error === 'slot_conflict' ? 'That slot conflicts with another booking' : err.data && err.data.error === 'duplicate_booking' ? 'Duplicate booking prevented' : 'Could not book: ' + err.message, 'err');
      }
    });
  }

  /* ===== REVIEWS ===== */
  RENDERERS.reviews = async function () {
    const { reviews } = await api('/reviews');
    views.innerHTML = `
      <div class="toolbar"><span class="muted">Honest feedback is requested from every customer equally — no filtering, no fake reviews.</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Customer</th><th>Service</th><th>Completed</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="revBody">${reviews.map(revRow).join('') || emptyRow(5)}</tbody>
      </table></div>`;
    $('#revBody').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act="send"]'); if (!btn) return;
      const tr = btn.closest('tr'); const id = tr.dataset.id;
      btn.disabled = true;
      try {
        const { review, message } = await api('/reviews/' + id + '/send', 'POST', {});
        tr.outerHTML = revRow(review);
        toast('Review request sent (simulated)');
        console.log('[simulated SMS]', message);
      } catch (err) {
        btn.disabled = false;
        toast(err.data && err.data.error === 'opted_out' ? 'Customer opted out — not sent' : err.data && err.data.error === 'already_sent' ? 'Already sent (duplicate prevented)' : 'Send failed: ' + err.message, 'err');
      }
      refreshBadges();
    });
  };
  function revRow(r) {
    const canSend = r.status === 'pending' || r.status === 'requested';
    const label = r.status === 'requested' ? 'Send follow-up' : 'Send request';
    return `<tr data-id="${r.id}">
      <td><strong>${esc(r.customer)}</strong>${sampleTag(r)}<div class="muted">${esc(r.phone)}</div></td>
      <td>${esc(r.service)}</td>
      <td><span class="muted">${ago(r.completedAt)}</span></td>
      <td><span class="pill ${r.status}">${r.status.replace(/_/g, ' ')}</span></td>
      <td>${canSend ? `<button class="btn btn-ghost btn-sm" data-act="send">${label}</button>` : '<span class="muted">—</span>'}</td>
    </tr>`;
  }

  /* ===== AUTOMATIONS ===== */
  RENDERERS.automations = async function () {
    const { automations, activity } = await api('/automations');
    const cards = automations.map((a) => `
      <div class="auto" data-id="${a.id}">
        <div class="auto-body">
          <h4>${esc(a.name)}</h4><p>${esc(a.description)}</p>
          <div class="auto-meta">${a.enabled ? `Last run ${ago(a.lastRun)} · ${a.runsToday} today` : 'Currently off'}</div>
        </div>
        <label class="switch"><input type="checkbox" class="auto-toggle"${a.enabled ? ' checked' : ''} aria-label="Toggle ${esc(a.name)}" /><span class="track"></span></label>
      </div>`).join('');
    views.innerHTML = `
      <div class="auto-grid">${cards}</div>
      <div class="panel"><h3>Recent activity</h3><ul class="act-list">${activity.slice(0, 14).map((a) => `<li class="act-item"><span class="act-time">${ago(a.ts)}</span><span>${esc(a.text)}</span></li>`).join('') || '<li class="empty">No activity.</li>'}</ul></div>`;
    $$('.auto-toggle', views).forEach((inp) => inp.addEventListener('change', async (e) => {
      const card = e.target.closest('.auto'); const id = card.dataset.id;
      try { const { automation } = await api('/automations/' + id, 'PATCH', { enabled: e.target.checked }); toast(`${automation.name} turned ${automation.enabled ? 'on' : 'off'}`); card.querySelector('.auto-meta').textContent = automation.enabled ? 'Just enabled' : 'Currently off'; }
      catch (err) { e.target.checked = !e.target.checked; toast('Toggle failed: ' + err.message, 'err'); }
    }));
  };

  /* ===== SETTINGS ===== */
  RENDERERS.settings = async function () {
    const { business } = await api('/settings');
    const b = business;
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const hoursRows = days.map((d) => {
      const h = b.hours[d];
      return `<div class="hours-row" data-day="${d}">
        <span class="day">${d}</span>
        <input type="time" class="h-open" value="${h ? h.open : ''}" ${h ? '' : 'disabled'} />
        <input type="time" class="h-close" value="${h ? h.close : ''}" ${h ? '' : 'disabled'} />
        <label class="consent" style="font-size:.8rem"><input type="checkbox" class="h-closed"${h ? '' : ' checked'} /> closed</label>
      </div>`;
    }).join('');
    const svcRows = b.services.map((s) => svcRowHtml(s)).join('');
    const faqRows = b.faqs.map((f) => faqRowHtml(f)).join('');
    const escRows = b.escalation.map((e) => escRowHtml(e)).join('');
    views.innerHTML = `
      <div class="form-card">
        <h3>Business</h3>
        <div class="fg"><label>Business name</label><input id="setName" maxlength="80" value="${esc(b.name)}" /></div>
        <div class="muted">Industry: ${esc(b.industry)} · Timezone: ${esc(b.timezone)}</div>
      </div>
      <div class="form-card"><h3>Business hours</h3>${hoursRows}</div>
      <div class="form-card"><h3>Services</h3><div id="svcList">${svcRows}</div><button class="add-row" id="addSvc">+ Add service</button></div>
      <div class="form-card"><h3>FAQs</h3><div id="faqList2">${faqRows}</div><button class="add-row" id="addFaq">+ Add FAQ</button></div>
      <div class="form-card"><h3>Escalation contacts</h3><p class="muted" style="margin-top:-8px">Who the AI hands off to for urgent or after-hours calls.</p><div id="escList">${escRows}</div><button class="add-row" id="addEsc">+ Add contact</button></div>
      <div class="save-bar"><button class="btn btn-primary" id="saveSettings">Save settings</button><span class="muted" id="saveMsg"></span></div>`;

    // hours closed toggle
    views.addEventListener('change', (e) => {
      if (e.target.classList.contains('h-closed')) {
        const row = e.target.closest('.hours-row');
        const closed = e.target.checked;
        row.querySelector('.h-open').disabled = closed;
        row.querySelector('.h-close').disabled = closed;
      }
    });
    $('#addSvc').addEventListener('click', () => $('#svcList').insertAdjacentHTML('beforeend', svcRowHtml({})));
    $('#addFaq').addEventListener('click', () => $('#faqList2').insertAdjacentHTML('beforeend', faqRowHtml({})));
    $('#addEsc').addEventListener('click', () => $('#escList').insertAdjacentHTML('beforeend', escRowHtml({})));
    views.addEventListener('click', (e) => { const x = e.target.closest('.icon-btn'); if (x) x.closest('.repeat-row').remove(); });

    $('#saveSettings').addEventListener('click', async () => {
      const hours = {};
      $$('.hours-row', views).forEach((row) => {
        const d = row.dataset.day;
        hours[d] = row.querySelector('.h-closed').checked ? null : { open: row.querySelector('.h-open').value || '08:00', close: row.querySelector('.h-close').value || '17:00' };
      });
      const services = $$('#svcList .repeat-row').map((r) => ({ name: r.querySelector('.s-name').value.trim(), priceNote: r.querySelector('.s-price').value.trim() })).filter((s) => s.name);
      const faqs = $$('#faqList2 .repeat-row').map((r) => ({ q: r.querySelector('.f-q').value.trim(), a: r.querySelector('.f-a').value.trim() })).filter((f) => f.q && f.a);
      const escalation = $$('#escList .repeat-row').map((r) => ({ name: r.querySelector('.e-name').value.trim(), phone: r.querySelector('.e-phone').value.trim(), role: 'staff' })).filter((e) => e.name && e.phone);
      try {
        await api('/settings', 'PUT', { name: $('#setName').value.trim(), hours, services, faqs, escalation });
        $('#saveMsg').textContent = '✓ Saved — the AI demo now uses these settings.';
        toast('Settings saved');
      } catch (err) { toast('Save failed: ' + err.message, 'err'); }
    });
  };
  const svcRowHtml = (s) => `<div class="repeat-row"><input class="s-name" placeholder="Service name" value="${esc(s.name || '')}" maxlength="80" /><input class="s-price" placeholder="Price note (e.g. from $129)" value="${esc(s.priceNote || '')}" maxlength="80" /><button class="icon-btn" title="Remove">×</button></div>`;
  const faqRowHtml = (f) => `<div class="repeat-row faq"><input class="f-q" placeholder="Question" value="${esc(f.q || '')}" maxlength="160" /><input class="f-a" placeholder="Answer" value="${esc(f.a || '')}" maxlength="600" /><button class="icon-btn" title="Remove">×</button></div>`;
  const escRowHtml = (e) => `<div class="repeat-row"><input class="e-name" placeholder="Name" value="${esc(e.name || '')}" maxlength="60" /><input class="e-phone" placeholder="Phone" value="${esc(e.phone || '')}" maxlength="20" /><button class="icon-btn" title="Remove">×</button></div>`;

  /* ---- shared helpers ---- */
  function emptyRow(cols) { return `<tr class="empty-row"><td colspan="${cols}" class="empty">No records yet.</td></tr>`; }
  function wireSearch(inputSel, bodySel) {
    const input = $(inputSel); if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase();
      $$(`${bodySel} tr`).forEach((tr) => { if (tr.classList.contains('empty-row')) return; tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });
  }
  async function refreshBadges() { /* overview recomputes on visit; placeholder for future live badges */ }

  /* ---- Nav wiring ---- */
  $('#sideNav').addEventListener('click', (e) => { const b = e.target.closest('.side-link'); if (b) { render(b.dataset.view); $('#sidebar').classList.remove('open'); } });
  $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#bannerX').addEventListener('click', () => $('#demoBanner').classList.add('hidden'));
  $('#resetBtn').addEventListener('click', async () => {
    if (!confirm('Reset all demo data back to the sample state?')) return;
    try { await api('/demo/reset', 'POST', {}); toast('Demo data reset'); render(currentView()); }
    catch (err) { toast('Reset failed: ' + err.message, 'err'); }
  });

  function currentView() { const v = (location.hash || '').replace('#', ''); return TITLES[v] ? v : 'overview'; }
  window.addEventListener('hashchange', () => render(currentView()));

  // init
  api('/health').then((h) => { $('#modeBadge').textContent = h.mode === 'live' ? 'Live' : 'Simulation'; }).catch(() => {});
  render(currentView());
})();
