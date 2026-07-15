/**
 * Cloudflare Pages Function — geocod.io geo resolver
 *
 * Resolves a US location (ZIP or full address) to the congressional
 * district(s), state(s), and applicable federal offices for a given election
 * cycle. Geographic normalization ONLY — Senate-up and race data are decided
 * downstream in the FEC layer (see strategy/location-search-races.md).
 *
 *   GET /api/geo/resolve?type=zip&q=98604&cycle=2026
 *   GET /api/geo/resolve?type=address&q=<urlenc address>&cycle=2024
 *
 * Returns the normalized resolve object, or { error } (200) for the typed
 * failure cases. The GEOCODIO_KEY secret is injected server-side and never
 * exposed. ZIP resolves are cached in GEO_CACHE (key geo:zip:{zip}:{congress});
 * address resolves are geocode-and-discard — never cached, never logged.
 *
 * Secret:   npx wrangler pages secret put GEOCODIO_KEY --project-name fecledgerapp
 * KV bind:  GEO_CACHE (manual dashboard step, like AGGREGATIONS) — optional for
 *           local dev / correctness; required only for production cache.
 */

const GEOCODIO_BASE = 'https://api.geocod.io/v2/geocode';
const MIN_CONGRESS = 113;   // geocod.io floor — 113th Congress = cycle 2012
const MAX_CONGRESS = 120;   // current highest available — 120th = cycle 2026
const TERRITORY_CODES = ['PR', 'GU', 'VI', 'AS', 'MP'];

// Cache TTLs (seconds): a past Congress's district lines are immutable; the
// current Congress is still "preview" and can be refined by a late redraw.
const TTL_PAST = 60 * 60 * 24 * 365;   // ~1 year
const TTL_CURRENT = 60 * 60 * 24 * 45; // 45 days

export async function onRequest(context) {
  const { request, env, params } = context;

  const segments = params.path
    ? (Array.isArray(params.path) ? params.path : [params.path])
    : [];
  if (segments.join('/') !== 'resolve') {
    return json({ error: 'unknown geo route' }, 404);
  }

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const q = (url.searchParams.get('q') || '').trim();
  const cycleRaw = url.searchParams.get('cycle');

  // --- validate input ---
  if (type !== 'zip' && type !== 'address') {
    return json({ error: 'invalid or missing type' }, 400);
  }
  if (!q) {
    return json({ error: 'missing q' }, 400);
  }
  if (type === 'zip' && !/^\d{5}$/.test(q)) {
    return json({ error: 'invalid zip' }, 400);
  }
  if (!cycleRaw || !/^\d{4}$/.test(cycleRaw)) {
    return json({ error: 'invalid or missing cycle' }, 400);
  }

  const cycle = parseInt(cycleRaw, 10);
  const congress = (cycle - 1786) / 2;

  // BELOW the geocod.io floor (pre-2012) or a non-integer congress → HARD reject,
  // never clamp (clamping would silently return a year the user didn't ask for).
  // This is genuinely no-data + no supported-cycle intent — not degrade-able.
  if (!Number.isInteger(congress) || congress < MIN_CONGRESS) {
    return json({ error: 'cycle_out_of_range', cycle }, 200);
  }

  // ABOVE the highest available congress (a future cycle whose district lines
  // aren't published yet) → DEGRADE, don't reject (Stage 2). Districts are
  // House-only + cycle-variant; states / Senate / President are cycle-invariant
  // geographically, so we still resolve everything that doesn't need a district.
  // Implementation: a state-only geocode (NO cd append) fed to the SAME normalize
  // — it already yields districts:[] + offices without 'H' when no
  // congressional_districts come back, so the in-range path is untouched. The
  // future resolve is deliberately NOT cached (a cached districts:[] shape would
  // go stale the moment this congress's district data lands and MAX_CONGRESS is
  // bumped; future searches are rare, so geocode-fresh-don't-persist). No
  // absurd-year ceiling here — the per-office year-selector cap is races.html's
  // job; a hand-typed far-future year self-corrects downstream (FEC returns
  // empty → empty state). NB: a future multi-state border ZIP resolves to the
  // centroid state only (the neighbor-state signal lives in district ocd_ids,
  // which we don't fetch without cd) — accepted edge-of-an-edge.
  const futureCycle = congress > MAX_CONGRESS;
  const cdField = futureCycle ? null : 'cd' + congress;

  // --- cache check (ZIP only; never for the future-cycle degrade — see above) ---
  const cacheKey = type === 'zip' && !futureCycle ? `geo:zip:${q}:${congress}` : null;
  if (cacheKey && env.GEO_CACHE) {
    const hit = await env.GEO_CACHE.get(cacheKey, { type: 'json' });
    if (hit) return json(hit, 200);
  }

  // --- geocode ---
  let geo;
  try {
    const gUrl = new URL(GEOCODIO_BASE);
    gUrl.searchParams.set('q', q);
    if (cdField) gUrl.searchParams.set('fields', cdField); // omitted on future-cycle state-only resolve
    gUrl.searchParams.set('api_key', env.GEOCODIO_KEY);
    const resp = await fetch(gUrl.toString(), { headers: { 'User-Agent': 'FECLedger/1.0' } });
    // 402 = over quota, 429 = rate limited, 5xx = geocod down → typed, no retry.
    if (resp.status === 402 || resp.status === 429 || resp.status >= 500) {
      return json({ error: 'geocoder_unavailable' }, 200);
    }
    geo = await resp.json();
  } catch (e) {
    return json({ error: 'geocoder_unavailable' }, 200);
  }

  // geocod.io returns an { error } object (HTTP 200) for ungeocodable input.
  if (!geo || geo.error || !Array.isArray(geo.results) || geo.results.length === 0) {
    return json({ error: 'not_found' }, 200);
  }

  // --- accuracy gate (BEFORE normalize) ---
  // ZIP is format-pre-gated; a returned result already means a hit (place-or-
  // better is fine — the check only catches a geocoder miss). An address must
  // pin to rooftop/range; a place-level (centroid) match wasn't pinned → reject
  // without doing the normalize/union work.
  if (type === 'address') {
    const at = geo.results[0].accuracy_type;
    if (at !== 'rooftop' && at !== 'range') {
      return json({ error: 'low_accuracy' }, 200);
    }
  }

  const norm = normalize(geo, cycle, congress, type);

  // --- cache write (ZIP only, never address) — fire-and-forget ---
  if (cacheKey && env.GEO_CACHE) {
    const ttl = congress < MAX_CONGRESS ? TTL_PAST : TTL_CURRENT;
    context.waitUntil(env.GEO_CACHE.put(cacheKey, JSON.stringify(norm), { expirationTtl: ttl }));
  }

  return json(norm, 200);
}

/**
 * Build the normalized resolve object from a geocod.io response.
 * Geographic only — no Senate-up, no race data.
 */
function normalize(geo, cycle, congress, inputType) {
  const results = geo.results;

  // geocod echoes the Congress it resolved against in each district
  // (e.g. "119th"). Surface it so the caller can confirm the cycle→Congress
  // conversion was honored end-to-end (a wrong-by-one field often returns the
  // same district by luck; this is the direct check). Null on DC/territory
  // edges that carry no standard district.
  let congressNumber = null;
  for (const r of results) {
    const cds = (r.fields && r.fields.congressional_districts) || [];
    for (const c of cds) {
      if (c.congress_number) { congressNumber = c.congress_number; break; }
    }
    if (congressNumber) break;
  }

  // Collect the state set from BOTH address_components.state_province (always
  // present, v2 field name) AND each district's ocd_id — the latter catches the
  // one-result-two-states shape (42223 → a single result whose district array
  // spans TN + KY). Looking at results[0] alone would miss it.
  const stateSet = new Set();
  for (const r of results) {
    const st = r.address_components && r.address_components.state_province;
    if (st) stateSet.add(st);
    const cds = (r.fields && r.fields.congressional_districts) || [];
    for (const c of cds) {
      const os = stateFromOcdId(c.ocd_id);
      if (os) stateSet.add(os);
    }
  }
  const states = [...stateSet];

  // --- DC / territory classification (BEFORE district work), by STATE CODE ---
  // Robust even if a territory returns no congressional_districts. DC's own
  // ocd_id is …/district:dc/… (not state:XX), so it's caught here via
  // state_province='DC', not by the district parser.
  if (states.length === 1 && states[0] === 'DC') {
    return baseObj(inputType, cycle, congress, congressNumber, ['P'], ['DC'], [], { dc: true });
  }
  if (states.some((s) => TERRITORY_CODES.includes(s))) {
    return baseObj(inputType, cycle, congress, congressNumber, [], states, [], { territory: true });
  }

  // --- House districts: union across all results + all districts ---
  const districts = [];
  const seen = new Set();
  for (const r of results) {
    const fallbackState = r.address_components && r.address_components.state_province;
    const cds = (r.fields && r.fields.congressional_districts) || [];
    for (const c of cds) {
      // Defensive: a non-voting delegate district (>= 90) is not a House race.
      if (typeof c.district_number === 'number' && c.district_number >= 90) continue;
      const st = stateFromOcdId(c.ocd_id) || fallbackState;
      const num = normalizeDistrictNumber(c);
      if (!st || num == null) continue;
      const key = st + '-' + num;
      if (!seen.has(key)) {
        seen.add(key);
        districts.push({ state: st, number: num });
      }
    }
  }

  // Cycle-aware office set: P only in presidential cycles; H if any district
  // resolved; S is geographic (Senate-up is decided in the FEC layer).
  const offices = [];
  if (districts.length > 0) offices.push('H');
  offices.push('S');
  if (cycle % 4 === 0) offices.push('P');

  return baseObj(inputType, cycle, congress, congressNumber, offices, states, districts, {
    multi_state: states.length > 1,
    multi_district: districts.length > 1,
  });
}

function baseObj(inputType, cycle, congress, congressNumber, offices, states, districts, flagOverrides) {
  return {
    input_type: inputType,
    cycle,
    congress,
    congress_number: congressNumber,
    offices,
    states,
    districts,
    flags: Object.assign(
      { multi_state: false, multi_district: false, dc: false, territory: false },
      flagOverrides || {}
    ),
  };
}

// Extract the 2-letter state from a district ocd_id, e.g.
// "ocd-division/country:us/state:tn/cd:7" → "TN". Returns null when absent
// (historical congresses return ocd_id: null; DC uses …/district:dc/…).
function stateFromOcdId(ocdId) {
  if (!ocdId) return null;
  const m = ocdId.match(/\/state:([a-z]{2})\//);
  return m ? m[1].toUpperCase() : null;
}

// Normalize a district to a 2-char FEC-style string. At-large → "00" (both the
// current-congress form — district_number 0 + ocd_id …/cd:at-large — and the
// historical form, where ocd_id is null and the only signal is the name
// "…(at Large)"). Otherwise zero-pad the number ("7" → "07").
function normalizeDistrictNumber(c) {
  const num = c.district_number;
  const name = c.name || '';
  const atLarge =
    num === 0 ||
    (typeof c.ocd_id === 'string' && c.ocd_id.endsWith('cd:at-large')) ||
    /at\s*large/i.test(name);
  if (atLarge) return '00';
  if (num == null) return null;
  return String(num).padStart(2, '0');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
