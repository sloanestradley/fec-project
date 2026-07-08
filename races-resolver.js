/**
 * races-resolver.js — FEC race layer + summary-tile render for the /races
 * location-search surface (Stages 2a–2b).
 *
 * Turns a geo-resolver result (from /api/geo/resolve) + an election cycle into
 * the set of federal races that touch a location, each as a SUMMARY TILE object
 * for the /races card: { office, state, district?, seatStatus, total, href }.
 *
 * The card is a summary (race identity + seat status + total) that links to
 * race.html for candidate detail — so the candidate array is used to DERIVE
 * seatStatus + total and then dropped, never retained or handed downstream
 * (race.html re-fetches independently). See strategy/location-search-races.md
 * "Stage-2 build decisions" + "Seat-status contract".
 *
 * Progressive render (2c) uses planRaces() + fetchRaceSummary() so each office
 * paints as its own /elections/ call lands; resolveRaces() is a Promise.all
 * convenience for tests / non-progressive callers.
 *
 * Standalone module (sankey.js precedent). Loaded by races.html AFTER utils.js —
 * references its globals: apiFetch, formatCandidateName, raceHref. The office
 * word map is defined locally to keep the module self-contained (it is also
 * inlined in race.html + races.html today — lifting the three copies to utils.js
 * is a banked follow-on cleanup, out of 2a scope).
 */

// Office code → /elections/ word param. /elections/ requires the lowercase full
// word (house/senate/president), NOT the H/S/P code (which 422s). See CLAUDE.md.
function officeApiWord(o) {
  return { H: 'house', S: 'senate', P: 'president' }[o] || String(o).toLowerCase();
}

// --- Pure derivation (unit-testable: candidate array in, card fields out) ---

// Race total = sum of every candidate's total_receipts, UN-deduped (surface what
// FEC reports — $0 filers and occasional duplicate candidate records included).
function raceTotalReceipts(candidates) {
  return (candidates || []).reduce((sum, c) => sum + (Number(c.total_receipts) || 0), 0);
}

// Dual-field incumbent test (per race.html): /elections/ returns
// incumbent_challenge_full ('Incumbent'); the mock/other endpoints use the
// short code incumbent_challenge ('I').
function isIncumbentRow(c) {
  return !!c && (c.incumbent_challenge_full === 'Incumbent' || c.incumbent_challenge === 'I');
}

// Seat status for the summary tile (FINAL contract, 2026-07-08):
//   0 candidates            → "No candidates reported"  (contested office, no filers)
//   >=1 candidate, 0 incs   → "Open seat"
//   exactly 1 distinct inc  → "Incumbent: {name}"
//   2+ distinct incumbents  → "Multiple incumbents"     (names live on race.html)
// Distinct count dedupes by normalized name so a duplicated incumbent record
// (same person, two candidate_ids) reads "Incumbent: X", not "Multiple".
function raceSeatStatus(candidates) {
  const arr = candidates || [];
  if (arr.length === 0) return 'No candidates reported';
  const incumbents = arr.filter(isIncumbentRow);
  if (incumbents.length === 0) return 'Open seat';
  const names = new Set(
    incumbents
      .map((c) => (c.candidate_name || c.name || '').trim().toUpperCase())
      .filter(Boolean)
  );
  if (names.size > 1) return 'Multiple incumbents';
  const nm = formatCandidateName(incumbents[0].candidate_name || incumbents[0].name || '');
  return nm ? 'Incumbent: ' + nm : 'Incumbent';
}

// --- Fetch plan (pure: geo + cycle → the list of /elections/ calls to make) ---

// Geographic only, from the geo resolver. House: one per district. Senate: one
// per state (DC skipped — no voting Senate). President: only in presidential
// cycles (cycle % 4 === 0), national (state=US). Territory / error geo → none.
function planRaces(geo, cycle) {
  if (!geo || geo.error) return [];
  if (geo.flags && geo.flags.territory) return [];
  const plan = [];
  for (const d of geo.districts || []) {
    plan.push({ office: 'H', state: d.state, district: d.number });
  }
  for (const st of geo.states || []) {
    if (st === 'DC') continue;
    plan.push({ office: 'S', state: st, district: null });
  }
  if (cycle % 4 === 0) {
    plan.push({ office: 'P', state: 'US', district: null });
  }
  return plan;
}

// --- Orchestration (one /elections/ call per plan item → summary tile) ---

// Returns the summary tile object, or null for an "office-absent" result — an
// empty Senate/President call means that seat isn't up this cycle, so no card.
// House is always contested (biennial), so an empty House call still returns a
// card ("No candidates reported"), never null.
async function fetchRaceSummary(item, cycle) {
  // House/Senate candidate lists are well under 100 (fully captured). President
  // can exceed it (869 filers in 2024) — but only ~115 have any money (receipts
  // hit $0 at rank 116). per_page=200 (one call — /elections/ honors it) sorted
  // by receipts desc covers the ENTIRE funded field with wide margin, so the
  // total is EXACT (top-200 − top-100 was $6,397; 200→300 is $0) and every
  // incumbent is present (incumbents are top fundraisers). The ~669 skipped rows
  // are provably $0. Revisit only if a cycle pushes funded presidential filers
  // past ~200.
  const params = {
    state: item.state,
    cycle: String(cycle),
    office: officeApiWord(item.office),
    per_page: 200,
    sort: '-total_receipts',
  };
  if (item.office === 'H' && item.district) params.district = item.district;

  const data = await apiFetch('/elections/', params);
  const candidates = (data && data.results) || [];

  if (candidates.length === 0 && item.office !== 'H') return null; // not up → drop

  return {
    office: item.office,
    state: item.state,
    district: item.district || null,
    seatStatus: raceSeatStatus(candidates),
    total: raceTotalReceipts(candidates),
    href: raceHref(item.office, item.state, item.district, cycle),
  };
}

// Convenience: resolve every race at once. 2c uses planRaces + fetchRaceSummary
// directly for progressive per-office reveal; this Promise.all form is for tests
// and non-progressive callers. Office-absent (null) and failed calls are dropped
// — per-office error UX is 2c's job on the progressive path.
async function resolveRaces(geo, cycle) {
  const plan = planRaces(geo, cycle);
  const settled = await Promise.all(
    plan.map((item) => fetchRaceSummary(item, cycle).catch(() => null))
  );
  return settled.filter((r) => r !== null);
}

// --- Presentation: summary tile (Stage 2b) ---

// Renders ONE /races summary tile — the sole render for the location-search
// surface (it replaces the browse row once 2c retires it). It is today's browse
// .race-card ESSENTIALLY UNCHANGED: race name on the left, the .race-row-meta
// slot on the right — with the candidate COUNT replaced by the SEAT STATUS
// (total stays beside it, same muted-mono styling). No new CSS; the .race-tile-
// seat class on the seat span is a bare JS/test hook (no style of its own — it
// inherits .race-row-meta), used by 2c's progressive swap.
//
// STATE-DRIVEN, mirroring the browse card's candidateCount===null skeleton:
// seatStatus == null → loading (race name paints immediately; the meta shows
// skeletons until that office's /elections/ call lands); non-null → resolved.
//
// race: { office, state, district?, seatStatus?, total?, href?, cycle? }
//   - resolved objects (from fetchRaceSummary) carry href.
//   - a loading placeholder may instead carry cycle so the tile is still a live
//     link to race.html while its data loads.
//   - seatStatus is already fully formatted by raceSeatStatus() (incl. the
//     formatCandidateName pass) — rendered verbatim; the tile has no name logic.
//   - total is OMITTED entirely when 0 (a "No candidates reported" race — "$0"
//     would imply a measured zero rather than nothing filed; seat status stands
//     alone in the meta, matching the browse card's falsy-total suppression).
function raceTileHTML(race) {
  const label = formatRaceName(race.office, race.state, race.district);
  const href = race.href || raceHref(race.office, race.state, race.district, race.cycle);
  const key = race.office + '|' + race.state + '|' + (race.district || '');
  const loading = race.seatStatus == null;

  let metaHtml;
  if (loading) {
    metaHtml = '<div class="race-row-meta">'
      + '<span class="skeleton" style="width:110px;height:12px;display:inline-block"></span>'
      + '<span class="skeleton" style="width:100px;height:12px;display:inline-block"></span>'
      + '</div>';
  } else {
    const total = race.total > 0 ? '<span>Total raised: ' + fmt(race.total) + '</span>' : '';
    metaHtml = '<div class="race-row-meta">'
      + '<span class="race-tile-seat">' + race.seatStatus + '</span>'
      + total
      + '</div>';
  }

  return '<a class="race-card" href="' + href + '" data-race-key="' + key + '">'
    + '<div class="race-card-name">' + label + '</div>'
    + metaHtml
    + '</a>';
}
