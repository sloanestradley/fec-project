/**
 * races-resolver.js — FEC race layer + summary-tile render for the /races
 * location-search surface (Stages 2a–2b).
 *
 * Turns a geo-resolver result (from /api/geo/resolve) + an election cycle into
 * the set of federal races that touch a location, each as a SUMMARY TILE object
 * for the /races card: { office, state, district?, seatStatus, total, href } —
 * where seatStatus is raceSeatStatus()'s { kind, name? } object, not a string.
 *
 * The card is a summary (race identity + seat status + total) that links to
 * race.html for candidate detail — so the candidate array is used to DERIVE
 * seatStatus + total and then dropped, never retained or handed downstream
 * (race.html re-fetches independently). See strategy/location-search-races.md
 * "Stage-2 build decisions" + "Seat-status contract".
 *
 * Progressive render (2c) uses planRaces() + fetchRaceSummary() so each office
 * paints as its own /elections/ call lands. (A resolveRaces() Promise.all
 * convenience existed for "tests / non-progressive callers" and was deleted
 * 2026-07-16 — it never acquired a single consumer.)
 *
 * Standalone module (sankey.js precedent). Loaded by races.html AFTER utils.js —
 * references its globals: apiFetch, formatCandidateName, formatRaceName, fmt,
 * raceHref, and officeApiWord (the H/S/P→word map was lifted from here to
 * utils.js in 2c; race.html keeps its own inline copy for now).
 */

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

// Seat status for the summary tile — STRUCTURED (2026-07-16; was a display string
// under the 2026-07-08 contract). Returns { kind, name? }:
//   { kind:'none' }                  0 candidates (contested office, no filers)
//   { kind:'open' }                  >=1 candidate, 0 incumbents
//   { kind:'multiple' }              2+ distinct incumbents
//   { kind:'incumbent', name }       exactly 1 distinct incumbent (name may be '')
// Distinct count dedupes by normalized name so a duplicated incumbent record
// (same person, two candidate_ids) is 'incumbent', not 'multiple'.
//
// WHY STRUCTURED: `kind` is the stable, low-cardinality fact. Display copy and the
// Amplitude `seat_status` value both derive from it independently, so renaming a
// label can't silently rewrite the analytics enum (it did — the click event used to
// read the rendered DOM text), and re-adding incumbent names to the tile later is a
// render-only change with `name` already flowing.
function raceSeatStatus(candidates) {
  const arr = candidates || [];
  if (arr.length === 0) return { kind: 'none' };
  const incumbents = arr.filter(isIncumbentRow);
  if (incumbents.length === 0) return { kind: 'open' };
  const names = new Set(
    incumbents
      .map((c) => (c.candidate_name || c.name || '').trim().toUpperCase())
      .filter(Boolean)
  );
  if (names.size > 1) return { kind: 'multiple' };
  // `name` is display-ready but deliberately NOT rendered on the tile today — the
  // card shows no incumbent (a name beside the race-wide total read as though the
  // total were the incumbent's). Kept so adding it back is a render change only.
  return {
    kind: 'incumbent',
    name: formatCandidateName(incumbents[0].candidate_name || incumbents[0].name || ''),
  };
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
// card (kind 'none' → "No candidate filings"), never null.
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

// --- Presentation: summary tile (Stage 2b) ---

// Renders ONE /races summary tile — the sole render for the location-search
// surface. Race name on the left, the .race-row-meta slot on the right (seat
// status + total, muted-mono).
//
// SEAT STATUS IS MARK-THE-EXCEPTION (2026-07-16): only a notable seat state shows.
//   incumbent → NOTHING (total stands alone)
//   open      → "Open seat"           as a .tag.tag-neutral chip
//   multiple  → "Multiple incumbents" as a .tag.tag-neutral chip
//   none      → "No candidate filings" as plain meta text (an absence of data, not
//               a race attribute — so deliberately not a tag)
// The incumbent NAME was removed: two identically-styled spans ("Incumbent: X" next
// to the total) read as a subject-predicate pair, implying the total was that
// candidate's — but `total` is the race-wide un-deduped sum of EVERY candidate's
// receipts. Absence of a chip is now the only incumbency signal, by design.
// The chip's background matches .race-card:hover (both --surface-2), so it flattens
// into the row on hover — a known, accepted trade (same as .candidate-card's tags).
//
// .race-tile-seat is a TEST/QA hook only (no CSS of its own — it inherits
// .race-row-meta). The Amplitude click event no longer reads it: it reads the
// data-seat-kind attribute below, so display copy and the analytics enum are
// independent.
//
// STATE-DRIVEN: seatStatus == null → loading (race name paints immediately; the
// meta shows skeletons until that office's /elections/ call lands).
//
// race: { office, state, district?, seatStatus?, total?, href?, cycle? }
//   - seatStatus is raceSeatStatus()'s { kind, name? } object (NOT a string).
//   - resolved objects (from fetchRaceSummary) carry href.
//   - a loading placeholder may instead carry cycle so the tile is still a live
//     link to race.html while its data loads.
//   - total is OMITTED entirely when 0 (a no-filings race — "$0" would imply a
//     measured zero rather than nothing filed; the seat status stands alone).
function raceTileHTML(race) {
  const label = formatRaceName(race.office, race.state, race.district);
  const href = race.href || raceHref(race.office, race.state, race.district, race.cycle);
  const key = race.office + '|' + race.state + '|' + (race.district || '');
  const loading = race.seatStatus == null;

  let metaHtml;
  let kindAttr = '';
  if (loading) {
    metaHtml = '<div class="race-row-meta">'
      + '<span class="skeleton" style="width:110px;height:12px;display:inline-block"></span>'
      + '<span class="skeleton" style="width:100px;height:12px;display:inline-block"></span>'
      + '</div>';
  } else {
    const kind = race.seatStatus.kind;
    const total = race.total > 0 ? '<span>' + fmt(race.total) + ' raised</span>' : '';
    metaHtml = '<div class="race-row-meta">' + seatHTML(kind) + total + '</div>';
    kindAttr = ' data-seat-kind="' + kind + '"';   // omitted while loading → click logs null
  }

  return '<a class="race-card" href="' + href + '" data-race-key="' + key + '"' + kindAttr + '>'
    + '<div class="race-card-name">' + label + '</div>'
    + metaHtml
    + '</a>';
}

// Seat-status markup for one kind. '' for 'incumbent' (mark-the-exception — see
// raceTileHTML). Copy lives here alone; `kind` is the stable contract, so changing
// a label can't move the analytics enum.
function seatHTML(kind) {
  if (kind === 'open') {
    return '<span class="tag tag-neutral race-tile-seat">Open seat</span>';
  }
  if (kind === 'multiple') {
    return '<span class="tag tag-neutral race-tile-seat">Multiple incumbents</span>';
  }
  if (kind === 'none') {
    // plain text, not a tag — an absence of data rather than a race attribute
    return '<span class="race-tile-seat">No candidate filings</span>';
  }
  return '';   // 'incumbent' — no seat signal on the card
}
