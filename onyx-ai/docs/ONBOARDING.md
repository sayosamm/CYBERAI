# First-client onboarding checklist

A practical, do-this-in-order checklist to take a home-service business from
"yes, let's try it" to live — safely. Target: **live in about a week**.

## 0. Before the kickoff call
- [ ] Confirm the trade (HVAC, plumbing, electrical, cleaning, auto detailing)
      and the one or two pain points they feel most (missed calls? no-shows? slow quote follow-up?).
- [ ] Agree on a starting package (see `PACKAGES.md`) — start narrow, expand later.
- [ ] Set expectations: everything is tested in **simulation** and approved by
      them before a single live message or call.

## 1. Discovery (30–45 min)
- [ ] Business name, service area, timezone.
- [ ] Business hours (and what counts as "after hours").
- [ ] Service list with rough durations and how they talk about pricing.
- [ ] Top 10 FAQs in the owner's own words.
- [ ] Escalation rules: who gets urgent/after-hours calls, and what's a true
      emergency vs. schedulable (e.g. "no heat" vs. "filter change").
- [ ] Booking rules: slot length, buffer, who/what can be double-booked.
- [ ] Review policy confirmation: honest requests to **all** customers equally.

> Enter all of this in the dashboard **Settings** tab — the AI uses it immediately.

## 2. Connect the tools (secure, server-side)
- [ ] **Phone/telephony:** provision or port a Twilio number; decide whether
      Onyx answers first or only catches missed/overflow calls.
- [ ] **SMS:** set up a Messaging Service; register the sender (A2P 10DLC brand
      + campaign registration in the US — allow lead time).
- [ ] **Calendar:** connect Google Calendar (share the booking calendar with the
      service account) or Microsoft 365.
- [ ] **CRM (optional):** connect Jobber / Housecall Pro / ServiceTitan / HubSpot.
- [ ] Put all credentials in `.env` (never in the repo). Verify each provider's
      current docs (linked in `server/integrations/*.js`).

## 3. Configure flows
- [ ] AI disclosure script (edit the default to the owner's voice).
- [ ] SMS consent language + opt-out footer.
- [ ] Quiet hours.
- [ ] Missed-call text-back message.
- [ ] Reminder cadence (24h / 2h) and reschedule link.
- [ ] Review request + one gentle follow-up timing.
- [ ] Estimate follow-up timing and "customer is ready" staff alert.

## 4. Test in simulation (owner sits with you)
- [ ] Walk the interactive receptionist through 8–10 real scenarios
      (booking, pricing, urgent, after-hours, "talk to a human").
- [ ] Trigger a simulated missed-call text-back and reply as a customer.
- [ ] Create, confirm, reschedule, and cancel a booking; confirm no double-books.
- [ ] Send a simulated review request and a follow-up.
- [ ] Reply `STOP` and confirm the number is suppressed; `START` to resubscribe.
- [ ] Owner reviews the daily summary format.
- [ ] **Owner signs off in writing** on every flow that will go live.

## 5. Go live (gated)
- [ ] Set `ONYX_MODE=live` and wire the live provider branches.
- [ ] Test on the owner's and your own numbers first.
- [ ] Soft launch: enable missed-call text-back + reminders only for a few days.
- [ ] Expand to full inbound answering once the owner is comfortable.

## 6. First-week success check
- [ ] Review transcripts daily; tune FAQs and escalation.
- [ ] Confirm reminders are reducing no-shows.
- [ ] Confirm every missed call got a text-back and a lead.
- [ ] Share a simple weekly recap: calls handled, leads captured, appts booked,
      reviews requested. (Only real, measured numbers — never invented.)

## Guardrails to never skip
- Clear AI disclosure on every channel.
- A human is always reachable.
- Honor every opt-out immediately and permanently.
- No automated messages during quiet hours.
- Never send real messages/calls without the owner's explicit approval.
