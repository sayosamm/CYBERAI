# Pricing, delivery costs & assumptions

> Internal planning doc. Validate provider pricing against current rate cards
> before committing; third-party rates change.

## The plan (one, all-inclusive)

| | **Full Package** |
|---|---|
| **Price** | **$299 / month** |
| **One-time setup & onboarding** | **$4,000** |
| AI receptionist / voice agent (inbound calls) | ✓ |
| Missed-call text-back | ✓ |
| Appointment booking, reminders & rescheduling | ✓ |
| Google review requests (+ follow-up) | ✓ |
| Estimate follow-up | ✓ |
| Lead reactivation | ✓ |
| Website AI concierge | ✓ |
| After-hours urgent routing + human handoff | ✓ |
| Daily owner summary | ✓ |
| Lead capture + dashboard | ✓ |
| AI disclosure + STOP/opt-out | ✓ |
| **Included usage** | Generous fair-use conversation + voice-minute allotment |
| **Overage** | At cost + small margin, quoted up front |
| **Third-party fees** | Phone number, SMS carrier, voice minutes passed through at provider cost |

Month-to-month, cancel anytime. No tiers, no per-feature upsells.

## Margin check (per client, per month)

Rough *our* cost to run one client, to sanity-check the $299/mo. **Verify
against current provider pricing.**

| Cost line | Est. / mo | Assumption |
|---|---|---|
| Phone number | ~$1–5 | Local number |
| SMS (carrier) | ~$10–50 | Per-segment + carrier fees; A2P 10DLC registered |
| Voice minutes | ~$15–80 | Inbound + transfer legs, typical small-business volume |
| Realtime voice AI | ~$30–120 | Per-minute speech agent |
| LLM / NLU (optional) | ~$0–40 | Rule engine is near-zero; only if upgraded |
| Hosting / infra | ~$7 | One Render instance (free–starter) |
| **Est. delivery subtotal** | **~$65–300** | Scales with call/text volume |
| **Price** | **$299 / mo** | Plus the $4,000 setup up front |

At typical volume this leaves healthy margin; heavy months (e.g. an HVAC heat
wave) compress it, which is what the overage + pass-through terms protect.
**The $4,000 setup is the real profit lever early** — it covers onboarding
effort and front-loads cash while the monthly recurring builds.

### What the $4,000 setup covers (our effort)
- Discovery + Settings configuration: 2–4 hrs
- Provider wiring (number, messaging registration, calendar/CRM): 3–8 hrs
- Flow scripting + simulation testing with the owner: 3–6 hrs
- A2P 10DLC brand/campaign registration: lead time of days–weeks (start early)
- First-week monitoring and tuning

## Key assumptions
1. **US home-service businesses** initially; SMS requires A2P 10DLC registration.
2. Price excludes taxes and pass-through carrier/voice fees.
3. Fair-use allotment assumes typical small-business volume; heavy seasons push
   into overage — expected and margin-protective.
4. The rule-based assistant covers most flows at near-zero marginal NLU cost;
   the LLM upgrade is optional and billed accordingly.
5. No revenue or performance guarantees are made to clients. We sell captured
   leads and saved admin time, demonstrated in simulation, not promised ROI.
6. Month-to-month (no long lock-in), which favors proving value fast in the
   first 2–4 weeks.

> **Pricing note:** $4,000 setup is a premium anchor — great margin and it
> filters for serious clients. For your very first 1–2 reference customers you
> may choose to discount the setup (e.g. $1,000–1,500) in exchange for a
> testimonial and a case study, then hold firm at $4,000 once you have proof.

## Positioning note
Lead with plain-English outcomes: *"answer every call, text back every missed
one, and book more jobs without hiring a receptionist."* Avoid buzzwords and
never promise a specific revenue lift.
