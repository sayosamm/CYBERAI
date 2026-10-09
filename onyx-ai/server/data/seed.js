'use strict';
/**
 * Seed data for the Onyx AI demo.
 *
 * EVERYTHING in this file is SAMPLE DATA for a fictional demo business
 * ("Northside Heating & Air"). No real person, phone number, or booking is
 * represented here. Phone numbers use the 555-01xx range reserved for
 * fiction. The UI labels all of this as sample data.
 */

function daysFromNow(days, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

const business = {
  name: 'Northside Heating & Air',
  industry: 'HVAC',
  timezone: 'America/Chicago',
  phone: '+15550100', // sample / fiction
  // Human escalation contacts for after-hours + urgent routing.
  escalation: [
    { name: 'Dana (Owner)', phone: '+15550101', role: 'owner' },
    { name: 'On-call Tech', phone: '+15550102', role: 'technician' },
  ],
  hours: {
    monday: { open: '08:00', close: '17:00' },
    tuesday: { open: '08:00', close: '17:00' },
    wednesday: { open: '08:00', close: '17:00' },
    thursday: { open: '08:00', close: '17:00' },
    friday: { open: '08:00', close: '17:00' },
    saturday: { open: '09:00', close: '13:00' },
    sunday: null, // closed
  },
  // AI assistant personality + free-form knowledge the chatbot answers from.
  persona: 'Warm, upbeat, and concise — like a friendly front-desk pro who gets things booked.',
  knowledge: 'Service area: greater Northside metro, ~30 miles. We service all major brands. Payment: cash, card, and financing available on new installs. Diagnostic fee is waived if you approve the repair. We offer a 100% satisfaction guarantee on workmanship.',
  services: [
    { id: 'svc_tuneup', name: 'AC / Furnace Tune-up', durationMin: 60, priceNote: 'from $129' },
    { id: 'svc_repair', name: 'Diagnostic & Repair', durationMin: 90, priceNote: '$99 diagnostic, applied to repair' },
    { id: 'svc_install', name: 'System Install Estimate', durationMin: 60, priceNote: 'free in-home estimate' },
    { id: 'svc_emergency', name: 'Emergency No-Heat / No-Cool', durationMin: 120, priceNote: 'after-hours fee may apply' },
  ],
  faqs: [
    { q: 'What are your hours?', a: 'We are open Monday to Friday 8am to 5pm, and Saturday 9am to 1pm. For no-heat or no-cool emergencies we offer after-hours urgent routing.' },
    { q: 'What areas do you serve?', a: 'We serve the greater Northside metro and surrounding suburbs within about 30 miles.' },
    { q: 'How much is a diagnostic visit?', a: 'A standard diagnostic is $99, and that amount is applied toward any repair you approve.' },
    { q: 'Do you offer free estimates?', a: 'Yes — new system installs include a free in-home estimate.' },
    { q: 'Do you service all brands?', a: 'We service and repair all major residential heating and cooling brands.' },
  ],
  // Compliance settings
  compliance: {
    aiDisclosure: 'Hi! You are chatting with Northside’s AI assistant. I can answer questions and help you book — I’ll connect you to a person anytime you ask.',
    smsConsentLanguage: 'Reply YES to get text updates about your service from Northside Heating & Air. Msg & data rates may apply. Reply STOP to opt out, HELP for help.',
    smsOptOutFooter: 'Reply STOP to opt out.',
    quietHours: { start: '21:00', end: '08:00' }, // no automated texts during these local hours
  },
};

const calls = [
  {
    id: 'call_1001',
    direction: 'inbound',
    from: '+15550111',
    callerName: 'Sample Caller — Maria G.',
    startedAt: hoursAgo(2),
    durationSec: 142,
    handledBy: 'ai',
    outcome: 'booked',
    intent: 'AC not cooling',
    summary: 'Caller’s AC is running but not cooling. AI qualified the issue, confirmed service address in-area, and booked a diagnostic visit. Offered earliest slot.',
    sentiment: 'neutral',
    transferredTo: null,
    sample: true,
  },
  {
    id: 'call_1002',
    direction: 'inbound',
    from: '+15550112',
    callerName: 'Sample Caller — Tom R.',
    startedAt: hoursAgo(5),
    durationSec: 63,
    handledBy: 'ai',
    outcome: 'lead_captured',
    intent: 'Quote for new furnace',
    summary: 'Caller wants a quote on a furnace replacement. AI captured contact details and preferred callback window, created a lead, and flagged for an install estimate.',
    sentiment: 'positive',
    transferredTo: null,
    sample: true,
  },
  {
    id: 'call_1003',
    direction: 'inbound',
    from: '+15550113',
    callerName: 'Sample Caller — Priya S.',
    startedAt: hoursAgo(20),
    durationSec: 201,
    handledBy: 'human',
    outcome: 'transferred',
    intent: 'No heat — urgent',
    summary: 'After-hours no-heat call. AI recognized an urgent keyword, read the safety script, and warm-transferred to the on-call technician.',
    sentiment: 'negative',
    transferredTo: 'On-call Tech',
    sample: true,
  },
  {
    id: 'call_1004',
    direction: 'inbound',
    from: '+15550114',
    callerName: 'Sample Caller — Unknown',
    startedAt: hoursAgo(26),
    durationSec: 0,
    handledBy: 'missed',
    outcome: 'missed_then_texted',
    intent: 'Unknown (missed)',
    summary: 'Call came in after hours and was missed. Missed-call text-back fired automatically within 1 minute; caller replied and a lead was created.',
    sentiment: 'neutral',
    transferredTo: null,
    sample: true,
  },
];

const leads = [
  {
    id: 'lead_2001',
    name: 'Sample Lead — Tom R.',
    phone: '+15550112',
    email: 'tom.sample@example.com',
    source: 'inbound_call',
    service: 'System Install Estimate',
    status: 'new',
    value: 'high',
    note: 'Wants furnace replacement quote. Prefers callback after 4pm.',
    smsConsent: true,
    createdAt: hoursAgo(5),
    updatedAt: hoursAgo(5),
    sample: true,
  },
  {
    id: 'lead_2002',
    name: 'Sample Lead — Website Visitor',
    phone: '+15550115',
    email: 'visitor.sample@example.com',
    source: 'website_concierge',
    service: 'AC / Furnace Tune-up',
    status: 'contacted',
    value: 'medium',
    note: 'Asked about tune-up pricing via website concierge; details captured.',
    smsConsent: true,
    createdAt: hoursAgo(9),
    updatedAt: hoursAgo(3),
    sample: true,
  },
  {
    id: 'lead_2003',
    name: 'Sample Lead — Maria G.',
    phone: '+15550111',
    email: '',
    source: 'inbound_call',
    service: 'Diagnostic & Repair',
    status: 'booked',
    value: 'medium',
    note: 'Diagnostic booked for AC not cooling.',
    smsConsent: true,
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(2),
    sample: true,
  },
  {
    id: 'lead_2004',
    name: 'Sample Lead — Reactivation (Carla D.)',
    phone: '+15550116',
    email: 'carla.sample@example.com',
    source: 'reactivation',
    service: 'AC / Furnace Tune-up',
    status: 'new',
    value: 'low',
    note: 'Past customer (last service 13 months ago), opted in to messages. Eligible for seasonal tune-up reminder.',
    smsConsent: true,
    createdAt: hoursAgo(1),
    updatedAt: hoursAgo(1),
    sample: true,
  },
];

const appointments = [
  {
    id: 'appt_3001',
    customer: 'Sample Lead — Maria G.',
    phone: '+15550111',
    service: 'Diagnostic & Repair',
    start: daysFromNow(0, 14, 0),
    end: daysFromNow(0, 15, 30),
    status: 'confirmed',
    remindersSent: ['24h'],
    source: 'ai_booking',
    sample: true,
  },
  {
    id: 'appt_3002',
    customer: 'Sample Lead — Jordan P.',
    phone: '+15550117',
    service: 'AC / Furnace Tune-up',
    start: daysFromNow(1, 10, 0),
    end: daysFromNow(1, 11, 0),
    status: 'pending',
    remindersSent: [],
    source: 'ai_booking',
    sample: true,
  },
  {
    id: 'appt_3003',
    customer: 'Sample Lead — Website Visitor',
    phone: '+15550115',
    service: 'System Install Estimate',
    start: daysFromNow(2, 9, 0),
    end: daysFromNow(2, 10, 0),
    status: 'confirmed',
    remindersSent: [],
    source: 'website_concierge',
    sample: true,
  },
];

const reviews = [
  {
    id: 'rev_4001',
    customer: 'Sample Customer — Alan W.',
    phone: '+15550118',
    service: 'AC / Furnace Tune-up',
    completedAt: hoursAgo(28),
    status: 'requested', // requested | followed_up | completed | declined
    requestedAt: hoursAgo(26),
    followUpAt: null,
    smsConsent: true,
    sample: true,
  },
  {
    id: 'rev_4002',
    customer: 'Sample Customer — Beth K.',
    phone: '+15550119',
    service: 'Diagnostic & Repair',
    completedAt: hoursAgo(50),
    status: 'followed_up',
    requestedAt: hoursAgo(48),
    followUpAt: hoursAgo(6),
    smsConsent: true,
    sample: true,
  },
  {
    id: 'rev_4003',
    customer: 'Sample Customer — Chris N.',
    phone: '+15550120',
    service: 'System Install',
    completedAt: hoursAgo(5),
    status: 'pending', // service done, request not yet sent
    requestedAt: null,
    followUpAt: null,
    smsConsent: true,
    sample: true,
  },
];

const automations = [
  { id: 'auto_missedcall', name: 'Missed-call text-back', description: 'Texts missed callers within ~1 minute to find out what they need.', enabled: true, lastRun: hoursAgo(26), runsToday: 3, category: 'messaging' },
  { id: 'auto_reminders', name: 'Appointment reminders', description: 'Sends 24h and 2h reminders; lets customers confirm or reschedule.', enabled: true, lastRun: hoursAgo(4), runsToday: 5, category: 'scheduling' },
  { id: 'auto_reviews', name: 'Review requests', description: 'Sends a review link after completed service, with one gentle follow-up.', enabled: true, lastRun: hoursAgo(6), runsToday: 2, category: 'reputation' },
  { id: 'auto_estimate', name: 'Estimate follow-up', description: 'Follows up on unanswered quotes and notifies staff when a customer is ready.', enabled: true, lastRun: hoursAgo(12), runsToday: 1, category: 'sales' },
  { id: 'auto_reactivation', name: 'Lead reactivation', description: 'Reconnects with opted-in past customers eligible for seasonal service.', enabled: false, lastRun: hoursAgo(72), runsToday: 0, category: 'sales' },
  { id: 'auto_waitlist', name: 'Cancellation waitlist fill', description: 'Offers freed-up slots to the next waitlisted customer automatically.', enabled: true, lastRun: hoursAgo(30), runsToday: 0, category: 'scheduling' },
  { id: 'auto_afterhours', name: 'After-hours urgent routing', description: 'Detects urgent keywords after hours and routes to the on-call contact.', enabled: true, lastRun: hoursAgo(20), runsToday: 1, category: 'routing' },
  { id: 'auto_summary', name: 'Daily owner summary', description: 'Sends the owner a morning recap of calls, bookings, and leads needing attention.', enabled: true, lastRun: hoursAgo(3), runsToday: 1, category: 'reporting' },
];

const activity = [
  { id: 'act_1', ts: hoursAgo(1), type: 'reactivation', text: 'Lead reactivation queued seasonal tune-up offer for Carla D. (opted in).', sample: true },
  { id: 'act_2', ts: hoursAgo(2), type: 'booking', text: 'AI receptionist booked a Diagnostic & Repair for Maria G.', sample: true },
  { id: 'act_3', ts: hoursAgo(3), type: 'summary', text: 'Daily owner summary sent to Dana (Owner).', sample: true },
  { id: 'act_4', ts: hoursAgo(4), type: 'reminder', text: '24h reminder sent for tomorrow’s tune-up (Jordan P.).', sample: true },
  { id: 'act_5', ts: hoursAgo(6), type: 'review', text: 'Review request follow-up sent to Beth K.', sample: true },
  { id: 'act_6', ts: hoursAgo(20), type: 'routing', text: 'After-hours urgent call warm-transferred to On-call Tech.', sample: true },
  { id: 'act_7', ts: hoursAgo(26), type: 'messaging', text: 'Missed-call text-back sent to an after-hours caller; lead created.', sample: true },
];

function buildSeed() {
  return {
    meta: { seededAt: new Date().toISOString(), demo: true },
    business: JSON.parse(JSON.stringify(business)),
    calls: JSON.parse(JSON.stringify(calls)),
    leads: JSON.parse(JSON.stringify(leads)),
    appointments: JSON.parse(JSON.stringify(appointments)),
    reviews: JSON.parse(JSON.stringify(reviews)),
    automations: JSON.parse(JSON.stringify(automations)),
    activity: JSON.parse(JSON.stringify(activity)),
    // Consent ledger (phone -> { consent, updatedAt }) and message/booking
    // idempotency keys live here so opt-outs and de-duplication survive restarts.
    consent: {},
    sentKeys: {},
    // Per-caller SMS assistant state (keyed by phone) for multi-turn text-back.
    convos: {},
  };
}

module.exports = { buildSeed };
