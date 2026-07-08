# FECLedger — Location search for races.html (Address / City+State / ZIP → races)

> **STATUS: INVESTIGATION / PROPOSAL — UNEXECUTED.** Prepared 2026-06-12 as a research handoff to bring to Claude Chat for open-item discussion. No code written. FEC behavior verified live against the deployed FEC proxy (`fecledgerapp.pages.dev/api/fec/*`); **geocod.io behavior verified live with a real key (2026-06-12), and the golden cases re-verified against the v2 API — BUILD ON v2** (`https://api.geocod.io/v2/geocode`). See "Verified response contract" and "v2 contract deltas" below. Self-contained; no prior context needed. **BUILD PLAN APPROVED 2026-07-08 — see the "Build plan" section (it supersedes the Open items where noted); Stage 1 (geo resolver) is next, pending the resolver-plan review gate.**

---

## The reframe

**Replace** races.html's current browse entirely. The old surface — show all races for a cycle, enrich each row's totals on scroll (IntersectionObserver + localStorage), filter by office/state — **is retired**. The new landing is a **location search + an election-year selector (defaulted to the current cycle)**: the user enters a ZIP, City+State (typeahead-picked), or full street address, and sees the federal races that touch that place for the selected year. (Address is the precision tier — see §3b; ZIP/City use pre-submit gates, address validates post-submit.) The question a strategist/voter actually asks is *"what federal races touch this place?"* — a search, not a browse-and-narrow.

**What this retires:** the all-races enumeration via `/elections/search/?cycle=X`, the per-row IntersectionObserver enrichment, and the localStorage race cache all go away as the *primary* surface. The new flow resolves a location → `(state, district(s), cycle)` and then fetches only the **specific** resolved races via `/elections/` (House: state+district; Senate: state; President: national) — a handful of targeted calls instead of ~475 enumerated rows. (`/elections/search/` may still have a minor role — e.g. confirming a resolved House district actually fielded a contest that cycle — but it is no longer the landing's spine.)

**Default / pre-search state** (no location entered yet): **bare for v1** (a simple search prompt, no populated default — resolved, open item #8). A "top races by spending this cycle" hero is a planned follow-up (Follow-on work), tying to the earlier same-session investigation.

Sloane's locked calls for v1:
- **Location search REPLACES the browse** — it is the landing, not an addition. Election-year selector defaults to the current cycle; a typeahead drives the location input.
- **Cycle correctness is a hard requirement** (a 2018 search must return 2018's district lines, not today's).
- **City+State or ZIP** as the inputs (overlapping representation across a ZIP/city is accepted).
- **Route the geocoder through a Cloudflare Function** (server-side key + privacy).
- **geocod.io** as the provider (key provisioned 2026-06-12; API verified live).
- Dig deeper on **cost at scale**, **maintenance cadence (automate where possible)**, and the **Senate edge case**.

---

## Build plan (APPROVED 2026-07-08 — supersedes Open items where noted)

> Locked in review 2026-07-08 and authoritative where it conflicts with the "Open items" section below. The investigation sections (core insight, architecture §1–7, §4/§4b, test corpus, v2 deltas) remain the reference detail this plan draws on. **No code yet** — the Stage-1 resolver approach is posted here for review; gate before implementing.

### Locked decisions (post-review)

- **v1 inputs = ZIP + full address only.** City DEFERRED to ride in with the ZIP→district precompute (the only point it's completeness-honest). *(supersedes #6, #12)*
- **Address** = plain-text field; validate **post-submit** on `accuracy_type` (require `rooftop`/`range`; reject `place`/error); geocode-and-discard; **no** caching of raw addresses; **no** autocomplete. *(supersedes #12)*
- **`accuracy_type` is input-type-dependent (correctness):** **ZIP accepts `place`** (the correct accuracy for a ZIP — a uniform rooftop/range gate would reject *every* ZIP search); **address requires `rooftop`/`range`**.
- **Cost = cache-on-miss for v1**; precompute banked as a lever, not built now. *(supersedes #3)*
- **Multi-state ZIP = detect + label, share-ordered**; never show a neighbor state's race as the user's. Label is **cycle-aware per state** for Senate — a state whose seats aren't up renders no Senate card (true + silent by construction; S3 adds the explanation). *(supersedes #10)*
- **DC → President-only** (surfacing the non-voting delegate optional); **territories (`district ≥ 90`) → graceful "no federal races" empty state.** *(supersedes #11)*
- **Retirement = CLEAN replacement, folded into Stage 2.** No surviving browse affordance.
- **Race-card contract (net-new):** each resolved race **leads with seat status** — "Open seat" or "Incumbent: [Name]." Rule: any candidate row `incumbent_challenge_full === 'Incumbent'` → incumbent (show the name); zero Incumbent rows → open seat. (Field ∈ {Incumbent, Challenger, Open seat}; don't require all rows to agree — a stray "Challenger" row is fine.) Show **race total = Σ candidate `total_receipts`.**
- **No editorializing the candidate set:** no receipts-threshold filter, no name-match dedupe. $0 filers and duplicate candidate records (same person, two `candidate_id`s) are surfaced as FEC reports them. *(Accepted consequence: the race total can double-count a duplicated candidate.)*
- **Single-candidate races render as-is** (safe seats, e.g. GA-05) — honest, not an error state.
- **Senate two-race collapse = detect + caption, no split.** Caption pulled into **Stage 2** (see caption note). Same combined candidate list; no per-contest split/totals/filter.

### Corrected S1 resolver contract

The `/api/geo/` resolver returns **geographic normalization only.** `senate_up` is **NOT** here — it's derived in the FEC race layer from `/elections/?office=senate&state=X&cycle=Y` non-empty (concern A). Normalized output:

```
{
  input_type: 'zip' | 'address',
  cycle, congress,                 // congress = (cycle − 1786)/2 → single fields=cd{congress}
  congress_number,                 // geocod's echo ("119th") — asserts the conversion was honored end-to-end
  offices: ['H', ...],             // cycle-aware: 'P' only in presidential cycles (cycle % 4 == 0);
                                   //   'S'/'H' are geographic — Senate-up is decided in the FEC layer
  states:    ['KY','TN'],          // union across results[] AND each result's district ocd_id states
  districts: [ {state:'TN', number:'07'}, {state:'KY', number:'01'} ],   // at-large → '00'
  flags:  { multi_state, multi_district, dc, territory },
  error?: 'not_found' | 'low_accuracy' | 'geocoder_unavailable' | 'cycle_out_of_range'
}
// DC → valid resolve: offices:['P'], flags.dc (NOT an error). Territory → valid
// resolve: offices:[], flags.territory (UI renders the graceful empty state).
// DC/territory are classified by STATE CODE (DC / PR,GU,VI,AS,MP), robust even if
// a territory returns no districts — not by district_number alone.
```

Normalization rules live in the mapping-rules block + §4/§4b: at-large `0 → "00"` (+ historical `name`-based detection when `ocd_id` is null); DC (`district 98`, ocd_id `…/district:dc/…`) + territory (`district ≥ 90`) classified **before** the state-union (concern E — DC's ocd_id is not `state:XX`); multi-state union across **both** `results[]` and per-result districts (concern from §4b).

### Three stages

**Stage 1 — Geo resolver proxy (`functions/api/geo/[[path]].js`). Additive, no UI. → ships to main independently.**
Location → the normalized object above. Cache-on-miss for ZIP; address geocode-and-discard. Stop = every golden case in the test corpus resolves correctly via curl against `wrangler pages dev`. Detailed approach + setup timing in "Stage-1 resolver — approach" below (review gate before implement).

**Stage 2 — The replacement (input UI + FEC race layer + render). This IS the retirement.**
- **FEC race layer:** resolved districts/states/offices → parallel `/elections/` calls (office conversion + district `'00'` per race.html conventions) → race objects with seat-status + total. `senate_up` = non-empty senate result. **Cycle-aware office presence** (concern C): President only in presidential cycles; Senate only where up — absence is a first-class "No [office] race in [ST] this cycle" line, not an error.
- **Year selector:** floor **2012** (cd113); ceiling per-office reusing race.html (House=current, Senate+4, Pres+2) (concern F). **Year-change = full re-resolve** — district is cycle-variant via redraw (concern D). **Future-cycle × per-office ceiling (contract note, from the 2026-07-08 review):** the resolver is House-district-only, but the per-office ceiling can legitimately offer a future cycle (e.g. 2028 President/Senate) whose House `cd` isn't published yet. Stage 1 rejects those (`cycle_out_of_range`, upper bound); **Stage 2 replaces the upper-bound reject with a state-only resolve** (House n/a this cycle; Senate/President still shown, since neither needs a district). Don't hard-reject a valid future President/Senate result.
- **Race-result card:** net-new component (seat-status header + race total + nested `candidateCardHTML` rows) → needs a design-system entry + tests.
- **Multi-district built real** (all N House cards — ~20% of ZIPs, not an edge) (concern B). **Input cue** "races for your exact address" vs "all races in ZIP X" (concern H).
- **Deletes the entire browse surface:** IntersectionObserver/`enrichRace`, `lf:race` read+write, `/elections/search/` enumeration, `fetchAllRaces`/`fetchGeneration`, filters/`applyFilters`, chips, filter URL-sync/`updateURL`, `populateCycles`, the three filter combos. **Keep** shared utils (`formatRaceName`, `initComboDropdown`, `apiFetch`, `fmt`, `.race-card` CSS — used elsewhere). Update `shared.spec.js` races.html structural assertions + add a **geocod.io mock** mirroring `tests/helpers/api-mock.js` (concern G).
- Degradation states per the approved table below (Group 1 real; Group 2 = multi-state state-grouped, Senate-collapse captioned).
Stop = the browse is gone; ZIP + address + year selector render seat-status race cards across single/multi-district, single/multi-state, office-absent, DC, territory, and all error states.

**Stage 3 — Edge hardening on the live surface.**
Multi-state **cycle-aware Senate explanation** (make the silent omission explicit); Senate-collapse caption **detection enabled** (post-verification — see caption note); Amplitude events for the new surface; card polish. The caption *markup* ships in S2.

### Degradation states (approved 2026-07-08)

**Group 1 — built *real* in S2 (not degradation; listed because they were named):**

| Edge | Frequency | S2 renders | Honest? |
|---|---|---|---|
| Multi-district | ~20% of ZIPs | All N House races, each a full seat-status card | ✅ Real, not degraded (concern B) |
| Office absent (Senate not up / midterm President) | every search | Section omitted; quiet "No [office] race in [ST] this cycle" | ✅ True omission, never a false card (concern C) |
| DC | rare | President-only (delegate optional); House/Senate omitted | ✅ It *is* president-only |
| Territory (`district ≥ 90`, non-DC) | rare | "No federal races on FECLedger for this location" | ✅ Honest empty state |
| not-found (ungeocodable) | input error | S1 `error:'not_found'` → "We couldn't find that location" | ✅ Designed error |
| geocoder-unavailable (geocod 5xx/quota) | infra | S1 `error:'geocoder_unavailable'` → "Location lookup temporarily unavailable" | ✅ Designed error |
| low-accuracy address | address input | S1 `error:'low_accuracy'` → "Enter a more specific address" | ✅ Designed error (the address gate) |

**Group 2 — genuinely degraded in S2, hardened in S3:**

| Edge | Frequency | S2 renders | Clears "honest-or-not-at-all"? | S3 hardening |
|---|---|---|---|---|
| Multi-state ZIP | dozens of ZIPs | Races **grouped under each state header** ("Kentucky races" / "Tennessee races"); each state's Senate card appears only if up (via concern C). No false "your Senate race"; omission is silent. | ✅ State-scoped grouping is true; never a neighbor's race *as theirs*. Lacks only the explanatory callout. | Cycle-aware caption ("KY has a Senate race this cycle; TN's seats aren't up") — makes the silent omission explicit. |
| Senate two-race collapse | rare + **past cycles only** | Collapsed single card + combined candidate list, **plus the static caption** (pulled forward — see note) | ✅ Now genuinely-honest (not merely-not-false): the caption states two contests are shown together. | Nothing structural — caption's *detection* is enabled post-`/election-dates/` verification. |

### Senate-collapse caption — build in S2, detection-dark until verified

Caption ships in **Stage 2** (rare + past-cycles-only → cheap, and it pulls the whole S2 window up into the genuinely-honest tier). It is **one static explanatory line** — same combined candidate list, **no** split, no per-contest totals, no filtering. Copy (illustrative): *"[State] held two U.S. Senate elections in [year] — a regular and a special; candidates for both are shown together."* The split stays deferred to the Senate term-class work.

**Trigger is gated on verification (the risk is the enum, not the text):** detection rule = **both a general `G` AND a special `SG`/`SP`** present for the state/cycle in `/election-dates/` → two contests. Must **NOT** fire on a special-only cycle (AZ 2020 = one contest) nor any normal single-race state. The exact `election_type_id` values are **not yet verified live** (Chat runs it; Chrome was down). So: **the caption's detection must be confirmed against real `/election-dates/` data before it goes live** — don't wire a shipped caption to an unverified enum. **Ordering (Sloane's to sequence):** S2 may ship with detection **dark** (caption markup present, trigger disabled), enabled the moment the enum is confirmed.

### Concerns ledger (resolved in this plan)

A senate_up → FEC layer (not geo) · B multi-district is common → built real · C office-presence cycle-dependent → absence is first-class · D year-change = full re-resolve · E classify DC/territory before the state-union · F per-office year ceiling from race.html · G geocod mock + shared.spec updates in-scope · H address-vs-ZIP count cue.

### Stage-1 resolver — approach (review gate before implement)

- **File/deploy:** `functions/api/geo/[[path]].js`; `onRequest(context)` + a `jsonResponse()` helper matching the FEC + aggregations Functions. Ships via `cp -R functions` in `stage-site.sh` — **no allowlist edit required** (add to the `critical_paths` sanity sample as hygiene).
- **Route:** `GET /api/geo/resolve?type=zip&q=98604&cycle=2026` (or `type=address&q=…`). `400` on malformed (aggregations convention).
- **Server responsibilities:** validate by type → `cycle → congress → cd{congress}` (single field; **out-of-range → typed reject `cycle_out_of_range`, never clamp** — clamping silently returns a year the user didn't ask for) → cache check (ZIP only) → geocod `/v2/geocode` with `GEOCODIO_KEY` server-side, `fields=cd{congress}` → geocod error-object/no-results → `not_found` → **`accuracy_type` gate BEFORE normalize** (by input type: ZIP = place-or-better, its job is catching a geocoder miss not accuracy-filtering since ZIP is format-pre-gated; address requires rooftop/range) → normalize (DC/territory classified **first** by state code, then at-large `0→"00"`, multi-state union across `results[]` **and** per-result districts, v2 `state_province`/`postal_code`) → cache write (ZIP only, never address) → return.
- **Cache:** key `geo:zip:{zip}:{congress}` (congress, not cycle — it's what varies the answer); TTL past-congress long/permanent, current-congress 30–90d (redraw-refinement insurance); address bypasses the cache and is never written or logged (privacy invariant).
- **Error types (200 body unless noted):** `400` malformed input; `{error:'cycle_out_of_range'}` congress < 113 (pre-2012) or > current max (future — Stage-2 reworks the upper bound to state-only, see the Year-selector contract note); `{error:'not_found'}` geocod error-object / no results; `{error:'low_accuracy'}` address below rooftop/range; `{error:'geocoder_unavailable'}` geocod 5xx/429/402 (no retry, matching the FEC proxy). **Territory is NOT an error** — valid resolve, `offices:[]` + `flags.territory` (UI renders the empty state); **DC** is a valid resolve, `offices:['P']` + `flags.dc`.
- **Rate-limit/quota:** address is the quota consumer (uncacheable); ZIP repeats hit cache. Pass through geocod quota headers for observability (as the FEC proxy does with `x-ratelimit-*`).
- **Stop line (strengthened, 2026-07-08):** every corpus case resolves correctly via curl against `wrangler pages dev` (KV empty → live path), where "correctly" means: **(a)** the response `congress_number` equals the `(cycle−1786)/2` formula output for each cycle — a direct year→Congress check that doesn't rely on adjacent congresses happening to differ in district lines (an off-by-one Congress often returns the same district by luck and hides the bug); **(b) every normalize/error branch is exercised**, not just happy ZIPs — both multi-state shapes (42223 one-result-two-states + 73949 two-results), the historical null-`ocd_id` at-large case, DC, a **territory** (PR `00901` verified live 2026-07-08 → `offices:[], states:['PR'], flags.territory` — classified by state code, no district), an ungeocodable input, and a low-accuracy address rejection. No UI.

**Stage-1 VERIFIED 2026-07-08 (commit pending):** `functions/api/geo/[[path]].js` implemented; **14/14 corpus cases green** against `wrangler pages dev` — single/multi-district, both multi-state shapes (42223 one-result-two-states + 73949 two-results), current + historical null-`ocd_id` at-large (59101@cd117, 82001@cd119), historical multi-district (27401@cd116), rooftop address → single district, DC → president-only, **PR → territory**, not_found (00000), low_accuracy (vague address), and both out-of-range bounds (2008 low / 2028 high). Stop-line (a) direct congress-honored check passed via `congress_number` incl. the off-by-one traps (59101→`117th`, 77004→`120th`, 27401→`116th`). Offline unit test (`normalize`/error branches) green under `node`. Local-dev note: the installed wrangler binary is behind "today," so `wrangler pages dev` needs `--compatibility-date=2026-04-17` (or a wrangler upgrade) until the version catches up — a local-env papercut, not a code issue (Cloudflare Pages sets its own runtime compat date in production).

**Sloane-side setup — prerequisites-with-timing (run when reached, not up front):**
1. **`GEOCODIO_KEY` secret** — `npx wrangler pages secret put GEOCODIO_KEY --project-name fecledgerapp`, plus a `GEOCODIO_KEY=…` line in local `.dev.vars`. **Required before:** the first live (cache-miss) resolve — i.e. before Stage-1 curl verification. Without it the Function loads but geocod 403s.
2. **`GEO_CACHE` KV namespace** — create the namespace + bind it as `GEO_CACHE` (Production) in Cloudflare dashboard → Pages → fecledgerapp → Settings → Functions → KV bindings. Pages KV bindings **can't be set via wrangler** — same manual step as `AGGREGATIONS`. **Required before:** cache-on-miss works *in production*. **NOT required for local dev or Stage-1 correctness** — `wrangler pages dev` simulates KV empty → every resolve takes the live path (mirrors AGGREGATIONS locally), so Stage-1 verification runs without it. Bind before relying on production cache (Stage-2 traffic).

---

## The core insight that shrinks the problem

A location maps to three offices, but only **one** of them needs a geocoder, and only that same one is geographically cycle-variant:

| Office | What a location needs | Cycle-variant? | Source |
|---|---|---|---|
| **President** | nothing — national | no | n/a |
| **Senate** | the **state(s)** | no — state lines never move | read from the same House geocode response (per-district `ocd_id`) — **not** a separate call |
| **House** | the **congressional district(s)** | **yes** — district lines change between cycles (redistricting) | the geocoder |

**Consequences:**
1. The geocoder is only ever *called* for the **House district** — but the **state(s) for Senate come from that same response**, via each returned district's `ocd_id` (`ocd-division/country:us/state:XX/cd:N`). **Do NOT use a separate ZIP3→state table** (an earlier idea here): it returns a single state and silently misses **multi-state ZIPs** (see §4b), where it could even pick the minority state. President needs nothing (national).
2. **Cycle correctness is a House-only concern.** Senate and President are cycle-invariant geographically, so the entire historical-Congress mechanism below applies to House district resolution only.

This is the same scoping discipline as the rest of the project — minimize the third-party dependency surface to exactly the slice that needs it.

---

## Data source decision: geocod.io (with the alternatives that lost)

| Source | ZIP | City | Multi-district | **Historical (per-cycle)** | Cost/scale | Privacy |
|---|---|---|---|---|---|---|
| **geocod.io** ✅ | ✅ | ✅ | ✅ all districts, ranked by overlap (API only) | ✅ **113th–120th Congress** | 2,500 lookups/day free; CD-append doubles → ~1,250 ZIP-with-district/day free; pay-as-you-go above | 3rd party (mitigated by proxy + cache) |
| Census ZCTA→CD relationship file | ✅ (as ZCTA) | ✗ | ✅ | ✗ **current Congress only** | free static | fully private |
| Census Geocoder API | weak | weak | partial | ✗ current only | free, rate-limited | gov 3rd party |
| Community crosswalk (`us-zipcodes-congress`) | ✅ | ✗ | ✅ | ✗ current only | free static | private |

**geocod.io wins on the hard requirement.** Cycle correctness eliminates every static/free option in one stroke — they're all current-Congress-only. geocod.io is the only source that returns **per-Congress historical districts** (verified: explicit `cd113`…`cd120` fields), which is exactly what the cycle requirement demands. It also uniquely handles City + ZIP + multi-district out of the box, and "independently tracks redistricting" (a maintenance advantage — see Maintenance).

---

## Architecture

### 1. Cloudflare Function proxy (`functions/api/geo/[[path]].js`)

Mirror the FEC proxy pattern exactly:
- Client never sees the geocod.io API key (Cloudflare secret, e.g. `GEOCODIO_KEY`).
- The user's location never travels client→3rd-party directly; it goes client→our Function→geocod.io. For a politically-charged tool (harassment/privacy is an explicit brief concern), "we don't hand your location to anyone" is a real trust property.
- The Function is also where the **KV cache** (below) lives, so cost control and privacy are the same layer.

### 2. Cycle → Congress mapping (House only)

The district lines used in an election cycle are the lines that elect that cycle's incoming Congress:

```
Congress N = (cycleYear − 1786) / 2
```

| Cycle | Congress | geocod.io field |
|---|---|---|
| 2012 | 113th | `cd113` (floor) |
| 2014 | 114th | `cd114` |
| 2016 | 115th | `cd115` |
| 2018 | 116th | `cd116` |
| 2020 | 117th | `cd117` |
| 2022 | 118th | `cd118` |
| 2024 | 119th | `cd119` (current default) |
| 2026 | 120th | `cd120` (labeled "preview" — verified usable + redraw-aware, see note below) |

**Verified call pattern (live, 2026-06-12):** request **exactly one** congress field per call — `fields=cd{NNN}` for the cycle's Congress. **Combining multiple congress fields in one call silently returns only the first** (`fields=cd,cd118,cd116` → only current came back). The response key is always `congressional_districts[]`; each entry carries `district_number`, `congress_number` ("116th"), `congress_years` ("2019-2021"), and `proportion`. So: map cycle → Congress → single `fields=cd{NNN}`, then read the array. Historical congresses **work on the free tier** (verified `cd116` on a real ZIP). One geocode + one CD-append = 2 lookups per search (the append doubles the count).

**Coverage floor — RESOLVED (2026-06-12): floor location search at cycle 2012.** geocod.io's earliest district data is the 113th Congress = cycle 2012, which **aligns cleanly with an existing architectural barrier** — FEC detail data for Senate and Presidential candidates already floors at 2012 (`ARCHIVE_MIN_YEAR` S:2012, P:2012). So the geocoder floor isn't a new limitation; it matches where the product already stops offering detail for two of the three offices. The election-year selector on the location-search landing offers **2012 → current** only. (House detail technically reaches back to 2008, but flooring the whole search at 2012 keeps one consistent boundary across offices rather than an office-dependent floor.) Pre-2012 is simply out of range for this surface.

**Current-cycle `cd120` — RESOLVED (verified live 2026-06-12): use `cd120` for the 2026 cycle.** geocod.io labels 120th "preview," but it returns real, **redraw-aware** data — not a stale copy of 119th. Proof: the Texas 2025 mid-decade redraw shows divergence between `cd119` and `cd120` (Houston 77004: TX-18+TX-9 → TX-18; Dallas 75215: TX-30 → TX-30+TX-33; Austin 78702: TX-35 → TX-37). States that didn't redraw return identical 119th/120th (IL, GA sampled). So no `cd119` fallback is needed. Residual: "preview" boundaries may still be refined as states finalize — covered by the maintenance watch (Follow-on work), not a blocker.

### 3. Input validation + typeahead

**geocod.io does NOT do as-you-type autocomplete** (verified — it's forward/batch geocoding; the autocomplete market is Geocode Earth / Geoapify / ArcGIS, geocod.io is absent from it). So "only allow search if the input is valid" is something **we build**, not something geocod.io hands us. Two clean inputs, two gates:

- **ZIP:** client-side format gate (`^\d{5}$`) before firing; geocode on submit; server-side backstop rejects if geocod.io returns no match / low confidence. (**Verified live:** results carry `accuracy` (1) + `accuracy_type` ("place" for a ZIP/city-centroid match) — directly usable as the reject threshold.)
- **City+State:** constrain input with a **static local typeahead** sourced from the **Census Places gazetteer** (~19k incorporated places + CDPs, a small shippable file). The user can only *pick a real, disambiguated "City, ST"* — which both validates before submit AND resolves the "which Springfield?" ambiguity. Then geocode the chosen canonical string on submit.

**Why a static typeahead, not a live autocomplete API:** firing a paid/3rd-party geocoder on every keystroke is the worst case for both cost and privacy. A static places list gives instant suggestions with zero per-keystroke calls, and limits paid geocod.io usage to **one lookup per submitted search**. (This mirrors the project's existing combo-dropdown pattern — local data, no per-keystroke network.)

**Net validation model:** ZIP is format-gated; City is pick-from-known-list-gated; geocod.io's accuracy score is the server-side backstop. The search only fires on a structurally valid input.

### 3b. Full-address input (precision tier) — small lift, big payoff

Beyond ZIP and City,ST, a **full street address** is worth supporting — and counterintuitively it's the *easiest to resolve* and *most accurate* input, because address is geocod.io's **native** mode (ZIP/city are the degraded forms). **Verified live:** `6320 S Pulaski Rd, Chicago, IL 60629` → `accuracy_type: rooftop`, **exactly IL-4** — where the bare ZIP `60629` returned *four* districts. A rooftop point falls in **one district and one state**, so address **eliminates** the multi-district (§4) and multi-state (§4b) ambiguity rather than adding it.

**Resolution side = free.** Same endpoint, same `fields=cd{NNN}`, same proxy, same 2-lookup cost, same result rendering — and it hits the clean single-district path, *fewer* branches than ZIP.

**The lift sits in exactly two places:**
1. **Input UX.** ZIP is regex-gated; City,ST is gazetteer-typeahead-gated. A free-text address is neither — not regex-validatable, not powered by a shippable static list (~150M addresses), and geocod.io has no as-you-type autocomplete. Two builds: **(a) plain address text field** — geocode on submit, validate via `accuracy_type` (require `rooftop`/`range`, reject `place`/error) → **small lift**, the only change is validation moves *post-submit*; **(b) address autocomplete** (Geoapify/Google) → **big lift + new dependency + per-keystroke cost + privacy regression — avoid.**
2. **Caching/cost + privacy.** The cost model amortizes because ZIP/city universes are small and repeat. **Addresses are unbounded + unique → ~0 cache hit rate → one fresh paid lookup each**, uncoverable by the ZIP precompute. Address is also more sensitive PII → **don't cache raw addresses** (fine — hit rate is ~0 anyway). Geocode-and-discard. Negligible at portfolio traffic; self-limiting at scale (a user types their own address once).

**Why include it:** address is the **escape hatch** for the two documented ambiguities — a border-ZIP or sprawling-city user who wants *their* exact race just types their address, and the multi-state + city-completeness problems vanish. The three inputs are one geocode endpoint with three affordances forming a precision ladder (ZIP = place, may be multi-district/multi-state, cacheable → City,ST = centroid, under-complete, cacheable → **Address = rooftop, one district/state, uncacheable**). **Recommendation: include address as a plain text field in v1 (small lift, best accuracy); never the autocomplete version.**

### 4. Multi-district handling — and a City vs ZIP completeness asymmetry

**ZIP — verified multi-district (live):** a bare ZIP returns *all* overlapping districts as a `congressional_districts[]` array ranked by `proportion`:
- `77002` (Houston) → TX-18 (0.88) + TX-7 (0.12)
- `60629` (Chicago) → IL-4 (0.77) + IL-7 (0.16) + IL-1 (0.06) + IL-6 (0.02) — four districts
- single-district ZIPs return one entry at `proportion: 1`

Use the **API path** (all districts, ranked) — *not* the spreadsheet/Lists path (returns most-likely only). UX: "60629 spans IL-4, IL-7, IL-1, IL-6 — here are races for all four," ordered by overlap.

**City+State — a real completeness gap (verified live):** geocoding a city *name* resolves to the city **centroid → the single district at that point**, NOT every district the city spans. `Houston, TX` returned **only TX-18** (proportion 1) — even though Houston spans ~9 House districts. So **City search under-reports "races that touch this city."** This is the key asymmetry: **ZIP gives honest overlap; City gives one centroid point.**

Implications / options (→ Open Items):
- **ZIP is the precision + completeness path; City+State is a convenience path that's only centroid-accurate.** Reinforces ZIP-first.
- v1 pragmatic option: City returns the centroid district with a caveat ("based on city center — search by ZIP for your exact district"), OR City is deferred to a fast-follow until completeness is solved.

**What "solving City completeness" actually requires (analysis, 2026-06-12):** geocoding a city *name* yields one centroid point → one district; getting *every* district a city spans needs the city's extent, not a point. Two paths:

- **Path A — city → ZIPs → union (pragmatic).** (1) Look up the set of ZIPs composing "Houston, TX" from a static **city→ZIP table**; (2) get each ZIP's district(s); (3) **union** them. The determining constraint: step (2) done live is ~150 geocode calls *per city search* — cost-prohibitive. So **City completeness is only viable on top of the ZIP→district precompute** (§5 endgame): once ZIP→district(cycle) is in KV, city→ZIPs is a static lookup and the union is local — zero extra geocoding. So "complete city search" is **a follow-on to the ZIP precompute**, not a separate large lift — it adds one dataset (city→ZIP) + union logic. Caveats: (a) USPS city ≠ municipal boundary, so the union skews *broad* (postal area incl. suburbs, not legal city limits); (b) ZIP overlap proportions don't compose across ZIPs, so you present the *set* of districts unweighted, not percentages.
- **Path B — city polygon ∩ district shapefiles (accurate).** Intersect the Census TIGER/Line place boundary with congressional-district shapefiles for true "city limits ∩ districts." Legally precise but real GIS work (polygon overlap + a geo library) — only worth it if legal-city precision matters.

**Net:** completeness ≈ "do the ZIP precompute, then add a city→ZIP table + union." Sequencing implication → **ship ZIP-first; City-complete rides in with the precompute.** (See Follow-on work.)

### 4b. Multi-state ZIPs (the border-ZIP edge) — verified, not yet decided

A small number of ZIPs straddle a **state** line, not just a district line. Because Senate is state-derived, a border ZIP can surface a **neighboring state's** Senate race — and since Senate races are sparse, an open/competitive one in the *unintended* state is salient and confusing (Sloane's catch). **Verified live (2026-06-12):**

- **42223** (Fort Campbell): centroid `address_components.state = KY`, but the district array spans **TN-7 (0.551) + KY-1 (0.449)** — the centroid state (KY) is the **minority** share. Per-district state is in `ocd_id` (`…/state:tn/cd:7`, `…/state:ky/cd:1`).
- **73949** (Texhoma): geocod.io returns **two results** (`state=OK` and `state=TX`), both carrying OK-3 (0.864) + TX-13 (0.136).

**What this forces:**
- **Detect multi-state** from the geocode response: unique set of `state:XX` across the districts' `ocd_ids`, and/or multiple results with differing `address_components.state_province` (v2 field name; `…state` on v1.9). (Wrinkle: `ocd_id` is **populated on multi-state ZIPs and current-congress single-state ZIPs, but null on historical congresses** — so the `state_province` fallback covers the historical case; `ocd_id`-based detection covers current.)
- **Order by share, not centroid:** rank states by summed district proportion (Fort Campbell → TN primary, KY secondary), since the centroid can be the minority state.

**Mitigation options (→ Open Items / decision):**
1. **Honest multi-state grouping** (parallels multi-district): "42223 spans Kentucky and Tennessee — here are races for both," grouped by state, share-ordered. Surfaces the neighbor race but *labels why*, removing the confusion. (Recommended — consistent with the multi-district treatment.)
2. **Disambiguation prompt:** on multi-state detection, ask "Did you mean KY or TN?" before rendering. Cleanest for confusion, adds a step.
3. **Centroid-state only for Senate:** simplest, one state — but can be *wrong* (picks KY for a majority-TN ZIP) and is inconsistent with House showing cross-state districts. Not recommended.
- **City+State input has no multi-state problem** (state is explicit) — another reason to steer border-ZIP users toward City+State, and a point in favor of ZIP-first-with-City.

Rare (dozens of ZIPs nationally), but it's exactly the kind of non-ideal state the brief says to handle thoughtfully. v1 should at minimum **detect + label** (option 1), never silently show a neighbor-state race as if it were yours.

### 5. Cost at scale — the arc

The key property: **a (location, Congress) → district mapping is immutable for past Congresses and stable within the current one.** So you never need to geocode the same place for the same cycle twice.

- **v1 — cache-on-miss in KV** (in the Cloudflare Function). Key: `geo:{normalizedLocation}:{congress}` → `{districts:[…]}`. First user to search a place-for-a-cycle pays the geocod.io lookup; everyone after hits KV. **Lifetime geocod.io calls ≈ number of distinct (location, congress) pairs ever searched — not number of searches.** At portfolio traffic this likely never leaves the free tier; at viral traffic the cost is bounded by the *distinct-locations* universe, not request volume. This is the same live→cache shape as the banked FEC proxy-cache item.
- **Endgame (optional) — full precompute.** Batch-geocode the ZIP/ZCTA universe (~33k) per needed Congress once, store ZIP→districts per Congress in KV, and make **zero** runtime third-party calls. Budget: ~1,250 free ZIP-with-district lookups/day → ~27 days/Congress on free tier, or one trivial paid batch run. This is the election-night-proof, fully-private version. City typeahead still resolves to a ZIP/point, so the ZIP precompute covers it. **Cache-on-miss is almost certainly enough for v1; precompute is the lever if real traffic arrives.**

**Cache TTL by immutability:** past-Congress entries are permanent (history never changes); **current-Congress entries get a TTL** (e.g. 30–90 days) as insurance against a mid-decade court-ordered redraw landing. Because the cache key includes `{congress}`, a new cycle automatically starts a fresh key space — no stale-data risk across cycles.

### 6. Maintenance cadence (understood + automated)

What can change, how often, and how it's handled:

| Change | Frequency | Handling |
|---|---|---|
| **New Congress** (new `cd{NNN}` field + cycle→Congress row) | every 2 years (scheduled) | Biennial release-checklist item: add the new field name + mapping row; confirm geocod.io has promoted it from "preview" to current. Predictable, calendared. |
| **Mid-decade redistricting** (court-ordered: recent real examples AL, LA, NY, NC, GA in 2023–24) | sporadic, current-Congress only | geocod.io tracks redistricting themselves, so the runtime/cache-on-miss path **inherits the fix automatically** once their data updates — this is geocod.io's edge over a static Census file you'd hand-refresh. The current-Congress cache TTL ensures we re-pull within the window. |
| **New/retired USPS ZIPs** | rare, continuous | cache-on-miss handles transparently; a precompute would refresh on its next batch run. |

**Automation:** the cycle→Congress map is deterministic (formula above) — no manual table to drift. A scheduled GitHub Actions check (quarterly, reusing the existing pipeline-cron muscle) can (a) assert geocod.io still returns the expected fields, and (b) optionally re-batch the current Congress to catch a redraw proactively rather than waiting on TTL expiry. The only genuinely manual, calendared task is the biennial new-Congress field bump.

### 7. Response payload — extra data available (and what's worth using)

The `fields=cd` response (current cycle) carries more than the district. Per result: `formatted_address`, `address_components` (city / **county** / state / zip), `location {lat,lng}`, `accuracy` / `accuracy_type`, `source`, and `congressional_districts[]`. For the **current** congress, each district additionally nests **`current_legislators[]`** — the sitting House rep + **both** senators. Historical congresses (e.g. `cd116`) omit `current_legislators`.

**`current_legislators` is the standout — and it's free** (bundled in the `cd` append we already pay for; no extra lookup). Each entry carries `type` (representative/senator), `bio` (name, party, gender, **`photo_url`**), `contact` (official url, DC address, phone), `social` (twitter/facebook/youtube), and `references` (`bioguide_id`, `opensecrets_id`, `govtrack_id`, `ballotpedia_id`, `wikipedia_id`, …). **No FEC ID is included** — see linking note. (Verified live on 30303 → Rep. Nikema Williams + Sens. Ossoff & Warnock.)

**Opportunities for races.html (ranked):**
1. **"Your current representatives" context** beside the cycle's races (incumbent House member + 2 senators). Natural companion to "what races touch this place." **Current-cycle only** — it's today's members, not the selected cycle's roster, so it would mislead on a past-cycle view.
2. **Incumbent photos** — `photo_url` (congress.gov official portraits) directly fills the gap the **project brief flags as "data not provided by FEC" (candidate profile images)**. Free, for sitting members. (Confirm image-use terms.)
3. **Link incumbents → FECLedger profiles** — the payload has **no FEC ID**, but carries `bioguide_id`; the same source geocod cites (the @unitedstates project) publishes a `bioguide → FEC ID` crosswalk (static, free). One offline join links an incumbent to their FECLedger candidate page. *(Verify the @unitedstates legislators file's `id.fec` field at build.)*
4. **`location {lat,lng}` → district map** (banked) — pin the searched location / future boundary viz. Bigger lift (shapefiles + map lib).
5. **`formatted_address`** — clean result-header label ("Races for Atlanta, GA 30303").
6. **ACS demographics** (`fields=acs-*`, **extra lookup cost**) — district population / median income for editorial "district profile" context. Optional; not v1.

**Caveats:** legislators are **current**, not cycle-historical (current-cycle only); **no FEC ID** in-payload (needs the bioguide→FEC crosswalk); photo terms to confirm; ACS costs extra lookups.

---

## Senate edge case — fully characterized (it's a data-model gap, not a geo gap)

**Finding (verified live):** When a state runs two Senate contests in one cycle (regular + special election to fill a vacancy), the FEC `/elections/` data model **collapses them into one**:

- `/elections/search/?cycle=2020&office=senate&state=GA` → **a single result** `{office:'S', state:'GA', district:'00'}`. No special-election distinguisher field exists on the record.
- `/elections/?cycle=2020&office=senate&state=GA` → **35 candidates from BOTH contests mashed into one list**: Ossoff ($151.8M) + Perdue ($90.4M) from the *regular* race, and Warnock ($102.6M) + Loeffler ($71.0M) + Collins ($7.3M) from the *special* — indistinguishable in the response.

**Implication for location search:** location search does **not create** this problem, but it **makes it prominent.** It promises "*your* Senate race," and for a GA-2020 ZIP it inherits the collapse — surfacing one mashed-up "Georgia Senate" contest mixing two real elections. The Senate part of a location result is just "state → Senate contests," so the geo layer is honest; the defect lives entirely in the **race-listing/`/elections/` layer**, which is the same surface as the existing open "Senate term-class disambiguation" question (project-brief Open Questions; CLAUDE.md Senate-class heuristic note).

**Mitigation paths (deferred — for Chat):**
1. **v1 accept + caveat:** surface the single collapsed entry with a note ("Georgia held two U.S. Senate elections in 2020"), splitting deferred.
2. **Detect + split:** special elections are rare and enumerable; a maintained list of (state, cycle) two-race cases could trigger a client-side split — but splitting the candidate list requires per-candidate special-vs-regular attribution that `/elections/` doesn't provide (would need `/election-dates/` SP/SG types or per-candidate `election_years` cross-referencing — real work).
3. Tie this to the existing Senate term-class open question rather than solving it inside the location-search ticket.

Recommend **(1)** for v1; this ticket should **document** the gap, not fix it.

---

## Other call-outs / residual risks

- **ZIP ≠ ZCTA** matters only if you ever fall back to a static Census file — geocod.io geocodes to a point, so it covers PO-box/"point" ZIPs that ZCTA files drop. Not a concern on the geocod.io path; noted in case the static endgame is ever chosen for a subset.
- **City is a fuzzier input than ZIP** — a city can span many districts (Houston ≈ 9) and the result set can feel like "a region's races," not "yours." ZIP is the precision input; City+State is the human-friendly one. Both are in scope per Sloane; just weight the UX toward ZIP as the crisp path.
- **`accuracy`/`accuracy_type` fields** are confirmed present (live: `accuracy: 1`, `accuracy_type: "place"`) and usable as the server-side reject threshold — set the exact cutoff at build.
- **Presidential cycle correctness is a non-issue** (national, no district) — included only to make the "House-only" scoping explicit.

---

## Open items for Claude Chat

> **Partially superseded by the Build plan (2026-07-08 review).** #3, #6, #10, #11, #12 are now decided — see "Locked decisions (post-review)." Retained here for lineage. #4 (Senate split) is deferred to the term-class work; #5 (City typeahead) rides with the deferred City input; #7 (billing) and #9 (retirement survey — folded into Stage 2) are operational.

1. ~~**`cd120` preview readiness**~~ — **RESOLVED 2026-06-12:** use `cd120` for 2026. Verified live as redraw-aware (Texas 2025 mid-decade redraw diverges from `cd119`); no fallback needed. "Preview" boundary refinement is a maintenance watch, not a blocker.
2. ~~**Pre-2012 House floor**~~ — **RESOLVED 2026-06-12:** floor location search at cycle 2012 (aligns with the existing S/P detail-data floor; geocod.io's 113th-Congress floor matches). Year selector offers 2012→current.
3. **Cost arc commitment** — ship v1 on cache-on-miss only, or budget the one-time ZIP precompute now? (Recommendation: cache-on-miss; precompute as a banked lever.)
4. **Senate two-race cycles** — accept-with-caveat for v1 (recommended) vs. attempt the split; and whether to fold it into the existing term-class open question.
5. **City typeahead dataset** — confirm Census Places gazetteer as the static source (size/shape) and the disambiguation UX (how "City, ST" picks render).
6. **Input scope + City completeness** — geocoding a City *name* returns only the **centroid's** district, not all districts the city spans (Houston → TX-18 only, verified). Per the §4 analysis, full completeness is gated on the ZIP precompute (city → ZIPs → union). Decision: ship **ZIP-first and defer complete City** to ride in with the precompute (recommended), or City-centroid-with-caveat at v1? *(Leaning ZIP-first; see Follow-on work.)*
7. **Geocod.io account/billing** — pay-as-you-go ceiling + alerting (key owned by Sloane's Geocodio Self-Serve account, provisioned 2026-06-12; free tier 2,500/day, ~1,250 with district append).
8. ~~**Pre-search / default landing state**~~ — **RESOLVED 2026-06-12:** go **bare** for v1 (a simple search prompt, no populated default). The **"top races by spending this cycle" hero** is a planned follow-up pending its own research (see Follow-on work + the same-session top-races-by-spending investigation).
9. **Retirement scope** — confirm the IntersectionObserver enrichment + localStorage race cache + `/elections/search/` enumeration are fully removed (not just hidden), and whether any "browse all races" affordance survives as a secondary path at all.
10. **Multi-state ZIP handling** (§4b) — a border ZIP can surface a neighbor state's (sparse, salient) Senate race. Pick the mitigation: honest multi-state grouping with a "spans X and Y" label *(recommended)*, a disambiguation prompt, or centroid-state-only *(not recommended — can pick the minority state)*. v1 minimum = detect + label, never silently show a neighbor-state race as if it were yours.
11. **DC / delegate / territory handling** (surfaced by the test corpus) — DC geocodes to `district_number 98` (non-voting delegate), no voting House/Senate. Confirm DC → **President-only** for v1 (and whether the DC delegate race is shown at all); treat territories (PR/GU/VI/AS/MP, also `98`/delegate, no presidential vote) as out of scope with a graceful "no federal races on FECLedger for this location" state.
12. **Full-address input in v1?** (§3b) — recommended **yes, as a plain text field** (small lift, native geocod.io input, rooftop accuracy → exactly one district/state, eliminates the multi-district + multi-state + city-completeness ambiguities; validation moves post-submit via `accuracy_type`; geocode-and-discard, no cache). The only thing to rule out is **address autocomplete** (new dependency + per-keystroke cost + privacy regression). Decide: ship all three inputs (ZIP / City,ST / Address) at v1, or stage address as a fast-follow?

---

## Follow-on work / backlog

*Living list — capture backlog, cleanup, and tradeoffs uncovered as decisions resolve. Not v1 scope unless promoted.*

### Deferred features (post-v1)
- **Complete City search** — make City+State span-complete (all districts a city touches), not centroid-only. Gated on the ZIP precompute: city → ZIPs (static city→ZIP table) → union of cached districts. Adds one dataset + union logic; accepts USPS-postal-city breadth. (§4 analysis; resolves the City half of open item #6.)
- **ZIP→district precompute → KV** — the cost-at-scale endgame (§5): batch-geocode the ZIP universe per Congress once → zero runtime third-party calls, fully private, election-night-proof. Also the prerequisite that unblocks Complete City search. Promote when real traffic / a launch warrants it; v1 ships on cache-on-miss.
- **"Top races by spending this cycle" hero** — the planned non-bare default landing state (open item #8 went bare for v1). Needs its own research; ties directly to the same-session "top races by spending" investigation (candidate-totals grouping vs. weball bulk → KV). Could combine with location search: hottest-races default + search-to-narrow.
- **Incumbent context block (from `current_legislators`)** — surface the searched location's current House rep + 2 senators (name, party, **official photo**, contact) beside the cycle's races; free in the `cd` payload (§7). Two unlocks: (a) **incumbent photos** fill the brief's "no candidate images from FEC" gap; (b) a static **bioguide→FEC crosswalk** (@unitedstates project) links each incumbent to their FECLedger profile. Current-cycle only (the data is today's members, not the cycle's roster). Good ZIP-precompute companion or a standalone enrichment.
- **Senate two-race split** — when a state runs a regular + special Senate election in one cycle, `/elections/` collapses both into one mashed candidate list (GA-2020 verified). Splitting needs per-candidate special-vs-regular attribution the endpoint doesn't provide. Tie to the existing Senate term-class open question rather than solving inside this work. v1 documents + accepts.

### Recurring maintenance (calendar/triggered)
- **Biennial new-Congress field bump** — each cycle adds a `cd{NNN}` field + a cycle→Congress mapping row, and the new Congress must be promoted from geocod.io "preview" → current. Scheduled, predictable.
- **`cd120` boundary-refinement watch** — `cd120` is confirmed usable for 2026 (redraw-aware, verified), but is still "preview," so finalized state maps may shift it slightly; the current-Congress cache TTL + quarterly re-batch absorb any late refinements.
- **Mid-decade redraw insurance** — current-Congress cache TTL (30–90 days) + optional quarterly GitHub Actions re-batch so court-ordered redraws (AL/LA/NY/NC/GA-class) propagate without manual work. geocod.io tracks the redraws; we just need to re-pull.

### Cleanup on build
- **Retire the old browse internals** when location search ships: the `/elections/search/` all-races enumeration, the IntersectionObserver per-row enrichment, and the localStorage race cache (open item #9 — confirm full removal, not just hidden).
- ~~**geocod.io v1.9 → v2 migration**~~ — **RESOLVED 2026-06-12:** golden cases re-verified on v2; build directly on `/v2/geocode`. Only build-affecting delta is the `address_components` rename (`state`→`state_province`, `zip`→`postal_code`) — see "v2 contract deltas." No verify-then-migrate needed.
- **Pre-2012 out-of-range messaging** — year selector floored at 2012; ensure any deep-linked/old `?year=` below 2012 degrades gracefully (clamp to 2012 or a friendly note).

---

## Verified response contract (live geocod.io v1.9, 2026-06-12)

Real key exercised; key NOT stored in this doc or committed anywhere.

- **Per-Congress, one-at-a-time:** `fields=cd{NNN}` returns `congressional_districts[]`, each `{district_number, name, congress_number, congress_years, proportion}`. Requesting multiple congress fields in one call silently returns only the first → **one congress per call.** Historical works on the **free tier** (`cd116` verified).
- **Cycle correctness proven (past):** `27401` (Greensboro NC) for the **116th** → NC-13 (0.583) + NC-6 (0.417), the pre-redraw split — different from its current 119th district. Confirms per-cycle district resolution.
- **Cycle correctness proven (current/120th, redraw-aware):** Texas 2025 mid-decade redraw diverges between `cd119` and `cd120` — Houston 77004 (TX-18+TX-9 → TX-18), Dallas 75215 (TX-30 → TX-30+TX-33), Austin 78702 (TX-35 → TX-37). Non-redrawn states (IL, GA) return identical 119th/120th. So `cd120` is live and usable for 2026, not a stale 119th copy.
- **Multi-district ZIP shape:** `77002` → TX-18 (0.88) + TX-7 (0.12); `60629` → IL-4/7/1/6 (4 districts); single-district ZIPs → one entry at `proportion 1`. Ranked by overlap.
- **City centroid limitation:** `Houston, TX` → centroid match, **TX-18 only** (not all ~9 Houston districts). City input is centroid-accurate, not span-complete. City queries also return multiple *candidate matches* (Houston, TX returned 6) — the typeahead-pick model resolves which one.
- **Multi-state ZIPs:** `42223` → districts span TN-7 (0.551) + KY-1 (0.449); centroid state (KY) is the *minority*. `73949` → two results (OK + TX). Per-district state lives in `ocd_id` (`…/state:tn/cd:7`); `ocd_id` was populated on multi-state ZIPs but null on single-state ones in sampling. Senate state(s) must be read from this response, not a ZIP3 table. (§4b)
- **Validation fields:** `accuracy` (1) + `accuracy_type` ("place") present on every result.
- **API version:** the values above were captured on v1.9 and **re-verified on v2** (`/v2/geocode`, the build target — key is scoped to it). v2 deltas are listed in the next section; the only build-affecting one is the `address_components` field rename.

## v2 contract deltas (build target — verified 2026-06-12)

All golden cases above were re-run against `https://api.geocod.io/v2/geocode`. **Everything the build depends on is identical to v1.9** EXCEPT the items below. Build on v2.

| Delta | Build impact | Action |
|---|---|---|
| `address_components.state` → **`state_province`**; `zip` → **`postal_code`** (values unchanged) | **Yes** — Senate-state derivation uses the centroid state as a fallback when `ocd_id` is null (historical congresses), and the multi-state centroid read uses it | **Read `address_components.state_province`** anywhere this doc says `address_components.state`. `ocd_id`-based per-district state detection is unaffected (`ocd_id` format unchanged). |
| Top-level `input` echo + `_warnings` removed | No (build reads `results`) | none — and no deprecation warning on v2 |
| Ungeocodable input returns `{error, reference}` (added `reference`) | No — gate keys on `error` present | `error` string is byte-identical (`"Could not geocode address. No matches found."`) |
| Combining `cd{NNN}` fields returns a *different* single congress than v1.9 (last vs. first) | No — one-congress-per-call is mandatory regardless | single-field requests return the correct congress (verified `cd116`→116th, `cd119`→119th); **never combine** |

**Identical on v2 (re-verified):** `congressional_districts[]` entry shape (`district_number` / `congress_number` / `congress_years` / `proportion` / `name` / `ocd_id` / `current_legislators`); `ocd_id` format incl. `.../cd:at-large` and the null-on-historical wrinkle; at-large `district_number: 0`; multi-district proportions (60629→IL-4/7/1/6); multi-state two-result + per-district `ocd_id` state (42223, 73949); `current_legislators` presence + structure (still no `fec_id`); `accuracy`/`accuracy_type`; rooftop address → single district; the error string.

> **NB for the build:** wherever this doc (esp. §4b and the mapping rules) names `address_components.state`, the v2 field is **`address_components.state_province`**.

## Other verified facts (FEC + docs)

- **geocod.io per-Congress availability:** `cd113`–`cd120` (113th earliest, 119th current/default, 120th preview); free tier 2,500/day, CD-append doubles the count.
- **geocod.io ≠ autocomplete:** confirmed absent from the as-you-type market (Geocode Earth/Geoapify/ArcGIS own it) → typeahead must be built locally.
- **Senate collapse:** `/elections/search/` GA-2020-senate = 1 entry, no distinguisher; `/elections/` GA-2020-senate = 35 candidates from both contests in one list (Ossoff/Perdue regular + Warnock/Loeffler/Collins special).
- **Sources:** [Geocodio congressional districts API](https://www.geocod.io/api-to-get-congressional-districts) · [Geocodio congressional data guide](https://www.geocod.io/guides/congressional-data) · [Geocodio pricing](https://www.geocod.io/pricing) · [Census ZCTA↔CD relationship files](https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.2020.html) · [Census Places gazetteer](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html) · [us-zipcodes-congress](https://github.com/OpenSourceActivismTech/us-zipcodes-congress)

---

## Test corpus / golden cases (regression fixtures for the build)

Curated edge-case inputs with **live-verified expected outputs** (geocod.io v1.9, 2026-06-12; cycle = 119th/2024 unless noted). Use these as regression fixtures for the location→races resolver and the geocod.io→FEC mapping. **✅** = geocode value verified live; **behavioral** = a UX expectation (no single geocode value to assert).

### Geocod.io → FEC mapping rules surfaced by these cases (build-critical)
- **At-large → district `0`, normalize to `"00"`:** single-seat states (WY/VT/DE/AK) return `district_number: 0` + `ocd_id …/cd:at-large`. FEC `/elections/` accepts **both** `district=0` and `district=00` (verified live 2026-06-12 — identical results), so this isn't a correctness gate. Normalize `0 → "00"` to match the app's existing cache convention, which already keys at-large House (and Senate/President) as `00` — e.g. `lf:race:2026:H:AK:00`, `lf:race:2024:S:ME:00`.
- **Non-voting delegate → district `98`:** DC returns `district_number: 98`, name `"Delegate District (at Large)"`. No voting House/Senate → DC resolves to **President-only** (decide whether to surface the delegate race at all). Territories (PR/GU/VI/AS/MP) follow the same `98`/delegate pattern and additionally cast no presidential vote — almost certainly out of scope; treat any `district_number ≥ 90` as "non-standard, no House race."
- **Invalid location → `error` object:** geocod.io returns `{"error": "Could not geocode address. No matches found."}` (NOT empty `results`). The reject/validation path keys on `error` present (or `results` empty).
- **`ocd_id` is the per-district state + at-large signal, but is `null` on older congresses** (MT 117th returned `ocd_id: null`; the only at-large signal there was the `name` string `"…(at Large)"`). Detection must fall back to `name` / `address_components.state_province` (v2; `…state` on v1.9) when `ocd_id` is absent.

### ZIP cases

| Input | Cycle / Congress | Expected (verified) | Status |
|---|---|---|---|
| `30303` | 2024 / 119th | GA-5 (single) | ✅ |
| `75201` | 2024 / 119th | TX-30 (single) | ✅ |
| `10001` | 2024 / 119th | NY-12 (single) | ✅ |
| `77002` | 2024 / 119th | **multi-district** TX-18 (0.88) + TX-7 (0.12) | ✅ |
| `60629` | 2024 / 119th | **multi-district ×4** IL-4 (0.77) + IL-7 (0.16) + IL-1 (0.06) + IL-6 (0.02) | ✅ |
| `90011` | 2024 / 119th | CA-37 (0.99) + CA-42 (0.01) | ✅ |
| `42223` | 2024 / 119th | **multi-STATE** TN-7 (0.551) + KY-1 (0.449); centroid state = KY (the *minority*) | ✅ |
| `73949` | 2024 / 119th | **multi-STATE** OK-3 (0.864) + TX-13 (0.136); geocod returns **2 results** (OK, TX) | ✅ |
| `82001` (WY) | 2024 / 119th | **at-large**, `district_number 0` → FEC `"00"` | ✅ |
| `05601` (VT) | 2024 / 119th | at-large, `0` | ✅ |
| `59101` (Billings MT) | **2020 / 117th** | **at-large** (`0`) — MT had 1 seat | ✅ |
| `59101` (Billings MT) | **2024 / 119th** | **MT-2** — seat split after 2020 census (same ZIP, different seat across cycles) | ✅ |
| `27401` (Greensboro) | **2018 / 116th** | NC-13 (0.583) + NC-6 (0.417) — pre-redraw split | ✅ |
| `77004` (Houston) | 119th → 120th | TX-18 + TX-9 → **TX-18** (TX 2025 redraw) | ✅ |
| `78702` (Austin) | 119th → 120th | TX-35 → **TX-37** (TX 2025 redraw) | ✅ |
| `20001` (DC) | 2024 / 119th | `district_number 98` delegate → **President-only** | ✅ |
| `00000`, `99999` | any | `error: "…No matches found."` → **reject** | ✅ |

### City, ST cases

| Input | Cycle | Expected | Status |
|---|---|---|---|
| `Atlanta, GA` | 2024 | centroid → **GA-6 only** (single) | ✅ |
| `Houston, TX` | 2024 | centroid → **TX-18 only** (spans ~9 districts — completeness gap, §4) | ✅ |
| `Springfield, IL` | 2024 | IL-13 | ✅ |
| `Springfield, MO` | 2024 | MO-7 (same name, disambiguated by state) | ✅ |
| `Springfield` (no state) | — | typeahead **requires a state pick** before submit | behavioral |
| small CDP not in Places gazetteer | — | typeahead shows no suggestion → can't submit | behavioral |

### Cycle / office cases

| Input | Cycle | Expected | Status |
|---|---|---|---|
| any state, Senate | **2020 GA** | `/elections/` **collapses** regular + special into 1 entry (35 candidates mashed) — see Senate edge case | ✅ |
| any | **2010** | below the 2012 floor → **out of range** message | behavioral |
| `59101` MT | 2020 vs 2024 | at-large → MT-2 (cycle-correct **seat-count** change, not just line shift) | ✅ (see ZIP) |
| any valid input | any | **President always present** in results | behavioral |

*Add rows here as the build uncovers new edges. The ✅ rows carry exact verified values and should become literal assertions; behavioral rows become interaction tests.*
