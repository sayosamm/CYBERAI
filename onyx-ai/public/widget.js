/*
 * Onyx AI — embeddable chat widget.
 *
 * Add this to ANY website (Wix, Squarespace, WordPress, custom) with one line,
 * placed before </body>:
 *
 *   <script src="https://YOUR-INSTANCE.onrender.com/widget.js"
 *           data-name="Acme Plumbing"
 *           data-accent="#1e73be"
 *           data-launch="Chat with us"></script>
 *
 * It injects a floating chat bubble that talks to this instance's AI
 * receptionist, discloses it's an AI, and can capture a callback request
 * (name + phone) straight into the dashboard + owner notifications.
 * No dependencies, no build step.
 */
(function () {
  'use strict';
  if (window.__onyxWidgetLoaded) return;
  window.__onyxWidgetLoaded = true;

  var script = document.currentScript || (function () {
    var s = document.querySelectorAll('script');
    for (var i = s.length - 1; i >= 0; i--) if (/widget\.js(\?|$)/.test(s[i].src)) return s[i];
    return null;
  })();
  var BASE = '';
  try { BASE = new URL(script.src).origin; } catch (e) { BASE = ''; }
  var d = (script && script.dataset) || {};
  var ACCENT = d.accent || '#e3b84b';
  var NAME = d.name || 'Chat';
  var LAUNCH = d.launch || 'Chat with us';
  var INK = contrast(ACCENT);

  function contrast(hex) {
    try {
      var c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map(function (x) { return x + x; }).join('');
      var r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff';
    } catch (e) { return '#fff'; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ---- styles ---- */
  var css = `
  .oxw-launch{position:fixed;bottom:20px;right:20px;z-index:2147483000;display:flex;align-items:center;gap:10px;
    background:${ACCENT};color:${INK};border:none;border-radius:999px;padding:13px 20px;font:600 15px/1 -apple-system,Segoe UI,Roboto,sans-serif;
    cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.25);transition:transform .2s}
  .oxw-launch:hover{transform:translateY(-2px)}
  .oxw-launch svg{width:20px;height:20px;fill:none;stroke:${INK};stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .oxw-panel{position:fixed;bottom:20px;right:20px;z-index:2147483001;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 40px);
    background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden;
    font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#111}
  .oxw-open .oxw-panel{display:flex}.oxw-open .oxw-launch{display:none}
  .oxw-head{background:${ACCENT};color:${INK};padding:14px 16px;display:flex;align-items:center;gap:10px}
  .oxw-head strong{font-size:15px;display:block}.oxw-head small{opacity:.85;font-size:12px}
  .oxw-x{margin-left:auto;background:none;border:none;color:${INK};font-size:22px;cursor:pointer;line-height:1;opacity:.9}
  .oxw-body{flex:1;overflow-y:auto;padding:16px;background:#f7f7f9;display:flex;flex-direction:column;gap:9px}
  .oxw-b{max-width:84%;padding:10px 13px;border-radius:14px;font-size:14px;white-space:pre-wrap;word-wrap:break-word}
  .oxw-b.bot{align-self:flex-start;background:#fff;border:1px solid #e6e6ea;border-bottom-left-radius:4px}
  .oxw-b.me{align-self:flex-end;background:${ACCENT};color:${INK};border-bottom-right-radius:4px}
  .oxw-b.typing{display:inline-flex;gap:4px}.oxw-b.typing i{width:6px;height:6px;border-radius:50%;background:#bbb;animation:oxwb 1.2s infinite}
  .oxw-b.typing i:nth-child(2){animation-delay:.2s}.oxw-b.typing i:nth-child(3){animation-delay:.4s}
  @keyframes oxwb{0%,60%,100%{opacity:.3}30%{opacity:1}}
  .oxw-foot{border-top:1px solid #ececf0;padding:10px;background:#fff}
  .oxw-row{display:flex;gap:8px}
  .oxw-in{flex:1;border:1px solid #d8d8de;border-radius:999px;padding:10px 14px;font:14px inherit;outline:none}
  .oxw-in:focus{border-color:${ACCENT}}
  .oxw-send{background:${ACCENT};color:${INK};border:none;border-radius:999px;padding:0 16px;font:600 14px inherit;cursor:pointer}
  .oxw-cb{display:block;width:100%;margin-top:8px;background:none;border:1px dashed #cfcfd6;color:#555;border-radius:10px;padding:8px;font:13px inherit;cursor:pointer}
  .oxw-cb:hover{border-color:${ACCENT};color:#111}
  .oxw-form{display:none;flex-direction:column;gap:8px;margin-top:8px}
  .oxw-form.on{display:flex}
  .oxw-form input,.oxw-form textarea{border:1px solid #d8d8de;border-radius:8px;padding:9px 11px;font:14px inherit;outline:none}
  .oxw-form button{background:${ACCENT};color:${INK};border:none;border-radius:8px;padding:10px;font:600 14px inherit;cursor:pointer}
  .oxw-note{font-size:11px;color:#999;text-align:center;padding:6px 0 2px}
  .oxw-msg{font-size:12px;text-align:center;min-height:1em}
  `;
  document.head.appendChild(el('style', null, css));

  /* ---- DOM ---- */
  var root = el('div', 'oxw-root');
  var launch = el('button', 'oxw-launch', '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.4L3 21l1.1-4.5A8.4 8.4 0 1 1 21 11.5Z"/></svg><span>' + esc(LAUNCH) + '</span>');
  var panel = el('div', 'oxw-panel');
  panel.innerHTML =
    '<div class="oxw-head"><div><strong>' + esc(NAME) + '</strong><small>AI assistant · replies in seconds</small></div><button class="oxw-x" aria-label="Close">&times;</button></div>' +
    '<div class="oxw-body" id="oxwBody"></div>' +
    '<div class="oxw-foot">' +
      '<div class="oxw-row"><input class="oxw-in" id="oxwIn" placeholder="Type your question…" autocomplete="off"/><button class="oxw-send" id="oxwSend">Send</button></div>' +
      '<button class="oxw-cb" id="oxwCb">📞 Request a callback</button>' +
      '<form class="oxw-form" id="oxwForm">' +
        '<input id="oxwName" placeholder="Your name" maxlength="80" required/>' +
        '<input id="oxwPhone" placeholder="Your phone" maxlength="20" required/>' +
        '<textarea id="oxwWhat" placeholder="What do you need? (optional)" rows="2" maxlength="300"></textarea>' +
        '<label style="font-size:11px;color:#777;display:flex;gap:6px"><input type="checkbox" id="oxwConsent"/> <span>OK to contact me, incl. by text. Reply STOP to opt out.</span></label>' +
        '<button type="submit">Send request</button>' +
        '<div class="oxw-msg" id="oxwFormMsg"></div>' +
      '</form>' +
      '<div class="oxw-note">Powered by AI · you can ask for a person anytime</div>' +
    '</div>';
  root.appendChild(panel);
  root.appendChild(launch);
  document.body.appendChild(root);

  var body = panel.querySelector('#oxwBody');
  var input = panel.querySelector('#oxwIn');
  var state = null, greeted = false;

  function open() { root.classList.add('oxw-open'); if (!greeted) { greeted = true; greet(); } input.focus(); }
  function close() { root.classList.remove('oxw-open'); }
  launch.addEventListener('click', open);
  panel.querySelector('.oxw-x').addEventListener('click', close);

  function bubble(who, text) { var b = el('div', 'oxw-b ' + who, esc(text)); body.appendChild(b); body.scrollTop = body.scrollHeight; return b; }
  function typing() { var b = el('div', 'oxw-b bot typing', '<i></i><i></i><i></i>'); body.appendChild(b); body.scrollTop = body.scrollHeight; return b; }

  function api(path, payload) {
    return fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });
  }

  function greet() {
    var t = typing();
    api('/api/demo/receptionist', {}).then(function (data) {
      t.remove(); bubble('bot', data.reply || 'Hi! How can I help?'); state = data.state;
    }).catch(function () { t.remove(); bubble('bot', 'Hi! How can I help you today?'); });
  }
  function send(text) {
    bubble('me', text); var t = typing();
    api('/api/demo/receptionist', { message: text, state: state }).then(function (data) {
      t.remove(); bubble('bot', data.reply || '…'); state = data.state;
    }).catch(function () { t.remove(); bubble('bot', 'Sorry — I had trouble connecting. Please try again.'); });
  }
  panel.querySelector('#oxwSend').addEventListener('click', function () { var v = input.value.trim(); if (v) { input.value = ''; send(v); } });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var v = input.value.trim(); if (v) { input.value = ''; send(v); } } });

  /* callback form */
  var form = panel.querySelector('#oxwForm');
  panel.querySelector('#oxwCb').addEventListener('click', function () { form.classList.toggle('on'); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = panel.querySelector('#oxwFormMsg');
    var payload = {
      name: panel.querySelector('#oxwName').value.trim(),
      phone: panel.querySelector('#oxwPhone').value.trim(),
      message: panel.querySelector('#oxwWhat').value.trim(),
      interest: 'Website chat',
      consent: panel.querySelector('#oxwConsent').checked,
    };
    if (!payload.name || !payload.phone) { msg.style.color = '#c00'; msg.textContent = 'Please add your name and phone.'; return; }
    if (!payload.consent) { msg.style.color = '#c00'; msg.textContent = 'Please check the consent box.'; return; }
    api('/api/contact', payload).then(function (r) {
      if (r && r.ok) { msg.style.color = '#1a9e52'; msg.textContent = '✓ Got it! We’ll reach out shortly.'; form.reset(); setTimeout(function () { form.classList.remove('on'); msg.textContent = ''; }, 2500); bubble('bot', 'Thanks! I’ve shared your details with the team — they’ll reach out shortly. 👍'); }
      else { msg.style.color = '#c00'; msg.textContent = 'Something went wrong — please try again.'; }
    }).catch(function () { msg.style.color = '#c00'; msg.textContent = 'Couldn’t send — please try again.'; });
  });
})();
