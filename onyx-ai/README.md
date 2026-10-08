# Onyx AI

**AI automation for home-service businesses** — turn missed calls into booked
appointments. Onyx AI answers the phone, texts back missed callers, books
appointments, requests honest reviews, and automates the repetitive front-office
work for HVAC, plumbing, electrical, cleaning, and auto-detailing businesses.

This repository contains a **polished marketing website** and a **working demo
dashboard** you can show to a potential client today. Everything runs locally
with **no build step, no database, and no third-party credentials**.

> ⚠️ **Demo safety:** The app ships in **simulation mode**. It never places real
> calls, sends real texts, creates real calendar events, or charges anyone.
> Sample data is clearly labeled and fictional. Going live requires adding
> credentials *and* flipping `ONYX_MODE=live` *and* wiring the provider calls —
> all intentionally gated. Do not go live without explicit approval.

---

## Quick start (local)

Requires **Node.js 18+** (tested on Node 22). No dependencies to install.

```bash
cd onyx-ai
cp .env.example .env     # optional — defaults are fine for the demo
npm start                # or: node server/index.js
```

Then open:

- **Website:** http://localhost:3000/
- **Demo dashboard:** http://localhost:3000/dashboard

Useful scripts:

```bash
npm run dev          # auto-restart on file changes (node --watch)
npm run reset-demo   # restore the dashboard to the labeled sample data
```

To reset the demo from the UI, click **Reset demo** in the dashboard top bar.

---

## What works now vs. what needs provider credentials

### ✅ Works now (no credentials, fully functional)

| Capability | Where | Notes |
|---|---|---|
| Marketing website | `/` | Responsive, animated, mobile-friendly |
| Interactive AI receptionist demo | hero on `/` | Rule-based engine over the business's FAQs/services |
| Missed-call text-back visual | `/#textback` | Animated conversation replay |
| Lead capture (contact / book-a-demo) | `/#contact` → dashboard | Real validation + consent checkbox |
| Demo dashboard | `/dashboard` | Overview, Calls, Leads, Appointments, Reviews, Automations, Settings |
| Submit a lead & update its status | Leads view | Persists to the local JSON store |
| Create / confirm / reschedule / cancel a booking | Appointments view | **Double-booking prevented** |
| Send a (simulated) review request + follow-up | Reviews view | Honest-feedback policy; de-duplicated |
| Toggle automations on/off | Automations view | Activity feed updates |
| Edit business hours, services, FAQs, escalation | Settings view | The receptionist demo immediately uses them |
| Consent / opt-out engine | server-wide | `STOP`/`START`/`HELP`, quiet hours, dedupe |

### 🔌 Needs provider credentials (boundaries are built; live calls are stubbed)

| Capability | Provider (suggested) | Credential(s) | Status |
|---|---|---|---|
| Inbound calls + warm transfer | Twilio Programmable Voice | `TWILIO_*`, `ESCALATION_PHONE_NUMBER` | Boundary in `server/integrations/telephony.js` |
| Realtime AI voice agent | Realtime speech provider | `VOICE_AI_API_KEY`, `VOICE_AI_AGENT_ID` | Boundary in `server/integrations/voice.js` |
| Outbound SMS (text-back, reminders, reviews) | Twilio Messaging | `TWILIO_*` / `TWILIO_MESSAGING_SERVICE_SID` | Boundary in `server/integrations/sms.js` |
| Calendar booking + reminders | Google Calendar / MS Graph | `GOOGLE_*` / `MS_GRAPH_*` | Boundary in `server/integrations/calendar.js` |
| CRM sync | Jobber / Housecall Pro / HubSpot / etc. | `CRM_PROVIDER`, `CRM_API_KEY`, `CRM_BASE_URL` | Boundary in `server/integrations/crm.js` |
| LLM concierge upgrade (optional) | Anthropic Claude | `ANTHROPIC_API_KEY` | Demo uses the local rule engine; no key needed |

Each integration module documents the exact live API call (verified against the
providers' current docs) and throws a clear error if `ONYX_MODE=live` is set
before the live path is actually wired — so nothing real can fire by accident.

---

## Architecture

```
onyx-ai/
├── server/
│   ├── index.js              # zero-dependency HTTP server (static + API)
│   ├── routes/api.js         # all JSON API endpoints
│   ├── lib/
│   │   ├── env.js            # .env loader + ONYX_MODE switch
│   │   ├── consent.js        # opt-out, quiet hours, idempotency/dedupe
│   │   ├── assistant.js      # local rule-based receptionist/concierge
│   │   └── util.js           # ids, phone normalization, validation
│   ├── integrations/         # provider BOUNDARIES (simulation by default)
│   │   ├── telephony.js  voice.js  sms.js  calendar.js  crm.js
│   ├── data/
│   │   ├── seed.js           # clearly-labeled fictional sample data
│   │   └── store.js          # tiny JSON-file persistence
│   └── scripts/reset.js
├── public/                   # static site + dashboard (no build step)
│   ├── index.html  dashboard.html
│   ├── css/  (base, site, dashboard)
│   └── js/   (site.js, dashboard.js)
├── docs/                     # onboarding, packages, roadmap
└── .env.example
```

**Why this stack?** The existing repository had no web stack (it held an
unrelated Java sketch), so Onyx uses a **simple, maintainable, zero-dependency
Node stack**: a built-in `http` server plus static vanilla-JS pages. It runs
anywhere Node runs, has nothing to install, and is trivial to read and extend.
For a production, multi-tenant deployment you would swap `data/store.js` for a
real database behind the same interface and add an auth layer in front of the
dashboard — the API and integration boundaries are already structured for it.

### Security & secrets

- Secrets live only in `.env` (gitignored) and are read **server-side**; they
  are never serialized to the browser.
- The server sets `Content-Security-Policy`, `X-Content-Type-Options`,
  `X-Frame-Options`, and `Referrer-Policy`, blocks path traversal, caps request
  body size, and returns `Cache-Control: no-store` on the API.
- When you wire Twilio webhooks, validate the `X-Twilio-Signature` header
  (noted in `integrations/sms.js` / `telephony.js`).

### Responsible-AI & compliance (built in)

- **AI disclosure** at the start of every call/chat (editable in Settings).
- **Human handoff** always offered; urgent keywords and after-hours calls route
  to an escalation contact.
- **Consent + opt-out**: `STOP/UNSUBSCRIBE/CANCEL` opts a number out;
  `START/YES` resubscribes; `HELP` returns help text. Opt-outs persist.
- **Quiet hours**: no automated texts during configured local quiet hours.
- **Duplicate protection**: idempotency keys stop the same message/booking from
  firing twice.
- **Honest reviews**: review requests go to every eligible customer equally —
  no fabricated reviews, no filtering out unhappy customers.
- **No invented social proof**: the site contains no fake testimonials, logos,
  or performance statistics, and pricing is clearly labeled **draft**.

---

## API reference (demo)

All endpoints return JSON. Mutations persist to `server/data/store.json`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Server + mode |
| GET | `/api/overview` | Dashboard summary stats |
| GET | `/api/calls` | Call list + AI summaries |
| GET/POST | `/api/leads` | List / create a lead |
| PATCH | `/api/leads/:id` | Update status/note/value |
| GET/POST | `/api/appointments` | List / create (conflict + dup checked) |
| PATCH | `/api/appointments/:id` | Confirm / reschedule / cancel |
| GET | `/api/reviews` | Review request list |
| POST | `/api/reviews/:id/send` | Send request / follow-up (simulated) |
| GET | `/api/automations` | Automations + activity feed |
| PATCH | `/api/automations/:id` | Enable / disable |
| GET/PUT | `/api/settings` | Business hours, services, FAQs, escalation |
| POST | `/api/demo/receptionist` | Interactive receptionist turn |
| POST | `/api/demo/missedcall` | Missed-call text-back simulation |
| POST | `/api/sms/inbound` | Inbound SMS webhook sim (STOP/START/HELP) |
| POST | `/api/contact` | Website contact / book-a-demo |
| POST | `/api/demo/reset` | Reset to sample data |

---

## More docs

- [`DEPLOY.md`](DEPLOY.md) — deploy to Render free tier; one instance per customer
- [`docs/ONBOARDING.md`](docs/ONBOARDING.md) — checklist to onboard the first client
- [`docs/PACKAGES.md`](docs/PACKAGES.md) — packages, estimated delivery costs, assumptions
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — five additional automation ideas, ranked

---

## Going live (gated — requires approval)

1. Add credentials to `.env`.
2. **Verify each provider's current API docs** (linked in the integration files).
3. Implement the live branch in the relevant `integrations/*.js` module.
4. Set `ONYX_MODE=live`.
5. Test on your own numbers first, with explicit approval, before touching any
   real customer.
