# Claude Code Brief — FECLedger
*Hand this to Claude Code at the start of each session.*

---

## Frontend skill

**Frontend skill:** Use the `frontend-design` skill whenever creating or modifying UI — new components, new pages, style updates, CSS edits, design token changes. It should assess the existing design system, work within it where it's sound, and propose or apply systematic improvements where it isn't. Consistency and systems thinking take priority over local fixes.

---

## What this is

A web-based campaign finance visualization tool built on the FEC public API. The goal: give political strategists, journalists, and researchers a faster, clearer window into where money is flowing in a race than the FEC website provides.

This is also a portfolio piece for a staff-level product designer (Sloane). It needs to look and feel like a designer built it — not a developer prototype.

**Live URL:** fecledgerapp.pages.dev (git-connected; primary as of 2026-04-21 Phase 2 cutover)  
**Repo:** GitHub (ask Sloane for the repo URL if you don't have it)  
**Deployment:** Push to main on GitHub auto-deploys via `bash scripts/pages-build.sh`, which delegates to `scripts/stage-site.sh` — the single source of truth for what's in the deploy surface (explicit `cp` allowlist of HTML/CSS/JS/functions/_redirects). Build output directory is `dist`. Bindings attached: `AGGREGATIONS` (KV → `fecledger-aggregations`) and `API_KEY` (secret). Lock-in proof: `<html data-deployed-via="git">` attribute on the root page — `curl -s https://fecledgerapp.pages.dev | head -5` after any push should show the attribute present. If it ever disappears, the push-to-deploy chain has broken silently.

**Pre-delete safeguard (durable rule — applies to any future Cloudflare Pages project deletion):** Before deleting any Cloudflare Pages project, visit its `.pages.dev` URL in a browser and confirm it is NOT the currently-live production site. The 2026-04-21 Phase 1→2 migration produced two parallel Pages projects for ~1 day; deleting the wrong one would have taken the live site down with no easy rollback. This check is mandatory whenever a Pages project is being retired, and applies to every Cloudflare Pages project this account owns.

- **Netlify** (`sloanestradley.netlify.app`) is stopped/paused — do not push there.

**`redesign` branch:** Merged into main on 2026-04-13. The redesign is now the live design on main. All feature/bugfix work goes on main going forward. The `redesign` branch no longer diverges from main.
**Analytics:** Amplitude
- Integrated on the original FRED proof-of-concept index page; may not be present on all current pages — audit before assuming
- Pageview tracking is the baseline expectation on every page
- Meaningful interactions worth tracking: tab switches on the candidate page, committee modal opens, build log / reflections toggle on process log, search queries and result clicks (once search is built)
- Do not add a second Amplitude instance to pages that already have it — check first

---

## Tech stack

- Vanilla HTML/CSS/JS — no framework, intentional for this stage
- Chart.js 4.4.0 + chartjs-adapter-date-fns 3.0.0 (time scale support)
- Google Fonts: Oswald (display/headings) + IBM Plex Sans (body/nav) + IBM Plex Serif (editorial/narrative prose) + IBM Plex Mono (labels/data)
- FEC public API: `https://api.open.fec.gov/v1`
- Cloudflare Pages Functions for server-side logic — proxy at `functions/api/fec/[[path]].js`, routing at `functions/candidate/[[catchall]].js` and `functions/committee/[[catchall]].js`
- No build step — files are served directly
- **Clean URLs:** `_redirects` defines Netlify 200 rewrites for all pages. Profile pages with path-segment URLs (`/candidate/:id`, `/committee/:id`) **must use absolute paths** for every local resource and nav link — `href="/styles.css"`, `src="/main.js"`, `href="/candidates"`, etc. Relative paths break because the browser treats the path segment as a subdirectory (e.g. from `/candidate/H2WA03217`, relative `utils.js` resolves to `/candidate/utils.js`, which also matches the rewrite rule and returns HTML served as JS). Browse pages (`/candidates`, `/committees`, `/races`, `/race`, `/search`) use single-level paths so relative links still resolve to root — but any new page with a deeper path must follow the absolute-path rule.
- **Testing:** Playwright (`@playwright/test`) — `npx playwright test` runs 417 structural tests (mocked API); `npm run test:smoke` runs 5 live-API smoke tests against `https://fecledgerapp.pages.dev`. See `TESTING.md`.
- **apiFetch concurrency queue:** `utils.js` implements a `MAX_CONCURRENT = 4` request queue to avoid 429 rate-limit errors when pages fire many parallel API calls (candidate page fires 15–20 on load). All calls still execute — they just pace to ≤4 in-flight at a time. No call-site changes needed; `apiFetch(path, params)` signature is identical.
- **FEC API key is server-side (Cloudflare secret):** `utils.js` sends requests to `/api/fec/*`, which proxies to `api.open.fec.gov/v1/*` via a Cloudflare Pages Function at `functions/api/fec/[[path]].js`. The API key is stored as a Cloudflare secret (`API_KEY`) and injected server-side — it is no longer visible in client-side source. All visitors draw from the same rate limit. An upgraded key is confirmed at 7,200 calls/hour (120 calls/min). **Live site:** `https://fecledgerapp.pages.dev` (Cloudflare Pages — see the Deployment note above).
- **FEC API field verification:** Before writing logic that depends on a specific field name or value from any FEC endpoint, verify the actual response shape first. Navigate directly to the endpoint in a browser (or use `apiFetch` in the console) and confirm field names, value formats, and null behavior. Do not infer from the FEC docs alone — the docs and actual responses diverge in practice (e.g. `/elections/` returns `incumbent_challenge_full` as `"Incumbent"/"Challenger"/"Open seat"`, not the single-letter `incumbent_challenge` code). Document any verified field behavior in the relevant section below.
- **Cloudflare KV for pre-computed aggregations:** Namespace `fecledger-aggregations` stores top-25 contributors per committee per cycle, populated daily by `scripts/precompute-aggregations.js` (see pre-computation architecture below). Bound to the Pages project as `AGGREGATIONS` — Pages Functions read via `env.AGGREGATIONS.get('top_contributors:{cmte_id}:{cycle}')`. The binding is **configured manually in the Cloudflare dashboard** (Workers & Pages → fecledgerapp → Settings → Functions → KV namespace bindings); it cannot be set via wrangler for Pages projects. Writes happen from GitHub Actions via the Cloudflare REST API (bulk PUT/DELETE/list endpoints); reads happen from Pages Functions via the binding.
- **DuckDB in the aggregation pipeline:** `scripts/precompute-aggregations.js` uses `@duckdb/node-api` (Neo binding) to run a single SQL GROUP BY over the indiv CSV. DuckDB spills to disk automatically when memory is exhausted, giving bounded memory + 100% accurate totals. An earlier streaming-Map approach with mid-stream pruning was abandoned because pruning silently undercounts late-cycle contributors whose prior accumulation was discarded.
- **Verify input data before shipping pipeline SQL or schema changes:** Before writing code that depends on a specific column position, field name, value format, or quoting convention in any FEC bulk file, verify the actual file: fetch the FEC description page AND `head -n 2` (or `awk -F'|' '{print NF}'`) a real sample. Write the schema constant against what's in the file, not against what the docs or prior code assumed. This has been paid for three times: pas2 21-vs-22 columns (2026-04-17) broke DuckDB downstream with a cryptic parse error; pas2 NAME semantics (2026-04-20, recipient_name vs. giver_name) shipped to production with visually wrong data and required a same-day rollback; cm.txt (2026-04-21) was caught up front — the real cm.txt file has literal `"` chars embedded in `CMTE_NM` that would have broken DuckDB's default `quote='"'`, the check against the real file surfaced the need for `quote=''` in 30 seconds of work. Cost of verifying up front: ~5 minutes. Cost of debugging after: a full pipeline re-run plus a follow-up commit. The discipline is also documented per-surface in the relevant strategy docs (see `strategy/cm-txt-integration.md` for the reference treatment).

---

## Design system

**Reference file:** `design-system.html` is the living design system reference. Read it (or at minimum the token table and component list) before building any new page or component.

**Skeleton loading:** `.skeleton` (in `styles.css`) is the standard placeholder for content that loads asynchronously after the initial page render. Use it whenever a UI element shows a loading state before data resolves — set `width` and `height` inline to approximate the expected content size. Do not define page-specific skeleton keyframes; always use the shared class. Size guidance: height should match the resolved element's total height (content + padding), width should approximate the minimum resolved state. Do NOT wrap the skeleton in its resolved container (e.g. `.tag-context`) during loading — that adds a second visible background layer behind the pulse.

**Tag context:** `.tag-context` (in `styles.css`) is inline serif prose (IBM Plex Serif 0.875rem) for contextual sentence-format content. No background, no padding, no border, no uppercase — distinct from `.tag`. `display:flex; width:fit-content; max-width:100%; flex-wrap:wrap` — hugs content on wide viewports; constrained by `max-width:100%` on narrow viewports, at which point `flex-wrap` kicks in and the link right-aligns via `margin-left:auto`. `.tag-context-text` has `flex:1; min-width:0` so it fills the row when wrapping occurs. `.tag-context a` has `margin-left:auto; white-space:nowrap`. Used for the race context sentence on the candidate profile (inside `#race-context-bar`). Promote from `candidate-only` to `stable` in `design-system.html` when used on a second page.

**Shared files:** `styles.css` contains the CSS reset, token `:root`, shared layout (sidebar, mobile nav, header), utility classes, and all shared component CSS — including `.page-header` (layout-only: padding — no border, no animation), `.page-header-reveal` (animation modifier: `opacity:0` fade-in; add this alongside `.page-header` on elements that JS reveals via `.visible`; profile pages use both, browse/static pages use `.page-header` only), `.page-title` (Oswald 600, `clamp(2rem,5vw,4.5rem)`, uppercase, margin-bottom 0.5rem, `color:var(--color-navy-950)` — used as the page title on all pages: candidate, committee, race, and browse pages), `.profile-header-row` (flex row wrapper for name + meta-row in profile headers — `display:flex; align-items:center; gap:var(--space-8); flex-wrap:wrap`; no margin-bottom; `.profile-header-row .page-title` has `min-width:0` to prevent flex overflow; used on candidate.html and committee.html), `.profile-content` (content area below tabs bar on all three profile pages — `padding:var(--space-32) var(--page-gutter)`, `opacity:0` fade-in via `.visible`; mobile: `var(--space-24)` top), `.tabs-bar` (profile tab strip — on candidate.html, committee.html, and race.html, `.tabs-bar` is a direct child of `.main`, not `.main-inner`, so its `border-bottom` spans full viewport width; `position:sticky; top:var(--header-h); z-index:185; background:var(--bg)` — sticky sitewide across all three profile pages; uses responsive `padding-left/right: max(var(--page-gutter), calc((100% - 1600px) / 2 + var(--page-gutter)))` to align tab content with `.main-inner`-constrained content at wide viewports; includes `opacity:0`, `transition` reveal; add `.tabs-bar.visible` via JS to reveal), `.tabs-bar.visible` (opacity:1), `.cycle-select` (the cycle `<select>` element inside `.tabs-bar` — last child, after all `.tab` elements; pushed right via `margin-left:auto`), and `.meta-row` (flex row of tags/badges below the page title on profile pages — used on candidate.html and committee.html). `main.js` contains Amplitude init + Session Replay, mobile scroll-aware header, and hamburger nav (all null-guarded). `utils.js` contains shared JS utilities: `BASE`, `API_KEY`, `apiFetch` (concurrency-limited to MAX_CONCURRENT=4 — see tech stack note), `fmt`, `fmtDate`, `toTitleCase`, `formatCandidateName` (semantic alias for `toTitleCase` — use this when rendering candidate names at call sites), `partyClass`, `partyLabel` (returns human label: "Democrat", "Republican", "Libertarian", "Green Party", "Independent", or "Party N/A" for unmapped codes — N/A bucket: NNE/NON/UNK/OTH/NPA/UN/W/O), `partyTooltip(p, party_full)` (returns title attribute text: title-cased `party_full` if available, fallback map for known codes, "No party affiliation on file" for N/A bucket), `committeeTypeLabel`, `formatRaceName` (returns e.g. `'House • WA-03'` from office/state/district — suppresses district suffix when district is `'00'` for at-large seats; returns `'US President'` for office `'P'` (no bullet, no state suffix); used by candidate cards and races browse page), `STATE_NAMES` (object mapping two-letter FEC state codes to full state names — 50 states + DC), `toOrdinal(n)` (converts a numeric district string like `'03'` → `'3rd'`; handles 11th/12th/13th teen exceptions), `formatRaceLabelLong(office, state, district)` (returns long-form race label for profile headers: `'H','WA','03'` → `"US House: Washington's 3rd District"`; `'S','WA',''` → `"US Senate: Washington"`; `'P','',''` → `"US Presidential"`; at-large House (`district==='00'`) omits district suffix), `CHART_COLORS` (JS chart color palette — raised/spent/COH line colors, donut/tooltip/axis colors; used by candidate.html and committee.html chart configs), `ENTITY_TYPE_LABELS` (maps FEC entity type codes to human labels: PAC, Party committee, Committee, Candidate committee, Organization, Candidate (self), Individual — used by Schedule A contributor tables), `PURPOSE_MAP` (ordered array of disbursement purpose buckets with keyword patterns — used by Spent tab on candidate.html and committee.html), `purposeBucket(desc)` (maps a disbursement description string to a PURPOSE_MAP label, or 'Other' — used by renderSpendDetail() on both Spent tabs). Every page links all three (main.js → utils.js → inline script block).

**CSS consolidation principle:** Component CSS lives in `styles.css`. Inline `<style>` blocks in individual pages are for page-specific overrides only (layout grid, page-specific spacing, page-specific components). `design-system.html` imports the same `styles.css` as production — no component CSS is duplicated between pages.

**Design system demo override pattern:** Any shared component rule that uses `opacity:0` / `transition` for a JS-revealed animation needs a matching override in `design-system.html`'s inline `<style>` block, alongside the existing `.page-header-reveal` reset: `.ds-component-demo .component-class { opacity:1; transition:none; }`. Demos don't run page JS so `.visible` is never added — without the override, the component renders invisible in the design system. Currently: `.page-header-reveal` and `.tabs-bar` both have overrides at line 115–117 of `design-system.html`.

**Browse result row pattern (`.candidate-card`, `.committee-row`, `.committee-result-row`):** All three use `border-bottom:1px solid var(--border)` only — no background, no full border, no adjacent-sibling `border-top:none` suppression (no longer needed with bottom-border-only). Horizontal padding is `var(--space-8)` on all three, giving hover tint breathing room. Hover state is `background:var(--surface2)`. `.candidate-card` and `.committee-row` use `display:grid; grid-template-columns:1fr auto; align-items:flex-start; gap:var(--space-8) var(--space-16)` — name left, meta tags right. `.committee-result-row` uses `display:flex; align-items:flex-start; justify-content:space-between`. On mobile (≤860px): grid collapses to `1fr`, flex wraps, `.candidate-card-meta` and `.committee-card-meta` drop below and left-align via `justify-content:flex-start; width:100%`. **`.committee-card-meta`** is the shared meta wrapper for both `.committee-row` (committees.html) and `.committee-result-row` (search.html) — `display:flex; align-items:center; gap:var(--space-8); flex-shrink:0; flex-wrap:wrap; justify-content:flex-end` — comma-grouped with `.candidate-card-meta` in `styles.css`.

**`.candidate-card-office` — removed:** Replaced by `<span class="tag tag-neutral">` with `formatRaceName()` output on all pages. CSS rule and last call site (committee.html) both removed 2026-03-20.

**`.committee-name-link` — active in modal, removed from committees.html:** The `.committee-row` in committees.html converted to a full `<a>` tag — the inner `.committee-name-link` anchor is gone there. However, the class is still in use in `candidate.html`'s committees modal (`renderCommitteeGroups()`) as the link on each committee name. The CSS rule in `styles.css` should stay. Remove only after that modal render is refactored.

**Party tag render order:** Race tag first, party tag second — on candidates.html and search.html. This is the canonical order for browse/search results. On candidate.html, the race tag has been removed from the header meta-row entirely — only the party tag remains there, with the race context moved to `.candidate-race-label` above the name. Party tag always includes `title="..."` via `partyTooltip(c.party, c.party_full)` — native browser tooltip on desktop hover.

**Office/race display in candidate cards:** Use `formatRaceName(c.office, c.state, c.district)` + `<span class="tag tag-neutral" style="font-size:0.625rem">` to render the race/seat label in candidate card meta rows. This is the canonical pattern on all three browse pages.

**Shared form controls:** `.form-input`, `.form-select`, `.form-search-btn` (and their focus/disabled variants) are defined in `styles.css` and used across search.html, candidates.html, and committees.html. `.toggle-switch` (CSS-only pill toggle: hidden checkbox + `.toggle-track` + `.toggle-knob` + `.toggle-label`) is also defined in `styles.css` — used on committees.html filter bar for "Show terminated". `.toggle-label` uses DM Sans 0.8rem to match form input value text. Also in `styles.css` (promoted from candidates.html/committees.html): `.search-combo` (position:relative; display:flex — the search input + button row), `.search-combo .form-input` (flex:1; min-width:160px; border-right:none), `.state-combo`, `.state-combo .form-input`, `.filter-bar-wrap`, `.filter-bar`, `.form-field`, `.form-label`, `.filter-chips-wrap`, `.filter-chip`, `.chip-x`, `.chip-clear-all`, `.results-area`, `.no-results`, `.error-prompt`, `.retry-btn`. Page-specific extensions stay inline: `.form-select.wide` (committees only), `.search-bar .form-input` (search.html flex + border-right). **Custom combo dropdowns:** `.combo-wrap` + `.combo-trigger` (in `styles.css`) + `initComboDropdown(config)` (in `utils.js`) implement the accessible filter dropdown pattern used for office/party/cycle on candidates.html, type on committees.html, and year/office on races.html. The trigger `<button>` carries both `combo-trigger` and `form-select` classes for visual consistency — **critical:** the hide/show CSS for native selects inside `.combo-wrap` must use `select.form-select` (type-qualified), not `.form-select`, to avoid hiding the button via specificity. At ≤860px, `.combo-wrap .combo-trigger { display:none }` and `.combo-wrap select.form-select { display:block }` swap in the native `<select>` for mobile. `initComboDropdown` returns `{ setValue(v), setDisabled(bool) }` — use these in `clearFilter`, `clearAllFilters`, and `init` to keep combo state in sync with `activeFilters`. **CSS consolidation (2026-04-01):** `.combo-wrap` is now the single source for `position:relative` and `select.form-select { display:none }` (desktop) / `select.form-select { display:block }` (mobile) / `.typeahead-dropdown { display:none !important }` (mobile). `.state-combo` retains only its unique rules: `.form-input { width:120px }`, `.typeahead-dropdown { min-width:200px }`, mobile `.form-input { display:none }`, mobile `select.form-select { width:120px }`. All three state-combo divs in HTML carry both `state-combo` and `combo-wrap` classes.

**Button group (`.button-group` + `.button-group-btn`):** Defined in `styles.css`. Inline-flex toggle button group — mono 0.625rem uppercase with `--ls-expanded`, `height:34px` (matches `.form-input`/`.form-select`), shared collapsed borders, active state with `--color-navy-950` fill. Used on feed.html for office and time window filters. Reusable anywhere a segmented toggle control is needed.

**End-of-results (`.end-of-results`):** Defined in `styles.css`. Mono 0.625rem uppercase muted, centered, `border-top:1px solid var(--border)`, `display:none` default. Used on candidates.html, committees.html, and feed.html. JS toggles via `style.display = 'block'`.

**`.sr-only` utility:** Defined in `styles.css`. Standard visually-hidden pattern (`position:absolute; width:1px; height:1px; ...`). Use for submit buttons that are visually replaced by icon affordances — keeps the button DOM-present and keyboard/screen-reader accessible while invisible.

**Icon-leading search pattern (`.search-field`):** All search inputs on the site use this pattern. `.search-field` is `position:relative; display:flex; align-items:center`. `.search-field-icon` is `position:absolute; left:var(--space-8); color:var(--muted); pointer-events:none`. The input inside gets `padding-left:calc(var(--space-8) + 14px + var(--space-8))` (8 + icon + 8 = 30px). Icon SVGs use `aria-hidden="true" focusable="false"`. Submit buttons use `.form-search-btn.sr-only` with `type="submit"` and `aria-label="Search"`. **Critical:** The sr-only button must live *inside* `.search-field` (not as a sibling outside it) — placing it outside breaks the visual pattern and makes it visible. Context-specific flex rules: `.search-combo .search-field { flex:1; min-width:0 }`, `.top-nav-mobile-search-form .search-field { flex:1 }`. Page-level search.html uses `.search-bar .search-field { flex:1 }` in inline styles. **Browse page filter bar search** (`.search-combo`) uses `type="button"` (not `type="submit"`) with `id="search-btn"` wired via `addEventListener('click', submitSearch)` — Enter is handled via a `keydown` listener on the input; the sr-only button enables keyboard accessibility without form submission.

**Nav search typeahead:** Global typeahead on the desktop nav search input is implemented in `main.js`. Functions `officeWord`, `buildTypeaheadHTML`, `showNavTypeahead`, `hideNavTypeahead`, `doNavTypeahead` live in `main.js` and are available on all pages. The `bindSearchForm` submit handler checks `window.__navSearchHandler` — if set, calls it instead of redirecting to `/search?q=`. `search.html` sets `window.__navSearchHandler` to fire `doSearch()` inline (no page reload). All 9 pages include `#nav-typeahead-dropdown` with `position:relative` on `.top-nav-search`. The `#search-input` (hero search on search.html) carries full combobox ARIA: `role=combobox`, `aria-haspopup=listbox`, `aria-expanded` (toggled by show/hideTypeahead), `aria-controls=typeahead-dropdown`, `aria-autocomplete=list`.

**Nav logo markup:** Two-tone split via separate spans: `<span class="logo-fec">FEC</span><span class="logo-ledger">Ledger</span>` inside `.top-nav-logo`. `.logo-fec` = `--color-red-700`; `.logo-ledger` = `--color-navy-950`. Do not use `<em>` or plain text — the split requires separate spans. Playwright tests check for both spans in `.top-nav .top-nav-logo`. **Weight deviation:** `.top-nav-logo` uses `font-weight:600` — an explicit deviation from the `heading` type style (Oswald 400). Weight is set directly on the component rule in `styles.css`, not inherited from the type system.

**Banner and nav architecture (sticky pattern):** `.global-banner` is in-flow (not fixed). `.top-nav` uses `position:sticky; top:0`. This means the banner is visible above the nav on page arrival and scrolls away naturally — the nav sticks only after the banner is out of the viewport. **Critical DOM order:** `.global-banner` must immediately precede `<nav class="top-nav">` in every HTML file — sticky only works when the banner is above the nav in the document flow. `.main` does NOT need `padding-top` to offset a sticky nav — it is already in-flow. **Critical — `.main` uses `overflow-x:clip`, NOT `overflow-x:hidden`:** `overflow-x:hidden` implicitly sets `overflow-y:auto`, creating a scroll container that breaks `position:sticky` for all children (sticky elements stick relative to the scroll container, not the viewport). `overflow-x:clip` clips horizontal overflow visually without creating a scroll container. Do not change this back to `hidden`. **Mobile panels are DOM children of `<nav class="top-nav">`, not siblings:** Both `#mobile-nav` (`<nav class="mobile-nav">`) and `#top-nav-mobile-search` (`.top-nav-mobile-search`) live inside `<nav class="top-nav">` and use `position:absolute; top:100%`. `top:100%` on an absolutely-positioned child of a sticky parent always resolves to directly below the nav's bottom edge — whether the nav is in-flow or stuck at viewport top. Being inside `.top-nav`'s stacking context (z-index:200) automatically elevates these panels above all lower-z-index page elements (profile headers at 195, tabs bar at 185) without needing their own explicit z-index. **Do not move these panels outside `.top-nav`:** `position:fixed; top:var(--header-h)` fails here because when the in-flow banner (32px) is still visible, the nav occupies 32–88px in the viewport and fixed panels at top:56px land inside the nav area. Playwright tests `mobile nav and search panel are children of .top-nav` and `mobile nav has four links` enforce this DOM structure. Playwright test: `.global-banner precedes .top-nav in the DOM` checks `compareDocumentPosition` to enforce banner order contract.

**`apiFetch` array params:** `utils.js` `_execute` supports array values in the params object — `{ filing_frequency: ['-T', '-A'] }` correctly serializes to `filing_frequency=-T&filing_frequency=-A`. This was added 2026-03-31 to support multi-value filter params. All existing scalar call sites are unaffected.

**Typeahead container:** `.typeahead-dropdown` is the canonical class, defined in `styles.css` (position, sizing, shadow, `display:none` default, `max-height:240px`, `overflow-y:auto`). All three search pages (search.html, candidates.html, committees.html) use `.typeahead-dropdown`. Toggle mechanism differs by page: browse pages use `classList.add/remove('open')` with `.typeahead-dropdown.open { display:block }`; search.html uses `style.display` directly. **Critical:** The `.map()` callback in `renderTypeahead()` on browse pages must be `function(c, i)` — the `i` index is used in the Amplitude onclick string. If omitted, a `ReferenceError` silently kills the typeahead (caught by the surrounding try/catch, which calls `closeTypeahead()`). All three pages handle Escape key to close the typeahead.

**Typeahead item format:** candidates.html right side = office word only (`House`/`Senate`/`President`, no state, no bullet). committees.html right side = status dot only (no text label). search.html uses the same format as these — it is the reference.

**Chart colors:** `--chart-*` CSS vars in `styles.css :root` are the canonical chart palette. JS chart configs reference the `CHART_COLORS` constant defined in `utils.js`. `CHART_COLORS` is populated via a `getComputedStyle` IIFE that reads the CSS variables at runtime — changing a token in `styles.css :root` automatically propagates to charts with no changes needed in `utils.js`. HTML legend swatches use the CSS vars directly (`style="background:var(--chart-raised)"`). Add new chart color vars to `styles.css :root` first; `utils.js` will pick them up via the IIFE.

### Token naming tiers

- **Tier 1 — Primitives:** Raw hex values. Not CSS vars. Documented in `design-system.html` only. Do not use directly in components.
- **Tier 2 — Semantic tokens:** CSS vars in `styles.css :root`. Named by meaning, not appearance (`--bg`, `--surface`, `--dem`, `--green`). New tokens always go here first. Add to `styles.css :root` and document in `design-system.html`.
- **Tier 3 — Component tokens:** Not yet built. Would be things like `--tag-dem-bg`. Document as `planned` in `design-system.html` before building.

**Rgba semantic token refactor — deferred:** Several semantic tokens in `:root` (`--chart-raised`, `--chart-spent`, `--chart-overlay-*`, etc.) are expressed as raw `rgba()` values rather than `color-mix()` derivations from primitives. This is a known cleanup item. Blocked on a decision about whether blue-500 (`#4a90d9`), red-500 (`#d94a4a`), and chart-amber (`rgba(232,160,32,...)`) should be promoted to `:root` as explicit primitive tokens. Do not refactor piecemeal — address as a single pass when unblocked.

**Spacing token system (8px grid):** All padding, margin, and gap declarations in `styles.css` AND inline `<style>` blocks use `--space-*` tokens exclusively. Do not write raw rem spacing values in either location — map to the nearest token using the table below. The only permitted raw values are sub-floor fine-tunes (below 0.1rem) and values above the scale ceiling (above 4rem), both must be documented with an inline comment.

Off-grid values map to nearest token as follows:
```
0.1–0.2rem  → --space-4    0.3–0.35rem → --space-4
0.4–0.75rem → --space-8    0.8–1.2rem  → --space-16
1.25–1.5rem → --space-24   1.75–2rem   → --space-32
```

```
--space-2:  2px      micro — fine-tuning only; leave an inline comment at every call site
--space-4:  0.25rem  tag padding, chip gap, form-field label gap, entry-date margin, icon fine-tune
--space-8:  0.5rem   meta gaps, form control padding, tight component rows, badge padding, swatch gaps
--space-16: 1rem     standard component padding, card internals, table cells, insight/field-notes padding
--space-24: 1.5rem   section subgaps, modal padding, nav inner, content area padding, card/cell top padding
--space-32: 2rem     section gap (--section-gap), results area, timeline indent, entry margin, profile-content top padding, page-header bottom padding
--space-40: 2.5rem   page-header top
--space-48: 3rem     page gutter (desktop) — use via var(--page-gutter)
--space-64: 4rem     DS section margin, timeline entry gap, hero state padding
```

Documented non-token exceptions: `margin-bottom:-1px` in `.tab` (border-offset technique); `calc(-1 * var(--space-24))` for the negative modal committee-row flush margin. Inline block exception: `margin-top:0.05rem` on `.changelog-bullet` in `process-log.html` (0.8px — below mapping floor, fine-tune only).

**Page gutter pattern:** All content sections use `var(--page-gutter)` for horizontal padding — resolves to `var(--space-48)` (48px) on desktop, `var(--space-16)` (16px) on mobile (≤860px). Mobile value is overridden in `:root` inside `@media (max-width:860px)`. When adding a new page or content section, use `padding: <vertical> var(--page-gutter)`. Component-internal padding (buttons, cards, modals) uses `--space-*` tokens directly, not `--page-gutter`.

**Known intentional overlap:** `--red` and `--rep` both resolve to `#d94a4a`. `--rep` = Republican partisan color; `--red` = status color (stressed/error). Do not merge them. If the status system ever diverges from the partisan palette, split them at that point.

### Component status lifecycle

Each component in `design-system.html` has a `data-status` attribute and badge:
- New component added to one page → document with `candidate-only` or `log-only` status in the same session
- Component moves to a second page → update status to `stable`
- Component being removed → set `deprecated` first, remove code in a later session
- Planned component → add with `planned` status before building

### Figma data attributes

Every color swatch has `data-token` and `data-hex` attributes. Every component card has `id="comp-{name}"`. Preserve these when editing `design-system.html`.

---

### CSS variables (defined in `styles.css :root`)

Light "broadsheet" theme. Key CSS variables:

```
--color-navy-950: #05234f  (brand primitive — backs logo "Ledger", banner bg, future brand accent)
--color-red-700:  #a83228  (brand primitive — backs logo "FEC", also backs --rep and --red)

--bg: #F8F5EC        (page background + nav)
--surface: #ffffff   (cards, panels)
--surface2: #eee9e1  (chart interiors, inset elements)
--border: #D7D1C7
--border-strong: #a8a099  (strong borders, nav dots default)
--text: #1a1510
--muted: #625b52
--subtle: #46403a
--dem: #1e3a5f       (Democrat)
--rep: #a83228       (Republican — resolves via --color-red-700)
--ind: #5a4a7a       (Independent)
--green: #1e6644     (healthy)
--filing-active: #3dbf7a (active filing status dot)
--amber: #8a5f10     (watch / warning)
--red: #a83228       (stressed — resolves via --color-red-700; same value as --rep, intentionally kept separate)
--filing-terminated: #a8a099 (terminated filing status dot)
--accent: #2c5282    (interactive accent, active indicators)
--accent-dim: rgba(44,82,130,0.1)  (accent tint)
--overlay-bg: rgba(26,21,16,0.65)  (modal and drawer overlay scrim)

Layout tokens (reference --space-* scale):
--page-gutter: var(--space-48)   (48px desktop / var(--space-16) 16px mobile ≤860px)
--section-gap: var(--space-32)   (32px — vertical margin-bottom between stacked content sections)
--header-h: 56px                 (sticky top nav height)
--banner-h: 32px                 (in-flow global banner height; banner scrolls away naturally before nav sticks)

Nav tokens:
--nav-active-bg: #d4cdc3  (nav active state background — currently unused, reserved)
```

**Typography — named type styles:** All text must use one of these 10 canonical styles. Do not introduce new font-family/font-size/font-weight combinations — map to the closest existing style. The styles are documented in `styles.css :root` (comment block) and rendered as live specimens in `design-system.html`.

| Style | Family | Size | Weight | Transform | Spacing | Line-height |
|---|---|---|---|---|---|---|
| **display** | Oswald | clamp(2rem,5vw,4.5rem) | 600 | uppercase | `--ls-tight` | `--lh-tight` |
| **stat** | Oswald | 2rem | 600 | — | — | `--lh-tight` |
| **heading** | Oswald | 1.25rem | 400 | uppercase | — | — |
| **tab** | Oswald | 1.25rem | 400 | none | — | — |
| **subheading** | Oswald | 0.875rem | 600 | uppercase | — | — |
| **label** | IBM Plex Mono | 0.625rem | 400 | uppercase | `--ls-expanded` | — |
| **caption** | IBM Plex Mono | 0.625rem | 400 | none | — | — |
| **body** | IBM Plex Sans | 0.75rem | 400 | none | — | — |
| **body-emphasis** | IBM Plex Sans | 0.875rem | 500 | none | — | — |
| **prose** | IBM Plex Serif | 0.875rem | 400 | none | — | — |

"—" = inherits default (no explicit declaration needed). Exceptions outside the system: `body` element (14px base), `.global-banner-text` (Mono 10px).

**Typography tokens (CSS vars in `styles.css :root`):**
- Line-height: `--lh-expanded: 1.75` (prose/notes), `--lh-normal: 1.5` (body default), `--lh-tight: 1` (display/numeric)
- Letter-spacing: `--ls-tight: -0.125rem` (display titles, fixed rem), `--ls-expanded: 0.1em` (small uppercase labels, proportional em)

Font families: Oswald 400/600 (display/headings), IBM Plex Sans 400/600 (body/nav), IBM Plex Serif 400/600 (editorial prose), IBM Plex Mono 400/600 (labels/data). Redesign branch only; main uses Barlow Condensed + DM Sans.

---

## Current files

```
index.html        — Root redirect → search.html (entry point)
search.html       — Candidate name search (live)
candidates.html   — Unified browse+search (live): auto-load, inline search + typeahead, state combo, filter chips, URL sync, error state
candidate.html    — Single candidate profile (live, primary active file)
committees.html   — Unified browse+search (live): auto-load, inline search + typeahead, state combo, filter chips, URL sync, error state, "Show terminated" toggle (off by default — excludes `filing_frequency=T/A`; `?terminated=1` URL param)
committee.html    — Single committee profile (tabs bar + cycle switcher live; Raised tab live; Spent tab live — donut by category, purpose bars, vendors table, contributions to candidates & committees; filing history removed from scope)
races.html        — Browse races by year, office, state (live — progressive enrichment from /elections/; URL sync on cycle/office/state filters)
race.html         — Single race view — all candidates in a contest (scaffold)
feed.html         — Filing feed — recent candidate committee filings (live): load-all-upfront, client-side office/report-type/time-window filters, filter chips, refresh with dedup, Amplitude tracking
process-log.html  — Living case study / dev diary
design-system.html — Token and component reference (live)
project-brief.md  — Full product vision and open questions
ia.md             — Information architecture reference (page inventory, nav structure, URL patterns)
test-cases.md     — Manual browser test checklist; one section per page + shared checks + test log
TESTING.md        — Playwright automated test setup, Track 1 vs Track 2 commands, how mocking works
playwright.config.js       — Playwright config (Track 1, structural, mocked API)
playwright.smoke.config.js — Playwright config (Track 2, smoke, live FEC API)
package.json      — npm scripts: test, test:smoke, test:report
_redirects        — Netlify 200 rewrites for /candidate/:id and /committee/:id (Cloudflare overrides these with Pages Functions)
functions/
  api/fec/[[path]].js            — Cloudflare Pages Function: proxies /api/fec/* → api.open.fec.gov/v1/*, injects API_KEY secret
  api/aggregations/[[path]].js   — Cloudflare Pages Function: reads env.AGGREGATIONS KV. Two routes share the same shape:
                                   GET /api/aggregations/top-contributors?committee_id=X&cycle=Y   (key top_contributors:{id}:{cycle})
                                   GET /api/aggregations/top-committees?committee_id=X&cycle=Y     (key top_committees:{id}:{cycle})
                                   Both return {results, source} where source='bulk' on KV hit, source='api' on miss (200,
                                   client falls back). 400 on malformed committee_id or cycle. 404 on unknown aggregation path.
  candidate/[[catchall]].js      — Cloudflare Pages Function: serves candidate.html for /candidate/:id (clean URL, no .html)
  committee/[[catchall]].js      — Cloudflare Pages Function: serves committee.html for /committee/:id (clean URL, no .html)
pipeline/                  — Standalone Cloudflare Worker: HTTP trigger only (no cron — all processing moved to GitHub Actions 2026-04-16)
  wrangler.toml            — Worker config: name=fecledger-pipeline, R2 binding (BULK→fecledger-bulk); cron removed
  package.json             — Worker deps: no third-party deps (fflate removed; uses native DecompressionStream)
  README.md                — Infrastructure overview: architecture, file manifest, R2 bucket structure, manual triggers, auth setup
  src/index.js             — Worker: fetch handler (GET /admin/pipeline/run) retained for ad-hoc testing; FILES=[] (empty); utility
                             functions (processZip, filterColsBinary, etc.) retained for future Worker use
                             Deploy: cd pipeline && npm install && npx wrangler deploy
.github/
  workflows/fec-bulk-pipeline.yml — GitHub Actions: daily cron 6am UTC + workflow_dispatch; Node.js 24; runs
                                    scripts/ingest-bulk.js, then scripts/precompute-aggregations.js in the same job
scripts/
  ingest-bulk.js                — Node.js pipeline: downloads all 9 FEC bulk files (indiv22/24/26 + pas222/24/26 + cm22/24/26); conditional
                                  fetching via HEAD request + fec/meta/pipeline_state.json; BulkProcessingStream (column filter for indiv and cm,
                                  passthrough for pas2); per-file state write for partial-run recovery; writes fec/last_updated.json
                                  { indiv, pas2, cm } on success. R2 keys: fec/indiv/{year}/indiv.csv, fec/pas2/{year}/pas2.csv,
                                  fec/cm/{year}/cm.csv. cm.txt is FEC's Committee Master File (15 cols filtered down to CMTE_ID + CMTE_NM)
                                  — see CM_HEADER/CM_KEEP_COLS constants for the full 15-col reference schema. fileConfig() centralizes the
                                  per-type dispatch (URL, r2Key, header, keepArr) so main() and processFile() share one source. Note:
                                  PAS2_HEADER is 22 columns (includes CAND_ID between OTHER_ID and TRAN_ID) — earlier versions wrote 21 cols,
                                  which broke DuckDB downstream; see pre-computation pipeline below.
  precompute-aggregations.js    — DuckDB-based pre-computation of top contributors per committee per cycle. Runs after
                                  ingest-bulk.js completes. For each cycle in CYCLES (all 24 even years 1980–2026 since 2026-04-21
                                  historical backfill): downloads pas2 + indiv + cm CSVs from R2 to /tmp, runs SQL GROUP BY
                                  queries (spill-to-disk bounded memory, 100% accurate totals), writes top 25 per in-scope
                                  committee to Cloudflare KV via REST bulk PUT. Per-cycle scoped wipe (not global) — deletes
                                  only keys ending in `:{cycle}` before writing new entries, so cycles with unchanged source
                                  files can be skipped entirely without losing their KV data. Skip logic: compares the three
                                  source files' Last-Modified tuple (read from state['indiv{yy}'], state['pas2{yy}'],
                                  state['cm{yy}']) against state.precompute[year] from fec/meta/pipeline_state.json — if they
                                  match, skip SQL + KV work for that cycle. state.precompute[year] is updated after each
                                  successful cycle, matching ingest's per-file write-on-success pattern. TTL: 7 days.
                                  Schema constants for each file
                                  (INDIV_COLUMNS, PAS2_COLUMNS, CM_COLUMNS) feed columnsToSqlMap() for DuckDB read_csv calls. Both key
                                  patterns are populated (ENABLE_TOP_COMMITTEES_PASS = true):
                                    • `top_contributors:{cmte_id}:{cycle}` — individual donors, aggregated over indiv with memo filter
                                      and scope rule (committee appears in pas2 as a CMTE_ID giver OR has ≥500 post-memo rows in indiv).
                                      Row shape: {name, entity_type, city, state, total} where city/state use any_value() per donor
                                      (mode() was tried first but blew past the 28-min historical pipeline ceiling on 2024's indiv file).
                                    • `top_committees:{cmte_id}:{cycle}` — aggregates pas2 WHERE OTHER_ID=this committee, grouped by
                                      CMTE_ID (giver). Row shape: {name, entity_type, committee_id, total}. Display name comes from cm.txt
                                      via LEFT JOIN on giver's CMTE_ID (with COALESCE fallback to pas2's filer NAME for unregistered givers).
                                      Self-affiliate filter compares cm.txt-sourced names on giver and receiver; ID-level filter
                                      (giver_id != receiver) kept as belt-and-suspenders. Critical: cm.txt read uses quote='' in read_csv
                                      because CMTE_NM contains literal " chars in some rows (e.g. CONSTANCE "CONNIE" JOHNSON).
  package.json                  — @aws-sdk/client-s3 + @aws-sdk/lib-storage + @duckdb/node-api dependencies
tests/
  helpers/amp-mock.js  — Amplitude mock (blocks CDN, stubs sessionReplay, reads _q queue)
  helpers/api-mock.js  — FEC API mock (route intercept + fixture data for all endpoints)
  shared.spec.js       — 16 structural tests × all 10 pages (nav, CSS, Amplitude, background)
  candidate.spec.js    — candidate.html tests (stats, modal, chart, tabs, Amplitude events)
  search.spec.js       — search.html tests (states, interaction, Amplitude events)
  pages.spec.js        — all other pages + mobile layout + feed.html (16 feed-specific tests)
  smoke.spec.js        — 5 live-API smoke tests (@smoke tagged)
```

**Local dev:** `python3 -m http.server 8080` from project root → `localhost:8080/` (redirects to search.html)

---

## Candidate page: current state

The candidate page (`candidate.html`) is the main work in progress. It accepts any candidate via `?id=` URL param (e.g. `candidate.html?id=H2WA03217`). MGP is the default fallback for development.

- **Test candidate:** Marie Gluesenkamp Perez — `H2WA03217` (House, WA-03)
- **Also verified with:** Kirsten Gillibrand — `S0NY00410` (Senate, NY)
- **Local dev:** `python3 -m http.server 8080` from project root, then `localhost:8080/candidate.html?id=H2WA03217`

### What's working
- Profile header: `.candidate-race-label` div above `.profile-header-row` renders a long-form race label (`formatRaceLabelLong()`) in red-700 Oswald 400 uppercase, linking to the race page; `.profile-header-row` below has candidate name + party tag (race tag removed from header meta-row) + "Committees (N) →" trigger floating right via `margin-left:auto`
- Race context sentence (`.tag-context` pill sourced from `/elections/`, skeleton while loading) lives in a persistent `#race-context-bar` strip between the tab bar and content — visible on all tabs
- Cycle switcher is a `<select>` element, first child of `.tabs-bar`, populated from `election_years` — `loadCycle()` updates `select.value` in sync; Amplitude `Cycle Switched` fires on `onchange`
- URL anchor encodes cycle + tab: `candidate.html#2024#summary`
- Tab navigation: Summary, Raised, Spent
- **Summary strip (`#summary-strip`):** persistent wrapper sibling to `#content` inside `.main-inner` that contains `.banner` + `.stats-grid`. Visible on all three tabs — users never lose sight of top-line cycle framing when drilling into Raised or Spent. Mirrored on committee.html (stats-grid only — no banner). Scoped CSS override `.profile-content { padding-top:0 }` removes the old summary-tab padding; stats-grid's existing `margin-bottom:--section-gap` handles the gap to tab content. Reveal JS toggles `#summary-strip` visibility in the same RAF block as `#race-context-bar` and `#content`.
- Stats row (order matters): Raised-to-Spent Ratio → Cash on Hand → Total Raised → Total Spent. On committee.html the order is Coverage Through → COH → Raised → Spent. Cards are referenced by ID (`#stat-ratio`, `#stat-coh`, etc.) so rendering logic is DOM-order-independent.
- **Edge-to-edge border pattern:** `#summary-strip` has no horizontal padding — it's full-width inside `.main-inner`. Horizontal `var(--page-gutter)` padding is applied to the bordered children (`.banner`, `.stats-grid`) instead. Because `border-top`/`border-bottom` draw on the border box, the navy rules extend edge-to-edge while stat card / banner content stays gutter-aligned with the rest of the page. Scoped via `#summary-strip .banner` and `#summary-strip .stats-grid` selectors in each page's inline `<style>` block.
- **Mobile stat-card borders** (`@media ≤860px` in `styles.css`): stats-grid switches to `repeat(2,1fr)` 2×2 layout with `.stat-card:nth-child(even) { border-right:none }` (removes stray right border on card 2) and `.stat-card:nth-child(-n+2) { border-bottom:1px solid #05234f }` (divider between top and bottom rows). Rules assume exactly 4 cards in the grid.
- Cycle-aware banner (`.banner` inside `#summary-strip`): health signal (green/amber/red) for active cycles; "Cycle Complete" summary for closed cycles. Banner has a navy `border-top:1px solid #05234f` matching the stats-grid rules. `.banner-label` and `.banner-desc` use prose type (IBM Plex Serif 0.875rem); `.banner-note` uses caption type (Plex Mono 0.625rem). Closed-cycle copy: desc is `"Cycle concluded with {X in outstanding debt | no outstanding debt reported.}"`, note holds `"Final coverage: {date}"` (empty string when no `covDate`). No-Data copy: desc is `"No filings this cycle."`, note is empty. `.banner` is `candidate-only` in the design system — committee.html and race.html have no banner.
- Associated committees modal: "Committees (N) →" trigger in profile header opens a modal with Active and History tabs; committees fetched eagerly at init so count is immediate
- **Raised tab — Top Committee Contributors:** Paginated `/schedules/schedule_a/?is_individual=false` to full exhaustion across all sub-cycles via `Promise.all` (House: 1 call per sub-cycle; Senate: 3; Presidential: 2). `apiFetch`'s `MAX_CONCURRENT=4` queue bounds parallelism. No artificial cap — candidate committees have bounded committee-to-committee transfer volume so page loads stay under ~10s even for Senate candidates. Dedup by `contributor_committee_id` naturally sums contributions from the same committee across sub-cycles. Memo filter (`memo_code === 'X'`) excludes conduit itemization from the committee contributors total.
- **Raised tab — Top Conduit Sources:** Second aggregation pass over the same `allRows` data in `fetchRaisedData()`, collecting only `memo_code === 'X'` rows. No additional API calls. Surfaces conduit platforms (ActBlue, WinRed, Anedot) that forward individual contributions — distinct legal category from committee contributors. `#conduits-card` sits below `#donors-card` in the Raised tab markup with identical `.donors-card` + `.donors-table` structure.
- **Cycle label format (shared convention):** Year-range string computed on every render so cycle-switcher changes propagate correctly. candidate.html: `(data.subCycles[0] - 1) + '–' + data.subCycles[data.subCycles.length - 1]` — House reads "2025–2026", Senate "2021–2026", Presidential "2023–2026". committee.html: `(cycleOrAll - 1) + '–' + cycleOrAll` when a specific cycle is selected, "Most recent cycle" on All time. Both pages apply this to the Raised tab card headers and data notes.
- Responsive layout: desktop sidebar nav, mobile scroll-aware header + hamburger drawer
- Smooth fade-in animations on load; profile header, tabs bar, race context bar, and content all revealed together in the RAF block
- Compact sticky header (single-element pattern): `#profile-header` is `position:sticky; top:var(--header-h)` always — behaves as `position:relative` until the scroll threshold, then sticks. When `#profile-header-sentinel` (a zero-height sibling div in normal flow, placed just before the header) scrolls above the top nav, a scroll listener adds `.compact` class to the header. Compact mode changes `flex-direction:row` and padding — no display toggling, no flash. **Critical — JS-revealed elements inside compact header:** Any element shown via `el.style.display = 'something'` (inline style) will override a stylesheet `display:none` rule. Use `display:none !important` on compact-scoped hide rules for any element that JS reveals — e.g. `#profile-header.compact #committees-trigger { display:none !important }`. Pattern ported identically to `committee.html` (`#committee-header`) and `race.html` (`#race-header`). CSS selectors are combined: `#profile-header, #committee-header, #race-header { ... }`. Tabs bar `top` offset updated via `tabsBarEl.style.top` only on compact state transitions (not every scroll event); compact header height measured once via `offsetHeight` on first compact engagement and cached in `compactHeaderH`. Scroll listener guards on `isCompact` state — exits early if compact state unchanged, preventing per-frame forced layout recalculation. `display:flex; flex-direction:column` always applied — reveal code uses `style.removeProperty('display')` so CSS controls the flex display value entirely. Max-width/padding alignment uses the `max()` trick: `padding-left: max(var(--page-gutter), calc((100% - 1600px) / 2 + var(--page-gutter)))` (same as tabs-bar). **Critical:** `overflow-x:clip` (not `hidden`) on `.main` AND `body` — `hidden` creates an implicit scroll container that breaks `position:sticky` for children and disrupts `overflow-anchor` targeting. Do not change either back to `hidden`. **Critical:** `html { overflow-anchor: none }` in `styles.css` — the compact height change on a sticky element triggered browser scroll anchoring (scrollY auto-adjusted to compensate for layout shift, causing a compact→uncompact feedback loop). Disabling anchoring site-wide is safe for this project; the only place anchoring would be useful (feed.html refresh prepending rows) is not negatively impacted. **Critical — scroll clamping:** Three additional mechanisms prevent a second class of loop caused by browser scroll clamping (distinct from anchoring): (1) `suppressUntil` — 100ms cooldown variable set on every state transition; `update()` exits early while active, absorbing any clamping-triggered scroll events during layout settling. (2) `paddingBottom` compensation — when compact engages, `Math.min(80, fullH - compactHeaderH)` px is added to `.main.style.paddingBottom`; this keeps document height stable so scrollY is never clamped below the un-compact threshold; cleared on un-compact. (3) `showTab` minHeight lock — on `candidate.html` and `committee.html`, before switching to a Raised or Spent tab that hasn't rendered yet, `mainEl.style.minHeight = document.body.scrollHeight` is set to prevent document height collapse during the loading spinner phase (tab content starts with `display:none`); cleared after `renderRaisedIfReady`/`renderSpentIfReady` resolves or rejects. Without (3), the first visit to Raised or Spent while compact would cause the page to snap to the top.
- `.main-inner` wrapper inside `.main` constrains content to `max-width:1600px` and centers it via `margin-left:auto; margin-right:auto` — defined in `styles.css`. All 7 pages use it. Key insight: `margin:auto` centering doesn't work on grid items (`.main` itself), but does work on a normal block element inside a grid item — that's why `.main-inner` solves the ultra-wide problem where earlier attempts on `.layout` and `.main` failed.

### Chart architecture
- Type: line chart with `type: 'time'` x-axis (requires date-fns adapter)
- X-axis spans full election cycle, office-aware: House = 2yr, Senate = 6yr, President = 4yr
- Points only at actual filing dates (quarterly cadence = 4–8 points per cycle)
- Raised and Spent: `stepped: 'before'` (cumulative, stair-step between filing dates)
- Cash on Hand: linear connect (snapshot value, not cumulative)
- Overlay plugin draws vertical lines: grey dashed = filing deadlines, amber dotted = election dates, subtle = "today" (active cycles only)

### Key FEC API endpoints in use
```
GET /candidate/{id}/                          — candidate metadata
GET /candidate/{id}/totals/?cycle={year}      — cycle-level financial totals
GET /candidate/{id}/committees/               — associated committees (not cycle-scoped; returns all)
GET /committees/?sponsor_candidate_id={id}    — leadership PACs sponsored by this candidate (separate endpoint!)
GET /committee/{id}/                          — committee metadata (name, type, designation, status)
GET /committee/{id}/totals/?per_page=1        — committee financial summary (most recent filing)
GET /committee/{id}/reports/?cycle={year}     — per-period filing reports (chart data)
GET /reporting-dates/?report_year={year}&report_type={type} — filing deadlines (one call per type)
GET /election-dates/?election_state=&office_sought=&election_year= — actual election dates
GET /elections/?state=&cycle=&office=&district= — all candidates in a contest with financial summaries
GET /elections/search/?state=&office=&district=&per_page= — available election cycles for a race (returns {cycle, district, office, state})
GET /candidates/search/?q=&per_page=&sort=    — name-based candidate search
GET /candidates/?state=&office=&party=&election_year= — browse candidates by filter
GET /committees/?state=&committee_type=       — browse committees by filter
GET /filings/?form_type=F3&form_type=F3P&is_amended=false&sort=-receipt_date&min_receipt_date=&per_page=100 — candidate committee filings (feed page)
```

**Critical — `/elections/` office param:** This endpoint requires `office` as a **lowercase full word** (`house`, `senate`, `president`), NOT the single-letter code (`H`, `S`, `P`) used by other endpoints. Passing `H`/`S`/`P` returns a 422 error. Use a conversion function:
```javascript
function officeApiParam(o) {
  return { H:'house', S:'senate', P:'president' }[o] || o.toLowerCase();
}
```
Other endpoints (`/candidates/`, `/candidate/{id}/totals/`) use the single-letter codes — the inconsistency is an FEC API quirk.

**Critical — `/elections/` party field:** This endpoint does NOT return a `party` field. Party affiliation comes back as `party_full` with full names like `"DEMOCRATIC PARTY"` / `"REPUBLICAN PARTY"`. When building cards from `/elections/` data, read `c.party || c.party_full`. The `partyClass()`, `partyLabel()`, and `partyTooltip()` utilities in `utils.js` accept both short codes (`DEM`, `REP`) and full names (`DEMOCRATIC PARTY`, `REPUBLICAN PARTY`). Pass `party_full` as the second arg to `partyTooltip()` when available — it title-cases it for the tooltip (e.g. "Democratic Party").

**Critical — `/elections/` incumbent field:** This endpoint returns `incumbent_challenge_full` (e.g. `'Incumbent'`, `'Challenger'`, `'Open seat'`) — NOT the short-code `incumbent_challenge: 'I'/'C'/'O'` that appears on the `/candidate/{id}/` metadata endpoint. The field is populated at time of candidacy filing, so it's available for future cycles as soon as a candidate has declared. Check `c.incumbent_challenge === 'I' || c.incumbent_challenge_full === 'Incumbent'` to handle both shapes (mock uses short code; live API returns full string).

### Key FEC API field names (verified from live response)
Reports endpoint (`/committee/{id}/reports/`) returns per-filing objects with:
- `total_receipts_period` — raised this filing period only
- `total_disbursements_period` — spent this filing period only
- `total_receipts_ytd` — cumulative raised, resets Jan 1 each year
- `total_disbursements_ytd` — cumulative spent, resets Jan 1 each year
- `cash_on_hand_end_period` — COH snapshot at end of period
- `coverage_start_date` / `coverage_end_date` — in format `"2025-03-31T00:00:00"` (strip `T` and after)
- `report_form` — e.g. `"Form 3"` (use this to filter deadlines)
- **Amended filings:** When multiple reports exist for the same period, use only the most recent. Amendment-tracking fields (verified from live response, C00806174 "Marie for Congress"):
  - `most_recent` (boolean) — `true` = current authoritative version; `false` = superseded. **This is the correct dedup filter.** The API also accepts `?most_recent=true` as a query param to filter server-side.
  - `is_amended` (boolean) — `true` = this record has been superseded by a newer filing. Equivalent to `most_recent: false`.
  - `amendment_indicator` — `"N"` = originally filed as a new report; `"A"` = this record is itself an amendment filing
  - `amendment_indicator_full` — `"NEW"` or `"AMENDMENT"`
  - `amendment_chain` — array of `file_number` integers tracking the full amendment lineage
  - `most_recent_file_number` — float; the `file_number` of the current authoritative version
  - **`amendment_version` does NOT exist** — remove any logic relying on this field name; it is not present in API responses.

Reporting-dates endpoint (`/reporting-dates/`) returns:
- `report_type` — short code e.g. `"Q1"`, `"YE"`, `"12G"`, `"M6"`
- `report_type_full` — human label e.g. `"APRIL QUARTERLY"`, `"YEAR-END"`
- `due_date` — e.g. `"2027-01-31"` (no timestamp, safe to use directly)
- No `report_form` or `form_type` field exists on this endpoint
- **Critical:** `due_date_gte` / `due_date_lte` are silently ignored — API returns all 4,896 records across all time if used
- **Critical:** Correct filter is `report_year=<year>` (one value per call)
- **Critical:** Default sort is by creation date descending — always pass `sort=due_date`
- **Critical:** `per_page` max is 100; 2026 has 182 records so unfiltered fetch cuts off Q3 and YE
- **Critical:** `MY` (mid-year) appears in results but is a PAC type, not a Form 3 quarterly deadline — exclude it
- **Correct approach:** 4 parallel calls per cycle year, one each for Q1, Q2, Q3, YE — each returns exactly 1 record, sidestepping pagination and false positives entirely

Candidate totals endpoint returns:
- `receipts` — cycle total raised (sum of ALL receipt categories below)
- `disbursements` — cycle total spent
- `last_cash_on_hand_end_period` — most recent COH
- `coverage_end_date` — most recent coverage date
- **Receipt breakdown fields** (all summed into `receipts`; used by "Raised breakdown" donut on candidate.html and committee.html — both pages now surface the full 13-field breakdown):
  - `individual_itemized_contributions` — itemized individual donations (>$200 required; ≤$200 permitted)
  - `individual_unitemized_contributions` — lump-sum unitemized individual donations (always ≤$200)
  - `other_political_committee_contributions` — PAC and other non-party committee contributions
  - `political_party_committee_contributions` — contributions from official party committees
  - `transfers_from_other_authorized_committee` — transfers between candidate-authorized committees
  - `candidate_contribution` — direct contribution (gift) from candidate to own committee
  - `loans_made_by_candidate` — loans from candidate to own committee (creates repayable debt)
  - `all_other_loans` — third-party loans (banks, etc.)
  - `federal_funds` — presidential public financing only; always 0 for House/Senate
  - `offsets_to_operating_expenditures` — vendor refunds credited back as receipts
  - `offsets_to_fundraising_expenditures` — fundraising expense credits
  - `offsets_to_legal_accounting` — legal/accounting expense credits
  - `other_receipts` — named FEC line item for miscellaneous receipts (interest, dividends, etc.)
  - **Note:** `candidate_contribution` + `loans_made_by_candidate` are merged into "Candidate self-funding" in the donut. Offsets are grouped as "Refunds & offsets". These fields are confirmed present (may be 0) on live responses.

Committee totals endpoint (`/committee/{id}/totals/`) — amendment safety (verified from live response, C00806174 "Marie for Congress"):
- Returns one record **per cycle** — 4 records for a multi-cycle committee, not one record by design. `per_page=1` with no cycle filter returns the most recent cycle only.
- Has **no amendment fields** (`is_amended`, `most_recent`, `amendment_indicator` are absent). The endpoint returns pre-aggregated cycle totals, not raw filings — no dedup logic needed here.

Schedule A / Schedule B cursor pagination (verified live 2026-04-14):
- Both endpoints use cursor-based pagination, not page-numbered. The cursor is carried forward via `last_index` plus one sort-field-specific key returned in `response.pagination.last_indexes`.
- **Schedule A, sorted by `-contribution_receipt_amount`:** cursor key is `last_contribution_receipt_amount`. Used by Top Committee Contributors / Top Conduit Sources aggregation on both candidate.html and committee.html.
- **Schedule B, sorted by `-disbursement_amount`:** cursor key is **`last_disbursement_amount`** (NOT `last_disbursement_date` — that was a pre-existing bug that caused 422 errors on any pagination beyond page 1, fixed 2026-04-14 across `fetchSpentData` in candidate.html and two Schedule B loops in committee.html).
- **Critical pattern:** the cursor field mirrors the sort field. If you change the sort key on either schedule, you must also update the cursor key. The mock at `tests/helpers/api-mock.js` returns `pagination: { count: N }` with no `pages` field, so cursor advance logic is bypassed in tests — live verification before shipping is mandatory.
- **Broken endpoint:** `/schedules/schedule_a/by_contributor/` is documented in the FEC API spec but returns 500 Internal Server Error on reasonable queries (verified 2026-04-14 with `committee_id`, `cycle`, `two_year_transaction_period` combinations). Cannot be used for server-side contributor aggregation; the walk-and-aggregate pattern via `/schedules/schedule_a/` is the only working path today.

Elections-search endpoint (`/elections/search/`) returns:
- `cycle` — integer, election cycle year (even number)
- `district` — string, e.g. `'03'` (House only)
- `office` — string, e.g. `'H'`, `'S'`, `'P'`
- `state` — string, e.g. `'WA'`
- **Critical:** Returns projected future cycles out to 2060+ — must cap client-side. House: cap at current cycle. Senate: cap at current cycle + 4 (covers both seats' next election).
- **Critical:** For Senate, returns cycles for *both* seats in the state (unioned). Deduplication required.
- **Critical:** No Senate class field exists anywhere in the FEC API (`/elections/`, `/elections/search/`). Senate seat class (I/II/III) must be derived heuristically from cycle year.

---

## What to build next

See `project-brief.md` for the full phased roadmap. Short version:

**Phase 1 (complete):** Candidate page — all tabs (Summary, Raised, Spent), committees modal, design system.

**Phase 2 (complete):** Search + navigation — search.html, candidates.html, committees.html, index redirect.

**Phase 3 (scaffold):** Committee and race pages.
- ~~committee.html~~ ✅ structural parity — tabs bar (Summary/Raised/Spent) + cycle switcher, cycle-aware stats (All time / per-cycle), overspend callout, title-cased name, relType-aware associated candidate section (`fetchAndRenderAssocSection()` — back-link removed from header), .candidate-card-office removed, URL hash encoding (`#cycleOrAll#tab`), `Tab Switched` Amplitude event
- ~~committees.html~~ ✅ unified browse+search — auto-load, inline search + typeahead, state combo, filter chips, URL sync, error state, treasurer always shown
- ~~races.html~~ ✅ browse page — filter bar (Year/Office/State), results area, state combo, filter chips, all UI states; data fetching with progressive enrichment via /elections/; URL sync on all three filters
- ~~race.html~~ ✅ scaffold — single race view, candidate cards with financials, cycle-anchored links, dynamic cycle dropdown from `/elections/search/`, Senate class indicator, URL param validation
- committee.html: Raised tab ✅ live; Spent tab ✅ live (donut by category, purpose breakdown bars, top vendors table, contributions to candidates & committees section); filing history removed from scope — moved to backlog as a broader "candidate and committee filings" item pending validation with John

**Phase 4:** Early signal data (48/24hr reports), AI insights, transaction-level search.

**Bulk data pipeline (infrastructure, parallel to Phase 4):**
- ~~Session 1~~ ✅ Pipeline Worker deployed — `pipeline/` directory; processes pas222/224/226 only; writes pipe-delimited CSVs to R2 bucket `fecledger-bulk`; manual trigger `GET /admin/pipeline/run[?file=key]`; indiv files deferred — 4.5 GB each exceeds Workers limits
- ~~Session 1b~~ ✅ indiv file ingestion via GitHub Actions — `scripts/ingest-indiv.js`; weekly cron Mon 8am UTC; Node.js 24; zlib.createInflateRaw() + ZIP64 extra-field parsing; @aws-sdk/lib-storage multipart upload; all three indiv files confirmed in R2. **Auth note:** R2 S3-compatible API requires a dedicated R2 API Token (separate from the general Cloudflare API token used for Wrangler).
- ~~Session 1c~~ ✅ Pipeline consolidation — all 6 files unified into GitHub Actions (`scripts/ingest-bulk.js`, `.github/workflows/fec-bulk-pipeline.yml`); daily cron 6am UTC; conditional fetching via HEAD request + `fec/meta/pipeline_state.json`; `BulkProcessingStream` handles both column-filtered indiv and passthrough pas2; per-file state write for partial-run recovery. Worker cron removed; Worker retained for ad-hoc testing only. (Pipeline expanded to 9 files in Session 4B — see below.)
- ~~Session 2~~ ✅ KV pre-computation — `scripts/precompute-aggregations.js` runs after ingest in the same GitHub Actions job. For cycles 2024 + 2026, downloads pas2 + indiv CSVs from R2 to `/tmp`, runs a single DuckDB SQL GROUP BY (spill-to-disk bounded memory, 100% accurate totals), and writes top 25 contributors per in-scope committee to Cloudflare KV namespace `fecledger-aggregations`. Key format `top_contributors:{cmte_id}:{cycle}`, TTL 7 days. Wipe-then-write flow prevents stale entries. ~9,472 entries per daily run (5,483 committees × 2024 + 3,989 × 2026). Completes in ~7-8 minutes. **Initial approach (streaming Map + pruning) was abandoned** because pruning is approximate — any contributor outside the top 500 at prune time loses prior accumulation and can be undercounted in the final output. **AGGREGATIONS Pages binding (manual dashboard step) is required before Session 3** — Workers & Pages → fecledgerapp → Settings → Functions → KV namespace bindings; variable name `AGGREGATIONS`; Production environment; then trigger a Pages redeploy.
- ~~Session 3~~ ✅ Wired pre-computed aggregations to Top Individual Contributors and Top Committee Contributors on committee.html. Pages Function at `functions/api/aggregations/[[path]].js` exposes two routes (`top-contributors` and `top-committees`), both returning `{results, source}` where `source='bulk'` on KV hit and `source='api'` on miss (client branches on body). **KV-first branch tree** applied to both surfaces on committee.html: hit → use bulk data, miss + pages ≤ PAGE_THRESHOLD (100) → paginate live API to exhaustion for accurate totals, miss + pages > threshold → honest empty state (`"Unable to show due to high transaction volume."`). `cycleOrAll === 'all'` for Top Individual Contributors uses the same KV-first tree scoped to `ALL_CYCLES[0]` with a data-note disclaimer clarifying the scoping; Top Committee Contributors is hidden entirely on All time (aggregation across cycles isn't meaningful). **Top Conduit Sources** stays live-API-only — no bulk-data equivalent — and becomes unavailable on mega-committees independent of top-committees state. KV row shape: `{name, entity_type, city, state, total}` for individuals (any_value() on city/state — mode() was initially tried and blew past the 28-min pipeline ceiling); `{name, entity_type, committee_id, total}` for committees. **candidate.html rollback (2026-04-20):** a Top Individual Contributors card was built, shipped, and then removed — individual contributions to a candidate's principal committee are capped at ~$3,300 per election, so the top-10 list was a predictable partial max-out roll call with near-zero differentiating signal. Surface remains on committee.html where contribution limits (PACs, parties, conduits, super PACs) vary meaningfully. candidate.html's Top Committee Contributors continues to use the live paginated API (candidate committees don't hit the mega threshold; no functional benefit from adding the KV path there).
- ~~Session 4B~~ ✅ cm.txt (FEC Committee Master File) integration — ingested as the 7th–9th bulk files (`cm22/24/26`) into `scripts/ingest-bulk.js` (via `CM_HEADER`, `CM_KEEP_COLS` = cols 0/1, `fileConfig()` dispatch); downloaded per-cycle in `precompute-aggregations.js` and LEFT-JOINed in `buildCommitteesAggSql()` as the authoritative `committee_id → registered_name` source; `ENABLE_TOP_COMMITTEES_PASS` flipped to `true`. Fixes the recipient-vs-giver name bug that shipped broken in Session 3 — pas2's NAME column is `recipient_name` (often DBA or affiliate-branded), cm.txt's `CMTE_NM` is the FEC-registered committee name. Self-affiliate filter now compares cm.txt-sourced names on both giver and receiver; `COALESCE(cn_g.name, upper(trim(f.name)))` falls back to pas2 filer NAME for the (rare) case where the giver isn't in cm.txt. Pipeline runtime delta <30s. Strategy doc: `strategy/cm-txt-integration.md` (executed).
- ~~Session 5~~ ✅ Historical backfill (2026-04-21) — extended `FILES` in `scripts/ingest-bulk.js` to all 72 files (3 types × 24 cycles, 1980–2026) and `CYCLES` in `scripts/precompute-aggregations.js` to all 24 even years 1980–2026 (also closed the 2022 precompute gap). Research-verified schemas hold across all historical cycles (indiv=21 cols, pas2=22 cols, cm=15 cols); no format blockers. Bundled with a precompute skip logic refactor: global `wipeNamespace()` replaced with per-cycle scoped delete (`wipeCycleKeys()`), and `pipeline_state.json` extended with a nested `precompute` object so cycles with unchanged source files skip their SQL + KV work entirely. Without the skip logic, adding 23 historical cycles would have added ~50 min to every daily cron; with it, daily runtime stays at the existing ~8 min baseline post-backfill. **Execution reality:** the backfill required 3 workflow runs + 3 bug-fix commits past the initial plan to complete. Each bug surfaced a DuckDB setting that only real pipeline execution could have revealed: (a) `parallel=false` on `read_csv` for pas2/indiv — DuckDB's parallel CSV scanner fails on `null_padding=true` combined with quoted-newline fields (modern FEC data from 2012+ has multi-line OCCUPATION/EMPLOYER strings); (b) `strict_mode=false` + `ignore_errors=true` on the same reads — historical indiv/pas2 have rows with literal `"` inside field content (e.g. `"K" LINE AMERICA INC`, `"GRAMMIES" FOR BARTON`) that aren't CSV-quoted; same class of issue as cm.txt's embedded quotes but we can't use `quote=''` because modern data DOES use legitimate CSV quoting; (c) `memory_limit='8GB'` (up from 4GB) + `SET preserve_insertion_order=false` — 2020 indiv is 9.6 GB, largest in the dataset, OOMed at 4GB even with spill-to-disk. All three settings are the right long-term configuration for this pipeline regardless of backfill. Field-level note: ENTITY_TP is blank in pre-2010 indiv rows (FEC didn't record it yet) — the UI's Top Individual Contributors table doesn't display entity_type so this is invisible; Top Committee Contributors uses `ENTITY_TYPE_LABELS[d.entity_type] || 'Committee'` which falls back cleanly. Local DuckDB smoke caught cm.txt's embedded-quote issue up front but missed the three above; smoke is necessary but not sufficient — small-sample tests can't reveal dataset-scale OOM or rare content edge cases.

## Remaining architectural debt

- **Bulk pipeline Worker (separate from Pages):** `pipeline/` is a standalone Cloudflare Worker deployed via `cd pipeline && npx wrangler deploy` — NOT part of the Pages git-push deployment. Has its own `wrangler.toml`, own workers.dev subdomain (`fecledger-pipeline.sloanestradley.workers.dev`). As of 2026-04-16, FILES=[] and no cron is active — all file processing runs in GitHub Actions. The Worker is retained for ad-hoc HTTP testing (`/admin/pipeline/run`) and potential future lightweight use. Workers Paid plan ($5/mo) is still required to keep the Worker deployed on the workers.dev subdomain.
- **YTD per_page limit:** Reports currently fetched with `per_page=20` per sub-cycle — verify this is sufficient for Senate candidates with dense filing histories. Some cycles may have more than 20 reports.
- **Presidential cycle untested:** 4-year cycle is architecturally supported via `getCycleSpanYears()` / `getSubCycles()` but has not been tested with a real presidential candidate.
- **Multi-cycle stat labels:** Stats row (Raised, Spent, COH) doesn't yet indicate when figures represent a multi-sub-cycle sum (e.g. "6-year total" vs. "cycle total"). Needs a label or caveat for Senate candidates.
- **Spent tab timeline:** A spend-over-time line chart (parallel to the Raised tab's chart) has not been built. Lower priority — the category/purpose/vendor breakdown is sufficient for current use. Add when the Raised chart pattern is ready to be reused.
- **JFA committee gap:** Joint fundraising committees where a candidate is a participant (not the principal) have `candidate_ids: []` and `sponsor_candidate_ids: null` in the FEC API — they don't appear in either `/candidate/{id}/committees/` or `/committees/?sponsor_candidate_id=`. The only source of truth is the candidate's F2 filing document, which lists them as authorized committees. Surfacing these would require fetching the most recent F2 via `/filings/?candidate_id=&form_type=F2` and parsing committee references from the filing data. Not built yet; validate approach with John before implementing.
- **Presidential races use `state=US`:** The FEC API returns `state: 'US'` for presidential races in `/elections/search/`. `race.html`'s `VALID_STATES` array includes `'US'` to allow this. `formatRaceLabelLong` returns `'US Presidential'` for `office === 'P'` (no colon, no state suffix). `formatRaceName` (used by candidate cards and browse pages) returns `'US President'`.
- **Office cycle rhythms (race.html cycle cap):** Each office type has a distinct electoral rhythm that governs how far ahead the cycle dropdown should look. House: 2-year terms — cap at current cycle only. President: 4-year terms — cap at `currentCycle + 2` (next presidential election is always 0–2 years out from any given year). Senate: 6-year terms — cap at `currentCycle + 4` (covers both seats' next election in the state). These caps filter the projected-to-2060 results returned by `/elections/search/`. When adding any cycle-capping logic, treat all three office types explicitly — do not bucket President with House.
- **Senate class heuristic:** `getSenateClass()` in race.html derives class from cycle year via modular arithmetic. Special elections can seat a senator from a different class than the cycle implies. The FEC `/election-dates/` endpoint exposes SP/SG/SGR election types that could detect this, but financial data in `/elections/search/` has no special election flag — specials are folded into the standard 2-year cycle. Low priority: ~1-2 special Senate elections per decade.
- **Server-side caching for races.html (Phase 4):** The current solution (IntersectionObserver + localStorage cache) reduces the per-visit API call count from ~475 to ~15–20 and eliminates repeat-visitor calls within the 24h TTL. For high-traffic scenarios — election night, a viral link — this still won't be enough. The API key is now server-side (Cloudflare proxy), but all visitors still share the same rate limit and each fires their own enrichment calls. The fix is a Cloudflare Pages Function (or cron Worker) that proxies `/elections/` and `/elections/search/` calls with server-side caching in Cloudflare KV — so all visitors share a single cold fetch per TTL period. Build this before any push for real traffic volume.
- **Top Committee Contributors — pas2 coverage gaps (copy now distinguishes cause; structural gap still open):** The cm.txt integration (Session 4B) resolved the display-name bug but did NOT close two independent gaps in pas2's coverage. (1) **Conduit mega-committees (ActBlue, WinRed):** their inbound Schedule A volume is dominated by `memo_code='X'` rows representing individual contributions forwarded through the platform — these aren't in pas2 at all. (2) **National party committees (DNC, RNC, DSCC, NRSC, DCCC, NRCC):** their inbound is dominated by FEC "transfer" transactions between affiliated party committees, which is a distinct transaction type from "contribution" and also isn't captured in pas2. Both classes of committee that ALSO exceed the 100-page Schedule A pagination threshold fall through to an empty state. **As of 2026-04-21, the empty-state copy distinguishes cause:** `fetchRaisedData()` in committee.html computes `topCommitteesPas2Gap = isParty || isConduit` where `isParty = COMM_TYPE in {'X','Y'}` and `isConduit = commPag.count > 500000`. Gap-case renders `"Committee contribution data is not available for this committee type."`; genuine high-volume-without-gap cases retain `"Unable to show due to high transaction volume."`. **Detection detail:** memo-rate on Schedule A page 1 cannot be used — sorting by `-contribution_receipt_amount` biases the sample toward the few non-memo large rows at the top of a conduit's distribution (ActBlue's page 1 by amount is 0% memo even though ~99% of the full dataset is memo'd); total count is the reliable signal. The 500k count threshold is safely above any known legitimate committee-to-committee inbound volume; ActBlue (~11M) and WinRed (~5M) sit well above it. Closing the structural pas2 gap itself still requires an additional bulk-data ingest (Schedule A memo rows or a transfers-specific source) — out of scope here. **Applied to Top Committee Contributors and Top Conduit Sources** on committee.html. Top Committee Contributors: coverage-gap copy when `topCommitteesPas2Gap` fires (party OR conduit). Top Conduit Sources: **card hidden entirely** (`display:none`) when `topCommitteesIsConduit` fires — the surface asks "who forwarded money through a conduit to this committee?" which is semantically meaningless on a conduit committee itself; better to hide than relabel. The existing high-volume copy is retained on Top Conduit Sources when `topConduitsTooLarge` fires *without* `topCommitteesIsConduit` (e.g. DNC — 425k inbound committee rows hits pagination threshold but is below the 500k conduit threshold; party-class conduits-to-DNC is a meaningful surface, just unreachable). The raised-tab data-note also suppresses its "Top conduit sources: aggregated from memo entries..." sentence when the card is hidden. **Top Individual Contributors was explicitly NOT extended** — for conduits and parties, individual-contribution data IS present in our source (indiv.txt) and in KV (hit path is normal; the unavailable state only triggers on rare KV miss + pagination-too-large), so the current "Unable to show due to high transaction volume." copy is accurate for what it is (an infrastructure gap, not a structural one).
- **`/schedules/schedule_a/by_state/` silently ignores cycle params:** The `two_year_transaction_period` filter on this endpoint is silently ignored — the API returns the full contribution history regardless. Correct pattern: make one call with no cycle param, then filter client-side by `d.cycle` on each result record. Used by both candidate.html and committee.html choropleth maps.
- **`/schedules/schedule_b/` `entity_type` param silently ignored:** Passing `entity_type=CCM` to filter for political committee contributions is silently ignored by the live FEC API — the response returns all disbursement types regardless. Always add a client-side filter as belt-and-suspenders: `d.entity_type === 'CCM' || d.disbursement_purpose_category === 'CONTRIBUTIONS'`. Confirmed 2026-03-20.
- **`disbursement_purpose_category` field values (verified from live `/schedules/schedule_b/` response):** `'CONTRIBUTIONS'` (political contributions to other committees), `'REFUNDS'` (contribution refunds to donors — money returned, not a vendor payment), `'ADVERTISING'`, `'ADMINISTRATIVE'`, `'FUNDRAISING'`, `'TRAVEL'`, `'OTHER'`. Vendor table should exclude `CONTRIBUTIONS` and `REFUNDS`. Note: `disbursement_purpose_description` (the human-readable label field) is always null in live responses — use `disbursement_description` for keyword-based purpose mapping.
- **`.spend-note` CSS class — removed:** Was a dead class in candidate.html with no CSS definition. Replaced with `.data-note` (the shared equivalent, defined in `styles.css`). Removed 2026-03-20.
- **`/committee/{id}/totals/` spending field names (verified 2026-03-20):** The transfers field is `transfers_to_affiliated_committee` — NOT `transfers_to_other_authorized_committee` (which doesn't exist). PACs may have zero `operating_expenditures` with spending in `shared_nonfed_operating_expenditures`, `independent_expenditures`, or `fed_candidate_committee_contributions` instead. The committee.html spent donut computes "Other Disbursements" as `totalSpent - sum(named categories)` to ensure 100% coverage regardless of committee type.
- **`/filings/` endpoint silently ignores repeated `committee_type` params (verified 2026-04-09):** Passing `committee_type=H&committee_type=S&committee_type=P` returns only the last value's results — the repeated param is not treated as an array. Scope candidate committee filings via `form_type=F3&form_type=F3P` instead (repeated `form_type` does work). Use the `office` field on results for client-side H/S/P discrimination.
- **F3/F3P results include non-candidate committees with `office: null` (verified 2026-04-09):** A small number of results (~10 per week) have `committee_type: N` (Non-Qualified PAC), `Q` (Qualified PAC), or `null` with `office: null` — likely data entry errors or committees that changed affiliation after initial registration. Filter on `office != null` to exclude when intent is candidate-committee scope. If feed scope expands to all committee types in the future, these will reappear and need an explicit display decision.
- **Mock/live field shape gap risk:** Some FEC endpoints return different field names or value types than their mock counterparts — the `/elections/` endpoint returns `party_full` (full name) instead of `party` (short code); `/elections/` returns `incumbent_challenge_full` (full string) not `incumbent_challenge` (short code) — mock corrected 2026-03-16; `total_receipts_ytd` in reports is a string in the live API but was mocked as a number; `/schedule_a/by_state/` returns `{state, state_full, total, count}` while the individual `/schedule_a/` endpoint returns `{contributor_state, contribution_receipt_amount, ...}`; `/committee/{id}/totals/` uses `transfers_to_affiliated_committee` not `transfers_to_other_authorized_committee` — fixed 2026-03-20. Rule: when adding a new endpoint, fetch one live response and verify field names against the mock before writing assertions. Utilities should always accept both short and full-form values where the API may vary by endpoint.

## Committee modal architecture

The associated committees feature is a modal triggered from the profile header — not a tab, and not cycle-scoped. Key design decisions and API patterns:

- **Two parallel API calls at init:** `/candidate/{id}/committees/` (authorized committees) + `/committees/?sponsor_candidate_id={id}` (leadership PACs). Results merged, deduped by `committee_id`.
- **Leadership PAC identification:** `leadership_pac: true` boolean field on the committee record is the reliable signal. `committee_type === 'D'` is unreliable — some leadership PACs have `committee_type: 'N'`. Records from the sponsor endpoint are tagged `_isLeadershipPac = true` as a fallback.
- **Active vs. terminated split:** `filing_frequency === 'T'` = terminated; `filing_frequency === 'A'` = administratively terminated (FEC-initiated, committee has unresolved debts). Both route to the History tab. Active tab = everything else.
- **Committee grouping order:** Principal Committee → Joint Fundraising → Leadership PAC → Other Authorized → Other. Uses an `assigned` Set to prevent double-counting.
- **Eager loading:** `fetchAndRenderCommittees()` called in `init()` (not on modal open) so the count in the trigger label is immediate. `committeesLoaded` flag prevents double-fetch on modal re-open.
- **JFA gap acknowledged in modal:** A `.data-note` at the bottom of the modal explains that JFA committees where the candidate is a participant (not principal) may not appear — this is an FEC API indexing limitation, not a bug.
- **JFA organizer display gap (unresolved):** The "Joint Fundraising" group in `renderCommitteeGroups()` only renders when `committee_type === 'J'`. In practice, the FEC assigns many JFAs `committee_type: 'N'` (Non-Qualified PAC) or `'Q'` (Qualified PAC) even when the candidate is the organizer — confirmed via Nancy Pelosi's modal (NANCY PELOSI VICTORY FUND shows as "Other", not "Joint Fundraising"). The `designation` field may be a more reliable signal (`designation === 'J'`) but has not been verified against live data. Needs investigation before the "Joint Fundraising" group can be considered reliable.

Key committee fields:
- `designation` — `'P'` = Principal CC, `'A'` = Authorized, `'J'` = Joint Fundraising
- `committee_type` — `'J'` = JFA, `'D'` = Leadership PAC (unreliable for LP detection — use `leadership_pac` boolean)
- `filing_frequency` — `'T'` = terminated, `'A'` = administratively terminated (FEC-initiated), `'Q'` = quarterly (active)
- `leadership_pac` — boolean; most reliable leadership PAC signal
- `sponsor_candidate_ids` — array on committee record; leadership PACs carry the candidate's ID here

## Unified browse+search architecture (candidates.html / committees.html)

Both browse pages use a single unified state machine — no separate browse/search modes. Key patterns:

- **Auto-load on page visit** — `doFetch(false)` fires in `init()` regardless of URL params. No "click to browse" gate.
- **Unified `doFetch(isLoadMore)`** — single code path. Uses `activeQ` (string) and `activeFilters` (object) to build params. If `activeQ` is set, fires `Candidates/Committees Searched`; otherwise fires `Candidates/Committees Browsed`.
- **State vars:** `activeQ` (search query), `activeFilters` (state/office/party/cycle for candidates; state/type for committees), `currentPage`, `totalPages`, `loading`, `lastFetch` (fn ref for retry).
- **URL sync** — `updateURL()` calls `pushState` after every fetch. `init()` restores from URL params on load.
- **Filter chips** — `renderChips()` rebuilds chip row after every fetch. `clearFilter(key)` and `clearAllFilters()` reset state and re-fetch.
- **State combo** — text input filters a `size="6"` listbox; `:focus-within` shows/hides the listbox. On selection, `f-state` fires `change`, populates `f-state-filter`, and calls `doFetch`.
- **Typeahead** — 300ms debounced, 6 results. Results link directly to `/candidate/{id}` or `/committee/{id}` — clicking does NOT trigger a search, it navigates.
- **Search field submit** — sets `activeQ` and calls `doFetch(false)`. Enter key or button click.
- **All result links are clean URLs** — `/candidate/{id}` and `/committee/{id}` in all modes (browse and search).
- **Error state** — `#state-error` shown on API failure; `.retry-btn` calls `lastFetch()`.
- **`needsApiMock: true`** in `shared.spec.js` for both pages — they make API calls on load.

## Races browse architecture (races.html)

Progressive loading pattern — instant race list, then viewport-gated enrichment:

- **Step 1 (instant render):** `/elections/search/?cycle=X` returns the authoritative race list (`{cycle, district, office, state}` per result). Rendered immediately with skeleton placeholders for candidate count and total raised.
- **Step 2 (IntersectionObserver enrichment):** `raceObserver` fires `enrichRace()` only for race rows that scroll within 100px of the viewport. Each call fetches one `/elections/` response, writes `candidateCount` + `totalRaised` to the race object, and caches the processed aggregate to localStorage. On repeat visit within 24h, all previously-seen races load from cache with 0 API calls.
- **Why IntersectionObserver instead of fire-all:** Original architecture fired ~475 `/elections/` calls on every page load, exhausting the shared API key (1000 calls/hour). IO scopes enrichment to visible rows — typical filtered browsing session fires 10–35 calls instead. Aligned with the long-term page direction (editorial curation / location-based filtering will make the initial viewport small by design).
- **localStorage cache:** Key = `lf:race:{cycle}:{office}:{state}:{district}`. Value = `{ data: { candidateCount, totalRaised }, expires }`. TTL = 24h. Caches aggregates only (~50 bytes/race vs ~2KB for raw response). Silently skips caching on QuotaExceededError or private browsing.
- **Why not `/candidates/totals/`:** That endpoint includes anyone who *filed* for a cycle, not just candidates in the actual race. Counts and totals are inflated. `/elections/` is the gold standard — same source race.html uses.
- **Why per-race, not per-state:** `/elections/` requires both `office` and `state`, and House races additionally require `district`. The endpoint doesn't return a `district` field on results — district is implicit from the query params.
- **Client-side filtering:** Office and state filter changes call `applyFilters()` directly — no API re-fetch. `renderResults` disconnects and re-wires the observer after every re-render so filter changes correctly scope enrichment to the newly visible subset.
- **URL sync:** `updateURL()` calls `pushState` at the end of `applyFilters()`, covering all filter changes. `init()` reads `?cycle`, `?office`, `?state` from URL params and restores them before `populateCycles()` resolves — cycle is applied after the dropdown is populated (sequencing handled in `populateCycles(preferredCycle)`).
- **Stale response guard:** `fetchGeneration` counter increments on each `fetchAllRaces()` call. `enrichRace()` captures `gen` at call time and discards results if the generation has changed (cycle switch mid-flight).
- **`needsApiMock: true`** in `shared.spec.js` — makes API calls on load.
- **Long-term solution:** A Cloudflare Pages Function with server-side KV caching would collapse all visitor traffic into one cold fetch per TTL period. The API key is already server-side; what's missing is the caching layer. See "Remaining architectural debt" for the full note.

## Filing feed architecture (feed.html)

Live filing feed showing recent FEC filings from candidate campaign committees (House, Senate, Presidential). Scoped to F3/F3P form types. Monitoring tool — users return to check what's landed.

- **Load-all-upfront pattern:** `fetchAllFilings()` fetches page 1 (per_page=100) to get `pagination.pages`, then fires all remaining pages in parallel. Skeleton shows until complete dataset is in memory. ~3 API calls for ~330 filings (7-day window).
- **Client-side filtering:** Three filters — office (H/S/P button group), report type (select: Quarterly/Pre-election/Post-election/Termination), time window (24h/48h/7d button group). All filter `allFilings` in memory. No additional API calls on filter change.
- **Time window re-fetch:** Changing the time window calls `init()` which re-fetches the full dataset for the new `min_receipt_date`. Office and report type filters are client-side only.
- **Null-office filtering:** Results with `office: null` (PAC types N/Q filing F3 incorrectly) are excluded at the data ingestion layer in `fetchAllFilings()`.
- **Refresh with dedup:** "Refresh feed" button re-fetches all pages, deduplicates by `file_number`, prepends new rows with `.feed-new` highlight animation (2s). Minimum 500ms "Refreshing..." + 1s "✓ Refreshed" feedback states.
- **State wrappers:** Uses `#state-loading`/`#state-results`/`#state-no-results`/`#state-error` pattern matching browse pages. `showState(name)` toggles between them.
- **Filter chips:** Always visible. Time period chip always shown. Office chip shown when not "All". Report type chip shown when not "All types". Matches `.filter-chips-wrap` pattern from browse pages.
- **Report type groups:** `REPORT_TYPES` config maps groups to FEC `report_type` codes: Quarterly (Q1/Q2/Q3/YE), Pre-election (12P/12G/12C/12S), Post-election (30G), Termination (TER).
- **Amplitude events:** `Page Viewed`, `feed_filter_office`, `feed_filter_window`, `feed_filter_report_type`, `feed_refresh`, `Feed Filing Clicked`, `Feed FEC Link Clicked`.
- **`needsApiMock: true`** in `shared.spec.js` — makes API calls on load.

## Navigation and IA architecture

The nav has a browse/profile split that must be preserved as new pages are added:

- **Browse pages** (`candidates.html`, `committees.html`, `races.html`) are primary nav destinations — each is its own nav item's active target
- **Profile pages** (`candidate.html`, `committee.html`, `race.html`) are subsections — they activate their *parent* browse page's nav item (e.g. `candidate.html` keeps "Candidates" active)
- **`ia.md`** is the canonical IA reference — page inventory, URL patterns, nav hierarchy, page relationships, phase roadmap. Read it before adding new pages or changing nav structure.

Nav link targets (all pages must use these — absolute paths, no stubs):
- Candidates → `/candidates`
- Committees → `/committees`
- Races → `/races`
- Feed → `/feed`

Search, Process Log, and Design System are **not** in the top nav. No active link on those pages.

**Top nav structure (`.top-nav`):** `position:sticky; top:0`, full-width, `z-index:200`. Inner `.top-nav-inner`: logo left → `.top-nav-links` (desktop nav links: `Candidates`, `Committees`, `Races`, `Feed`) → `.top-nav-search` (desktop search bar, `margin-left:auto`) → `.top-nav-mobile-controls` (hidden at desktop: search toggle icon + hamburger). **Mobile panels are direct children of `.top-nav` (siblings of `.top-nav-inner`):** `#top-nav-mobile-search` (search panel) and `#mobile-nav` (nav drawer) sit after `.top-nav-inner` inside `<nav class="top-nav">`, positioned `absolute; top:100%`. Mobile nav drawer drops down from below the nav bar (not from the side). Search toggle expands search panel inline below the nav bar. No `.sidebar`, no `.layout` grid wrapper — `.main` is a direct child of `<body>`.

**Active state:** `.nav-link.active` on the correct `<a>` in `.top-nav-links`, plus `.nav-item` with active class in `.mobile-nav` for browse pages. Profile pages activate their parent browse page's link.

**`.main` padding:** Global rule `padding-top:var(--header-h)` in `styles.css` handles the fixed nav offset. No per-page media query override needed.

Cycle-anchored links from race view: `candidate.html?id={id}#{year}#summary` — the `#{year}#summary` hash pre-selects the correct election cycle on the candidate page. Use this pattern whenever linking to a candidate from a race context.

## Senate multi-sub-cycle architecture

Senate 6-year cycles introduce a multi-sub-cycle pattern worth understanding before modifying:

- `getSubCycles(cycle)` returns `[cycle-4, cycle-2, cycle]` — three FEC 2-year periods
- Reports are fetched from all three in parallel and combined
- **Raised / Spent totals:** summed across all sub-cycles
- **COH and debt:** use most recent sub-cycle only
- **YTD stitching:** carries cumulative base forward across each calendar year reset within each sub-cycle, then chains sub-cycles together

---

## Product decisions already made (don't re-litigate)

- **Stepped line chart** (not smooth) for Raised and Spent — honest to the quarterly reporting rhythm
- **Full cycle x-axis** — even for active cycles where future quarters are empty; shows where we are in the cycle
- **"Raised-to-spent ratio"** — not "burn rate" (domain expert feedback from John, a congressional campaign manager)
- **Health indicator hidden for closed cycles** — replaced with "Cycle Complete" contextual summary
- **Points only at filing dates** — no interpolation between quarters
- **YTD field strategy** — use `_ytd` fields from reports and carry year-1 total as base for year-2 (avoids per-period accumulation errors)
- **Election dates from `/election-dates/`** — not `/elections/` (which returns candidate financial summaries, not actual dates)
- **Mobile nav search icon** — at smaller breakpoints, search does not collapse into the hamburger drawer. A search icon remains exposed left of the menu icon at all times.
- **Global nav links** — Home, Candidates, Committees, Races present from launch as stubs; activated as pages are built per phase plan.
- **Race page** — single contest view; all declared candidates auto-populated from `/elections/`. The comparison builder (selecting candidates across races) is a separate Phase 4 feature, not a mode of the race page.

---

## Domain context

- FEC "cycle" ends Dec 31 of the election year, not on election day
- House candidates file Form 3, quarterly + pre/post election reports
- Senate = 6-year terms; presidential = 4-year. X-axis logic must account for this
- `_ytd` fields reset each January 1, so a two-year cycle requires stitching year 1 final YTD + year 2 running YTD
- Memoed transactions (`memo_code: 'X'`) must be excluded from any manual totals — they are itemization detail of other rows, not standalone money. We avoid double-counting by using FEC-computed `_ytd` fields where possible; when summing Schedule A/B rows directly (e.g. contributor aggregations), explicitly filter `d.memo_code === 'X'` before adding to the total. Conduit platforms (ActBlue, WinRed, Anedot) forward individual contributions and are reported as `memo_code='X'` rows with `entity_type='PAC'` on the recipient committee's Schedule A — the individual donor is the main (non-memo) row on `is_individual=true` queries, and the conduit platform appears only in memos. The Top Conduit Sources table on candidate.html and committee.html (Raised tab) surfaces these memo aggregates as a distinct, legally-honest category — "here is the money routed via X platform, representing individual donors" — separate from Top Committee Contributors which shows committees giving their own money. Both tables draw from the same `/schedules/schedule_a/?is_individual=false` fetch; the aggregation loop splits on `memo_code === 'X'` to populate both accumulators in one pass.
- The FEC API silently ignores unrecognized query parameters — always verify a filter is working by checking total result counts, not just response shape
- The FEC `/reporting-dates/` endpoint ignores date range params; use `report_year` + `report_type` for targeted queries
- John (domain expert, congressional campaign manager) is available for validation questions

---

## Design reference

The process log (`process-log.html`) has the full project history including domain research notes, John's feedback, and all key decisions with rationale. Read it for context on *why* things are the way they are.

The full product brief (`project-brief.md`) has MVP scope, audience definition, backlog, open questions, and definitions.

---

## How to start a session

```bash
cd ~/Vibecoding/fec-project && claude
```

**Session-start ritual check:** Read CLAUDE.md, project-brief.md, ia.md, and claude-to-claude.md. (1) Check whether the most recent entry in `claude-to-claude.md` matches the last commit — if the log entry is missing and work was clearly done, flag it. (2) Run `git status` — if there are uncommitted changes, flag them before starting new work. (3) If any `package.json` changed since the last session (check via `git log --oneline -10 -- package.json pipeline/package.json scripts/package.json`), flag it and remind Sloane to run `npm install` in the affected directories (`fec-project/`, `pipeline/`, `scripts/`) on both machines before continuing.

**Opening prompt:**
```
Read CLAUDE.md, project-brief.md, ia.md, and claude-to-claude.md, then: (1) check whether the last session's end-of-session rituals were completed — if not, flag it. (2) Summarize the current state of the project, the top priority, and what you need from me to get started.
```

---

## When compacting or ending a session

**Before wrapping up:** Run `npx playwright test` (Track 1 — structural, mocked API, ~1 min). Fix any new failures before shipping. Then run the manual browser checks from `test-cases.md` for every page touched this session. Append a row to the Test log table at the bottom of `test-cases.md`. If any new failures are found, add them to the Known open issues table. If new features shipped, write Playwright assertions for them in the same session — not just manual checklist items in `test-cases.md`. The bar: any new DOM element, conditional render, or API behavior change must have at least one `.spec.js` assertion covering it.

**Pipeline sessions (changes to `scripts/ingest-bulk.js`, `scripts/precompute-aggregations.js`, `pipeline/`, or `.github/workflows/fec-bulk-pipeline.yml`):** Playwright is almost tautologically green for data-layer work, so the real verification is different. Before pushing: run `node --check` on every modified script (cheap syntax gate). If SQL changed: run a local DuckDB smoke test against a real sample of the input file (download a sample, filter to the shape BulkProcessingStream will produce, run the query locally) — this caught the `quote=''` requirement for cm.txt in 30 seconds and would have prevented the 2026-04-17 pas2-column bug and the 2026-04-20 pas2-NAME-semantics bug. After pushing: trigger `gh workflow run fec-bulk-pipeline.yml` and watch logs for non-zero row counts on each new or changed aggregation pass. Then `curl` the relevant Pages Function routes for at least (a) one committee that *exercises* the change and should now behave differently, and (b) one known-miss or known-unchanged case that should stay the same. Finally, browser-verify one representative committee on the live site. The verification cost is minutes; the cost of a bad pipeline run is a full re-run plus a follow-up commit.

**Documentation updates (always apply before outputting the four blocks below):** After tests pass, audit and apply any needed updates to the files below — do not wait to be asked. Not every session touches every file; skip a file only if you've actively audited it and concluded it needs no update.
- `CLAUDE.md` — update Current files list, What to build next checklist, and any API/architecture notes learned this session
- `test-cases.md` — add manual test cases for new features; update test count if changed; append test log row
- `TESTING.md` — update test count; update the pages.spec.js coverage description if new describe blocks were added
- `ia.md` — update Page Inventory status, URL Patterns table, Browse→Profile link patterns, or Phase Roadmap if any pages changed behavior or were promoted
- `design-system.html` — four distinct areas to audit, all required:
  1. **Token table** — add new CSS vars (with primitive source and usage note); remove deleted ones
  2. **Type specimen usage lists** — every named type style row has a list of `.class-names` that use it; if any component's font-family/size/weight changed this session, update the list for every affected style (both the style it left and the style it joined); if a component is a documented deviation (e.g. `.top-nav-logo` at 600), note it in the component card, not the specimen list
  3. **Component card demos** — if a component's markup structure changed (new wrapper elements, removed elements, new classes), update the demo HTML to match; demos must reflect the current DOM shape or they mislead future sessions
  4. **Component card notes** — if a component's layout, behavior, or CSS changed in a way that affects how it should be used, update the prose notes; include the specific CSS properties that matter (e.g. "flex row, `justify-content:space-between`") rather than vague descriptions
- `project-brief.md` — add or update definitions for any new domain concepts, data fields, status values, or product decisions introduced this session
- `pipeline/README.md` — if this session touched the bulk-data pipeline (ingest, precompute, R2 keys, feature flags, runtime characteristics), update the files-processed table, R2 bucket layout tree, feature-flag section, and architecture table. This doc is the canonical pipeline reference and drifts fastest when only CLAUDE.md is updated.
- `strategy/*.md` — if a strategy doc scoped this session's work and the work is now complete, add an `**EXECUTED <date> (commit <sha>)**` banner at the top so future sessions don't treat it as active scope. Keep the doc as a historical reference — the diagnosis and verification discipline written in these docs are often better than what lands in CLAUDE.md.

Before running /compact or ending a session, output all four of the following — each in its own fenced code block so they're easy to copy individually. Sloane will bring these to Claude Chat.

---

### 1. Process log draft
A draft entry for process-log.html covering:
- A title in the voice of existing entries (e.g. "Debugging in the dark, then the lights came on")
- A 2–3 sentence summary written from Sloane's perspective — not a technical changelog
- Changelog bullets: what changed, in plain language
- A field notes block: a journal-style reflection on what the session revealed — about the product, the process, or the tools
- Stack tags for anything new introduced this session

---

### 2. How Sloane steered the work
A summary of the key moments where Sloane shaped direction this session — product instincts, UX calls, decisions to push back or redirect, priorities set. Written for Sloane, not as a changelog. Focus on judgment and intent, not implementation.

Format: one named heading per moment (e.g. "Modal over tab — your call, for scale reasons"), followed by 2–3 sentences on what happened and why it mattered. Close with a 1–2 sentence through-line identifying the pattern across all the moments (e.g. "The through-line: you're making UX calls based on user psychology..."). No limit on number of moments — include everything that was genuinely Sloane's judgment call, not Claude's default.

---

### 3. Proposed CLAUDE.md updates
A list of specific, actionable updates to make to CLAUDE.md based on what was learned or built this session — new API findings, resolved debt items, architectural decisions, workflow notes. Format as: section name + what to change. Do not rewrite the file — just propose the changes.

---

### 4. What to bring to Claude Chat
A short list of topics, decisions, or open questions that are better discussed in Claude Chat than resolved in Claude Code — product direction, prioritization, design decisions, domain questions for John, anything requiring strategic thinking before building. 2–5 bullets.

---

### Logging to claude-to-claude.md
After outputting all four blocks above, append outputs #1, #2, and #4 to the **end** of `claude-to-claude.md` in the project root (not the top — the file is chronological, oldest entry first, newest entry last). Use this format:

```
---
[DATE] [TIME]

## Process log draft
[content]

## How Sloane steered the work
[content]

## What to bring to Claude Chat
[content]
```

If the file doesn't exist, create it. Always append to the end — never overwrite, and never prepend at the top.

**Final step — commit:** After appending to `claude-to-claude.md`, commit all session changes with `git add` (specific files, not `-A`) and a descriptive commit message. Uncommitted changes at session end are invisible to the next session's start check and will appear as mysterious working tree noise. If the session produced no code changes (discussion-only), a commit is not needed — but documentation-only changes still warrant one.
