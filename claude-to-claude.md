# claude-to-claude.md
*A running log of session handoffs — appended automatically by Claude Code at the end of every session. Bring this file to Claude Chat when you need context on recent sessions.*

---
2026-03-12 — Search overhaul Session 2: ?q= mode on candidates.html + committees.html

## Process log draft
Title: The search comes full circle

The "View all →" links from search.html had nowhere to go — they pointed at /candidates?q= and /committees?q=, but both pages ignored the q param and showed their default browse state. This session wired the other end: both pages now detect ?q= on load, hide the filter bar, and show paginated search results with infinite scroll. The search overhaul started in Session 1 is now a complete path.

Changelog:
– candidates.html: search mode — detects ?q=, hides filter bar, fetches /candidates/?q= per_page 50, renders paginated candidate cards with infinite scroll, links to /candidate/{id} (clean URL), Amplitude Candidates Searched event
– committees.html: search mode — same pattern; separate buildSearchRow() function (browse mode's buildRow() untouched) includes treasurer name in results, links to /committee/{id}
– Both pages: browse mode completely untouched — different code paths, no shared state
– tests/pages.spec.js: 11 new tests across two describe blocks; 198 → 209 total
– Documentation: TESTING.md test count updated; ia.md URL Patterns and Browse→Profile tables updated; test-cases.md new search mode sections + test log row; CLAUDE.md current files list updated
– CLAUDE.md ritual: documentation update step added as mandatory pre-wrap checklist item — no longer waiting to be asked

Field notes:
The key decision was a small one: write a separate buildSearchRow() instead of adding an optional parameter to the existing buildRow(). The constraint — "browse mode completely untouched" — made the choice obvious, and the result is cleaner than the alternative would have been: two independent functions, no conditional logic bleeding between modes, separately testable. The constraint shaped the architecture. The ritual edit at the end of the session is the same instinct at a different scale: instead of relying on a prompted question to trigger documentation updates, the checklist now makes it mandatory. The project is current because the process says it must be, not because someone remembered to ask.

Stack tags: none (no new dependencies)

## How Sloane steered the work
**"Browse mode completely untouched" — a constraint that shaped the architecture**
Specifying this upfront prevented a path that would have worked technically but muddied the separation: modifying buildRow() with an optional parameter. The constraint produced buildSearchRow() as a genuinely independent function. A small direction call with real structural consequences.

**Catching the buildRow() proposal before it was written**
When the plan proposed updating buildRow() to include treasurer name in both modes, Sloane caught it and redirected — search mode rows only. That's the right read: browse mode is filter-driven and has different information density needs than discovery-driven search. The distinction isn't just aesthetic; it's about what each mode is for.

**Making the ritual self-executing**
The observation — "you always recommend updates to the same four files, can we automate this?" — is a systems-thinking move. The ritual now has the doc update baked in as a mandatory step rather than a prompted question. That's the difference between a checklist and a habit.

The through-line: Sloane consistently catches where "technically correct" and "architecturally clean" diverge, and redirects before the wrong choice is made. Same instinct, different scales — from a function signature to a process ritual.

## What to bring to Claude Chat
– Back-navigation UX: now that the full search path is wired (typeahead → preview → full results → profile), how does back-button feel? If someone lands on /candidates?q=marie from search.html, does returning to search.html feel right, or should the full-results page have its own back affordance? Worth checking on the live site.

– Browse mode promotion: candidates.html and committees.html browse mode is still scaffold-level — per_page capped at 20, no infinite scroll, no result count from pagination total. Is there a session to bring browse mode to full parity with search mode, or is search mode sufficient for current use?

– Phase 3 remaining work: search overhaul is complete. CLAUDE.md lists committee filing history, associated candidates on committee.html, and ad hoc race mode as the remaining Phase 3 items. Worth aligning on sequencing before the next session.

---
2026-03-10 — Clean URLs, deployment, and debugging

## Process log draft
Title: The hidden cost of clean URLs — a subdirectory that wasn't there

The site had clean URLs as a design goal from the start, but shipping them revealed a class of failure that's easy to miss locally: when a Netlify 200 rewrite keeps the browser URL as `/candidate/H2WA03217`, the browser treats `/candidate/` as a directory. Every relative path — `styles.css`, `main.js`, `utils.js`, nav links — resolves into that imaginary subdirectory. Worse, those 404 requests also matched the rewrite rule itself, so Netlify served `candidate.html` HTML as JavaScript. The page appeared to partially load while being fundamentally broken.

Changelog:
– Created `_redirects` with Netlify 200 rewrites for all 7 URL patterns: `/candidate/:id`, `/committee/:id`, `/race`, `/search`, `/candidates`, `/committees`, `/races`
– Fixed candidate.html and committee.html: all local resource paths and nav links changed from relative to absolute (`/styles.css`, `/main.js`, `/utils.js`, `/candidates`, `/committees`, etc.)
– Fixed race.html: form submission URL updated to `/race?...` (absolute); candidate card links updated to `/candidate/{id}#{year}#summary`
– Fixed index.html: redirect target changed from relative `search.html` to absolute `/search`
– Simplified `_redirects` rewrite destinations: removed `?id=:id` from `/candidate/:id` and `/committee/:id` rules (ignored for static files; JS reads ID from pathname)
– Updated Playwright tests: nav link assertions now use `href*=` to accept both relative and absolute URL formats; index redirect test accepts `/search` or `/search.html`; race candidate card link test updated for clean URL format
– Updated CLAUDE.md: Netlify Pretty URLs enabled (site setting); absolute path rule documented in tech stack with full failure mode explanation
– Updated ia.md: Pretty URLs noted alongside clean URL architecture comment
– Updated test-cases.md: pre-deploy checklist for clean URL pages; test log rows added

Field notes:
The failure was layered in a way that made it hard to diagnose from a distance. The page structure rendered because the HTML was served correctly. The JS partially ran because some scripts loaded from CDN (Amplitude, Chart.js). But `utils.js` — the file containing `apiFetch` — was a local relative path, so it hit the rewrite rule and got HTML back instead of JavaScript. The error message `apiFetch is not defined` was the right clue, but only if you knew what it meant about the load order. The lesson isn't really about Netlify configuration — it's about how a working local environment can hide a class of bug that only surfaces when the URL structure changes. The pre-deploy checklist in test-cases.md is the right artifact: a lightweight way to catch this before it ships again.

Stack tags: Netlify · _redirects · clean URLs

## How Sloane steered the work
**Providing exact error text, not just "it's broken"**
When the profile pages failed, sharing the specific error message (`apiFetch is not defined`) and the exact visual state (unstyled nav text, the URL shown as page content in committee) gave enough signal to identify the root cause on the first pass. A vague "it's broken" would have required multiple back-and-forth cycles.

**Correcting the committee description mid-session**
The initial description of the committee page was "unstyled text with the URL shown." The follow-up correction — "actually it shows the nav structure and 'Fetching committee data from FEC…'" — was a meaningful distinction. It changed the diagnosis from "page not loading at all" to "page loading but JS failing partway through," which narrowed the fix.

**Confirming the site-level setting when asked**
When asked directly whether Netlify Pretty URLs was enabled, the immediate confirmation ("Yes, Pretty URLs is enabled") closed a key ambiguity that had been causing the debugging loop. Having that information explicitly answered — rather than needing to infer it from behavior — meant the fix could be targeted rather than defensive.

**Asking about documentation before closing**
"What MD documentation do we need to update?" is the right question at the right moment. It surfaces the architectural finding (absolute paths rule) as something worth preserving, not just a fix-and-move-on. The pre-deploy checklist in test-cases.md exists because of that question.

The through-line: Sloane gave the debugging process exactly the information it needed at each step — no more, no less — and then made sure the learning didn't evaporate when the session ended.

## What to bring to Claude Chat
– Post-deploy verification: now that the fix is live, confirm `/candidate/H2WA03217`, `/committee/C00833574`, and `/race?office=H&state=WA&year=2024&district=03` all load correctly on the deployed site. The Playwright tests pass but can't confirm Netlify-specific behavior.

– The race page for 2026: `/race?office=H&state=WA&year=2026&district=03` may genuinely return no candidates yet — the FEC system might not have any filed candidacies for WA-03 2026 this early in the cycle. Worth checking once the routing is confirmed working, so you know whether it's a data gap or a remaining bug.

– Next priority: now that clean URLs are working and the site is fully deployed, what's next? CLAUDE.md lists Spent tab, committee filing history, and ad hoc race mode as remaining Phase 3 work. Worth a quick alignment before the next session.

---
2026-03-10 — utils.js extraction

## Process log draft
Title: Paying down the debt we knew we had

Every page in the project had been carrying copies of the same seven functions — apiFetch, fmt, fmtDate, toTitleCase, partyClass, partyLabel, committeeTypeLabel — with TODO comments pointing at the problem. This session cleared it: extracted everything into utils.js, removed the duplicates from all six pages, and left the codebase in a state where adding a new page means linking one file instead of copy-pasting a block.

Changelog:
– Created utils.js with BASE, API_KEY, apiFetch, fmt, fmtDate, toTitleCase, partyClass, partyLabel, committeeTypeLabel
– Removed duplicated function definitions from candidate.html, search.html, committee.html, race.html, candidates.html, committees.html
– Added <script src="utils.js"></script> to each of those six pages (loads between main.js and the inline script block)
– Standardized two behavioral inconsistencies discovered during audit: partyLabel(null) now returns '' across all pages (was 'Unknown' in candidate.html only); committeeTypeLabel fallback is 'Type X' without colon (candidate.html had a stray colon)
– Removed all TODO comments that had flagged the duplication
– Updated CLAUDE.md: shared files paragraph, debt item marked resolved
– Updated test-cases.md: removed resolved known issue, added test log row
– 170/170 Playwright structural tests pass

Field notes:
The audit found the debt was slightly worse than documented — committeeTypeLabel was duplicated across three pages, not just mentioned as future work, and partyLabel had a silent inconsistency (one page returning 'Unknown' for null, three returning ''). Neither difference was visually obvious because real FEC candidates always have a party. That's the thing about copy-paste drift: it diverges in the gaps, not in the places you actually look. The extraction forced a decision, which forced an audit, which surfaced the inconsistency. The refactor did more than clean up lines of code — it made an implicit inconsistency explicit and resolved it.

Stack tags: none (pure refactor, no new dependencies)

## How Sloane steered the work
**Directing the scope precisely**
The task prompt was unusually specific: audit first, extract only what's genuinely duplicated across 2+ pages, don't move page-specific logic, verify with tests. That level of scope definition prevented the refactor from becoming a rewrite. It kept utils.js lean — nine things, no more — when there was pull toward adding more.

**Asking the right follow-up ("any docs to update?")**
After the code work was done, asking about documentation was a product-thinking move, not a housekeeping one. It surfaced the Known open issues table entry that needed clearing, the test log row that needed adding, and the question of whether shared tests should enforce utils.js — which turned out to be a no, for good reason (three pages don't need it). The question was small; the thinking it triggered wasn't.

The through-line: Sloane consistently treats refactors as complete when the documentation matches reality, not when the code compiles. That discipline is what keeps the project brief from drifting away from what was actually built.

## What to bring to Claude Chat
– Next priority check: the refactor is done and tests are clean — good moment to confirm what's next. CLAUDE.md lists Spent tab, committee filing history, ad hoc race mode, and Phase 4 as the remaining work. Worth a quick alignment on sequencing before the next session.
– Whether races.html, design-system.html, and process-log.html should ever load utils.js: currently they don't (no API calls), and that's correct. But if any of them ever adds a fmt() call or similar, the convention to follow is: add utils.js, don't copy the function.

---
2026-03-06 — Analytics session

## Process log draft
Title: We were flying blind. Now we're not.

The site had Amplitude in the project brief and in the stack tags of the process log, but zero actual tracking code on either active page. This session wired up the full analytics layer from scratch — pageviews, interaction events, and session recordings — and debugged two separate issues before anything actually worked.

Changelog:
– Audited all HTML files for Amplitude: confirmed 0 of 2 pages had any tracking code
– Added Amplitude browser SDK v2 (CDN snippet) to candidate.html and process-log.html
– Added pageview tracking on both pages with contextual properties (candidate_id, candidate_name, cycle on candidate page)
– Added interaction events on candidate page: Tab Switched, Cycle Switched, Committees Modal Opened, Committees Tab Switched — all guarded to fire only on user actions, not programmatic init calls
– Added Process Log View Toggled event on process-log.html
– Debugged broken SDK load caused by a bogus SRI integrity hash in the snippet (silent browser block, no console warning by default)
– Added candidate_id and candidate_name to all interaction events so they can be filtered or grouped by candidate in Amplitude without losing global visibility
– Added Amplitude Session Replay plugin (CDN, synchronous load) to both pages
– Debugged device ID mismatch error caused by adding the plugin before amplitude.init() — fixed by swapping order so init establishes device ID first
– Session Replay confirmed working in Amplitude dashboard

Field notes:
Two debugging detours in a row, both caused by the same pattern: code that ran without errors but produced no output. The SRI hash looked like a real hash. The session replay loaded without throwing. Both failures were silent until we knew where to look. The lesson isn't about analytics specifically — it's about how invisible failures in third-party integrations tend to be. The SDK either loads or it doesn't, and the only feedback is the absence of data. Having Amplitude's validation UI made the second bug visible in a way the browser console never would have.

Stack tags: Amplitude · Session Replay

## How Sloane steered the work
**Audit before action**
The opening instruction was explicit: don't add anything until you've checked what's already there. That discipline surfaces real information — the gap between "Amplitude" being in the stack tags and Amplitude actually being in the code is exactly the kind of drift that creates false confidence. Insisting on the audit first meant the implementation started from truth, not assumption.

**Keeping global visibility on interaction events**
When asked about adding candidate context to tab switches, Sloane flagged the concern directly: don't lose the ability to see tab switches globally across all candidates. That's a real product instinct — you want both the aggregate view ("which tabs get used most?") and the filtered view ("what does a Gillibrand visitor do differently?"). The reassurance that properties are additive in Amplitude, not restrictive, resolved the tension cleanly — but it was Sloane's question that made the tradeoff explicit.

**Knowing when to hand off debugging to the dashboard**
Rather than digging through the code for the session replay error, Sloane went to Amplitude's validation UI first and shared the specific error message. That's the right call — Amplitude's own tooling is better at diagnosing Amplitude configuration errors than code inspection is. The device ID mismatch message was precise enough to fix in two lines.

The through-line: Sloane consistently oriented toward "what does this data actually tell me?" rather than "does the code technically run?" That's a product-thinking lens applied to an engineering task, and it caught two silent failures that would have gone unnoticed otherwise.

## What to bring to Claude Chat
– Session Replay use cases: Now that replays are recording, how do you want to use them? Watching for UX confusion points on the candidate page? Sharing with John to show how people navigate the data? Worth having intent before the data accumulates.
– Analytics for future pages: As search and the committee page get built, what interactions will matter most to track? Good to decide event naming conventions now before there are more pages to retrofit.
– Remote Configuration Validation: Still showing a question mark in Amplitude's setup checker — worth investigating whether this requires any action or resolves on its own once more sessions accumulate.

---
2026-03-06 — AM session: Design System build (~11:00 AM – ~1:00 PM)

## Process log draft
Title: A living reference, not a dead document

The design system page didn't exist this morning. By noon it was a fully structured reference that uses the actual production CSS classes in its demos — not mockups, not approximations. The goal from the start was to build something honest: if a component changes in production, the design system reflects it automatically because they share the same CSS.

Changelog:
– Created design-system.html from scratch; links styles.css and main.js same as all other pages
– Built token documentation: Tier 1 primitive values table + Tier 2 semantic CSS vars table
– Built Color section with swatch groups (Backgrounds, Text, Partisan, Status); all swatches carry data-token/data-hex for Figma MCP
– Built Typography section with Syne + IBM Plex Mono specimens and size/weight scale
– Built Spacing section with visual scale bars
– Built Components section with 13 cards; each has: component name, data-status badge, class list, live demo using real CSS
– Component status lifecycle established: stable · candidate-only · log-only · planned · deprecated
– Interactive demos: tab bar switching, health banner state switcher (Green/Amber/Red/Closed), modal open/close trigger
– Added Design System link to Documentation section in sidebar + mobile nav on candidate.html and process-log.html
– Renamed "Dev" → "Documentation" nav section across all pages
– Added Process Log link to Documentation section
– Discovered .overspend-note and .ds-overlap-note were the same visual pattern defined twice under different names → unified as .callout in styles.css

Field notes:
The most revealing moment was asking where the overspend callout was "actually coming from." The answer was: the same place as the design system's overlap annotation — same amber tint, same border, same spacing, same intent — but defined separately in two files, neither documented as a component. The design system's job isn't just to document what exists. It's to notice when the same idea has been independently invented twice and quietly give it one name.

Stack tags: Design System · Component architecture · Figma MCP readiness

## How Sloane steered the work
**"Keep Figma MCP in mind but don't make it the focus" — a quiet architectural constraint**
Setting this direction at the start shaped every structural decision without turning the session into an integration project. The data-token, data-hex, id="comp-{name}", and data-status attributes are all in place — but zero time was spent on actual MCP wiring. That's exactly the right call: design for extensibility without overbuilding.

**"Dev" → "Documentation" — more than a rename**
This isn't just a label change. It signals something about the project's identity — a documentation hub, not a developer diary. The rename happened alongside adding both Process Log and Design System to that section, which clarified the nav's information architecture in one move.

**Insisting on the correct callout styling**
When the initial plan only changed font-size, Sloane pushed back: "Does this include the styling as it was with the background and stroked container?" That's a precision eye — noticing that amber + border + background together carry a specific meaning (important caveat, not just a footnote), and that stripping any of those elements would lose the signal.

**Adding "Closed" as the 4th health banner state**
The health banner demo originally had three interactive states. Sloane added the fourth — the closed-cycle summary state — during the build. This documents the actual state machine of the production component, which is the whole point of live demos over static screenshots.

**"Where is this coming from exactly?" — the question that broke open the audit**
Asking about the overspend callout on a closed cycle page was a small question with large consequences. It revealed that the same visual component had been independently invented twice under two different class names, neither documented. That instinct to investigate rather than accept the surface answer led directly to the callout unification — and eventually to the full CSS consolidation the following session.

The through-line: Sloane consistently treated the design system as infrastructure, not just documentation. Every call was oriented toward making the system honest and durable.

## What to bring to Claude Chat
– Figma MCP timing: data attributes are in place (data-token, data-hex, id="comp-{name}"). What needs to happen on the Figma side before the MCP integration makes sense?
– Process log voice: the entry above was drafted from notes and screenshots. Read it with Sloane and adjust first-person voice before publishing — field notes in particular should sound like Sloane wrote them.
– Spent tab is next priority. When it ships, components it introduces should be documented in design-system.html in the same session, not retroactively.

---
2026-03-06 — PM session: CSS consolidation + chart color tokens (~1:05 PM – ~1:40 PM)

## Process log draft
Title: The design system didn't share its own CSS

The design system page was supposed to be the canonical reference for production CSS. It wasn't. It was maintaining its own private copy — roughly 110 lines of component CSS duplicated from candidate.html's inline style block. If you changed a border-radius in production and forgot to update the design system, nothing would catch the drift. This session fixed the root cause.

Changelog:
– Identified ~110 lines of duplicated component CSS in design-system.html that mirrored candidate.html's inline style block
– Moved 10 component CSS groups to styles.css: tab bar, tags, health banner, chart card + legend, committee rows, data table, spend bars, donut, modal, choropleth map
– Added 10 --chart-* CSS custom properties to styles.css :root (raised, spent, CoH lines + overlay colors)
– Added CHART_COLORS JS constant to candidate.html script block — single source of truth for all chart rgba values
– Updated all raw rgba() references in chart configs to reference CHART_COLORS (timeline datasets, tooltips, axes, overlay lines, contributor donut)
– Updated HTML legend swatches in both pages to use var(--chart-raised/spent/coh) CSS vars
– Added Chart color swatch group to design-system.html Color section (6 swatches with data-token/data-hex)
– Added 11 --chart-* vars to Tier 2 token table in design-system.html
– Added choropleth map component card (comp-map, candidate-only) to design system
– Updated CLAUDE.md with CSS consolidation principle and CHART_COLORS pattern

Field notes:
The real problem this session solved wasn't CSS duplication — it was epistemological. When the design system maintains its own copy of production CSS, it's not a reference for production code; it's a parallel universe that can drift silently. The whole point of a design system is that there's one version of the truth. Now there is. Everything in design-system.html either comes from styles.css (shared) or is explicitly page-specific. The drift vector is closed.

Stack tags: CSS architecture · Design tokens · Chart.js

## How Sloane steered the work
**The investigative prompt that unlocked the audit**
"Where is this coming from exactly — and could there be other examples like this?" wasn't a request to fix one thing. It was a request to understand scope first. That discipline — audit before action — is what surfaces real problems rather than patching symptoms.

**Approving the comprehensive plan over a narrow fix**
When Claude proposed a full 4-part consolidation (10 CSS groups, chart tokens, DS docs, CLAUDE.md), Sloane approved without asking to scope it down. The narrow version would have been "just fix the callout." The right version was: close the drift vector, establish the pattern, document it for future sessions.

**Managing the rate limit without losing the thread**
Hitting a rate limit mid-implementation could have split the refactor across sessions, leaving the codebase in a partially-consolidated state. Upgrading and continuing kept the work atomic.

The through-line across both sessions today: Sloane consistently treated the design system as infrastructure. Every decision was oriented toward making the system honest and durable, not just visually complete.

## What to bring to Claude Chat
– Preventing the ritual gap: both today's sessions ended without proper log entries (rate limits/compaction). The screenshots saved it. What's the right habit going forward? Explicit /compact before limits hit, or a session-start check that looks at whether claude-to-claude.md is current?
– Figma MCP integration: now that the token and component architecture is solid, when is the right moment to do the actual MCP wiring? What would it require on the Figma side?
– Spent tab is the current build priority. New components it introduces should be documented in design-system.html in the same session they ship.

---
2026-03-06 — Light theme preview session

## Process log draft
Title: Testing the light switch

We knew the dark theme wasn't the only answer, just the first one. This session was a controlled experiment — three light theme palettes applied, screenshotted across three pages and two breakpoints, then fully reverted. No permanent changes. Just evidence to evaluate.

Changelog:
– Defined three light theme candidates: Option A (warm off-white, DM Sans), Option B (pure white, Inter), Option C (parchment/sepia, DM Sans)
– Wrote a preview workflow: apply token swap to styles.css :root + body font, add new web font to Google Fonts import in all three HTML files, screenshot, revert
– Discovered Chrome headless --screenshot CLI captures the page before web fonts render (Google Fonts uses font-display: swap — fonts load asynchronously after the load event)
– Solved with puppeteer-core + networkidle2 wait + 1500ms post-idle pause for font rendering
– Captured 18 screenshots: 3 options × 3 pages (candidate, process-log, design-system) × 2 breakpoints (1440×900 desktop, 390×844 mobile) — all at 2× deviceScaleFactor
– Confirmed full revert after each option; git status clean on exit
– Outputs saved to theme-previews/ (untracked, not committed)

Field notes:
The experiment surfaced something I didn't expect to care about: the design system page is the most honest preview surface. The candidate page is dominated by Syne headings and IBM Plex Mono data labels — both explicitly set, so they don't change between options. The font swap is nearly invisible there. The design system page, which has more body text, shows the font difference clearly. Option B (Inter) read the most neutral — almost indistinguishable from a default sans — while Options A and C had enough warmth in the background to make DM Sans feel more deliberate. Whether that warmth works for a data tool is the real question, and one screenshot session can't answer it.

Stack tags: puppeteer-core · CSS custom properties · light theme

## How Sloane steered the work
**Scope expansion before execution**
You added design-system.html and both desktop + mobile breakpoints before approving the plan. That brought the total from 6 screenshots to 18. The instinct was right — the design system page turned out to be the most revealing surface for comparing the body font swap, since candidate.html is heavily dominated by explicitly-set Syne and IBM Plex Mono.

**"Redo with proper font loading"**
When the first Option A screenshots came back using Chrome headless CLI, you flagged the load-timing issue immediately. That call led to the puppeteer-core approach, which gives a proper networkidle2 guarantee rather than hoping the timing works out.

**Pulling back at the end**
After seeing all three options, you didn't pick one — you called a timeout. "I might want to take a bigger step back and test more sweeping updates." That's the right read: a :root token swap is a preview, not a decision. The real design work — typographic scale, spacing, surface layering — needs its own session before committing to a direction.

The through-line: you're treating this session as evidence-gathering, not decision-making. You want to see the options before you know what questions to ask about them.

## What to bring to Claude Chat
– What's the actual design direction question? The three options were a controlled test, but the bigger fork is: does this tool stay dark-first, go light as primary, or offer both? That's a product positioning question as much as a design one.
– What would "more sweeping updates" mean? Token swaps are surface-level. A real light theme pass probably means revisiting typographic scale, surface layering depth, border weight, and spacing — worth scoping before the next session.
– Is the font pairing working in dark mode? DM Sans and Inter were only evaluated against light backgrounds. Worth asking whether the same pairing would hold in the dark theme before deciding if a font change is part of the direction at all.
– When is the Spent tab happening? This was a design exploration detour. The Spent tab (category breakdown, spend timeline) is still the top functional priority per CLAUDE.md. Worth reconfirming priority before the next session.

---
2026-03-09

## Process log draft
Title: The broadsheet lands — and the charts finally match the room

The dark theme is gone. This session replaced it entirely with the broadsheet light theme: warm parchment surfaces, Barlow Condensed headings, DM Sans body, IBM Plex Mono for labels and data. The decision had already been made in Claude Chat — this session was execution. Four files touched, all coordinated through a shared styles.css that makes the token change propagate everywhere.

The second half of the session closed the chart gap. CHART_COLORS still had nine hardcoded dark values — tooltips floating in dark boxes on a warm page, axis labels in dark gray. All updated to warm light equivalents. The raised and spent donut charts were also mismatched: the raised tab had visible segment borders (intentional, and kept), the spent tab had none, a wider cutout, and weaker animation. Aligned both to the same spec. Fixed a clipping bug where donut segments were getting cut off on hover — turned out to be overflow:hidden on the cell container, which was redundant given that min-width:0 already handles grid overflow.

Changelog:
– Replaced styles.css :root entirely with warm light token set; added --sidebar-bg, --sidebar-border, --sidebar-text, --sidebar-muted, --sidebar-active-bg, --border-strong, --accent-dim tokens
– Replaced Syne with Barlow Condensed across all pages; DM Sans replaces IBM Plex Mono as body font; IBM Plex Mono role narrows to labels only
– Sidebar, mobile header, mobile nav updated to --sidebar-bg and sidebar-specific tokens
– Nav dots: removed all inline style="background:..." attributes; CSS now drives all dot colors (--border-strong default, --accent active)
– Tab active indicator changed from --text (white) to --accent (blue)
– Health banner, chart card, modal, donut center, data table: all font-family updates
– Modal overlay lightened: rgba(26,21,16,0.65)
– Global top banner set to dark treatment (#1c1710 background) as intentional contrast element
– Choropleth map: no-data fill and state stroke updated from dark to light values
– Design system: token table, color swatches, Tier 1 primitives, and typography specimens all updated
– CHART_COLORS: all 9 hardcoded dark values updated to light theme equivalents
– Raised and spent donuts aligned: same cutout (68%), borderWidth (2), borderColor, hoverOffset (4), animation (600ms easeOutQuart), tooltip config
– Removed overflow:hidden from .raised-cell — fixes donut hover clipping
– Fixed hardcoded dark rgba in .donut-row border-bottom → var(--border)

Field notes:
The cache split was the first sign the retheme was working: Barlow Condensed appeared immediately (font import is per-page HTML), but the colors were still dark (styles.css was cached). That's a useful debugging signal — if the type changes but the palette doesn't, it's almost always a cache issue, not a broken stylesheet. The more interesting moment was the donut alignment ask. The raised donut had a design detail — the 2px border between segments — that the spent donut was missing. That kind of inconsistency is invisible until you see both charts on the same screen. Spotting it fast, and knowing it was intentional rather than accidental, is the kind of eye that makes a portfolio piece feel finished.

Stack tags: CSS custom properties · Barlow Condensed · DM Sans · Chart.js · Light theme

## How Sloane steered the work
**Direction already decided before the session started**
The retheme handoff doc arrived fully specified — fonts, tokens, hex values, contrast ratios, component-by-component decisions. Sloane had done the design work in Claude Chat and translated it into something a coder could execute without judgment calls. That's a disciplined handoff: design decisions happen in the right tool, implementation happens in the right tool.

**"Enter plan mode before touching any files"**
The explicit instruction to plan before acting kept the session organized. For a change touching four files and three font families, an unplanned execution would have introduced inconsistencies. The plan surfaced the donut row dark border, the modal overlay, the choropleth map — details that weren't in the handoff spec but needed resolution.

**Liking the raised donut's segment borders as a stylistic choice**
When reviewing the two donut charts, Sloane identified the dark borders between segments as something worth keeping — not a bug, a choice. That's a designer's read, not a developer's. It changed the brief from "fix the mismatch" to "preserve what works in one, apply it to the other." The spent donut now matches intentionally, not just technically.

**Cache diagnosis recognized without panic**
When the type changed but colors didn't, Sloane asked clearly what was happening rather than assuming the implementation was broken. The answer (browser cache split) was quick to identify and quick to resolve.

The through-line: Sloane came in with decisions made and a clear eye for what was working vs. what wasn't. The session was execution and calibration, not design exploration.

## What to bring to Claude Chat
– Typography refinement pass is still open. The handoff explicitly deferred sizing, weight, and tracking beyond the decisions already made. Now that the theme is live, what does a type pass look like? Which elements feel undersized or lacking hierarchy?
– Spent tab is still the top functional priority per the roadmap. The theme work was a prerequisite (portfolio piece needs to look right), but the feature backlog is waiting: category breakdown, spend timeline.
– Chart color pass: the --chart-* data colors (raised blue, spent red, CoH green) were carried over from the dark theme unchanged. They may need adjustment for legibility on a warm light background — worth evaluating once the theme is live.
– Data freshness indicators: every data display should show coverage dates and filing recency. Not yet built; should ship alongside the spent tab, not after.

---
---
2026-03-10

## Process log draft
Title: Housekeeping before the next push

A brief session, all infrastructure. The project directory name had been wrong in the CLAUDE.md session-start instructions since the repository was renamed — `fred-project` instead of `fec-project`. Fixed, committed, and pushed. The GitHub remote URL had the same stale name and was silently redirecting; updated that too. No production changes. The goal was testing a device-switching workflow: push something small, pull it on another device, confirm the setup travels.

Changelog:
– Fixed CLAUDE.md session-start instructions: `fred-project` → `fec-project`
– Updated git remote URL: `https://github.com/sloanestradley/fred-project.git` → `https://github.com/sloanestradley/fec-project.git`

Field notes:
The remote redirect was the only interesting thing here. GitHub was quietly forwarding pushes and pulls to the right repo, so everything "worked" — no one would have caught it without looking. The rename surfaced it. Worth noting: silent redirects are fine until the old repo name gets reused or the redirect expires. Good to have the canonical URL set correctly before that becomes a problem.

Stack tags: git

## How Sloane steered the work
**Testing a new workflow, not just deploying**
The push wasn't about the content of the commit — it was about proving the device-switching workflow. Sloane named that explicitly, which reframed a minor housekeeping task as infrastructure validation. That's systems thinking applied to the working environment, not just the product.

The through-line: Sloane treats the working environment as something worth maintaining intentionally. The cleanup was noticed, the rationale was stated, the test was run.

## What to bring to Claude Chat
– Device-switching workflow: did the pull on the second device work cleanly? Anything to set up (SSH keys, Claude Code config, etc.) to make the switch seamless?
– Spent tab is the top functional priority — when ready to resume building, that's where to pick up.

---
2026-03-10 — Navigation framework session

## Process log draft

**Title:** From stubs to structure: the navigation framework takes shape

**Summary:** We built the full navigation skeleton for ledger.fec — six new pages, a shared CSS migration, and an IA document that captures how everything connects. The session started with three scaffold pages (search, committee, race) and ended with a cleaner, more intentional IA: browse pages (candidates, committees, races) separate from profile pages (candidate, committee, race), with a single race view that links directly to the right election cycle on a candidate's profile.

**Changelog:**
- Created search.html: name-based candidate search, 4 states, Amplitude tracking, auto-fires from ?q= URL param
- Created committee.html: committee profile with metadata, status tags, financial summary, back-link to candidate, links from committees modal
- Migrated .stats-grid, .stat-card, .committees-link from candidate.html inline styles into styles.css
- Added shared CSS: .candidate-card, .tag-active, .tag-terminated, .committee-name-link, .mobile-search-icon
- Wired real hrefs into all nav stubs across all pages; added mobile search icon to all mobile headers
- Updated renderCommitteeGroups() in candidate.html: committee names now link to committee.html?id=...
- Created index.html: redirect to search.html
- IA refactor: renamed race.html → races.html (mode selector), created new race.html (single race view with cycle-anchored candidate links)
- Created candidates.html: filter-based browse (state/office/party/cycle)
- Created committees.html: filter-based browse (state/type), links to committee profiles
- Updated all page navs: Candidates → candidates.html, Committees → committees.html, Races → races.html
- Created ia.md: full IA documentation
- Fixed 422 error on race.html: /elections/ API requires lowercase full office words (house/senate/president), not H/S/P

**Field notes:** The rename from race.html to races.html clarified something important: the tool has two distinct layers — browse (plural) and profile (singular) — and keeping them structurally separate makes the nav logic much cleaner. The ia.md felt overdue; naming the layers explicitly made it easier to decide where future pages belong. The 422 on /elections/ is a good reminder that the FEC API is inconsistent about parameter formats — worth auditing when adding new endpoints.

## How Sloane steered the work

**The rename that reframed the architecture:** When you noted that race.html "appears to have content I'd actually see in 'races.html' (plural)," it wasn't just a naming fix — it surfaced a structural problem. The nav was routing top-level items directly to profile pages instead of browse pages. Your instinct to separate them led to candidates.html and committees.html, which made the whole IA click into place.

**Requesting the IA documentation:** Asking for ia.md alongside the page builds forced an explicit accounting of every page, its URL pattern, its status, and how it connects. It'll be useful as a handoff artifact as the project grows.

**The utils.js comment requirement:** When approving the plan, you added: "note the shared utility duplication as a future utils.js refactor in a comment — don't solve it now, just flag it." Exactly the right kind of technical debt acknowledgment — visible, actionable, non-blocking.

**Knowing when to stop:** You called end-of-session rituals while context was still available. Good session hygiene.

The through-line: you're consistently making decisions that favor clear structure and future legibility over short-term convenience — naming, documentation, flagging debt. The product is benefiting from being designed, not just built.

## What to bring to Claude Chat

- **Browse page design:** candidates.html and committees.html are filter-first and functional but minimal. Is that the right approach for the audience, or do they need more editorial design (featured candidates, recent filings)?
- **Search vs. browse distinction:** search.html is name-based, candidates.html is filter-based. The split is intentional but may not be obvious to users. Does it need a UI signal?
- **ia.md open questions:** Three decisions waiting: (1) What does a homepage eventually look like? (2) Does committee search live in search.html or committees.html? (3) Ad hoc race URLs — long comma-separated IDs or server-side shortener?
- **utils.js:** Extract shared utilities before the next session adds more pages, or hold until a natural refactor moment?

---
2026-03-10 — Test cases infrastructure session

## Process log draft
Title: The test cases that test the test cases

This session didn't ship a feature — it shipped the infrastructure for knowing when features break. The work was designing and writing a manual browser test checklist that covers every page in the project, scoped to what's actually built (not what's planned), with explicit Amplitude verification steps, a test log for session-by-session history, and a known open issues table so expected failures don't masquerade as regressions.

The most interesting moment was realizing the test cases themselves needed to be tested. After writing them, Claude flagged six cases with uncertain accuracy — two with wrong or unverified test URLs, two with wording that would produce false failures, two that may test unimplemented behavior. Two were fixed immediately (committee.html pointing to a real verified committee ID; race.html pointing to 2024 instead of 2026 for a cycle with actual filings). The others were documented for the first real run to shake out.

Changelog:
– Created test-cases.md with: shared checks section, per-page sections for all 10 pages, Amplitude verification method, known open issues table, test log table
– test-cases.md scoped per page status: live pages get full coverage, scaffold pages test only what's implemented
– race.html section explicitly tests the /elections/ office-param 422 bug (network tab check for "house" not "H")
– Added test-cases.md to CLAUDE.md Current Files inventory
– Added session-end test ritual to CLAUDE.md: run cases for pages touched → log results → add new cases for new features
– Fixed committee.html test URL: C00431445 → C00775668 (verified active, real coverage date in design-system.html)
– Fixed race.html test URL: year=2026 → year=2024 (completed cycle with known filings)

Field notes:
Writing test cases without running them is an act of faith in the source reading. The check that revealed the most was asking "which cases am I least confident in?" — not as a quality gate but as a forcing function to surface assumptions. The committee ID was a made-up placeholder. The 2026 race URL was based on the CLAUDE.md test candidate without considering whether 2026 filings would exist yet. Both are the kind of silent wrong that only shows up when someone actually runs the test. The meta-lesson: a test document is only as good as its first real run. The cases are a starting point, not a finished artifact.

Stack tags: Testing · Documentation · Project infrastructure

## How Sloane steered the work
**Plan mode before writing — the right instinct for an infrastructure task**
Asking for a plan before any files were written forced an explicit accounting of structure, scope, and maintenance protocol before a single checkbox existed. For an infrastructure artifact like a test document, the design decisions matter more than the writing — getting the shape right (shared checks, per-page sections, known issues, test log) is the thing that makes it useful long-term.

**Adding race.html verification to the plan**
The suggestion to add race.html?state=WA&district=03&year=2026&office=H as a verification step — and specifically to confirm the /elections/ fetch — showed domain awareness about which code path is most brittle. The 422 bug (office=H vs office=house) was the hardest-to-notice failure mode in the navigation session. It deserved explicit test coverage.

**Asking for Amplitude verification to be planned explicitly**
Not leaving Amplitude as an implicit "check that it works" — asking for it to be in the plan with a specific method (Network tab, filter api2.amplitude.com, inspect payload) means the test cases have actionable instructions, not just intentions.

**"Did you test against these cases yourself?"**
This question was the session's sharpest move. It surfaced something real: the test cases were written from code reading, not from browser runs. That's a meaningful limitation, and naming it directly led to the confidence audit that found six uncertain cases and fixed two immediately. Asking the question didn't undermine the work — it made the output more honest.

The through-line: Sloane consistently treated the test document as infrastructure with a lifecycle, not a one-time deliverable. Every steering moment pushed toward durability — plan first, verify the verifier, make Amplitude steps actionable, name what you don't know.

## What to bring to Claude Chat
– First real test run: the test cases have never been executed in a browser. The first run will find cases that are wrong (false failures, wrong URLs, missing steps). Worth doing a quick pass on candidate.html and race.html before the next build session so the document is calibrated before it's relied on.
– The six uncertain cases: four weren't fixed this session (races.html district show/hide behavior, committee modal count flakiness under slow network, search.html empty-search wording, design-system.html style block false failure). Worth reviewing on the first test run.
– test-cases.md maintenance habit: the document only works if it stays current. Worth discussing whether "add test cases in the same session a feature ships" is a habit that will actually hold, or whether a monthly audit is a more realistic backstop.

---
2026-03-10 15:30

## Process log draft
Title: Finally, a net under the tightrope

This session built the automated testing infrastructure the project has been missing — a Playwright suite that checks all 170 structural invariants across every page in about a minute, with no real API calls required. Along the way it caught a real bug: design-system.html was silently missing the mobile search icon that every other page has.

Changelog:
– Set up Playwright with two separate tracks: Track 1 (structural, mocked API) and Track 2 (smoke, live FEC API)
– 170 structural tests across 4 spec files covering all 9 pages plus index.html
– Shared checks (7 assertions × 9 pages): styles.css linked, main.js linked, sidebar nav, mobile search icon, correct active nav item, warm parchment background, Page Viewed Amplitude event
– candidate.html tests: profile header, stats row non-$0, health banner, chart canvas, tab nav, committees modal open/close, Amplitude event timing (Tab Switched not on init), URL hash pre-selection, API correctness
– search.html tests: hero state, search interaction, result card links, auto-search via ?q=, Candidate Searched and Candidate Result Clicked Amplitude events, no-results state
– All other pages: committee, races (mode cards, curated form), race (candidate cards, financial figures, cycle-anchored links), candidates, committees, process-log, design-system (token tables, swatch data attributes, component card IDs), mobile layout at 390px and 1280px
– 5 smoke tests: MGP financials non-zero, Gillibrand Senate cycle switcher, Gillibrand search, committee C00775668, WA-03 2024 race
– FEC API mocked via page.route() intercept with shape-correct fixture data; Amplitude mocked via CDN block + sessionReplay stub + _q queue reader
– Fixed design-system.html: missing .mobile-search-icon in mobile header (caught by automated test)
– Fixed font names in CLAUDE.md tech stack (listed Syne instead of Barlow Condensed)
– Updated test-cases.md to mark automated checks with ✅, added Track 1/2 orientation at top
– Updated CLAUDE.md: Playwright in tech stack, full test file tree in Current files, end-of-session ritual updated to lead with automated tests

Field notes:
The interesting design problem in this session wasn't "how do we test" but "how do we test without the real FEC API." The Amplitude mock ended up being the most elegant part — rather than injecting a fake window.amplitude, we just block the Amplitude CDN so the SDK never loads, which means the snippet's built-in _q queue stays populated with all track() calls. No injection, no monkey-patching, just reading a queue that was always there. The FEC API mock was more mechanical but the fixture data shapes had to be correct — the pages are defensive enough that malformed mocks would silently produce $0 stats or no-op renders. The one real bug found (design-system.html missing the mobile search icon) had apparently been there since the page was built. It was invisible to manual testing because you'd never look for a hidden icon at desktop breakpoint.

Stack tags: Playwright · Testing

## How Sloane steered the work
**Two tracks, not one**
You specified upfront that there should be a clear structural/smoke split with different run commands for each track. That decision shaped the entire architecture — it's why the helpers are cleanly separated, why fixtures are in api-mock.js and not inlined in each spec, and why there are two playwright configs. A single "run all tests" setup would have been simpler to build but harder to use.

**Scope discipline**
When the test setup was working at 169/170, you didn't ask to pause and investigate the one failure as a deep dive — you let it get resolved as part of completing the task. That kept the session from becoming about debugging test infrastructure instead of delivering test infrastructure.

**Documentation as part of done**
You asked to check the .md files at the end rather than treating docs as optional cleanup. That caught the wrong font names in CLAUDE.md's tech stack (Syne was listed instead of Barlow Condensed — a copy-paste error from early in the project), and the test-cases.md got meaningfully updated rather than just a log row appended.

The through-line: you're treating the test suite as production infrastructure, not a one-time artifact. The two-track separation, the documentation updates, the log row — all of it reflects the expectation that future Claude sessions will run these tests and rely on TESTING.md to understand what they're looking at.

## What to bring to Claude Chat
– Smoke test timing: the 5 smoke tests have a 45-second timeout each. Worth discussing whether to run them on every deploy or only on-demand — Netlify preview deploys happen frequently and FEC API rate limits are real.

– Test coverage gaps to prioritize next: the Spent tab isn't built yet, so there's no test for it. When Spent ships, tests need to be added in the same session. Worth flagging this as a pattern — new features need test cases written at the same time they're built, or the suite drifts.

– Whether to add Playwright to the Netlify deploy pipeline (CI). Currently tests only run locally. Adding them as a pre-deploy check would catch regressions before they go live, but requires the FEC API key to be available in CI for smoke tests, or keeping smoke tests local-only.
---
2026-03-10 — Banner refactor and polish fixes session

## Process log draft

**Title:** The global banner was everywhere and nowhere at once

Every page was supposed to show the early-build banner. Most did — but only candidate.html had the CSS to style it. All the others had the markup sitting unstyled at the bottom of the page, invisible until you scrolled past the sidebar. Process-log and design-system had no banner at all. This session made it truly global: one CSS rule in styles.css, identical markup on every page, one canonical height token, no overrides.

Changelog:
- Moved `.global-banner` and `.global-banner-text` CSS from candidate.html inline `<style>` into styles.css as the single source of truth
- Added `position:fixed; top:0; left:0; right:0; z-index:300` — the fix that makes DOM placement irrelevant
- Added `.ds-component-preview .global-banner { position:static }` so the design system preview renders inline, not flyover
- Added banner HTML to process-log.html and design-system.html (previously missing entirely)
- Removed stale `:root { --banner-h: 28px }` overrides from 6 browse pages (search, races, committees, candidates, committee, race); `styles.css :root { --banner-h: 36px }` is now the only definition
- Removed the same stale 28px override from candidate.html (previously fixed the inline CSS but left the variable)
- Fixed design-system.html component preview to use identical markup — `<p>` tag + `&nbsp;` spacing — matching all other pages
- Fixed race.html `<title>` to omit the `·` bullet separator
- Fixed committee.html `<title>` to set dynamically to `[Committee Name] — ledger.fec` on data load, matching candidate.html pattern

Field notes:
The stale `--banner-h: 28px` overrides were a ghost from an earlier phase — probably copied into each scaffold page when candidate.html was the reference template. They were never cleaned up as the design system matured. The inconsistency only became visible after the CSS was centralized, which is the point: consolidation reveals drift that was always there but hidden by redundancy. The `<span>` vs `<p>` discrepancy in the design system preview was the same class of thing — a copy-paste from an earlier draft that lived undetected in a component demo nobody was directly comparing to the live version.

Stack tags: CSS architecture · Design system

## How Sloane steered the work

**Starting with symptoms, not a known cause**
You came in describing a visual inconsistency — height and spacing differences on three specific pages — without knowing the root cause. That's the right framing: surface the observation, let investigation reveal the mechanism. The alternative (guessing a fix and applying it) would have missed the `--banner-h` variable drift entirely.

**Not accepting "it worked in tests" as enough**
After the banner CSS consolidation, tests passed 170/170. But you flagged the visual regression anyway — the cache issue first, then the height inconsistency. Automated tests confirmed structural correctness; your eye confirmed visual correctness. Both are needed.

**Catching the markup mismatch on design-system.html**
The `<span>` vs `<p>` difference in the component preview was subtle — same class names, same text, slightly different spacing due to the element type and missing `&nbsp;` spacers. Flagging it separately, after the height fix, showed that you were evaluating the result visually and not just trusting that "the HTML was added" equaled "it looks right."

The through-line: you're treating visual consistency as a first-class quality signal, not a polish afterthought. The fixes this session were small in code terms but meaningful in portfolio terms — the kind of detail that separates a designed product from a built one.

## What to bring to Claude Chat

- The banner is now globally consistent — good moment to evaluate whether 36px is the right height, or whether it should be tightened. Worth a visual check on the deployed site before moving on.
- Spent tab remains the top unbuilt feature. Now that the infrastructure cleanup is done, is this session the right moment to start planning it, or are there more polish fixes to address first?
- The process-log.html and design-system.html hadn't had a full manual test run since the broadsheet theme shipped. Worth doing a browser pass to confirm everything looks right before the next feature build.

---
2026-03-11

## Process log draft
Title: Three layout fixes that make the page feel designed, not assembled

The candidate page has been accumulating small visual inconsistencies since the broadsheet theme shipped — things that are each minor in isolation but collectively undermine the impression that a designer touched the page. This session closed three of them. The Raised and Spent tab data panels had been sharing a single bordered container with a 1px dividing line, giving the appearance of one card with two zones rather than two independent views. Separating them into distinct cards with real gaps makes the data hierarchy immediately clearer. The profile avatar had a surface-light background and a muted border that made it recede — flipping it to the dark/light inverse treatment gives it weight and makes it read as a deliberate design choice. And moving the avatar inline with the candidate name rather than beside the whole right-column block ties the identity element directly to the name it belongs to.

Changelog:
– `.raised-grid` / `.raised-cell`: replaced the 1px gap + background-color border trick with genuine per-cell borders and a 1.5rem gap; applied in both candidate.html and design-system.html
– Avatar: `background:var(--text); color:var(--bg)`, border removed, size reduced to 32×32px
– Profile header HTML restructured: `.candidate-row` now holds only avatar + name; meta-row, cycle-switcher, and committees trigger moved to direct children of `.profile-header`
– `.candidate-row` gap adjusted to 0.75rem; `align-items:center`
– design-system.html CSS overrides and component preview HTML updated to match all three changes
– 170/170 Track 1 tests passing throughout

Field notes:
The raised/spent card separation was the most revealing change. The 1px gap trick is common — it looks fine in isolation — but once both the donut and the map had their own breathing room and their own borders, the tabs stopped feeling like a developer laid them out and started feeling like something was considered. The avatar change is the kind of decision that looks obvious in retrospect: a dark chip next to a large display name has weight; a surface-colored box with a subtle border disappears. The 32px size is right — it's small enough to be subordinate to the name, large enough to be legible as an identity mark. The inline layout (avatar + name on the same row, everything else below) is what it should have always been.

Stack tags: CSS architecture · Layout

## How Sloane steered the work
**"Separate them into two distinct cards"**
The request was precise about what "done" looks like: own background, own border, own padding, matching the card treatment used elsewhere. That framing — "matching what's already in the design system" — is the right constraint. It meant the fix couldn't be cosmetic; it had to be structurally consistent with the rest of the page.

**Avatar direction: dark, no border, inline with name**
Three distinct decisions compressed into one instruction: color treatment, border removal, and layout position. Each one is a real design call. The dark/light inversion is a strong choice — it makes the avatar a deliberate element rather than a filler placeholder. Removing the border removes the hedging. Moving it inline with the name is the right IA decision: the avatar belongs to the name, not to the whole header block.

**"32×32, non-destructive"**
After seeing the 60px avatar inline with the display-size name, you immediately called the size adjustment. "Non-destructive" is the right framing — it signals awareness of the fragility of layout changes and a preference for surgical edits over wholesale rewrites. The resulting change was exactly that: two property values, nothing structural.

**Calling the session before diving into race-title investigation**
You surfaced the question about race-title formatting, let it get answered, and then recognized it as a thread for the next session rather than something to pull on now. That's good session hygiene — know when you're done.

The through-line: you came in with a clear visual problem statement and specific design intent for each fix. None of these were open-ended explorations — each one was "here's what I see, here's what I want." That clarity made the session fast and the output clean.

## What to bring to Claude Chat
– Race title format investigation: the race.html title is assembled as `stateParam + districtStr + officeName(officeParam)` with `officeName()` mapping single-letter codes to display words. Worth discussing whether this format is right for all office types — especially President — and whether year should be in the title vs. only in the meta line.

– Avatar at 32×32: now that it's live, worth a visual check on the deployed site. Is it legible at that size for 3-letter initials like "MGP"? Font size is still 0.9rem — may need to drop to 0.7rem or similar at this size.

– Next session priority: the race-title investigation is parked. Is that actually the next build task, or is there something higher priority? Spent tab data freshness indicators and the remaining race.html ad hoc mode are both on the backlog.

---
2026-03-11

## Process log draft
Title: Two tasks, one lesson: consistency is a system problem, not a file problem

This session started as a navigation polish pass — adding a shared formatRaceName() utility, rebuilding the candidate page breadcrumb as a three-segment linked path (Candidates → race → name), redesigning the race page header with a year dropdown in place of a back-link, and simplifying the committee breadcrumb to show the committee name instead of a type label. Five interconnected changes across four files, done with plan mode after the first attempt at a direct edit was turned back.

After those changes shipped, a closer look at all three profile pages revealed something more structural: each page had been building its header independently, in its own local style block, with no shared foundation. The result was a table full of inconsistencies — breadcrumbs with different text-transforms and letter-spacings, titles at different sizes, spacing that varied page by page. The fix was to extract the shared foundation to styles.css (new .page-header, .page-header-title, .breadcrumb classes), standardize everything to the same Barlow Condensed 800 clamp(1.6–2.4rem) uppercase title, and document the pattern in the design system. That extraction then surfaced three follow-up bugs: the committee breadcrumb rendering ALL CAPS (FEC API returns uppercase; toTitleCase() wasn't applied), stale local CSS in design-system.html overriding the new shared breadcrumb rule, and component demos becoming invisible because the opacity:0 animation was on the base .page-header class. The final fix split the animation into a .page-header-reveal modifier class — layout and animation now belong to separate rules.

Changelog:
– utils.js: added formatRaceName(office, state, district) returning e.g. "House • WA-03"
– candidate.html: breadcrumb rebuilt as 3-segment linked path; updateBreadcrumb() extracts to function; race link year updates on cycle switch
– race.html: header uses formatRaceName(); year dropdown selector (2018–2026) replaces "← All Races" back-link; all nav links fixed to absolute paths
– committee.html: breadcrumb changed from "Committees / {type label}" to "Committees / {committee name}"; toTitleCase() applied to prevent ALL CAPS from FEC API
– styles.css: added shared .page-header (layout), .page-header-reveal (animation), .page-header-title, .breadcrumb classes; removed translateY from animation (opacity-only fade); restored text-transform:uppercase on .breadcrumb
– candidate.html, committee.html, race.html: local duplicate header CSS removed; shared classes applied; tabs-bar added to fade-in sequence on candidate page
– design-system.html: Page Header component card added (stable); Candidate Header demo updated; stale local .breadcrumb CSS fixed
– tests/pages.spec.js, tests/candidate.spec.js: 4 new tests for breadcrumb links and race year dropdown (174 total)
– test-cases.md: header template consistency checks added; Page Header component card check; pre-deploy checklist updated for race.html; .layout banner overlap added to known issues

Field notes:
The header audit surfaced a pattern worth naming: when three pages build the same component independently, they will drift. Not immediately, not dramatically — one page gets text-transform removed for a specific reason, another inherits a different size from an earlier design pass, a third has slightly different letter-spacing. Each change made local sense. The table showing all three side-by-side is where the drift becomes visible. The extraction to styles.css isn't just a cleanup — it's making the implicit contract between pages explicit. The .page-header-reveal split is the same logic applied to behavior: layout and animation are different concerns, and separating them prevents the next page from accidentally inheriting an animation it doesn't need.

Stack tags: CSS architecture · design system · navigation

## How Sloane steered the work
**"Please use plan mode before starting" — enforcing the process**
The first edit attempt in this session was made without plan mode. Sloane rejected it immediately: "Please use plan mode before starting as there are several moving parts." Every multi-file change after that went through plan → approve → execute. That discipline is what kept five interconnected changes from becoming a debugging session.

**Requesting the header consistency audit**
After the breadcrumb changes shipped, Sloane looked at the three profile pages side by side and spotted divergence: "I'm seeing inconsistencies in text-transform in the breadcrumbs and page titles. Inconsistencies in text size. And possibly inconsistencies in spacing. Investigate why there are inconsistencies and come up with a scaleable plan to address." This was a systems question, not a targeted bug report. That framing led to the comparison table and the CSS extraction — the right solution rather than a series of local patches.

**"Uppercase everywhere" on titles**
When asked how to handle the race title (text-transform had been removed in the previous session for the new bullet format), Sloane called for uppercase everywhere. Conscious choice to reclaim consistency over the local accommodation — the bullet format reads fine in uppercase, and uniformity across all three headers matters more than optimizing for one edge case.

**"Standardize to large" for committee title — accepts wrapping**
The committee title was smaller to handle long names like "FRIENDS OF MARIE GLUESENKAMP PEREZ FOR CONGRESS." Sloane chose to standardize to the large size and accept wrapping. Right call: a slightly taller header is a smaller visual cost than a header that looks different from its siblings on every page.

**"ALL breadcrumb items uppercase" — system-level, not just labels**
When breadcrumb text was showing in mixed case, Sloane asked for uppercase across all pages and all items (including candidate names, committee names, race names). Unifies the breadcrumb as a data path rather than prose.

**Knowing when to stop**
When the banner overlap on candidate.html remained unresolved, Sloane called it: "this should be a separate debugging session." Good triage — the issue is cosmetic and isolated, logging it as a known issue is the right artifact.

The through-line: Sloane is consistently enforcing process (plan mode), making system-level calls (consistency over local accommodation), and managing scope (knowing when to stop). These decisions compound — each one makes the next session faster to start.

## What to bring to Claude Chat
- The .layout / banner overlap on candidate.html — needs a fresh debugging session. Before starting, open DevTools on localhost:8080/candidate.html?id=H2WA03217, inspect the .layout element, check computed top offset and whether body padding-top:36px is being applied. Bring a screenshot of the Elements panel showing computed layout.
- Breadcrumb uppercase on entity names — currently text-transform:uppercase renders candidate names, committee names, and race names fully uppercase in breadcrumbs (MARIE GLUESENKAMP PEREZ, FRIENDS OF MGP FOR CONGRESS). Is this the intended reading experience, or should only navigational segments be uppercase while the entity name stays mixed case?
- Spent tab on candidate.html — still the only unbuilt tab. Now that headers, breadcrumbs, and browse infrastructure are stable, is this the next priority?

---
2026-03-11 — Party tag on race candidate cards

## Process log draft
Title: The tag was there all along — just speaking a different language

The party tags were wired up from the start — partyClass(), partyLabel(), the HTML, the CSS — but they never appeared on the race page. The /elections/ endpoint turned out to return party_full ("DEMOCRATIC PARTY") instead of the three-letter party code ("DEM") used by every other FEC endpoint. The utilities only matched the short codes, so every lookup returned empty string and the tags silently disappeared. Once the actual API response was fetched and inspected, the fix was three lines.

Changelog:
– race.html: moved party tag from separate .candidate-card-meta div into .candidate-card-name div (inline with name, same row)
– styles.css: added display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap to .candidate-card-name
– race.html: buildCandidateCard now reads c.party || c.party_full to handle both endpoint shapes
– utils.js: partyClass() and partyLabel() now match startsWith('DEMOCRAT') and startsWith('REPUBLICAN') in addition to 'DEM'/'REP' short codes — handles any endpoint returning full party names

Field notes:
The debugging process here was a good reminder of how the mock/live gap works in this project. The Playwright tests all passed because the mock fixture used party: 'DEM' — matching what the utilities expected. The live API returns a completely different field name for the same concept, and there's no test that exercises the live shape. The fix to partyClass/partyLabel to accept both formats is the right call: it means any future endpoint returning full party names will just work without another round of this.

Stack tags: FEC API · utils.js

## How Sloane steered the work
**Catching the visual gap immediately**
The party tags weren't visible after the first deploy of the change, and rather than assuming it was a caching issue and moving on, you flagged it and confirmed via DevTools that the CSS was fresh. That distinction — "the CSS is definitely loaded, the tag is still missing" — is what shifted the investigation from a caching red herring to an actual data bug.

**Providing the screenshot**
Sharing the screenshot made the gap unambiguous. "Missing entirely" plus a visual of the cards confirmed there was nothing to hover, nothing hidden by overflow — the HTML just wasn't rendering the tag at all. That's a different class of bug than "tag is there but styled wrong," and the screenshot made that clear in one look.

The through-line: Sloane gave debugging exactly the right signal at each step — confirmed the CSS was fresh before assuming cache, confirmed the tag was absent (not just mispositioned), and escalated to a screenshot when words weren't enough. Each signal closed a branch of the investigation rather than opening new ones.

## What to bring to Claude Chat
- The mock/live field name gap is a structural risk — the /elections/ mock uses party: 'DEM' but live returns party_full. Worth a quick audit: are there other fields in the mock fixtures that don't match actual API response shapes? This won't surface in Playwright but will bite in production.
- Next priority alignment: CLAUDE.md lists Spent tab, committee filing history, and ad hoc race mode as remaining work. Which of these is the right next session?

---
2026-03-11 — Mock/live field shape audit

## Process log draft
Title: The tests were green. The map was empty.

The Playwright suite had been passing since the mock was first written, but one fixture was quietly serving the wrong data shape for the geography heatmap. The /schedules/schedule_a/by_state/ endpoint returns state-level aggregates — {state, state_full, total, count} — but the mock was returning individual contribution records with {contributor_state, contribution_receipt_amount}. The page code used d.state and d.total; the mock had neither. The heatmap rendered nothing in tests and nobody noticed, because no test asserted on it. The party tag bug from the previous session was the right prompt to audit systematically — and the audit found seven more gaps before any of them bit in production.

Changelog:
– Fetched live responses for all 9 mocked FEC endpoints and compared field names and value formats against fixtures
– SCHEDULE_A_BY_STATE: new fixture with correct field names (state, state_full, total, count); split from individual SCHEDULE_A fixture which now uses proper individual-contribution shape
– Route handler: /by_state/ now routes before plain /schedule_a/ so each path gets the right fixture
– TOTALS + COMMITTEE_TOTALS: coverage_end_date updated from '2024-12-31' to '2024-12-31T00:00:00' (live API always includes timestamp)
– REPORTS: total_receipts_ytd changed from number to string (live API quirk — only receipts is a string; disbursements is a float)
– CANDIDATE_COMMITTEES: leadership_pac changed from false to null (live value)
– COMMITTEE: organization_type_full changed from 'Candidate' to null (live value)
– CANDIDATE: added party_full: 'DEMOCRATIC PARTY' (present in live, missing from mock)
– CLAUDE.md: added mock/live gap risk pattern to Remaining architectural debt; updated test count 174 → 175
– test-cases.md: updated test count in How to use section; added test log row
– 175/175 structural tests pass

Field notes:
The audit structure — fetch live, compare to mock, document gaps before touching code — is the right process for this class of bug. The party tag failure from the previous session was a case where the live API used a different field name entirely (party_full vs party). This audit found a case where the field names were correct but the value types differed (string vs number), a case where an entire fixture was serving the wrong endpoint shape (by_state vs individual), and several cases where null vs false or null vs 'Candidate' diverged silently. None of these produced test failures. All of them would have produced silent rendering failures in production if the page code hadn't already been written defensively (parseFloat, split('T'), partyClass accepting both formats). The mock/live gap is structural — the only fix is a standing practice: fetch one live response when adding any new endpoint, before writing the mock.

Stack tags: FEC API · Playwright · api-mock.js

## How Sloane steered the work
**Framing this as a pre-deploy audit, not a feature**
The explicit constraint — "no UI changes, no new features, audit only" — kept the session focused. Without that framing, an audit session can drift into refactoring or improvement. With it, every fix was scoped to field name/value gaps only. That's exactly right for a session whose job is to close unknown unknowns before they ship.

**Treating the party tag bug as a signal, not a one-off**
The previous session fixed one gap (party_full vs party). Rather than closing that ticket and moving on, you recognized it as a representative failure — evidence that the mock/live gap was a pattern worth auditing systematically. That's the difference between fixing the bug and fixing the class of bug.

**Setting the ritual order: log first, then deploy**
Asking to run end-of-session rituals before the deploy commit means the session log and CLAUDE.md updates land in the same commit as the code changes. That's a better artifact than a floating log entry that doesn't reference a real commit.

The through-line: Sloane consistently treats process discipline as part of the work, not overhead after it. The audit structure, the scope constraint, the commit order — all of it reflects a belief that the codebase should remain legible to a future session, not just functional right now.

## What to bring to Claude Chat
– Next priority alignment: audit is done, tests are clean, party tag fix and mock corrections are ready to deploy. CLAUDE.md lists Spent tab timeline, committee filing history, and ad hoc race mode as remaining Phase 3 work. Which is next?
– Mock test coverage gap: no Playwright tests assert on the geography heatmap or the contributor breakdown table — the by_state fixture was wrong for months without detection. Worth deciding whether to add light assertions on those sections (e.g. heatmap SVG renders, top-states table has rows) before Phase 4 adds more endpoints.

---
2026-03-11 End of session

## Process log draft
Title: Housekeeping as craft — tests, cleanup, and dead issues

This session was infrastructure, not features — but the kind that makes the next session faster and more confident. We added smoke-level Playwright coverage for the two Raised tab sections that were previously untested (the geography heatmap and contributor table), confirmed that the local apiFetch duplicates in race.html and committee.html had already been resolved, and cleared three stale items from the known-issues list that no longer reflected reality.

Changelog:
- Added two new tests to candidate.spec.js: geography heatmap SVG renders inside #map-container; top committee contributors table has at least one data row after Raised tab activates (177 tests total, up from 175)
- Confirmed race.html and committee.html have no local apiFetch definitions — already cleaned up in the utils.js extraction session
- Removed stale "Spent tab not yet built" known issue from test-cases.md (Spent tab shipped in Phase 1)
- Removed .layout / global banner overlap from known issues in both test-cases.md and CLAUDE.md — no longer reproducible, likely a caching artifact
- Updated test counts in CLAUDE.md and test-cases.md header: 175 → 177

Field notes:
The banner overlap being gone without a fix is a good outcome with an unsatisfying explanation. "Caching artifact" is probably right — these kinds of ghosts show up when a stale asset gets served during development and then vanish once the browser fully refreshes. The right call is to close the issue and move on; leaving it open as a "dedicated debugging session" item would have added noise to every future session for a problem that may never reappear. Closing known issues when they stop being observable is maintenance discipline, not corner-cutting.

Stack tags: Testing / Playwright

## How Sloane steered the work
Closing the ghost issue
The banner overlap had been logged as a dedicated debugging session item. Rather than assuming it still needed investigation, Sloane confirmed it was no longer visible and called it resolved. That's a judgment call — a different instinct would have been to try to reproduce it first. Closing it clears real cognitive load from future sessions.

Asking about stale documentation proactively
After the cleanup task, Sloane asked "any further updates to CLAUDE.md or test-cases.md?" rather than moving straight to deploy. That check caught two things: the test count drift (175 → 177) and the stale "Spent tab not yet built" known issue. Both are small, but stale docs compound — a future Claude reading that known-issues entry would have flagged a non-problem.

The through-line: Sloane treats documentation as a first-class artifact, not an afterthought. The instinct to pause and audit before deploying is what keeps the brief trustworthy as a session-start document.

## What to bring to Claude Chat
- Phase 3 remaining work: filing history on committee.html, associated candidates on committee.html, and ad hoc mode on races.html — which of these is the next priority?
- The Spent tab timeline (spend-over-time chart) is still in architectural debt. Worth discussing whether it belongs on the near-term roadmap now that the Raised chart pattern is stable.
- Any new domain questions for John before building out committee or race features further?

---
2026-03-11 — The invisible 4px and the variable that ate 30 lines of CSS

## Process log draft
Title: The invisible 4px and the variable that ate 30 lines of CSS

Three small CSS bugs turned into a systems-level refactor. A vertical scrollbar on the tab bar, inconsistent mobile gutters, and a design system page that overflowed on mobile all pointed to the same root cause: horizontal padding was hardcoded in eight places with no single source of truth. Fixing the bugs was easy. The real win was introducing --page-gutter — one CSS variable that now controls content margins across every page, desktop and mobile.

Changelog:
– Fixed vertical scrollbar on .tabs-bar by adding overflow-y:hidden (the -1px margin trick on .tab was leaking)
– Standardized mobile content padding from 1.25rem to 1rem across all pages
– Added mobile padding to .global-banner-text so text no longer touches screen edges
– Introduced --page-gutter CSS variable (3rem desktop, 1rem mobile) — replaced ~30 hardcoded padding declarations across styles.css and 8 HTML files
– Fixed design-system.html horizontal overflow on mobile: added overflow-x:hidden to .main, overflow-x:auto to token tables and component demos
– Added 9 Playwright tests: no-horizontal-overflow at 390px for every page (186 total tests)

Field notes:
The session started with a 1-line CSS fix and ended with a design system refactor — not because we planned it that way, but because each fix revealed the same underlying pattern. The tab scrollbar fix was isolated. The mobile padding fix touched every page and made the duplication obvious. Sloane spotted the opportunity mid-session: "Is there a better route where we handle this centrally?" That question turned a bug fix into infrastructure. The --page-gutter variable is a small thing, but it's the kind of small thing that prevents the next 10 bugs from happening. The horizontal overflow tests are the same — they guard a class of problem, not a single instance.

Stack tags: CSS custom properties · responsive design · Playwright

## How Sloane steered the work
**Spotting the abstraction opportunity**
After the mobile padding fix landed, Sloane asked whether there was a better route — handling padding centrally rather than per-page. This is the designer's instinct for systems over instances. The fix was already done and working; the question was about whether the fix was the right *shape*. That question created the --page-gutter variable.

**Pushing for the full audit**
After the refactor, Sloane asked to audit for any remaining spots. This is the "finish the job" instinct — not leaving half the codebase on the old pattern. The audit came back clean, which is its own kind of value: now we know the migration is complete, not just "mostly done."

**Asking about test cases**
Rather than moving on after the CSS work, Sloane asked whether tests were needed. The horizontal overflow tests that came out of that question are arguably the most durable artifact of the session — they'll catch layout regressions on every page going forward.

**Asking about CLAUDE.md updates**
Closing the loop on documentation. The --page-gutter pattern is now documented so future sessions use it by default instead of hardcoding padding.

The through-line: Sloane consistently elevated point fixes into systemic improvements — asking not just "does it work?" but "is this the right pattern going forward?"

## What to bring to Claude Chat
– Visual QA at 390px: check all pages on a real device or simulator to confirm the 1rem gutters feel right — especially process-log.html (which previously had 3rem on mobile) and design-system.html (which had overflow issues). The Playwright tests confirm no overflow, but can't judge visual balance.
– The --page-gutter variable opens the door to a future responsive tier (e.g., tablet at ~600px with 2rem gutters). Worth discussing whether a middle breakpoint is needed or if the current desktop/mobile split is sufficient.
– design-system.html should document the --page-gutter token and the page gutter pattern — it's now a layout convention but isn't visible in the living reference yet.

---
2026-03-12 10:30

## Process log draft
**Title:** Search grew up: typeahead, two groups, and a cleaner data model

**Summary (Sloane's voice):**
Search went from a single-purpose candidate lookup to a proper unified search surface — typeahead as you type, results grouped into candidates and committees, and clean URLs throughout. The session also surfaced a quiet win: the FEC's `/candidates/?q=` endpoint works perfectly for name search, so the existing `/candidates/search/` detour wasn't necessary. Simpler and more consistent.

**Changelog:**
- `utils.js` — added `formatCandidateName()` as a semantic alias for `toTitleCase()` (same logic, cleaner call sites)
- `styles.css` — added Section P (typeahead dropdown components) and Section Q (two-group search results), moved `.search-bar-wrap { position:relative }` from inline to shared CSS
- `search.html` — full rewrite: two-group typeahead dropdown with 300ms debounce, two-group results preview (candidates + committees), "View all →" links to `/candidates?q=` and `/committees?q=` when count > 5, clean URL pushState, all links using `/candidate/{id}` / `/committee/{id}` format
- `tests/helpers/api-mock.js` — added `COMMITTEE_SEARCH_RESULTS` fixture; added `q` param branch to both `/candidates/` and `/committees/` route handlers
- `tests/search.spec.js` — full rewrite: 21 tests across 6 describe blocks covering initial state, typeahead, two-group results, view-all links, auto-search, and no-results
- `ia.md` — updated search.html description, resolved open IA question about committee search location, updated page relationships table
- `TESTING.md` — updated test count (170 → 198), updated search.spec.js description
- Test count: 186 → 198 (12 new search tests)

**Field notes:**
The pre-flight API check before writing a single line of implementation was worth it. The plan flagged a risk — the existing search used `/candidates/search/` while the prompt specified `/candidates/?q=`. Two different endpoints. Spending 30 seconds on a live curl before stubbing the mock meant the mock was correct from the start, not corrected after a test failure. The small habits matter.

The typeahead being `<a>` tags instead of `<div>` tags was a quiet but important call. Native keyboard focus, native click, no JS click handler needed — the browser handles it. It's the difference between building UI that fights the platform and UI that uses it.

## How Sloane steered the work
**"Let's resolve #3 first" — finishing the gutter token story**
Before touching search, Sloane pointed to the remaining open item from the previous session: documenting `--page-gutter` in design-system.html. A small thing, but deliberately completing it before moving on. The token exists in the code; the reference page should reflect it. No loose ends.

**Session split as a first-class decision**
Sloane presented a 5-part prompt but immediately flagged: "my first prompt may need to be split into two sessions to keep context." That's a product manager's instinct — scope awareness before implementation. The split (Parts 1–3 this session, Parts 4–5 next) came from reading the prompt, not from running out of time. The deliverable for Session 1 is coherent on its own: search is fully functional end-to-end.

**"Assess what's here and tell me if you'd propose anything differently"**
Before approving the plan, Sloane asked for an honest assessment of the approach — not just "can you do this?" but "is there a better way?" That opened the door to flagging the `formatCandidateName` / `toTitleCase` duplication risk and the endpoint uncertainty. The final implementation avoided both problems.

**Functional before visual — explicit**
Sloane was direct: "We'll start with functional and then move into more UI-related changes later." That framing shaped the entire session. The components work correctly; visual polish is deliberately queued for a separate pass.

The through-line: Sloane is managing complexity at the session level, not just the feature level — controlling what ships together, in what order, and why.

## What to bring to Claude Chat
- Visual pass for new search components: typeahead and two-group results are functional but unstyled beyond basics. Any visual/UX details worth discussing before the polish session? (Row hover states, loading shimmer, candidate card vs. committee row visual balance, "View all" link prominence.)
- Session 2 scope check: Parts 4–5 (candidates.html and committees.html `?q=` search mode with infinite scroll) — confirm this is still the right priority, or does something else jump the queue?
- design-system.html component lifecycle: three new components shipped (typeahead, committee result row, two-group results layout) but not yet documented in design-system.html — visual pass or standalone cleanup session?

---
2026-03-12 [Session 3]

## Process log draft

**Title: One control surface to browse them all**

Two pages that required a form submit to show any results at all — candidates and committees — got rebuilt from the ground up this session. Results now load the moment you arrive. Search and filter live side by side in the same bar. A chip row tracks what's active and lets you remove filters one by one or all at once. The URL stays in sync with every change, so the browser back button and shared links work correctly. And a quiet fix under the hood — a concurrency queue on apiFetch — prevents rate-limit 429s when a page fires 15+ API requests at once.

**Changelog:**
- candidates.html: full overhaul — unified doFetch() replaces separate browse()/search(); auto-load on page visit; inline search field + 300ms typeahead; state typeahead-select combo (text input filters a size="6" listbox via :focus-within); filter chips row; URL pushState sync; error state with retry; clean /candidate/{id} links in all modes
- committees.html: identical architecture — auto-load, typeahead, chips, URL sync, error state, clean /committee/{id} links, treasurer always shown
- utils.js: apiFetch now routes through a MAX_CONCURRENT=4 request queue — all requests still fire, paced to avoid 429s; no call-site changes
- tests/pages.spec.js: +13 new tests; removed 2 stale "filter bar hidden" tests
- tests/shared.spec.js: needsApiMock: true for candidates and committees
- tests/helpers/api-mock.js: office_full and treasurer_name added to fixtures

**Field notes:**
The most revealing moment was realizing the "two-mode mental model" wasn't just a UX problem — it was a code smell. Two nearly-identical async functions, two card builders with slightly different HTML, two scroll listeners with different guards. Collapsing into one doFetch() eliminated a whole class of bugs. The state combo (:focus-within keeps the dropdown open while either the input or listbox has focus) is the trickiest piece but works cleanly. The apiFetch queue was a fast, clean fix: 20 lines, zero call-site changes.

---

## How Sloane steered the work

**"Unified surface" as the design north star — your framing, not a refactor**
The plan specified collapsing browse and search into a single always-useful control surface explicitly. That framing drove every implementation choice: auto-load, chips that don't hide the search field, URL sync so context is never lost. This wasn't a technical cleanup; it was a UX position.

**The concurrency fix as a defensive quality move**
You surfaced the apiFetch rate-limit problem as a targeted, scoped change — one file, no call-site changes, existing tests confirm nothing broke. That discipline kept the session focused and the diff reviewable.

**Scope discipline throughout**
Both features were specified with clear scope boundaries: don't touch other pages, confirm with tests. That made it possible to ship both cleanly in one session without scope creep.

The through-line: you're shipping features that feel finished — not scaffolded. The browse pages now behave the way a user expects a search-and-filter surface to behave, with no documentation required.

---

## What to bring to Claude Chat

- **State combo UX** — the text-input + hidden listbox works technically but is unconventional. Worth evaluating whether a plain select with better styling would be more reliable and accessible.
- **Filter persistence on back-navigation** — should filters set on candidates.html carry forward when navigating to a candidate and hitting back? Currently they do via pushState, but the UX hasn't been thought through intentionally.
- **Committee page completeness** — filing history and associated candidates on committee.html are the main remaining Phase 3 scaffolds. Worth deciding priority vs. race page ad hoc mode before the next session.
- **apiFetch queue tuning** — MAX_CONCURRENT=4 was chosen conservatively. Worth monitoring in production whether 4 is right once real traffic hits.

---
2026-03-12 — Filing status refactor: explicit labels, correct termination handling, token system correction

## Process log draft
Title: More explicit, more correct — the quiet kind of progress

Sometimes a session doesn't ship a feature — it fixes the assumptions underneath one. The committee filing status display was technically working, but it was wrong: it couldn't distinguish between a committee that chose to terminate and one the FEC administratively terminated for unresolved debt. This session made it correct, then made it honest — showing the actual filing frequency label instead of a collapsed binary, backed by a proper token system.

Changelog:
– candidate.html: filing_frequency 'A' (administratively terminated) now routes to History tab alongside 'T'; previously fell through to Active
– search.html, committees.html, committee.html: replaced binary Active/Terminated tag with dot + human-readable filing frequency label (Quarterly Filer, Terminated, Administratively Terminated, etc.)
– utils.js: two new shared utilities — filingFrequencyLabel() (A/D/M/Q/T/W → display text) and filingFrequencyDotClass() (green or gray dot class)
– styles.css: added --filing-active (#3dbf7a) and --filing-terminated (#a8a099) as semantic Tier 2 tokens; removed .tag-active and .tag-terminated (no remaining usages); added .status-dot and .dot-gray
– design-system.html: both new tokens documented in token table
– project-brief.md: termination status definitions added (voluntary vs. administrative)
– CLAUDE.md: filing_frequency values documented; end-of-session ritual updated to include design-system.html and project-brief.md as mandatory documentation targets

Field notes:
The token naming correction was the most instructive moment. Promoting primitives (warm-active, green-500) directly to CSS variables under their primitive names is exactly the pattern the design system's tier hierarchy exists to prevent. The fix — --filing-active, --filing-terminated — is two words longer but carries real meaning: what the color is for, not what it looks like. The ritual additions at the end of the session are the same instinct applied to process: making the right thing the default thing, so it doesn't depend on remembering.

Stack tags: none

## How Sloane steered the work
**Catching the token naming violation before it shipped**
When --green-500 and --warm-active appeared as new CSS variables, Sloane immediately flagged that these were primitive names, not semantic ones — exactly what the token tier system prohibits. The redirect to --filing-active and --filing-terminated was fast and precise. Small call, but it kept the design system coherent.

**"Let's try filing-terminated at warm-rule-dark instead"**
Rather than accepting the first color choice, Sloane iterated on the terminated dot value by referencing a specific primitive by name. That's the design system working as intended — decisions made in terms of the token vocabulary, not hex values.

**Baking new rituals into CLAUDE.md**
Two additions in one session — design-system.html and project-brief.md as mandatory end-of-session documentation targets. Both came directly from noticing gaps in this session's work and closing them at the process level rather than relying on case-by-case judgment.

**"UX isn't as clean as I want it to be, but it works for now"**
Naming the UX debt explicitly rather than declaring the refactor done. That's a product instinct — knowing when something is correct but not finished, and saying so out loud so it doesn't get forgotten.

The through-line: Sloane consistently enforces the system — the token hierarchy, the ritual structure, the UX bar — and treats violations as signals to fix the process, not just the instance.

## What to bring to Claude Chat
– Filing status UX debt: the dot + label pattern is more correct but Sloane flagged it's not as clean as she wants. Worth a dedicated design pass — what would the ideal treatment look like? Is the label necessary, or can the dot alone carry enough meaning with a tooltip?

– Token system maturity: this session surfaced a gap between Tier 1 primitives and Tier 2 semantic tokens — specifically, no clear process for deciding when a primitive warrants a semantic token vs. inline hex. Worth defining a rule of thumb before the token table grows further.

---
2026-03-12 — Polish pass: load-more UX, typeahead unification, CSS refactor

## Process log draft
Title: Polish pass — the gap that wasn't there, the components that were

The browse/search overhaul from the last few sessions left some seams visible: a gap below the search.html typeahead, an oversized search bar that didn't match the filter bar style on the other pages, and typeahead items with different layouts depending on which page you were on. This session closed all of them — plus two refactors that the accumulated changes had finally made obvious.

Changelog:
– search.html: typeahead gap fixed — #typeahead-dropdown moved inside the <form> so .search-bar is the positioning ancestor; dropdown now sits flush below the input
– search.html: search input and button swapped from .search-input/.search-btn to .form-input/.form-search-btn — compact size, matches the filter bar on candidates/committees
– candidates.html + committees.html: typeahead items updated to .typeahead-row layout (name + ID left, contextual right), matching search.html's richer format
– candidates.html: typeahead right side shows office only — state and bullet separator removed
– committees.html: typeahead right side shows status dot only — state and type label removed
– candidates.html + committees.html: load-more spinner (#load-more-spinner) and end-of-results marker (#end-of-results) added to infinite scroll; both centered
– styles.css: .form-select, .form-input, .form-search-btn extracted from three pages' inline styles into shared stylesheet
– styles.css: .typeahead-dropdown gains display:none, max-height:240px, overflow-y:auto, and .typeahead-dropdown.open; .typeahead-dd retired
– candidates.html + committees.html: typeahead container swapped from .typeahead-dd to .typeahead-dropdown; inline .typeahead-dd rules deleted
– tests/search.spec.js: .search-input class selectors replaced with #search-input ID (selector stability)
– tests/pages.spec.js: 4 new tests — #load-more-spinner and #end-of-results DOM presence + hidden state on candidates and committees
– Test count: 222 → 226

Field notes:
The positioning bug on search.html was the most instructive moment of the session. The typeahead dropdown was positioned relative to .search-bar-wrap (a container with 2.5rem of top padding), not to .search-bar (the actual input row). The fix was two edits — move the element, change the CSS. The refactors that followed were made easy by the fact that the class names had already been aligned across pages: three files doing the same thing with the same names made the extraction obvious. Code that wants to be shared announces itself by repeating.

Stack tags: none

## How Sloane steered the work
**"Match the format to search.html" — a consistent reference point**
Every typeahead tweak this session was anchored to search.html as the standard: first the overall .typeahead-row structure, then removing the state+bullet from candidates, then removing state+type from committees to match the dot-only format. Naming search.html as the reference up front meant each follow-on decision was obvious rather than a judgment call.

**Acting on the refactor recommendations immediately**
When the two refactors were proposed at the end of the polish pass, Sloane approved them in the same session rather than deferring. That's the right call — the relevant code was still in working memory, the class names were fresh, and both extractions went cleanly. Deferred refactors accumulate debt; same-session ones don't.

The through-line: Sloane is consistently using existing, already-polished work as the standard for new or misaligned work. "Match search.html" is a more precise and faster instruction than "make it look right" — it tells the implementation exactly where to look.

## What to bring to Claude Chat
– The filter bar CSS (.filter-bar-wrap, .filter-bar, .form-field, .form-label, .state-combo, chip styles, etc.) is still duplicated between candidates.html and committees.html — now that form controls are extracted, this is the remaining obvious duplication. Worth a dedicated session, or fold into Phase 3 remaining work?
– Phase 3 remaining: committee filing history, associated candidates on committee.html, ad hoc race mode. What's the priority order?

---
2026-03-12 — Senate district tag fix

## Process log draft
Title: One character at a time

Senate candidates were showing "Senate · WA-00" because the FEC API returns district: '00' for Senate races. A one-line guard — the same pattern already used on the browse page — cleaned it up to "Senate · WA". Sometimes the smallest bugs are the ones that make you look the least like a designer built it.

Changelog:
– candidate.html: office/location tag now suppresses district segment when district is '00' or empty (Senate candidates show "Senate · NY" instead of "Senate · NY-00")

Field notes:
The fix was already in the codebase on candidates.html's buildCard function — this was just the candidate profile page lagging behind. The kind of inconsistency that creeps in when the same data renders in multiple places. The guard is simple: `cand.district && cand.district !== '00'`. The FEC API's use of '00' as a sentinel for "no district" is a quirk worth knowing.

Stack tags: none

## How Sloane steered the work
**Specific, surgical task scoping**
Sloane identified the exact line number, the exact condition to change, and even provided the replacement code. This turned what could have been a 20-minute investigation into a 2-minute fix-and-verify. The task description was indistinguishable from a well-written code review comment.

The through-line: Sloane is operating at a level where the instructions are as precise as the implementation — the value of the session is in the verification and testing, not the discovery.

## What to bring to Claude Chat
– The Schedule B 422 errors (known issue in test-cases.md) predate today's work but are worth prioritizing before any Spent tab polish — they fire 3-7 times per candidate page load.
– Phase 3 remaining work prioritization: committee filing history, associated candidates on committee.html, ad hoc race mode — what's next?
---
2026-03-16 — Incumbent tag on race.html + FEC incumbency research

## Process log draft
Title: One field, one tag, one field name correction

The race comparison page is meant to be the differentiator — the view you can't get on the FEC site. Adding the incumbent tag is a small thing on the surface, but it's the first step toward the race view doing real analytical work. The change itself was a single line. What took longer was verifying that the live API and the mock disagreed on the field name — and fixing that gap before it caused a test/live divergence.

Changelog:
– race.html: Incumbent tag added to candidate cards — reads incumbent_challenge_full from /elections/ response; renders .tag.tag-neutral "Incumbent" label only for incumbents; challengers and open-seat candidates get no tag
– tests/helpers/api-mock.js: ELECTIONS fixture corrected — added incumbent_challenge_full: 'Incumbent' to match live API shape (live returns full string, not short code)
– CLAUDE.md: new Critical note for /elections/ incumbent field — documents full-string vs short-code discrepancy, future-cycle availability, and dual-check pattern
– test-cases.md: incumbent tag test cases added to race.html candidate cards section; test log row appended

Field notes:
The field name discrepancy — mock had incumbent_challenge: 'I', live returns incumbent_challenge_full: 'Incumbent' — is exactly the class of bug the mock/live audit rule exists to catch. It surfaced immediately because the tag didn't render, which prompted a live API check. The fix is defensive: check both shapes in the condition, correct the mock, document the discrepancy. The broader session was mostly research and design thinking: understanding how incumbency status works across cycles, whether /elections/ can serve the candidate page, what the FEC can and can't tell you about election outcomes. The answer to that last question — it can't, but the incumbent tag on the next cycle implicitly answers "who won" for most use cases — is worth building into the UX design.

Stack tags: none

## How Sloane steered the work
**Pushing back on the performance dismissal**
When the initial analysis concluded that cycle-specific incumbency on candidate.html wasn't worth an extra API call, Sloane pushed back after seeing how fast the race page loaded locally. That prompted a more honest reassessment: the call would slot into the existing parallel batch, so the incremental wall-clock cost is likely zero. The first answer was technically defensible but overly conservative — the pushback produced the right answer.

**Scoping the incumbent tag precisely**
"Just the incumbent label — no challenger tag, nothing for open seat" is a design decision with real reasoning behind it: incumbent status is meaningful signal in a race context; challenger is noise (everyone who isn't the incumbent is a challenger by definition); open seat is better communicated through absence. That constraint shaped a cleaner implementation than "show all statuses."

**Holding the feature for a larger UX solution**
Rather than bolt cycle-specific incumbency onto candidate.html as a quick fix, Sloane recognized it belongs to a larger design effort involving /elections/ data on the candidate page. The decision to defer and design it properly rather than ship a partial solution shows the right instinct — the race comparison page is the differentiator, and it deserves a considered design pass, not incremental patches.

The through-line: Sloane consistently corrects for over-caution — pushing back when analysis is too conservative, scoping features to their minimum meaningful expression, and holding work for the right moment rather than shipping for its own sake.

## What to bring to Claude Chat
– Cycle-specific incumbency on candidate.html: Sloane is designing a UX solution that loads /elections/ data after initial candidate load. Worth thinking through: where does the incumbent tag live in the profile header relative to the existing party/office tags? Does it update visually on cycle switch, or is it set once after the secondary load completes?

– What /elections/ data unlocks beyond incumbency: the endpoint returns all candidates in the contest with financials. Once it's loading on the candidate page, you have the full competitive context — could power a "running against" module, a relative fundraising bar, or a "field" section. Worth designing the full shape of what this panel could be before building any of it.

– Election outcome data gap: the FEC can't tell you who won. For the race comparison view to show outcomes on past cycles, you'd need a supplemental data source (MIT Election Lab, Ballotpedia). Worth deciding whether that's in scope before building out the historical race view.
---
2026-03-16 — Skeleton loading infrastructure + race context sentence on candidate.html

## Process log draft
Title: Infrastructure first, then meaning

Two things shipped today that are deliberately small but load-bearing. A skeleton loading class is nothing on its own — it's permission to show intent while data loads without writing a one-off animation per component. The race context sentence is one API call and fifty lines of logic, but it's the first time the candidate profile communicates something about the race rather than just the candidate. "Smith is the incumbent with 4 challengers" is a sentence. It tells you something. That's new.

Changelog:
– styles.css: .skeleton class added — shared animation, caller-supplied sizing; @keyframes skeleton-pulse
– styles.css: .tag-context added — filled background tag variant, no border, no uppercase, with link states
– candidate.html: #meta-row rebuilt — unreliable incumbent_challenge_full tag removed; #race-context placeholder added
– candidate.html: skeleton shows in #race-context at top of loadCycle() (bare, not wrapped in .tag-context — avoids double-background visual artifact)
– candidate.html: /elections/ fetch added in Step 2 of loadCycle(); officeApiParam defined as var expression to avoid scope collision with race.html
– candidate.html: race context sentence resolves after fetch — incumbent/challenger/open-seat/unopposed branches, active/closed tense, "View race →" link with non-breaking space separator
– design-system.html: comp-skeleton card added (stable); comp-tag-context card added (candidate-only)
– tests/candidate.spec.js: #race-context DOM presence test added; 227 → 228 tests
– CLAUDE.md, TESTING.md, test-cases.md: updated counts, race context test cases, skeleton sizing guidance

Field notes:
Two bugs caught in real time. The first: the skeleton wrapped in .tag-context produced two simultaneous backgrounds — the filled tag shape visible behind the pulsing bar. The fix was a single line: remove the wrapper during loading, apply it only on resolve. The second: white-space: nowrap collapsed the space between the sentence period and "View race →". A regular space gets eaten; a non-breaking space (\u00a0) doesn't. Both bugs were visible immediately, caught before shipping. The pattern: render, look at it, notice what's wrong, fix it. The design system's guidance on skeleton sizing — "approximate the minimum resolved state" — came directly from this session's calibration of width to "View race →" and height to the total .tag-context box height.

Stack tags: none

## How Sloane steered the work
**Catching the double-background immediately**
The skeleton wrapped in `.tag-context` looked wrong the moment it rendered — a filled box shape behind a pulsing bar, two separate visual layers. Catching it immediately rather than shipping it means the component behaves correctly from day one. No user sees the artifact.

**Sizing the skeleton to the minimum resolved state**
The prompt already specified this instinct ("width to match 'View race →'") — but the reasoning behind it is worth naming: a skeleton that's too wide creates a visual jolt when the content resolves shorter. Sizing to the minimum avoids that. The skeleton expands to the sentence naturally; it never has to shrink.

**Noticing the missing space**
The screenshot showing ".View race →" flush against the period was a precise observation — the kind of thing that's easy to overlook on a fast render. Catching it and flagging it exactly ("no space between the '.' and 'View race'") gave the fix an unambiguous target. The `\u00a0` was one character.

**Deferring the full `/elections/` integration on candidate.html to this session**
The previous session noted that cycle-specific incumbency on the candidate page deserved a considered design pass. This session delivered it — and the final form is cleaner than a tag would have been. The sentence carries more information, links to the race, and updates on cycle switch. Holding work for the right moment produced the right solution.

The through-line: Sloane catches visual artifacts quickly, sizes things relative to their resolved state (not a guess), and notices precision failures — a missing space, a double background — at the level of detail that separates designed work from developer defaults.

## What to bring to Claude Chat
– Race context sentence as the pattern for /elections/ integration: now that /elections/ loads on the candidate page, the data is available. Worth designing what else it could power — a "running against" mini-module, a relative fundraising bar, a "field" section. What's the full shape of this panel before any of it gets built?

– Election outcome gap: the race context sentence shows who the incumbent is and how many challengers exist, but can't show who won past races. For past cycles, "Smith was the incumbent with 4 challengers" is incomplete — a reader naturally wants to know the result. Worth deciding whether a supplemental data source (MIT Election Lab, Ballotpedia) is in scope before building out any historical race view.

– .tag-context reuse opportunities: it's candidate-only now. Committee profiles are the obvious next candidate — a "sponsored by [candidate]" or "filed as [designation]" sentence in the committee header. Worth noting for Phase 3 committee page work.

---
2026-03-19 — Dynamic cycle dropdown + Senate class indicator + URL validation on race.html

## Process log draft
Title: The dropdown that thought it could see the future

The race page's year dropdown was hardcoded — five years, no more, no less. Replacing it with a dynamic call to the FEC's /elections/search/ endpoint was straightforward, until the API returned cycles through 2060. Senate races made it more interesting: two seats per state means the dropdown unions both, and the class of the seat changes with the cycle. The FEC doesn't expose Senate class anywhere in its API, so the label is a heuristic — modular arithmetic against known class years. Then the edge case conversation happened: what about garbage in the URL? What about special elections that break the class pattern? The heuristic got its limits documented, and the page got input validation it should have had from the start.

Changelog:
– race.html: replaced hardcoded [2018–2026] year dropdown with dynamic cycles from /elections/search/; added Senate class indicator (Class I/II/III) via cycle-year heuristic; added URL param validation (state, office, district, year); parallel fetch strategy (Promise.all when year is explicit, sequential when defaulting); fallback to hardcoded list on API failure; snap-to-nearest when requested year isn't in available cycles
– tests/helpers/api-mock.js: added ELECTIONS_SEARCH fixture + route
– tests/pages.spec.js: 6 new tests — dynamic dropdown content, no class on House, class label on Senate, invalid state/office/year error states
– CLAUDE.md: added /elections/search/ endpoint docs, Senate class heuristic debt note, elections-search field verification
– test-cases.md: added dynamic cycle dropdown, Senate class indicator, and URL validation test cases; updated test count; appended test log row
– TESTING.md: updated test count to 234

Field notes:
The most interesting part of this session wasn't the implementation — it was the edge case audit. Walking through real examples (Oklahoma 2022 with simultaneous regular and special elections, California's two-race same-cycle scenario, Alaska's at-large district) revealed that the Senate class heuristic is exactly wrong in the one case where it matters most: when a special election puts two seats on the ballot in the same cycle. The right response wasn't to build a more complex heuristic — it was to document the limitation clearly and move on. The FEC API doesn't give us the data to do better without cross-referencing /election-dates/, which is a different level of complexity. The input validation was the opposite story: once we saw that any garbage in the URL would produce a silent loading spinner, the fix was obvious and cheap. Sometimes the edge case audit surfaces a known limitation you accept; sometimes it surfaces a gap you fix immediately.

Stack tags: /elections/search/ · Senate class heuristic

## How Sloane steered the work
**"Why are we showing up to the year 2060 in the dropdown?"**
Caught the most visible bug immediately after the first implementation — the API returns projected future cycles that no user would expect to see. This led directly to the cycle-capping logic and the Senate +4 refinement.

**"Would it really be current cycle + 4?"**
Walked through the math live, caught that +6 was too generous. The reasoning was precise: in 2025/2026 with currentCycle=2026, 2032 isn't relevant yet. +4 covers both seats without overreaching.

**"When no year param set, can we default to current cycle or next upcoming race?"**
Identified that defaulting to the highest cycle (which could be 2030 for Senate) isn't the same as defaulting to the most relevant one. The fix — smallest cycle >= current — gives users the race that's happening now or next, not the one furthest in the future.

**The edge case audit**
The comprehensive edge case list with real-world examples (Oklahoma specials, California double races, Alaska at-large, Texas redistricting) wasn't just testing — it was product thinking. Each case was paired with a real election to make the abstract concrete.

**"This seems like a higher priority issue" → garbage URL params**
Reframed X3/X4 from "minor edge case" to "the page trusts user input completely." The demo URL with state=ABCDEFGHIJKLMNOPQRSTUVWXYZ made the problem visceral. Then "Why not #3 now?" — no hesitation on scope, just ship the validation.

The through-line: Sloane tests the implementation against reality, not against the spec. The 2060 dropdown, the +6 vs +4 math, the garbage URL — each was caught by asking "what would a real person see?" rather than "does the code do what the plan said?"

## What to bring to Claude Chat
– Input validation on other pages: race.html now validates URL params; candidate.html, committee.html, and the browse pages do not. Worth auditing whether the same garbage-URL problem exists there.
– Oklahoma 2022 / dual-race display: when a state has two Senate races in the same cycle (regular + special), the race page shows all candidates merged. Should there be any UI to distinguish which seat each candidate is running for?
– At-large district display: the -00 suffix for at-large House districts is a known cosmetic issue. Worth scheduling a fix.
– Previous session ritual gap: the 2026-03-16 session (skeleton loading + race context sentence) has no claude-to-claude.md entry. Decide whether to reconstruct from git history or note the gap and move on.

---
2026-03-19 — Candidate header IA overhaul

## Process log draft
Title: Tightening the header — structure as communication

The candidate profile header had grown vertically: tags on one row, cycle buttons on the next, committees link below that, race context inline with tags. It worked but didn't read as a unit. This session collapsed it — tags and committees are now a single flex row at the top, the cycle select moves to the tab bar where it belongs contextually (you're choosing what data to see, right where you see it), and the race context sentence gets its own persistent strip so it reads as connective tissue between the header and the content tabs rather than as one more tag.

Changelog:
– candidate.html header restructured: race tag first then party tag, both inline in candidate-row with the avatar and name; committees trigger floats right with margin-left:auto
– Cycle switcher replaced: .cycle-switcher + .cycle-btn buttons removed; <select id="cycle-switcher"> is now first child of .tabs-bar; loadCycle() updates select.value; Amplitude tracking preserved in onchange
– #race-context-bar added: persistent strip between tabs-bar and content; #race-context span lives inside it; skeleton and resolve logic in loadCycle() unchanged; .tag-context white-space:nowrap removed to allow wrapping on narrow viewports
– Profile header top border: border-top:3px solid var(--text) added via .profile-header in inline style block
– .main-inner wrapper: max-width:1600px content constraint in styles.css without touching .layout or grid behavior; solves the grid item / margin:auto shrink bug from multiple previous iterations
– styles.css: .committees-link margin-top removed (now inline in flex row); .tag-context white-space:nowrap → flex-wrap:wrap; .layout and .main max-width experiments cleaned up
– design-system.html: comp-cycle-btn removed; comp-candidate-header demo updated; comp-chart-container demo updated with cycle select; comp-tag-context notes updated; stale CSS rules removed from inline style block
– tests/candidate.spec.js, tests/smoke.spec.js: cycle switcher assertions updated from .cycle-btn to select#cycle-switcher option
– 234/234 Track 1 passing

Field notes:
The max-width iteration took longer than it should have. The constraint was simple — CSS Grid grid items with margin:auto shrink to content width — but we hit it three times before isolating it. The lesson: any layout change that involves margin:auto on a grid item needs to be treated as suspect until tested at a wide viewport. The .main-inner wrapper is the cleanest solution and the one that should have been proposed first: it doesn't touch the grid, doesn't touch the sidebar, and the max-width applies to exactly what we want it to. The header restructure itself was faster and cleaner — the spec was precise enough that each change mapped to exactly one edit.

Stack tags: none (no new dependencies)

## How Sloane steered the work
**Spec precision — each change mapped to one edit**
The six-change spec was written at exactly the right level of detail: HTML structure, CSS class names, JS behavior notes, responsive behavior, design intent. Nothing was underspecified enough to require a follow-up question, and nothing was overspecified in a way that forced an awkward implementation. That precision is what made the first set of changes go quickly.

**Catching the max-width problem early and staying patient through iterations**
The max-width problem took four iterations (layout, main, main again, then .main-inner). Sloane caught each wrong behavior quickly ("the width appears to only be computed at about 1092px") and provided clear directional feedback without over-explaining. The final fix (.main-inner wrapper) came from a precisely specified prompt that correctly identified both the CSS Grid behavior root cause and the correct architectural solution. That kind of root-cause spec — not just "make it work" — is what produced the right fix immediately.

**Targeted follow-up spec — same format as the original**
The second set of nine fixes was written in the same structured format as the first: named section, problem statement, fix instruction, scope note. This made it easy to execute in one pass with no ambiguity about which elements to touch or what behavior to verify.

The through-line: Sloane writes specs that are complete enough to execute without negotiation. The session moved fast because the instructions were pre-thought — the implementation choices had already been made before the first edit.

## What to bring to Claude Chat
– Max-width: is 1600px the right number? We converged on it after iterating up through 2200, 2800, 3200. Worth a deliberate decision rather than a leftover from iteration — what's the actual target viewport for this tool's primary users?
– Responsive behavior of the new header: tags wrapping below name/avatar on narrow viewports is the specified behavior, but worth a visual check on a real device or in DevTools at 375px/390px to confirm it feels right rather than just technically correct.
– Race context bar — should it hide on mobile? On narrow viewports it adds height between the tab bar and content. Worth deciding whether to collapse or hide it below a breakpoint.
– Phase 3 remaining work: with the IA polish done, the remaining Phase 3 items are committee filing history, associated candidates on committee.html, and ad hoc race mode. Worth aligning on which to tackle next.

---
2026-03-19 — .main-inner centering + profile header cleanup

## Process log draft
Title: Content at home on any screen — the fix that actually worked

Three earlier attempts to cap content width on ultra-wide screens all failed for the same reason: applying max-width to a CSS Grid item doesn't respond to margin:auto for centering. The solution was one level in — .main-inner is a regular block element inside the grid cell, where margin:auto works exactly as expected. While we were in the layout, two small visual details on the candidate profile header got cleaned up as well: the heavy black top border came off, and the title bottom margin was trimmed.

Changelog:
– styles.css: .main-inner now max-width:1600px; margin-left:auto; margin-right:auto; width:100% — content caps and centers correctly on ultra-wide screens (2560px+)
– All 7 content pages (committee.html, candidates.html, committees.html, race.html, races.html, search.html) now wrap .main children in .main-inner; candidate.html already had it
– candidate.html: removed border-top:3px solid var(--text) from .profile-header
– styles.css: removed margin-bottom:0.5rem from .page-header-title
– CLAUDE.md: documented the centering mechanism and why earlier attempts on .layout and .main failed
– test-cases.md: removed stale "3px top border" test case; added session test log row

Field notes:
The max-width problem had been attempted before — "grid items ignore margin:auto" was the known failure mode. The fix wasn't about fighting the grid; it was about not trying to. .main-inner is just a div inside a grid cell, which is a perfectly normal block formatting context where centering works. Knowing why the previous approaches failed made the correct level of intervention obvious on the first pass. The header cleanup was smaller but still deliberate — the 3px border had been functioning as a visual crutch, marking the top of content with a heavy line. Without it, the breadcrumb and title stand on their own.

Stack tags: none

## How Sloane steered the work
"That's why it failed before" — diagnosing before prescribing
Sloane arrived with a precise problem statement: not just "cap the width" but a clear explanation of why .main and .layout don't work, and why .main-inner does. That diagnosis made the correct solution immediately obvious rather than discovered by trial and error. Zero debugging time lost.

Iterating the max-width in two deliberate passes
After the fix landed at 1380px, Sloane quickly pushed to 1600px. This wasn't indecision — it was a calibration pass. The first number was a starting point; the second was the right answer after seeing it in context. Knowing when to iterate quickly and when to hold is a judgment call that kept the session moving.

Trimming visual weight from the profile header
Two small but considered requests: remove the top border, remove the title bottom margin. Both reduce mass at the top of the candidate profile. The border had been serving as a structural anchor but was adding more visual noise than structure. Removing it signals that the layout can hold itself.

The through-line: Sloane consistently brings the diagnosis alongside the prescription — not just "fix this" but "here's why it's broken and here's the lever." That pattern cuts iteration cycles to one.

## What to bring to Claude Chat
– The profile header top border is gone — worth checking on the live site to confirm the header still feels visually anchored. If it reads too flat, options include a subtle border-bottom on the breadcrumb row, stronger weight on the page title, or a thin accent line. Worth a visual judgment call before it ships to stakeholders.

– With .main-inner capping at 1600px on all pages, ultra-wide centering is now consistent across the whole app. Worth viewing on a large monitor to confirm the centering reads as intentional rather than stranded — particularly browse pages where the filter bar and results list have their own internal max-widths.

– The claude-to-claude.md log has a gap: sessions covering the candidate header IA overhaul, skeleton loading, and dynamic cycle dropdown (commits 0f14d6d through 1fa6829) have no log entries. Worth a retroactive note if any of those sessions produced decisions worth preserving, or just acknowledging the gap is expected given how the sessions went.

---
2026-03-19 — Visual consistency pass across browse and race pages

## Process log draft
Title: The gap was two pixels. The fix was four characters.

This session was a focused visual consistency pass across the browse pages and race page. The work unified list item appearances — committee rows now match candidate cards with full borders and surface backgrounds — fixed an office label inconsistency (plain mono text promoted to tag tag-neutral across all three browse pages), and resolved a double-border rendering problem that appeared on retina displays. The final fix: adjacent sibling selector, one rule per component, three components.

Changelog:
– styles.css: .results-list moved to shared CSS as plain flex-column; inline override removed from candidates.html (was carrying border/background/gap)
– styles.css: .committee-row upgraded to full border:1px solid var(--border) + background:var(--surface) + hover state — now visually matches .candidate-card
– styles.css: .committee-result-row — removed border-radius:0.5rem and margin-bottom:0.5rem; rows now sharp-cornered and flush
– styles.css: Adjacent sibling border fix on all three flush-stacking components — .candidate-card + .candidate-card, .committee-row + .committee-row, .committee-result-row + .committee-result-row each suppress border-top; retina-safe (inset box-shadow was tried first and rejected — still doubled on retina)
– candidates.html: buildCard() office display switched from .candidate-card-office mono text to tag tag-neutral via formatRaceName()
– search.html: renderCandidateGroup() same change — formatRaceName() + tag tag-neutral
– committees.html: buildRow() column order corrected to name → treasurer → type → status
– race.html: .race-list inline rule stripped of old double-border pattern (border/background/gap); now plain flex-column — inherits sibling fix from styles.css automatically
– design-system.html: comp-candidate-card and comp-committee-result-row added as stable; comp-committee-rows classes + demo updated for new column order and full-border style

Field notes:
The inset box-shadow approach was the obvious first move — it's a common technique for making borders visually collapse. It worked on a standard display. But two inset shadows touching at a pixel boundary don't merge the same way two borders do with a suppressed border-top: the rendering engine draws them independently, and on a retina screen that doubled boundary is visible. The adjacent sibling selector is what the platform actually provides for this problem. The fix was four characters (` + `) and a one-liner per component. The lesson isn't CSS trivia — it's that some browser rendering behaviors only surface on specific display types, and the correct fix is the one that works at the rendering level, not the one that looks right in a screenshot.

Stack tags: none

## How Sloane steered the work
**Catching the retina failure before it shipped**
The inset box-shadow approach was implemented and passing tests before Sloane flagged that it still doubled on retina. That's the right moment to catch it — before the commit, not after it's live on a MacBook. A screenshot wouldn't have shown the problem; knowing how retina rendering works did.

**Specifying the correct fix, not just the rejection**
Not just "that doesn't work" — but the specific technique: adjacent sibling selector, suppress border-top, one rule per component. That made the fix a one-pass edit with no ambiguity about approach.

**Catching .race-list as a follow-on**
After the main pass, noticing that .race-list on race.html still used the old double-border pattern (border/background/gap on the container) was a clean scoped add-on. Same problem, different container, handled in one more instruction.

**Sequencing rituals deliberately**
"Let's commit and deploy after end-of-session rituals" rather than skipping straight to the push. Keeps the deploy tied to a complete, documented state.

The through-line: Sloane brought the diagnosis and the correct tool at each step — not just a flag but a direction. That pattern cuts iteration loops down to one pass each time.

## What to bring to Claude Chat
– committee.html candidate mini-cards still use .candidate-card-office for office display — the one remaining call site. Now that candidates.html, search.html, and race.html all use tag tag-neutral via formatRaceName(), committee.html is the last inconsistency. Worth deciding when to unify, since it's tied to however much committee.html work remains in Phase 3.

– .committee-row is used in both the candidate profile's committee modal and the committees.html browse list. The new full-border + surface-bg style was designed for the browse list context. Worth a visual check in the modal to confirm it still reads well in that narrower/denser layout.

– Phase 3 remaining work: committee filing history, associated candidates on committee.html, and ad hoc race mode. Worth a quick alignment on sequencing before the next session.

---
2026-03-19 — Party labels, tooltips, full-row committee links, search header restructure

## Process log draft
Title: Small things that compound — label order, full-row links, tooltip groundwork

Three targeted refinements this session, each one about closing a small gap between how the product looks and how it behaves. Party labels got a proper taxonomy (N/A bucket, named fallbacks, tooltips via the native title attribute). Committee rows became full-row links, matching the pattern search.html already had. And the search results header learned to introduce itself — count first, label second, query in quotes — rather than just announcing a category.

Changelog:
– utils.js: partyLabel() expanded — N/A bucket (NNE/NON/UNK/OTH/NPA/UN/W/O → "Party N/A"), named map (DEM/REP/LIB/GRE/IND), raw code fallback for unmapped parties
– utils.js: partyTooltip(p, party_full) added — title-cases party_full if available, fallback map for known codes, "No party affiliation on file" for N/A bucket
– candidates.html, search.html, candidate.html: party tags updated with title="partyTooltip(...)" and race-before-party render order
– search.html: .results-group-header restructured — count span carries full label text (set by JS), view-all link sits alongside it; JS updated to write "N candidates/committees for "query""
– committees.html: buildRow() outer element converted from <div> to <a> with href + Amplitude onclick; inner .committee-name-link removed; .committee-name now a plain div
– styles.css: .committee-row gets text-decoration:none; color:inherit (now an <a>); .committee-name-link flagged deprecated
– tests/pages.spec.js: 3 tests targeting .committee-name-link updated to .committee-row / .committee-row .committee-name
– project-brief.md: tooltip UI debt noted under Open items — title attribute limitations, when to fix, what the fix looks like
– styles.css, candidates.html, committees.html: padding-bottom restored on .section-title, .results-group-header, .results-header (removed then restored same session)

Field notes:
The tooltip issue surfaced something worth keeping: "the code is right" and "it's working" are different claims. The title attribute was correctly set, the function was correctly defined, utils.js was correctly loaded — and the tooltip still wasn't appearing, because party_full wasn't being returned by the /candidates/ endpoint. The fallback map fixed it. The lesson isn't just "check your data shapes" — it's that a feature can be correctly implemented and silently inert at the same time, and only actually using the product surfaces that gap. The full-row link on committees.html is the same instinct at a different scale: the name link worked, but clicking the whitespace around it did nothing, and that dead zone is a friction point that's invisible until you actually try to use the page.

Stack tags: none

## How Sloane steered the work
**Catching the padding-bottom over-edit**
The original prompt asked to remove margin-bottom, padding-bottom, and border-bottom. When the result looked off, Sloane immediately flagged it as "my mistake" and asked for padding-bottom to be restored — without ambiguity about what went wrong or what the fix should be. That self-correction kept the session from spending time diagnosing a visual problem.

**"Where would you suggest adding UI debt around tooltips?"**
Rather than asking to fix the tooltip UX immediately, Sloane asked where the right place to note it would be — a sequencing question, not an implementation question. The answer (mobile polish pass, data-tooltip pattern, project-brief.md) was the right call: native title attribute is fine for now, and the note makes the tradeoff explicit without creating work that isn't yet warranted.

**Specifying the full-row link fix precisely**
The committee row change came in with the full HTML structure, the JS change, and the CSS additions spelled out — not "make the row clickable" but the exact conversion from div to a, where the href and onclick move, and what happens to the inner anchor. That precision made the edit a one-pass change with no interpretation required.

The through-line: Sloane consistently distinguishes between "fix this now" and "note this for later," and brings enough specificity when something needs to be fixed that the implementation is unambiguous.

## What to bring to Claude Chat
– Tooltip UX on mobile: the native title attribute is invisible on touch. When does this become worth addressing? Likely tied to a broader mobile polish pass — but worth flagging if the site gets any mobile traffic before then.

– Party N/A label: "Party N/A" is the chosen label for unmapped codes (NNE, NON, UNK, OTH, etc.). Is that the right framing for the audience (strategists, journalists)? An alternative like "No party" or "Unaffiliated" might read more clearly. Worth a quick gut-check.

– committee.html remaining Phase 3 work: filing history and associated candidates are still unbuilt. Now that the committee row interaction is at parity with search.html, is committee.html the next priority, or does Phase 4 work (early signal data, AI insights) take precedence?
