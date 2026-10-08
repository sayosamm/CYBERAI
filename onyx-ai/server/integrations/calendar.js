'use strict';
/**
 * Calendar boundary (booking, reminders, rescheduling, waitlist fill).
 *
 * Default: SIMULATION — bookings live in the local store only. No external
 * calendar is touched.
 *
 * LIVE implementation (Google Calendar) — verify before wiring:
 *   https://developers.google.com/workspace/calendar/api/guides/create-events
 *   const { google } = require('googleapis');
 *   const auth = new google.auth.GoogleAuth({
 *     keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
 *     scopes: ['https://www.googleapis.com/auth/calendar'],
 *   });
 *   const calendar = google.calendar({ version: 'v3', auth });
 *   await calendar.events.insert({
 *     calendarId: process.env.GOOGLE_CALENDAR_ID,  // share this calendar with the service account
 *     requestBody: {
 *       summary, description,
 *       start: { dateTime, timeZone }, end: { dateTime, timeZone },
 *     },
 *   });
 * NOTE: `calendarId: 'primary'` is the service account's own calendar — use the
 * shared business calendar id instead. Microsoft Graph is an alternative.
 */
const { mode } = require('../lib/env');

/** Prevent double-booking: no overlapping confirmed/pending appt on same slot. */
function hasConflict(appointments, { start, end, excludeId }) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return appointments.some((a) => {
    if (a.id === excludeId) return false;
    if (a.status === 'cancelled') return false;
    const as = new Date(a.start).getTime();
    const ae = new Date(a.end).getTime();
    return s < ae && e > as; // overlap
  });
}

async function createEvent(business, appt) {
  if (mode() === 'live') {
    throw new Error('LIVE calendar not enabled: wire Google Calendar and obtain approval before creating real events.');
  }
  return { ok: true, simulated: true, externalId: null };
}

module.exports = { hasConflict, createEvent };
