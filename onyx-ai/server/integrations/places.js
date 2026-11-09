'use strict';
/**
 * Lead finder — searches for local businesses to prospect.
 *
 * Default: SAMPLE mode (no key) returns clearly-labeled example businesses so
 * the Prospecting tab is fully usable in the demo. LIVE mode uses the Google
 * Places API (New) Text Search when GOOGLE_PLACES_API_KEY is set.
 *
 * Verify the current request/response shape before relying in production:
 *   https://developers.google.com/maps/documentation/places/web-service/text-search
 *   POST https://places.googleapis.com/v1/places:searchText
 *   headers: X-Goog-Api-Key: <key>
 *            X-Goog-FieldMask: places.id,places.displayName,places.nationalPhoneNumber,places.websiteUri,places.rating,places.formattedAddress
 *   body: { "textQuery": "electricians in Austin, TX" }
 *
 * NOTE: use the official API — do not scrape Google Maps (it violates their ToS).
 */
const { clampStr } = require('../lib/util');

function hasKey() {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

/** Live Google Places (New) Text Search. Returns [] on any error. */
async function liveSearch(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.nationalPhoneNumber,places.websiteUri,places.rating,places.formattedAddress',
      },
      body: JSON.stringify({ textQuery: query }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.places)) {
      return { ok: false, error: (data.error && data.error.message) || `http_${res.status}`, results: [] };
    }
    const results = data.places.map((p) => ({
      externalId: p.id || '',
      name: (p.displayName && p.displayName.text) || 'Unknown business',
      phone: p.nationalPhoneNumber || '',
      website: p.websiteUri || '',
      rating: typeof p.rating === 'number' ? p.rating : null,
      address: p.formattedAddress || '',
      sample: false,
    }));
    return { ok: true, results, live: true };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message, results: [] };
  } finally {
    clearTimeout(timer);
  }
}

/** Deterministic sample businesses for the demo (no external calls). */
function sampleSearch(trade, city) {
  const t = (trade || 'business').trim();
  const c = (city || 'your area').trim();
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  const names = ['Summit', 'Reliable', 'Gold Star', 'Allstar', 'Hometown', 'Apex', 'Premier', 'Rapid'];
  const suffix = /electr/i.test(t) ? 'Electric' : /plumb/i.test(t) ? 'Plumbing' : /hvac|heat|air/i.test(t) ? 'Heating & Air' : /clean/i.test(t) ? 'Cleaning Co.' : /detail|auto/i.test(t) ? 'Auto Detailing' : cap;
  const results = names.slice(0, 6).map((n, i) => ({
    externalId: `sample_${i}`,
    name: `${n} ${suffix}`,
    phone: `(555) 01${String(10 + i).padStart(2, '0')}`,
    website: `https://${n.toLowerCase()}${suffix.replace(/[^a-z]/gi, '').toLowerCase()}.com`,
    rating: +(3.9 + (i % 5) * 0.2).toFixed(1),
    address: `${100 + i * 7} Main St, ${c}`,
    sample: true,
  }));
  return { ok: true, results, live: false };
}

async function searchLeads(trade, city) {
  const query = `${clampStr(trade, 60)} in ${clampStr(city, 80)}`.trim();
  if (hasKey()) {
    const live = await liveSearch(query);
    // Fall back to sample if the live call failed, so the tab still works.
    if (live.ok) return live;
    return { ...sampleSearch(trade, city), liveError: live.error };
  }
  return sampleSearch(trade, city);
}

module.exports = { searchLeads, hasKey };
