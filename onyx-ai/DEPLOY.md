# Deploying Onyx AI (Render, free tier)

This guide gets a customer instance live on **Render's free plan** in ~10
minutes, and shows how to repeat it for each new customer.

**Deployment model:** one Render service = one customer. Each instance keeps its
own data, so there's no login system or multi-tenant database to manage.

---

## First deploy (one-time)

1. **Push the repo to GitHub** (already done for this repo).
2. Go to **https://render.com** and sign up (free; connect your GitHub).
3. Click **New → Blueprint**, pick this repository. Render reads `render.yaml`
   at the repo root and proposes a web service called **onyx-ai-demo**.
4. Click **Apply**. Render installs and starts it (`npm start`) and gives you a
   URL like `https://onyx-ai-demo.onrender.com`.
5. Open that URL — the marketing site loads; add `/dashboard` for the dashboard.

That's it. The app ships in **simulation mode**, so nothing real is sent.

> Prefer clicking over Blueprints? Use **New → Web Service** instead, pick the
> repo, and set: **Root Directory** = `onyx-ai`, **Build** = `npm install`,
> **Start** = `npm start`, **Plan** = Free.

---

## Add a new customer (repeat per client)

Pick whichever is easier for you:

- **Easiest:** in Render, **New → Web Service** from the same repo, give it the
  customer's name (e.g. `acme-plumbing`), Root Directory `onyx-ai`, Build
  `npm install`, Start `npm start`, Free plan. You get
  `https://acme-plumbing.onrender.com`.
- **Or** duplicate the service block in `render.yaml` with a new unique `name`
  and re-apply the Blueprint.

Then configure that instance:
1. **Settings → Environment** on the service, set any env vars (below).
2. Open the instance's **/dashboard → Settings tab** and fill in the business
   name, hours, services, FAQs, and escalation contacts. The AI uses them live.

### Custom subdomain (optional, looks professional)
In the service's **Settings → Custom Domains**, add e.g.
`acme.yourdomain.com` and create the CNAME record Render shows you at your DNS
provider. (Buying one domain and giving each client a subdomain is cheapest.)

---

## Environment variables

| Variable | When | Purpose |
|---|---|---|
| `ONYX_MODE` | always | `simulation` (default & safe) or `live` |
| `DASHBOARD_USER` + `DASHBOARD_PASS` | recommended | Turns on the dashboard password gate (set both) |
| `PUBLIC_BASE_URL` | when going live | This instance's public URL, for provider callbacks |
| `TWILIO_*`, `GOOGLE_*`, `CRM_*` | when going live | Provider credentials (see `.env.example`) |

`PORT` is set by Render automatically — don't set it yourself.

### Protecting the dashboard without a login
You said no login — that's fine. But once an instance holds real customer phone
numbers, don't leave the dashboard fully public. Set **`DASHBOARD_USER`** and
**`DASHBOARD_PASS`** in Render; the browser then asks for that one shared
password before showing `/dashboard`. The public marketing site and the chat
demo stay open. Leave them unset to rely on the unguessable URL instead.

---

## Two things to know on the free plan

1. **Cold starts.** A free service sleeps after ~15 min idle and takes ~30s to
   wake on the next visit. Fine for demos; upgrade a specific client to a paid
   instance ($7/mo) when they need it always-on.
2. **Data is ephemeral.** The free plan has no persistent disk, so leads created
   in the dashboard reset to the sample data on redeploy/restart. **Perfectly
   fine for demos.** Before an instance stores *real* client leads, do one of:
   - Upgrade that service to a paid plan and add a Render **Disk** mounted at
     `onyx-ai/server/data` (the JSON store persists there), **or**
   - Point the store at a free hosted database (e.g. **Neon** or **Supabase**,
     both have free tiers) — the store has a small interface built for this
     swap. Ask and I'll wire it.

---

## Going live with real calls/texts (gated)

Only after a client signs off (see `docs/ONBOARDING.md`):
1. Add the client's provider credentials as env vars.
2. Implement the live branch in the relevant `server/integrations/*.js` file
   (each documents the exact provider call).
3. Set `ONYX_MODE=live` and `PUBLIC_BASE_URL` to the instance URL.
4. Test on your own number first.

---

## Other hosts
A `Dockerfile` is included for **Fly.io** or any Docker host
(`fly launch` from the `onyx-ai/` folder). Render itself uses the native Node
runtime and does not need Docker.
