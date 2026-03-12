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
