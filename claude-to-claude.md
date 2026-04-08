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

---
2026-03-19 18:00

## Process log draft

**Tearing out the sidebar — a layout decision that was already made**

The sidebar had been a reliable anchor from day one — a fixed 220px column, a list of nav items with dots, a structure that felt stable. Replacing it was never really about aesthetics. It was about recovering horizontal space and reducing layout complexity as the content got denser. The decision had been made; this session was about execution.

Changelog:
- Removed sidebar nav, .layout grid, .mobile-header, and all --sidebar-* CSS tokens across all 9 pages
- Added fixed .top-nav bar: logo left, Candidates/Committees/Races links, global search bar right (desktop); mobile controls right (search toggle + hamburger)
- Mobile nav drawer now drops down from below the top nav (not slides in from the left)
- Mobile search expands inline as a panel below the nav bar; mutually exclusive with the drawer
- Global search form submits to /search?q= from both desktop bar and mobile expand panel
- Renamed --sidebar-bg/--sidebar-active-bg to --nav-bg/--nav-active-bg; removed --sidebar-border/--sidebar-text/--sidebar-muted (values covered by global tokens)
- Updated design-system.html: comp-nav-item card documents new .top-nav/.nav-link classes; token table updated
- Updated all Playwright tests: shared.spec.js, pages.spec.js, candidate.spec.js, search.spec.js — all stale .sidebar, .mobile-header, .mobile-search-icon references replaced
- 234/234 tests passing

Field notes:
The sidebar was doing a lot of invisible work — every page had a .layout grid wrapper, per-page mobile padding-top overrides, and a separate .mobile-header block. Removing it didn't just change the nav; it simplified the entire layout model. That kind of cascading cleanup is rare. The test suite found 14 stale references in three files after the first run — a normal amount for a refactor this wide. The mechanical part of updating tests is actually useful: it forces a pass over every assertion that assumed the old structure, which is a good audit of what the tests were actually measuring.

Stack tags: CSS, HTML, Layout

## How Sloane steered the work

**The full spec before the first line of code**
Sloane wrote a detailed spec covering desktop layout, mobile behavior, search wiring, implementation scope (all 9 pages), and verification steps — before any code was touched. This is the pattern: full clarity on what's being built, then execution. The plan was reviewed and approved before implementation began, which meant the refactor went in one direction with no mid-stream pivots.

**Three specific corrections to the plan before approving it**
When the initial plan was presented, Sloane identified three specific gaps and asked for them to be addressed before proceeding: (1) the design-system.html comp-nav-item risk needed a better mitigation — not "keep sidebar as deprecated block" but "update the component card to document the new classes"; (2) a risk for --sidebar-* inline references in HTML files was missing; (3) design-system.html should be last in the file edit order to reduce risk. These are exactly the kind of detail that saves debug time later — a plan with wrong mitigation is worse than no plan.

**Search removed from the top nav**
The original sidebar had a Search nav item with an active state. Sloane's spec was explicit: top nav has three links only — Candidates, Committees, Races. Search, Process Log, and Design System don't appear. This required updating the PAGES array in shared.spec.js and changing the search.spec.js nav assertion to verify the absence of an active link rather than the presence of one.

The through-line: Sloane plans at the spec level, not the implementation level — detailed enough to guide the work, not so detailed as to make it inflexible. The corrections to the plan show a sharp eye for risk surface, not just feature coverage.

## What to bring to Claude Chat

- Now that the layout is full-width, is there appetite to revisit the candidate page layout — wider stats row, wider chart, possibly a two-column layout for the Raised tab on desktop?
- The global search bar in the top nav submits to /search?q=. Should it search candidates only (current behavior) or open to committees + candidates (like the search.html two-group results)?
- Process Log and Design System are now orphaned from the nav — intentional for production but worth confirming: are they linked anywhere, or discoverable only by direct URL?
- Next phase priority check: filing history on committee.html vs. ad hoc mode on races.html — which has more demo value for the portfolio?

---
2026-03-19 20:00 — Visual + copy polish pass

## Process log draft
Title: The details that make a tool feel designed

The site had been functionally complete for a while, but the surface details — button labels, placeholder copy, background layers, font weights — were still in their first-draft state. This session was a cleanup pass: replacing text search buttons with SVG icons, tightening placeholder copy to say exactly what each field does, stripping visual noise from the filter bars, and matching font weights across related components. Small changes, but the kind that separate "built" from "finished."

Changelog:
– All search submit buttons (20 instances across 9 pages) replaced with inline SVG search icon — consistent with mobile search toggle
– Placeholder text updated globally: nav search bars say "Search candidates and committees"; candidates.html filter says "Candidate name or ID"; committees.html filter says "Committee name or ID"
– Ellipsis removed from all placeholder text across the site
– background:var(--surface) removed from .filter-bar-wrap and .filter-chips-wrap on candidates.html and committees.html — filter bar now sits flush with page background
– .page-desc paragraph + CSS removed from candidates.html and committees.html — the title and filter bar are self-explanatory
– .committee-name font-weight set to 500 in styles.css to match .committee-result-name
– aria-label on all 18 nav search inputs updated to "Search candidates and committees"
– Nav search input width increased from 200px to 240px

Field notes:
The most telling edit was the ellipsis removal. Placeholder text with trailing dots implies the user needs to complete a thought — "Search candidates…" reads as "Search candidates [what? where? how?]". Without the dots, "Candidate name or ID" is a direct instruction. It's a one-character change that shifts the tone from uncertain to confident. The same instinct drove the .page-desc removal: the browse pages had a subtitle explaining what the filter bar does, which is like putting a label on a light switch. If the controls need a paragraph to explain themselves, the controls are wrong. These didn't.

Stack tags: none (no new dependencies)

## How Sloane steered the work
**Specifying every change with surgical precision**
The opening prompt was a numbered list with exact CSS properties to change, exact placeholder strings, exact files. No ambiguity, no room for interpretation. That level of specification meant zero back-and-forth on scope — every edit was a direct execution of a clear instruction.

**Catching the placeholder text progression across two prompts**
The first prompt set placeholder text, the second refined it — removing ellipses, changing "or" to "and" in the nav, and making the filter bar placeholders describe the input format ("Candidate name or ID") rather than the action ("Search candidates"). That's iterating on copy the way a designer iterates on spacing: small adjustments that compound into a different feel.

**"Flag anything I may have missed"**
Explicitly inviting the flag surfaced the stale aria-labels — a real accessibility gap that would have shipped silently. The question wasn't "did I get everything right?" — it was "what's connected to these changes that I might not have thought about?" That's systems thinking applied to a copy pass.

The through-line: Sloane is treating placeholder text, button labels, and background colors as design decisions with the same weight as layout and typography. These aren't afterthoughts — they're the layer between "works" and "feels right."

## What to bring to Claude Chat
- The filter bar on candidates.html and committees.html now has no background — it blends with the page. Worth a visual check on the deployed site to confirm this reads well, especially at the boundary between page header and filter bar where two border-bottom rules stack.
- The nav search input is now 240px — does it feel wide enough for "Search candidates and committees" as placeholder text, or should it grow further? Worth checking at the 861px breakpoint where it first appears.
- Process-log.html and design-system.html still have .page-desc — these are documentation pages, not browse pages, so the subtitle pattern may still be appropriate. Worth confirming this is intentional rather than an oversight.

---
2026-03-19 21:30 — races.html browse page conversion

## Process log draft
Title: Mode selector out, browse page in

The races page had been a mode selector — two cards, one form, a placeholder for a feature that wasn't built yet. This session replaced it entirely with a browse page that matches the candidates and committees pattern: page header, filter bar (Year, Office, State), filter chips, and a full results area with loading/error/empty states. The data fetching is next, but the structure is ready.

Changelog:
– races.html rewritten as a browse page matching candidates.html/committees.html template pattern
– Mode selector UI (curated form, ad hoc stub, mode cards) removed entirely
– Filter bar: Year <select> (empty, JS-populated in follow-up), Office <select>, State combo with typeahead filtering
– Results area: results header, results list, load-more spinner, end-of-results, loading/no-results/error states
– Fixed state dropdown clipping: overflow:visible on .main overrides the global overflow-x:hidden that was creating a scroll container and clipping absolutely-positioned dropdowns when .main was short
– 5 stale Playwright tests replaced with 5 browse page structure tests; 234/234 passing
– ia.md: races.html promoted from Scaffold to Active

Field notes:
The dropdown clipping bug was a good reminder of a CSS spec quirk: setting overflow-x:hidden on an element forces overflow-y to auto, creating a scroll container that clips absolutely positioned children in both directions. On candidates.html and committees.html, this never surfaced because loaded results make .main tall enough to contain the dropdown. On races.html with no results, .main was short and the dropdown extended past its bottom edge. The fix — overflow:visible — is the right call for a page whose content won't cause horizontal overflow. The bug only existed because the page was empty; once results load it would have been masked again. Better to fix the root cause.

Stack tags: CSS, HTML

## How Sloane steered the work

**Full spec as the opening prompt — structure, fields, CSS, JS, everything**
The prompt specified every element: field order (Year, Office, State), exact option values, which patterns to copy from candidates.html, which CSS to include, which CSS to remove, the JS scaffold with exact function bodies, and the ia.md update. No ambiguity, no room for drift. The result was a single write with no mid-stream corrections.

**"Data fetching and results rendering are in a follow-up prompt"**
Explicitly scoping this session to structure-only prevented the temptation to wire up doFetch(), result cards, URL sync, and infinite scroll in the same pass. That's a clean boundary: get the DOM right first, then make it live. The JS scaffold has `// doFetch() — wired in follow-up` comments as placeholders — the separation is visible in the code itself.

**Catching the dropdown clipping in browser testing**
Sloane flagged the state dropdown clipping after the first implementation, and pushed back when the initial fix didn't work ("Hmm...still appearing as clipped"). That forced a deeper investigation into the CSS overflow spec behavior rather than accepting a surface-level z-index fix.

The through-line: Sloane scopes work to clean boundaries (structure vs. data), specifies at the field level, and tests in the browser before moving on.

## What to bring to Claude Chat
- races.html data fetching design: The follow-up prompt needs to decide which FEC API endpoint to use for browsing races. /elections/search/ returns cycle/office/state/district but no financial data. /elections/ returns candidates with financials but is scoped to a single race. The browse page likely needs /elections/search/ for discovery, then links to /race?... for detail. Worth aligning on the card format and what data to show in browse results before building.
- Overflow-x:hidden on .main globally: This caused the dropdown clipping on races.html and was fixed with a page-level override. candidates.html and committees.html have the same risk if they're ever rendered with no results and the state combo is open. Worth deciding whether to remove the global rule or keep the per-page overrides.
- races.html replaces the curated form entry point: The old races.html had a curated form that navigated to race.html. That entry point is now gone — users will browse and click into a race instead. Is that the right flow, or should the curated form (direct state/office/year/district entry) be preserved somewhere?

---
2026-03-20 — Races browse data fetching: progressive enrichment from /elections/

## Process log draft
Title: The data that lies to you, and the data that makes you wait

The races browse page went from static scaffold to live data — but getting there meant discovering that not all FEC endpoints tell the same story. /candidates/totals/ looked perfect until we noticed it overcounts (anyone who filed, not just real candidates). /elections/ is accurate but requires one API call per race — 475 for a single cycle. The solution: show the race list instantly, then progressively fill in candidate counts and dollar figures as hundreds of small requests resolve. Skeleton loaders do the waiting for you.

Changelog:
– races.html: full data fetching — cycle dropdown populated from /elections/search/, race list rendered instantly, progressive enrichment from /elections/ with skeleton→real data transition
– Race rows show "N candidates" and "Total raised: $X" sourced from the authoritative /elections/ endpoint
– Client-side filtering for office and state (no re-fetch); only cycle changes trigger new API calls
– fetchGeneration guard prevents stale enrichment responses from writing into a new cycle's data
– requestAnimationFrame batching prevents DOM thrashing during progressive enrichment
– Removed #load-more-spinner and #end-of-results (no pagination — all results at once)
– utils.js: formatRaceName now suppresses district "00" for at-large House seats (WY, AK, MT)
– tests/helpers/api-mock.js: added CANDIDATES_TOTALS fixture and /candidates/totals/ route
– tests/shared.spec.js: races.html needsApiMock set to true (was false — caused flaky failures)
– All documentation updated: CLAUDE.md, test-cases.md, TESTING.md, ia.md

Field notes:
The session was a lesson in data source trust. The first instinct — /elections/search/ for the list, /candidates/totals/ for the numbers — looked clean until we checked the actual counts. /candidates/totals/ returns anyone who filed paperwork, including candidates who lost primaries and people who registered but never raised a dollar. The gold standard is /elections/, the same endpoint race.html uses, but it demands state+office+district per call. The progressive loading pattern was born from that constraint: you can't make 475 API calls feel instant, but you can make the page useful while they resolve. The skeleton→data transition is honest — it shows you what's loading and what's loaded, rather than pretending everything arrived at once.

Stack tags: progressive loading · skeleton UI · FEC /elections/ endpoint

## How Sloane steered the work
**"Inaccurate data is unacceptable" — the line that redirected the architecture**
When I proposed accepting /candidates/totals/ counts as "close enough," Sloane drew a hard line. That single sentence redirected the entire data strategy from a simple two-endpoint join to a progressive loading pattern with 475 individual /elections/ calls. The instinct was right: for a tool that political strategists will rely on, approximate data undermines trust. The technical cost of accuracy was real (progressive loading, skeleton UI, generation guards), but the product cost of inaccuracy would have been worse.

**"Is there a loading strategy approach we could layer in?"**
Rather than accepting either extreme (inaccurate data vs. slow page), Sloane asked whether there was a middle path. That question produced the skeleton loading pattern — instant render of the race list, then progressive enrichment. This is a UX pattern Sloane clearly had in mind before the technical constraints were fully spelled out, and it turned a performance problem into a design feature.

**Catching the presidential data anomaly**
Sloane spotted presidential results appearing for 2026 — a non-presidential year — within minutes of the first render. That observation led to discovering the deeper issue: /candidates/totals/ doesn't respect cycle boundaries the way /elections/search/ does. The bug report was the domino that toppled the entire /candidates/totals/ approach.

**Catching the Senate overcounting risk**
After the presidential fix, Sloane asked whether the same problem affected Senate data. It did — and for the same reason. That pattern recognition (if one office type is wrong, check all of them) prevented shipping a half-fix.

The through-line: Sloane treats data accuracy as a product requirement, not a nice-to-have. Every time a shortcut was proposed, the response was to find the architecturally honest solution — even when it meant more complexity. The progressive loading pattern exists because Sloane refused to choose between fast and accurate.

## What to bring to Claude Chat
- Races browse page performance: 475 /elections/ calls is a lot. The progressive loading makes it usable, but a Netlify Function that aggregates server-side could reduce it to a single cached call. Worth discussing as a pre-launch priority alongside the API key proxy.
- Race row content density: Now showing name + candidate count + total raised. Is this enough to be compelling for the browse page, or should we add more (e.g. incumbent name, top-raised candidate, party breakdown)? Each addition potentially means more data in the enrichment step.
- Missing session logs: claude-to-claude.md is missing entries for the 2026-03-19 sessions (5 commits: party labels, nav refactor, Amplitude source attribution, search polish, races scaffold). Worth backfilling from git log + commit messages in Claude Chat.

---
2026-03-20 — Typeahead fix, API rate limit diagnosis, races.html IntersectionObserver

## Process log draft
Title: The invisible bug, the shared key, and the lazy observer

Three things that looked like one: the typeahead dropdown on the browse pages had never worked in production. The fix was four characters — adding `, i` to two `.map()` callbacks — but the failure mode was almost impossible to see: a ReferenceError inside a try/catch that silently called closeTypeahead(), with no trace in the console and no indication anything had gone wrong. Finding it required reading the error path backward from the symptom.

The bigger finding that day was the rate limit. Diagnosing why search didn't work in production led to confirming that the API key is shared across all users and was exhausted — mostly by races.html, which fired ~475 API calls every single page load. That conversation opened into a broader architectural question: what's the right way to fix this, and does the races page's data model match the long-term UX direction?

The answer was an IntersectionObserver. Instead of firing enrichment for all 475 races at once, the observer fires calls only for rows that scroll into the viewport — 15–20 on load, more as you scroll, scoped automatically to whatever filtered subset is visible. Combined with localStorage caching of the processed aggregate stats (24h TTL, ~50 bytes per race), repeat visitors fire zero API calls for races they've already seen. More importantly, the architecture is aligned with where the page is going: when editorial curation or location-based filtering narrows the initial view, the observer just works correctly with whatever small subset is shown.

Changelog:
– candidates.html, committees.html: fixed renderTypeahead() — .map(function(c) → .map(function(c, i) — missing index caused ReferenceError on every typeahead render; silently swallowed by try/catch
– candidates.html, committees.html: added Escape key handling to close typeahead (parity with search.html)
– tests/pages.spec.js: 8 new typeahead tests across candidates.html and committees.html describe blocks (2-char trigger, result links, Escape key) — 234 → 242
– API key rate limit: diagnosed as shared-per-key (not per-IP), exhausted primarily by races.html; upgraded key requested from FEC
– races.html: refactored enrichment from fire-all (475 calls/load) to IntersectionObserver + localStorage cache; enrichRace() fires per visible row, caches { candidateCount, totalRaised } with 24h TTL; repeat visitors serve from cache; observer re-wires on every filter re-render

Field notes:
The typeahead bug is the kind of failure that doesn't announce itself. The code looked right on first read — the try/catch looked like defensive programming, not a silencer. The only way to find it was to notice that the catch handler's only action was to hide the dropdown, then ask: what could be throwing in the function above it? It's a reminder that error handling that swallows exceptions can make bugs harder to find than no error handling at all. The fix took thirty seconds; finding it took reading the code as if it had already failed.

The races page conversation was more interesting. The fire-all architecture wasn't accidental — it was a deliberate data accuracy call documented in CLAUDE.md. The question was whether that accuracy requirement had been applied to the right layer. The browse page doesn't need all 475 races enriched immediately; users filter and scan. The race detail page is where accuracy matters most, and it already uses /elections/. The IntersectionObserver is a better fit not just because it reduces API calls, but because it matches how users actually move through the page — and because it already knows how to handle the future filtered state the page is moving toward.

Stack tags: IntersectionObserver, localStorage

## How Sloane steered the work
**"Is there a more global solution?" — pulling back before building**
The initial ask was localStorage caching for races.html. Before a single line was written, you pushed for a broader audit — how many calls are happening across all pages, and is there a more systematic fix? That audit revealed the full picture (476 calls/visit on races.html vs. 1–3 everywhere else), which led to a much more targeted solution. Skipping the audit would have shipped a page-specific fix that missed the real scope of the problem.

**Rejecting the global apiFetchCached plan as "unmanageable"**
The audit produced a plan for a site-wide caching utility in utils.js touching four files. You called it: too much surface area, and it still wouldn't support real traffic volume at scale. The instinct was right — the plan was architecturally tidy but solved the wrong problem. Pulling back to "what does races.html actually need" led to a simpler, more appropriate solution.

**"How did we get here" — naming your own direction as a factor**
When the conversation got tangled, you explicitly named that the current architecture reflected your own prior decisions, not just code drift. That kind of ownership opened the door to revisiting those decisions honestly without relitigating them defensively.

**#2 + #4: the right combination, and why**
When presented with four options, you converged on combining intersection observer with filter-scoped enrichment. The reasoning you added — that the page is heading toward a forced filter anyway — is what made the IntersectionObserver the right permanent architecture, not just a band-aid. Without that frame, it might have read as an optimization. With it, it reads as alignment with where the page is going.

The through-line: you consistently ask whether a solution fits the actual product direction, not just whether it solves the immediate problem. The global caching plan would have solved the rate limit today but created maintenance overhead that doesn't match a portfolio project at this stage. The IntersectionObserver solves the rate limit and is the right architecture for a page that will have editorial curation.

## What to bring to Claude Chat
– Forced filter / editorial curation direction for races.html: what does that look like in practice? Location-based (detect or prompt for state)? A curated "featured races" set? Both? Worth aligning on the UX before the page's scaffold state makes it feel permanent.

– races.html long-term traffic model: the IntersectionObserver buys meaningful headroom, but a high-traffic day (election night, a viral link) would still exhaust even an upgraded key if many first-time visitors hit the page. Is a Netlify Function proxy worth planning for Phase 4, or is the current audience size such that it's not needed yet?

– Typeahead on the top nav search bar: currently the nav search bar on all pages just submits to /search?q= on Enter. Should it have a typeahead dropdown too? It's a different surface (global, always visible) and could be high-value for fast navigation. Worth discussing before building it.

---
2026-03-20 — committee.html structural parity + URL hash + polish

## Process log draft
Title: The scaffold grows up — committee.html gets tabs, cycles, and a shareable URL

committee.html went from a single financial summary page to a real profile with structural parity with candidate.html: tabs, a cycle switcher with an "All time" aggregate default, URL hash encoding so any state is bookmarkable, and an Amplitude event every time a user intentionally switches tabs or cycles. Along the way: the last remaining use of the deprecated .candidate-card-office class was removed, the shared .callout style replaced a one-off override, the overspend note was suppressed on aggregate views and reworded into a neutral past tense, and the double border on the associated candidate card was fixed.

Changelog:
– committee.html: tabs bar (Summary/Raised/Spent) + cycle switcher (All time + per-cycle from c.cycles)
– renderStats() rewritten: All time sums all cycle records; per-cycle finds matching record, shows — when absent; overspend suppressed on All time
– renderHeader(): title-cases committee name, populates cycle switcher, fires Amplitude Cycle Switched
– fetchAndRenderBackLink(): relType param, dynamic section title, shared utils, tag-neutral + formatRaceName replacing .candidate-card-office
– URL hash encoding: #cycleOrAll#tab — reads on load (after ALL_CYCLES populated), writes on every cycle/tab change; invalid hash falls back silently
– Amplitude: Tab Switched fires on user tab click (guarded by event param — hash-restore does not fire it)
– .callout inline override removed; shared styles.css amber callout takes over
– Overspend copy: past-tense "spent beyond" / "prior-cycle" on committee.html, candidate.html, and design-system.html demo
– .candidate-card-office rule removed from styles.css (last call site was committee.html)
– .assoc-list double border fixed: removed border/background/gap from container
– COMMITTEE_TOTALS mock updated to 2 records; cycles field added to COMMITTEE fixture
– tests/pages.spec.js: 14 new tests; 242 → 256
– All documentation updated

Field notes:
The URL hash felt like a small addition but it's the thing that makes the page actually shareable. Without it, switching to the 2022 cycle and the Raised tab and then sending someone the link lands them on All time / Summary — not what you saw, not what you meant to share. The if (e) guard on Tab Switched was the right call from candidate.html's pattern — the hash-restore on load shouldn't look like a user action in Amplitude. The double border fix was caught on visual inspection after tests passed — a reminder that 256/256 doesn't mean visually correct.

Stack tags: URL hash · cycle switcher · Amplitude Tab Switched

## How Sloane steered the work
**Removing the double border — caught on visual inspection**
After the structural work was done, Sloane spotted the double border on the associated candidate card immediately. It wasn't in the plan and wasn't a regression — the .assoc-list container border had always been there, just became visible once rendered with real data. Quick fix, but it shows the habit of checking visual output against the design system rather than declaring the work done when tests pass.

**Amplitude Tab Switched — asking rather than assuming**
Sloane prompted the Amplitude audit rather than assuming tracking was complete. The question surfaced the missing Tab Switched event — genuinely useful data for understanding which tabs drive engagement, especially once Raised and Spent are built. One line, right pattern from candidate.html.

**End of session rituals — held to the process**
Sloane flagged the URL hash feature, got it built, then asked about Amplitude, then called end of session rituals — in the right order. That discipline means the session ends with 256/256 tests passing, documentation current, and a clean commit.

The through-line: Sloane treats the session-end ritual as part of the work. The process log, documentation updates, and commit are what make the next session start cleanly.

## What to bring to Claude Chat
- committee.html Raised/Spent tabs: both are stubs. Raised could mirror candidate.html's chart + geography + contributor table. How much of that pattern makes sense at committee level vs. something simpler?
- Filing history on committee.html: still not built. Is this Phase 3 remaining work or deprioritized in favor of Phase 4? The /committee/{id}/reports/ endpoint is already in use for candidate charts.
- .committee-name-link CSS rule: still in styles.css with a deprecation comment. Last call site already removed — safe to delete next time styles.css is touched.

---
2026-03-20 [end of session]

## Process log draft
Title: The committee page gets its first real data tab

Two sessions of structural scaffolding paid off this session — the committee.html Raised tab went from a "coming soon" stub to a fully functional page with a contributor type donut, a choropleth map, and two contributor tables. The wiring pattern mirrored candidate.html closely, with deliberate adaptations for the committee data model: breakdown built from ALL_TOTALS instead of sub-cycle fetch results, separate tables for individual and committee contributors, and a single by_state API call with client-side cycle filtering. A round of four cleanup fixes tightened things up before shipping.

Changelog:
– String(activeCycle) coercion fix in init() — integer 2022 wasn't matching <option value="2022"> string
– committee.html Raised tab: donut chart (contributor types with stripe pattern for unitemized), choropleth map with party-colored fill, top committee contributors table, top individual contributors table
– Table order: committee contributors above individual contributors
– by_state bug fix: replaced parallel multi-call pattern with single call + d.cycle client-side filter; parallel calls were summing state totals multiple times (two_year_transaction_period silently ignored by endpoint)
– candidate.html ALL_CYCLES sort: changed a-b to b-a (descending, most recent first) to match committee.html and race.html
– CHART_COLORS and ENTITY_TYPE_LABELS moved from candidate.html and committee.html inline scripts to utils.js; both pages now use shared definitions
– Dynamic table headers in renderRaisedIfReady: "2023–2024" for specific cycle, "Most recent cycle" for All time
– api-mock.js: SCHEDULE_A_BY_STATE updated to 3 records; SCHEDULE_A_INDIVIDUALS and SCHEDULE_A_COMMITTEES added; resolveFixture routes by is_individual param
– styles.css: .raised-grid, .raised-cell, .raised-cell-title added as shared component CSS (K1 section); @media column collapse added
– 4 new Playwright tests: donut canvas present, map container present, both donor tbodys non-empty
– 260/260 tests passing

Field notes:
The by_state bug was a good catch before it hit the live API. The parallel-call pattern looked correct on paper — one call per cycle, filter by request index — but fell apart because the endpoint ignores the cycle param entirely. Every parallel call returns the same full-history dataset, and filtering by request index means the same state totals get counted once per matching cycle. One call, filter by d.cycle on the results, done. The fix also made the code simpler.

Moving CHART_COLORS and ENTITY_TYPE_LABELS to utils.js was the right call the moment committee.html needed them. Two files with divergent copies of the same constants is a maintenance trap — one would inevitably drift. The consolidation was small but permanent.

Stack tags: Chart.js · D3 · TopoJSON · Schedule A

## How Sloane steered the work
**Specifying the bug before touching the code**
Rather than just flagging the cycle switcher as broken, Sloane arrived with the exact diagnosis: String(activeCycle) coercion, the specific line in init(), and why renderHeader()'s sw.value = 'all' didn't need the same fix. That level of precision means zero debugging overhead — the fix was one targeted edit and done.

**Four cleanup fixes as a pre-flight ritual**
Sloane structured the session with a cleanup pass before opening new scope. The four fixes weren't cosmetic — the by_state bug would have produced incorrect state totals in production, the cycle sort order was inconsistent across pages, and the duplicate CHART_COLORS would have silently drifted. Shipping them before the Raised tab meant the feature launched on a cleaner foundation.

**Committee contributors above individual contributors**
After the initial implementation, Sloane immediately swapped the table order — committee contributors first, then individual. That's a deliberate editorial hierarchy: for most committees, PAC and party inflows are the structurally interesting signal; individual donors are context. One line to reorder, but it reflects domain thinking about what data matters most.

**Specifying the by_state fix with the correct replacement code**
Sloane didn't just flag the bug — the fix brief included the exact replacement block, the reasoning (parallel calls produce duplicate state totals), and the note about what to update in the mock. That's the pattern across this session: arrive with the diagnosis and the prescription, not just the symptom.

The through-line: Sloane comes to coding sessions with prepared specs, not vague requests. The briefs include exact line numbers, verified reasoning, and explicit "don't change this other thing" boundaries. That precision is what makes four separate fixes across three files completable in a single session without introducing new issues.

## What to bring to Claude Chat
- Raised tab on committee.html vs. candidate.html — design divergence point. The committee Raised tab has two separate donor tables (committee + individual) where candidate.html has one. Now that both are live, worth a visual comparison pass: does the two-table layout feel right for all committee types, or should PAC-heavy committees (where committee donors dominate) collapse the individual table?
- Spent tab scope. Committee.html Spent tab is still a stub. Is the right approach to mirror candidate.html's spend-by-category donut + vendor table, or is there a committee-specific angle (e.g. disbursements to candidates, coordinated expenditures) that would serve journalists/strategists better?
- Filing history on committee.html. Still unbuilt. The /committee/{id}/reports/ endpoint is already in use for candidate charts. A filing history table (report type, coverage period, receipts, disbursements) might be more useful than the Spent tab stub for committees. Worth deciding before starting the Spent tab.
- CHART_COLORS in utils.js — timing. Now that it's shared, any page that links utils.js gets the full palette. Design system documentation should reflect this. Worth a quick design-system.html token table update to note which tokens are JS constants (not CSS vars).

---
2026-03-20 17:00

## Process log draft
Title: The spent tab ships — and the vendor table learned to say no

The last scaffold stub on committee.html is gone. The Spent tab now matches the Raised tab in depth, with one addition that doesn't exist anywhere else in the tool: a "Contributions to Candidates & Committees" section that surfaces outbound political giving. What looked like a copy-paste job turned into a real data-fidelity exercise once live API testing revealed that the FEC's entity_type filter is silently ignored, that contribution refunds were polluting the vendor table, and that a single shared transaction fetch would let opex volume crowd out political contributions in the pagination cap. The fix was a second parallel fetch — dedicated, separately paginated, deduped by recipient.

Changelog:
- Spent tab on committee.html: full implementation — donut by category, purpose bars by keyword, top vendors table, contributions to candidates & committees section
- fetchSpentData(): pulls breakdown from ALL_TOTALS; runs two parallel Schedule B fetches — one for opex (purpose bars + vendors), one dedicated CCM contributions fetch with independent pagination
- Contributions section: deduped by recipient_committee_id, sorted by total, links to /committee/{id}, shows candidate info (name, office, state) inline
- Vendor table: filters out entity_type=CCM, disbursement_purpose_category=CONTRIBUTIONS, and REFUNDS before deduplication — confirmed field values from live API
- PURPOSE_MAP, purposeBucket, renderSpendDetail copied from candidate.html; renderSpentDonut adapted (canvas ID: chart-spent-donut, not chart-donut)
- api-mock.js: DISBURSEMENTS split into SCHEDULE_B (opex) and SCHEDULE_B_CONTRIBUTIONS (CCM); routed by entity_type param
- Playwright tests: 5 new assertions in "committee.html — Spent tab sections" describe block; 265 total (263 pass, 2 pre-existing flaky races.html networkidle failures)
- Documentation: CLAUDE.md Spent tab marked complete, TESTING.md and ia.md updated, test-cases.md test log row added

Field notes:
The "contributions section" decision forced an architectural question I hadn't anticipated: what does "contributions" actually mean in FEC data? It's not a type — it's a purpose category value that can appear on any disbursement record regardless of recipient type. The entity_type=CCM filter I was relying on turned out to be silently ignored by the API. That's a pattern that's come up before — the FEC API has a habit of accepting filters it doesn't apply. The rule is now explicit: always add a client-side filter as belt-and-suspenders.

The parallel fetch architecture was Sloane's call. It was the right one — not just for correctness now, but because it makes the two data sources independently capped and debuggable.

Stack tags: Schedule B, Promise.all, FEC entity_type filter quirk, cursor pagination

## How Sloane steered the work
Option 2 over Option 1 — separate fetch, cleaner guarantees: When the contributions section turned out to have a completeness problem (political contributions could be crowded out by 500 opex transactions in the shared fetch), two options were on the table. Sloane chose the dedicated second fetch plus deduplication by recipient. This mattered because the contributions section is specifically designed for leadership PACs — committees that exist to give money to candidates — where completeness is the whole point.

Caught the 3-column/2-column thead mismatch before implementation: Before any code was written, Sloane reviewed the plan in Claude Chat and flagged that the contributions table HTML had a 2-column thead while the renderContributions function built 3-column rows. This caught a DOM mismatch that would have silently broken the table layout.

Pushed back on vendor table pollution after seeing it in action: When the vendor table came back with contribution and refund rows alongside media buys and payroll, Sloane asked directly: "I'm just realizing contributions and contribution refunds are included?" The fix required confirming actual disbursement_purpose_category values from a live API call before filtering.

Held the commit until review: After tests passed at 265/265, Sloane said "let's hold on committing until I've looked things over." That's a consistent pattern — shipping to the test suite is not the same as shipping to git.

The through-line: Sloane's calls this session were all about data fidelity — what the section claims to show versus what it actually shows. The contributions section, the vendor filter, the thead mismatch. All three corrections came from reading the data surface critically, not the code.

## What to bring to Claude Chat
- Contributions section for candidate.html? The section exists only on committee.html. Should it also appear on candidate.html (for the candidate's principal committee giving), or does that belong on the committee page only?
- Filing history tab: last scaffold stub on committee.html. Right scope — just a table of FEC report filings with links to documents, or something richer (trend lines, coverage gaps, amendment history)?
- Phase 4 priority order: Spent tab is done. What comes next — 48/24hr reports (early signal data), AI insights panel, or transaction-level search? Very different complexity profiles and audience value.

---
2026-03-20 Session 2

## Process log draft
### Cleaning the glass — removing visual noise to let the data breathe

A design cleanup session focused on removing accumulated visual friction — redundant borders, eyebrow labels, oversized titles, and a broken donut chart. The kind of work that doesn't add features but makes everything feel more intentional.

#### Changelog
- Fixed committee.html Spending by Category donut — chart was invisible because FEC API field names didn't match (transfers_to_other_authorized_committee → transfers_to_affiliated_committee), and PAC-specific spending categories were missing
- Fixed Chart.js rendering bug on both candidate.html and committee.html — donuts rendered at 0×0 when canvas parent was display:none; moved container visibility swap before chart initialization
- Moved "Spending by Purpose" data notes to bottom of module on both pages
- Committee header redesign: designation and state labels promoted to tag styling, placed inline with committee name
- Removed border-bottom from .page-header globally
- Removed redundant .page-header CSS redeclarations from three browse pages
- Removed page eyebrows from all five pages
- Hidden breadcrumbs on all three profile pages (display:none — JS stays wired for future redesign)
- Unified page title size across browse and profile pages to clamp(1.6rem,3vw,2.4rem)
- Tightened vertical rhythm on candidate.html: race-context-bar border removed, content padding reduced to 1.5rem, race-context-bar padding tuned to 1rem top / 0 bottom
- Reduced .page-header bottom padding globally from 2rem to 1rem

#### Field notes
This session was about subtraction. Every border removed, every eyebrow deleted, every padding value tightened made the pages feel more like a finished product and less like a wireframe wearing a skin. The donut bug was a good reminder that the FEC API field names can't be trusted from docs alone — the live response for committee totals uses transfers_to_affiliated_committee, not transfers_to_other_authorized_committee, and PACs distribute spending across entirely different fields than candidate committees. The "Other" bucket as a computed remainder was the right call — it makes the donut resilient to whatever field mix the API returns.

#### Stack
Chart.js · FEC API field verification · CSS vertical rhythm

## How Sloane steered the work
**Data note placement — bottom, not top**
Sloane noticed the Spending by Purpose data note was above the bars, creating visual noise before the user even sees the data. Moving it below lets the chart speak first. Small change, big signal about how Sloane thinks about information hierarchy.

**Tag styling for committee metadata**
Rather than accepting the faint designation-label text, Sloane pushed for full tag styling on designation and state, placed inline with the committee name. This is about visual parity across entity types — committees should feel as considered as candidates.

**Breadcrumbs hidden, not removed**
When Sloane said breadcrumbs weren't serving users well, the instinct wasn't to kill them — it was to acknowledge they might work in a different format. Hiding with display:none preserves optionality without the visual cost. Design restraint.

**Eyebrows fully removed**
In contrast to breadcrumbs, eyebrows got the full delete. Sloane saw them as pure redundancy — the page title already tells you where you are. The distinction between "hide" and "remove" was deliberate and revealed how Sloane categorizes design debt: salvageable vs. dead weight.

**Title scale unification**
Sloane traced the size discrepancy back to its root cause (eyebrows created a hierarchy pair that no longer exists) and chose the smaller scale. Tighter, more consistent, less "look at me."

**Vertical rhythm by feel**
The race-context-bar spacing conversation was surgical — Sloane identified the bottom padding as extra space, set the top padding to 1rem by feel, and reduced .page-header bottom padding to 1rem globally. Every value was tested visually, not calculated theoretically.

**The through-line:** Sloane is editing toward restraint — removing visual elements that don't earn their space, tightening spacing to create density without clutter. The product is getting more confident by having less.

## What to bring to Claude Chat
- Breadcrumb redesign: hidden, not gone. What format would actually serve users? Back-link? Contextual subtitle? Something integrated into the page header?
- Browse page headers feel bare now with eyebrows removed and titles downsized. Is just a title enough, or do they need a subtitle or contextual element?
- Committee spent donut category labels are FEC jargon. Worth a pass with John to map to plain-language equivalents.
- 1.5rem is emerging as the de facto section spacing value. Worth formalizing as a named token (--section-gap?) in the design system.

---
2026-03-30 18:00

## Process log draft

**Getting the map right before building anything else**

A research and documentation session — no new features shipped, but the kind of work that prevents expensive wrong turns. We verified FEC API behavior against live responses, caught a bad committee ID that had been quietly wrong in the docs, and did a full audit of the project roadmap against what's actually built. Phase 3 is effectively done. The backlog is now much more thoughtful.

Changelog:
- Verified FEC amendment fields against live API (C00806174 "Marie for Congress"): confirmed `amendment_version` does not exist; correct filter is `most_recent: true`
- Corrected MGP's principal committee ID in CLAUDE.md: was C00696948 (Bernie Sanders' 2020 presidential campaign); actual ID is C00806174
- Documented `/committee/{id}/totals/` amendment safety: returns one record per cycle, no amendment fields, pre-aggregated — no dedup logic needed
- Audited all phases in project-brief.md against current codebase; struck through and marked complete across Phases 1, 2, and 3
- Moved spend timeline from Phase 1 Spent tab to Backlog Discussion
- Removed filing history tab from committee.html scope; moved to Backlog as broader "candidate and committee filings" item pending John's validation
- Removed "two modes" framing from race page; Race page is now the single contest view; comparison builder moved to Phase 4 as its own distinct feature
- Added Phase 4 bullets: IE (Schedule E), refund spike detection, overhead ratio, dark money signals, candidate comparison builder
- Added definitions: Employee aggregates vs. PAC money

Field notes:
The wrong committee ID — C00696948 was Bernie Sanders — had been sitting in the docs unnoticed. It's a small thing, but it's the kind of subtle error that makes you wonder what else you're quietly wrong about. The more interesting work was the roadmap audit — especially the conversation about race page modes. "Two modes, one shared UI" was a framing that made sense early on, when the comparison builder felt like an extension of the race page. But as the project got more concrete, it became clear they're fundamentally different products. The race page is a directory. The comparison builder is a workspace. Better to say that clearly now than to build a weird hybrid UI trying to serve both.

## How Sloane steered the work

**Move the spend timeline, don't delete it**
When the phase audit showed the spend timeline was never built, Sloane's call was to move it to the backlog rather than close it as won't-do. The current category/purpose/vendor breakdown is sufficient, but the timeline pattern is worth revisiting once the Raised chart is ready to be reused. Backlog, not gone.

**Filing history: smaller than a tab, possibly not worth building**
Sloane quickly read filing history as something that skews toward backend recordkeeping — the kind of thing the FEC itself already surfaces well. The call wasn't to kill it, but to demote it: out of Phase 3, out of the tab bar, into the backlog as something to validate with John before committing any design or engineering time.

**Race page modes: untangle them now**
The two-modes framing had been in the brief since early days, and Sloane saw through it immediately — they're not modes, they're different products. A race page shows a contest. A comparison builder is a workspace. Separating them cleaned up Phase 3 (race page fully complete) and gave the comparison builder a more honest description in Phase 4.

**Validate before building — consistent signal across four new bullets**
Every Phase 4 bullet added this session (refund spike, overhead ratio, dark money signals, IE) included an explicit note to validate thresholds or framing with John before building. The tool's credibility depends on not hardcoding politically loaded signals without expert input.

The through-line: Sloane is making decisions that protect the product from scope creep in both directions — features that aren't done get marked clearly, features that don't belong get demoted, and features that could be harmful if implemented carelessly get guardrails before they go anywhere near code.

## What to bring to Claude Chat
- John validation queue: four Phase 4 items need his input before any building starts — refund spike threshold, overhead ratio threshold, dark money signals non-partisan framing, IE display approach. Worth batching into one conversation.
- Comparison builder product design: entry point, URL structure, save/share mechanics are undefined. Is this a logged-in feature? A shareable link? A scratch pad? Needs product thinking before it's ready to spec.
- Candidate and committee filings: is there any scenario where surfacing FEC document links would be genuinely useful to a political strategist, or does this belong entirely to the FEC's own site? John's call.
- Breadcrumbs: still hidden, JS wired. What form should they take in the redesign?
---
2026-03-31

## Process log draft

Title: Cleaning the map before moving forward

A session without a single new feature — just the accumulated debt of a project that's been shipping fast. Stale docs corrected, shared logic extracted, a token formalized, a flaky test fixed. The site works the same as when we started. The codebase is a little more honest about itself.

Changelog:
– Validated Claude Chat's "correctness issues" audit: race.html relative paths are fine (query-param URL, not path-segment); .tag-context candidate-only status is correct by design; ENTITY_TYPE_LABELS already lives in utils.js
– Fixed two stale ia.md entries: committee modal link pattern was using old committee.html?id= format (now /committee/{id}); committee.html status in CLAUDE.md Current Files said "Raised/Spent tabs are stubs" (both live)
– .committee-name-link: corrected stale deprecation claim — rule is still active in candidate.html committees modal; updated CLAUDE.md and styles.css comment to reflect this
– Incumbent tag added to candidate.html profile header — reads from electionsData already fetched in loadCycle(), appended to #meta-row after party tag, cleared and re-evaluated on cycle switch
– races.html URL sync: cycle/office/state now sync to URL on every filter change; populateCycles() accepts preferred cycle from URL params; init() restores all three filters on load
– candidates.html cycle dropdown: replaced hardcoded 2002–2026 option list with JS-generated even years from currentCycle down to 2002 — auto-updates when 2028 arrives
– PURPOSE_MAP and purposeBucket() extracted from candidate.html and committee.html into utils.js — pure extraction, no behavior change
– --section-gap: 1.5rem formalized as a CSS token in :root; applied to .banner, .chart-card, .donors-card, .stats-grid, .raised-grid; documented in design-system.html and CLAUDE.md
– Flaky races.html mobile overflow test fixed: networkidle → load (IntersectionObserver enrichment calls were keeping the network active past the 15s timeout; layout test doesn't need data loaded)
– 2 new Playwright tests: incumbent tag visible for MGP (mock fixture has candidate_id + incumbent_challenge_full); candidates.html cycle dropdown has computed even-year options
– Test count: 265 → 267, all passing

Field notes:
The most clarifying moment was the .committee-name-link audit. Claude Chat called it "deprecated but still in styles.css" — technically accurate, but the deprecation note itself was wrong. The rule isn't unused; it's actively applied in candidate.html's committee modal. The doc was the bug, not the code. That's a different kind of maintenance than removing dead code, and it's easy to miss if you're not reading both the note and the source at the same time. The broader lesson from the session: documentation that's "almost right" creates more confusion than documentation that's clearly incomplete.

Stack tags: none (no new dependencies)

## How Sloane steered the work

**Bringing Claude Chat's audit to Claude Code for validation**
Rather than acting on Claude Chat's list directly, Sloane brought it to Claude Code to verify each item against the actual source. This caught three false positives: race.html paths (correct by design), .tag-context status (correct by design), and ENTITY_TYPE_LABELS (already in utils.js). Two of the five items were real; three weren't. The validation step saved three unnecessary edits.

**"What exactly is the definition of 'stable'?"**
After the .tag-context non-issue was explained, Sloane asked the sharper question: is the status taxonomy itself right? The instinct that "multi-page" would be more self-describing than "stable" is correct — stable is borrowed convention from library lifecycle semantics, where it means production-ready, not used-in-multiple-places. That's a real design system improvement worth a dedicated session.

**Noting the design system coverage gap**
The observation that browse pages and committee.html may have components not documented in design-system.html was an architectural awareness call — the system was named from the candidate page's perspective and hasn't caught up with Phase 3. Flagged for a future audit session rather than addressed ad hoc.

**Questioning the "30 minutes" estimate**
Pushing back on the time estimate for races.html URL sync was the right instinct. It was 15–20 lines. The session confirmed it. The pattern is already well-established in this codebase; the only real wrinkle was the cycle dropdown sequencing.

**Connecting races.html URL sync to candidates.html cycle dropdown**
The question "should candidates.html also have a dynamic cycle dropdown?" reframed what could have been a narrow fix into a moment of architectural alignment. The answer (no API call needed — compute from current year) was the right one, and recognizing the distinction between the two pages' needs was sharp.

The through-line: Sloane consistently asks "is this actually right?" before acting, and "what's the bigger pattern here?" when a local fix is proposed. Both instincts — skepticism and systems thinking — produced better outcomes than moving straight to implementation.

## What to bring to Claude Chat
- Design system status taxonomy: "stable" should probably be renamed "multi-page" — it tracks usage breadth, not maturity. A dedicated session to rename + audit which browse/committee/race page components are missing from design-system.html entirely.
- Incumbent tag on past cycles: when viewing a past cycle where the candidate lost, the tag still shows "Incumbent" (they were the incumbent when they ran). Is that the right framing, or should past-cycle incumbency say "was incumbent" / "defended seat"? Needs a UX decision before it becomes a visible issue.
- Phase 4 sequencing: cleanup is done. What's the first Phase 4 item — early signal data (48/24hr reports), AI insights panel, or something else? John validation queue (refund spike, overhead ratio, dark money, IE display) should probably happen before any of those build.
---
2026-03-31 Session 2

## Process log draft

Title: Smaller fixes, sharper language — the kind of session that makes the product feel finished

A session without a headline feature — but the kind of cleanup that raises the overall quality floor. Presidential races now actually work. The committees browse page learned to hide terminated clutter by default. A few names got corrected. The design system got more consistent. None of it individually is a big deal; together it makes the tool feel more intentional.

Changelog:
– race.html: fixed "Invalid state: US" error for presidential races — added 'US' to VALID_STATES
– race.html: presidential cycle cap changed from currentCycle to currentCycle + 2 — 2028 now appears in dropdown
– utils.js: formatRaceName returns 'US President' for office='P' — no bullet, no state suffix; all six call sites updated
– utils.js: _execute upgraded to handle array param values — { filing_frequency: ['-T', '-A'] } correctly serializes to repeated query params
– committees.html: "Show terminated" toggle added to filter bar — off by default (excludes T/A committees), chip shows "Include terminated" when on, URL sync as ?terminated=1
– candidate.html: committees modal "History" tab renamed to "Terminated" (display label only; data-tab, IDs, Amplitude values unchanged)
– styles.css: .toggle-switch CSS component added — CSS-only pill toggle; .toggle-label uses DM Sans 0.8rem to match form input value text
– design-system.html: .toggle-switch component card added (stable); .ds-component-notes formalized as a CSS class (was inline styles on 3 elements); notes pulled out of .ds-component-demo on Choropleth and Tab Bar components; inline style cleanup across 3 note elements
– tests/pages.spec.js: second races.html mobile networkidle test fixed (networkidle → load); 4 new assertions added after Sloane caught spec gap at commit time — toggle DOM presence, Terminated tab label, state=US valid, US President title
– tests/candidate.spec.js: 1 new assertion — modal history tab labeled "Terminated" not "History"
– CLAUDE.md: office cycle rhythms note added; API key confirmed at 7,200/hour; presidential race VALID_STATES note added; apiFetch array params documented; formatRaceName presidential behavior documented
– Final test count: 271/271 Track 1 passing (was 267 at session start)

Field notes:
The "Show terminated" toggle made an interesting design question concrete: what does "active" mean as a default editorial stance? The FEC has two kinds of terminated committees — voluntarily closed and administratively closed by the FEC for unresolved debts. Both go in the same bucket for now. The toggle is opt-in rather than opt-out, which implicitly says: active committees are the default subject of interest. That's the right call for most users. The naming took a few iterations ("Including terminated" → "Includes terminated" → "Include terminated") before landing on the imperative form, which reads as a user action rather than a state description.

Stack tags: CSS toggle component · FEC filing_frequency filter · apiFetch array params

## How Sloane steered the work

**"US President" over "President" — geography-first is a pattern worth keeping**
When the presidential race bug surfaced, the first fix proposed was simply suppressing the state suffix ("President" with nothing after it). Sloane immediately questioned whether "US President" would be better UX. It was — it fits the geography-first pattern established by "House • WA-03" and "Senate • NY", and it's more immediately scannable in context (race rows, candidate tags, page titles). A naming instinct, not a technical one.

**Iterating the chip label three times until it felt right**
"Including terminated" → "Includes terminated" → "Include terminated." The final form is an imperative that reads as a user action rather than a state descriptor. Each iteration was a judgment call about register and voice.

**Toggle label should match input value text, not label text**
The initial toggle styling used IBM Plex Mono uppercase to match the .form-label class. Sloane caught that the toggle label sits at the same visual weight as typed input value text, not a form label. Switching to DM Sans 0.8rem was the correct read.

**Design system cleanup as you go, not deferred**
The .ds-component-notes inconsistencies were caught and addressed in the same session they were introduced. The instinct to trace "this note looks different" back to a missing CSS class and misplaced markup is the right habit for keeping the design system trustworthy.

**Architectural documentation as prevention**
After the presidential cycle bug, Sloane asked: "How do we avoid this in the future?" Two words in a comment ("House/President: current cycle only") established a false grouping that caused the bug. A fixed comment + CLAUDE.md note is the right prevention.

The through-line: Sloane is editing toward precision — in language (chip labels), in design (text styling references), and in architecture (documentation as prevention).

## What to bring to Claude Chat
– Terminated vs. administratively terminated: both go to the "Terminated" modal tab, but they're meaningfully different. Is there a session to surface that distinction in the UI, or is the current single bucket the right call?
– Presidential race page UX: now that it loads, does the page need special treatment for presidential candidates? (No district, national scope, larger candidate count.) Worth a visual check.
– Design system status taxonomy: "stable" still means "used on more than one page" which isn't what stable means in library semantics. A rename + audit of browse/committee/race components missing from design-system.html is overdue.
– Phase 4 sequencing: cleanup is done. What's the first Phase 4 item — 48/24hr early signal data, AI insights, or something else? John validation queue should happen before any of those build.

---
2026-03-31 18:00

## Process log draft

**Title: The design system finally looks like the thing it documents**

This was a documentation catch-up session — the design system had drifted from what was actually in production, and the goal was to bring it into honest alignment. No new features, just a thorough audit pass: renaming a class that had quietly grown two different names, documenting components that had been live on multiple pages for weeks without a card, and replacing a fictional modal demo with real candidate data.

Changelog:
- Renamed .page-header-title → .page-title globally (styles.css is now the single source; all local overrides removed from 6 pages)
- Added margin-bottom:0.5rem to .page-title in styles.css — eliminated repeated local definitions
- Added modal-scoped committee row spacing: .modal-body .committee-row margin-bottom + adjacent sibling margin-top, scoped to avoid side effects on flush-stacked browse lists
- Promoted three component status badges from candidate-only to stable: comp-raised-grid, comp-map, comp-donut
- Added comp-typeahead card with three-panel demo (results, empty state, loading skeleton)
- Added comp-status-dot card (.status-dot + .typeahead-status-dot variants)
- Added comp-results-groups card showing grouped search results layout
- Extended comp-candidate-card with a stats row demo card (MGP, real figures)
- Updated comp-modal class list and replaced fictional demo with Pelosi's real committee data (Active: Principal CC + Leadership PAC + Other; Terminated: 2 Other rows)
- Documented JFA organizer display gap in CLAUDE.md (FEC assigns many JFAs committee_type 'N'/'Q' instead of 'J' — modal groups them as "Other")
- Removed stale .typeahead-dd retired note from CLAUDE.md
- Updated 4 stale .page-header-title references in test-cases.md

Field notes:
The Pelosi modal investigation was the most interesting moment in the session. I'd built a demo with a JFA group showing prominently in the middle, and the question was whether the live site actually shows that. Turned out no — Pelosi has 5 committees (3 active, 2 terminated), none of which appear in the "Joint Fundraising" group because the FEC filed them with committee_type 'N' or 'Q' instead of 'J'. The modal still works correctly; it just groups them as "Other" instead. The documentation now reflects what the system actually does, not what I assumed it would do.

The class rename felt like a small thing but it had tentacles everywhere. Six pages each had their own copy of the same three-line CSS rule, all slightly different, all for a class that was supposed to be shared. When you only realize that after building the pages, the cleanup is worth doing — it's the kind of debt that silently multiplies.

## How Sloane steered the work

**Modal accuracy over demo convenience**
When I updated the comp-modal demo, the first version used fictional candidate data with a JFA group prominently displayed. You pushed to use real data from the live site, which immediately surfaced that JFAs don't show up as "Joint Fundraising" in practice. That wasn't a small editorial preference — it caught a real documentation-vs-reality gap before it misled anyone reading the design system.

**Scoped CSS over a global shortcut**
When we needed spacing between committee groups in the modal, I proposed a global approach: add margin-bottom on .committee-row, cancel it with a negative margin on the adjacent sibling. You rejected it as "hacked together and not future-proof" — and you were right. The modal-scoped version (.modal-body .committee-row) is self-contained, doesn't affect the flush-stacking pattern elsewhere, and is much easier to reason about.

**Documentation as a design artifact**
The whole session was your call. You chose to spend a session on documentation and design system alignment rather than new features. That discipline — making the reference system honest before building more on top of it — is a product instinct, not a dev one.

The through-line: you're holding the design system to the same standard as production — real data, scoped styles, honest component states. The rule is "document what it actually does," not "document what you wish it did."

## What to bring to Claude Chat
- JFA organizer gap — is it worth fixing? The "Joint Fundraising" group only appears when committee_type === 'J', but the FEC often assigns 'N' or 'Q' to real JFAs. Is showing all JFAs in their own group important enough to invest in a more reliable detection heuristic (e.g. designation === 'J')? Or is "Other" an acceptable fallback for now?
- Design system completeness vs. build momentum: This session was pure documentation catch-up. Is there a threshold where the design system is "good enough to stop maintaining in parallel" and attention should shift fully to Phase 4 features?
- Modal demo data philosophy: Using Pelosi's real data is accurate but will age. Should demos use real but frozen data (with a "as of" note), or is synthetic-but-realistic data more appropriate for a living reference?
---
2026-03-31 CSS Consolidation Session

## Process log draft

Title: Making the system honest — token audit and CSS consolidation

A full session of design system maintenance with no new features. We worked through six discrete cleanup tasks: replacing hardcoded color values in the global banner and modal overlay with semantic tokens, formalizing a new --overlay-bg token for the scrim layer, replacing two rgba() values in .callout with color-mix() derivations, and then two larger consolidation passes — promoting all browse-page chrome into styles.css, and stripping redundant rules from every profile page inline block. The codebase now has a single source of truth for every shared CSS rule.

Changelog:
- Global banner: replaced background:#1c1710, color:#7a7060, and strong color:#c8c0b0 with var(--text), var(--muted), var(--border)
- Added --overlay-bg: rgba(26,21,16,0.65) to :root Accent group; .modal-overlay now references it; design-system.html token table updated
- .callout: rgba(232,160,32,0.2) and rgba(232,160,32,0.05) replaced with color-mix(in srgb, var(--amber) 20%/5%, transparent)
- CLAUDE.md: rgba semantic token refactor documented as deferred (blocked on primitive promotion decision)
- Browse page chrome: ~200 lines of CSS (filter bar, state combo, chips, results area, error/no-results, retry) moved from candidates/committees/races/search inline blocks into styles.css section R; three 860px rules added; 480px block added
- candidates.html, committees.html: inline <style> blocks reduced to page-specific overrides only
- Profile page cleanup: .tabs-bar padding+opacity merged into styles.css; .tabs-bar.visible, .cycle-select, .meta-row added; .state-msg 860px and .stat-value 480px overrides promoted; .main, .raised-grid/.raised-cell/.raised-cell-title, empty .profile-header{} deleted from profile pages
- design-system.html: .ds-component-demo .tabs-bar override added alongside .page-header-reveal reset
- 271/271 Playwright tests passing

Field notes:
The tabs-bar demo override was a good catch — caught before execution because the plan included it. That's exactly the kind of downstream side effect that CSS promotion creates: a rule that means nothing in production (no JS adds .visible to demos) suddenly matters because the base rule changed. The design system is only trustworthy if it renders what production renders. The override keeps the contract intact.

Stack tags: none (no new dependencies)

## How Sloane steered the work

**Explicit, precise instructions — no inference required**
Every task this session arrived as a complete specification: exactly which values to replace with which tokens, exactly which rules to promote, exactly which files to touch. That level of precision eliminates an entire category of judgment errors.

**Catching the design-system.html demo side effect before execution**
When the tabs-bar promotion was planned, Sloane added a correction before approval: the design-system demo needed a matching override because it doesn't run JS. That's systems thinking — recognizing that promoting a rule changes its blast radius, and that the design system is a consumer of styles.css just like production pages are.

**color-mix() as the right tool for the callout**
Rather than creating two new tokens for single-use tints, Sloane specified color-mix() derivations. Tokens should carry semantic meaning, not be ephemeral intermediate values. color-mix() keeps the relationship between the callout colors and --amber explicit in the CSS itself.

**Deferred refactor as a first-class decision**
Rather than doing a piecemeal rgba cleanup on the chart tokens, Sloane directed that the decision to NOT refactor be documented explicitly in CLAUDE.md — with the reason (blocked on primitive promotion) and the constraint (address as a single pass). Deferring intentionally is different from deferring by accident.

The through-line: Sloane is treating CSS architecture with the same rigor as product architecture — every change either closes a known debt item or deliberately defers it with documented rationale.

## What to bring to Claude Chat
- color-mix() vs. token pattern: callout uses color-mix() for amber tints; chart overlays still use raw rgba(). Deferred refactor note documents the blocker (no primitive for blue-500/red-500/chart-amber in :root). Is there a session to promote those three primitives and close the rgba debt in one pass?
- Design system status taxonomy: "stable" rename + audit of browse/committee/race page components still missing from design-system.html is in queue.
- Phase 4 sequencing: CSS consolidation is done. First Phase 4 item? John validation queue should precede building.
- candidates.html / committees.html still have redundant .main { overflow-x:hidden; } — not in this session's scope but worth a one-line cleanup next time those files are touched.

---
2026-04-01 [end of session]

## Process log draft

**Title:** The dropdown that earned its keep — accessibility and the custom state picker

The state filter started this session as a native `<select size="6">` — functional but visually inconsistent and untestable in any meaningful way. It ended as a fully custom combobox with keyboard navigation, ARIA semantics, a mobile native fallback, and 9 new Playwright assertions covering the pattern across all three browse pages. Along the way, the form controls component got its first proper documentation card in the design system.

**Changelog:**
- styles.css: `.legend-dashed` and `.legend-amber-dashed` now reference CSS vars (`--chart-overlay-deadline`, `--chart-overlay-election`) instead of hardcoded rgba values — swatches now match chart overlays exactly
- design-system.html: new Form Controls card (`comp-form-controls`, stable) — documents `.form-input`, `.form-select`, `.form-search-btn`, states (focus/disabled), and variants (cycle-select, search-combo) with live demos
- candidates.html, committees.html, races.html: replaced native `<select size="6">` state picker with custom `.typeahead-dropdown` / `.typeahead-row` list — visually consistent with the name typeahead
- styles.css: removed `.state-select-wrap`, `.state-listbox`, `:focus-within` toggle rules; added `.state-combo .typeahead-dropdown { min-width:200px }`; added mobile media query swap (hides custom input+dropdown, shows native select)
- All three pages: keyboard nav (ArrowUp/Down/Enter/Escape), ARIA semantics (`role="combobox"` on input, `role="listbox"` on dropdown, `role="option"` on rows, `aria-expanded`, `aria-activedescendant`, `aria-selected`), `stateKbRow` tracking, blur+150ms pattern
- tests/pages.spec.js: 3 new test blocks (one per browse page) asserting `role="combobox"`, `role="listbox"`, and `#f-state-native` presence — 274 tests pass

**Field notes:**
A detail that came up mid-session: the Claude Chat prompt had two quiet errors — it suggested adding `id="state-listbox"` to a div that already had `id="state-dropdown"` (an element can only have one id), and it named the All States row `id="state-opt-"` (just the prefix, no value). Both were caught before implementation. The broader lesson: prompts drafted in Claude Chat don't have codebase context, so they need a review pass against the actual HTML before you trust the DOM IDs. The CLAUDE.md rule about verifying field names against live API responses has an analogue here: verify DOM IDs against the actual markup before wiring up JS or ARIA references.

Stack tags: Accessibility (ARIA combobox pattern), Keyboard navigation, Mobile fallback, Design system documentation

## How Sloane steered the work

**Reviewing the Claude Chat prompt before implementing**
Rather than blindly executing the ARIA prompt, you asked Claude Code to read and adjust it first. That caught two ID errors (an impossible duplicate id and an incomplete id value) and a missing Playwright step before a single line was written — a much cheaper catch than a confusing test failure or broken aria-activedescendant pointer mid-session.

**Insisting on documentation parity with implementation**
You held the line that the Form Controls card had to land in design-system.html in the same session the component was used across four pages. That's a discipline most projects let slip ("we'll document it later") and it's what keeps the design system useful vs. decorative.

**Legend swatches as a precision detail**
The CSS var fix for the legend swatches was a small change with a clear payoff — swatches that don't exactly match their chart overlays erode trust in the data visualization, even if nobody consciously notices. Flagging this as a discrete, non-negotiable first task set the tone for the session.

The through-line: you're making calls that look like "small polish" but are actually systemic — each one reduces the surface area where the next developer (including you in a future session) can make a mistake or miss a detail.

## What to bring to Claude Chat

- **State combo UX review:** The custom dropdown closes on blur with a 150ms delay. On mobile, the native select takes over. Worth a quick question for John or a test with a real user: does the custom dropdown feel predictable and accessible enough, or does it introduce friction vs. the original native select?
- **Design system card review:** The Form Controls card now exists. Worth a look — are the four demo rows (text input states, select variants, search combo, cycle select in tabs) sufficient, or is anything missing?
- **Race page: what's the next priority?** Races.html browse is live with progressive enrichment. race.html is scaffolded. The question is what Phase 3 work to prioritize — completing the single race view, or moving toward Phase 4 (early signal data, AI insights)?

---
2026-04-01

## Process log draft

Title: The invisible dropdown, and the one-word fix

This session started as an accessibility upgrade — replacing all the native filter selects on the browse pages with custom, keyboard-navigable dropdowns — and ended as a debugging session after two context compactions obscured a CSS specificity bug that made every new dropdown button invisible on desktop. The bug turned out to be two characters wide: ".form-select" hiding buttons that happened to share the class, fixed by qualifying it to "select.form-select". The implementation itself was sound; the compaction just didn't carry the right detail forward.

Changelog:
- Added initComboDropdown() factory to utils.js: ARIA combobox/listbox pattern, keyboard nav (arrow keys, Enter, Escape), outside-click dismiss, aria-selected sync on reopen, mobile native <select> fallback at ≤860px
- Replaced native <select> filter controls with custom combo-wrap/combo-trigger dropdowns: office/party/cycle on candidates.html, type on committees.html, year/office on races.html
- State combo on all three pages refactored to use the factory (removes ~300 lines of duplicated inline JS)
- Fixed [aria-selected="true"] visual indicator (CSS rule was missing)
- Fixed blur-timer race on state combo reopen
- Added Form Controls card to design-system.html documenting all form control classes including the new combo pattern
- CSS specificity fix: .combo-wrap .form-select → .combo-wrap select.form-select (two occurrences in styles.css)
- 9 new Playwright combo ARIA assertions; 4 existing tests updated with { force: true } for hidden native selects
- 271 → 280 structural tests passing
- Docs updated: CLAUDE.md (test count, combo docs, specificity note), TESTING.md (test count, pages.spec.js description), test-cases.md (count, manual test items, test log row)

Field notes: The specificity bug is a good reminder that dual-class elements are CSS landmines. A button styled to look like a select by sharing the form-select class seemed clever at the time — and it was, visually — but it silently inherited the hide/show rules meant for actual selects. The fix is also the lesson: when you need to hide "the select but not the button," say "the select" in CSS. Compaction didn't cause the bug; it just meant there was no one in the room who remembered writing the rule.

Stack tags: accessibility, ARIA, CSS specificity, utils.js

## How Sloane steered the work

**Catching what compaction lost**
The bug report — "I can't see several of the new dropdowns" — came with screenshots and a clear instinct that something had gone wrong during the compacted sessions. You didn't assume it was an API issue or a JS error; you went straight to the visual layer and asked for a plan before any fixes. That sequence (observe → plan → fix) is slower but it meant the diagnosis was right before any code changed.

**Pausing before commit**
You've now blocked the auto-commit at session end twice. That's a deliberate rhythm: do the work, do the documentation, then review the diff yourself before it lands in history. It's a quality gate that I was treating as optional. It's not.

**Asking about the checkmarks**
The question about ✅ in test-cases.md was a good catch — the file had become a mix of "automatically verified" and "manual only" items with no clear legend. The answer clarified the intent: ✅ = my job, unmarked = yours. That distinction matters for knowing where to spend time during a browser review pass.

The through-line: you're building habits around review that treat the session as not done until you've seen the output, not just the tests. That's the right instinct for a portfolio piece where the diff is also the artifact.

## What to bring to Claude Chat

- **What's next after combos?** race.html is still a scaffold. The Spent tab on committee.html is live. Is Phase 4 (48hr reports, AI insights) the next direction, or is there remaining Phase 3 polish first?
- **Browser QA on the combos** — The Playwright tests cover structure/ARIA, but keyboard nav and mobile fallback need a manual pass in the browser. Worth doing before pushing to Netlify.
- **Context compaction strategy** — Two compactions in one session created a blind spot that produced a real bug. Worth discussing whether longer sessions should have a mid-session checkpoint, or whether the planning gate (plan → approve → implement) is sufficient protection.
---
2026-04-01

## Process log draft

Title: Cleaning the closet — the design system starts to mean something

This session had no new features. It was two things: making CSS rules say what they actually mean, and making the design system document what actually exists. The combo-wrap consolidation was a structural tidying — two patterns that shared rules but maintained them separately, now unified. The design system work was the harder part: the Form Controls card had been written before the custom combo work existed, so it was quietly wrong. A card that doesn't show the filterable state-combo pattern, or explain which native selects are still in play, isn't documentation — it's archaeology.

Changelog:
- styles.css: merged duplicate position:relative and native-select hide/show rules from .state-combo into .combo-wrap; .state-combo retains only rules unique to it (input width, dropdown min-width, mobile input hide, mobile select width)
- candidates.html, committees.html, races.html: state-combo divs now carry both state-combo and combo-wrap classes
- design-system.html: comp-form-controls updated — state-combo filterable demo row added; native select row label updated to reflect current limited use; class list updated to include .state-combo; notes rewritten to document initComboDropdown modes (filterable:true vs filterable:false), .placeholder scoping, and .search-bar-wrap/.search-bar page-scoping
- design-system.html: comp-browse-chrome card added (stable) — filter bar, filter chips, and error prompt demo sections; page-gutter padding overridden with fixed value for card context; notes document production page-gutter behavior and page-specific extensions
- CLAUDE.md: Shared form controls note updated with CSS consolidation details
- test-cases.md: test log row appended

Field notes: The native-select caret question at the end of the session is a good example of a detail that looks like a bug but is actually a constraint. The mobile caret difference isn't a drift from the design — it's the cost of using the native OS picker, which is the right call for touch devices. The answer is worth having in a log somewhere because it will come up again when someone looks at the site on a phone and wonders why the State dropdown looks slightly different.

Stack tags: none (no new dependencies)

## How Sloane steered the work

**CSS consolidation as a scoped task, not a refactor**
The combo-wrap/state-combo work came in as a precisely bounded spec: what to merge, what to keep, which files to touch, and an explicit constraint ("the state combo's .form-input hide at mobile must stay"). That precision prevented the kind of exploratory cleanup that turns a 20-minute task into a 2-hour one. The work was done, tested, and done.

**Design system as a product artifact, not developer notes**
Asking for three specific things wrong with the Form Controls card — the missing state-combo demo, the stale native-select framing, the undocumented initComboDropdown modes — shows that the design system is being read and held to a standard. A card that quietly misrepresents how the system works erodes trust in the whole reference. Fixing it now means the next person to build a filter control has an accurate guide.

**The caret question**
The question about the mobile native select caret was small and incisive — it's the kind of thing you notice when you're actually looking at the site on a phone, not just running tests. The answer (intentional, trade-off between visual consistency and native UX) is one of those "why is this like this" moments worth having on record.

The through-line: you're treating the design system the way production code gets treated — it should be accurate, not aspirational. The session's work was less about building and more about making what already exists legible.

## What to bring to Claude Chat

- **Mobile caret parity — worth a decision:** Now that the design system explicitly documents native-select usage, is the caret inconsistency on mobile something to formally accept (add a note to the design system) or schedule a fix for? The `-webkit-appearance:none` + background-image approach is doable but adds maintenance surface. Good to have an explicit call rather than leaving it as an implicit known gap.
- **Design system completeness audit:** The "stable" taxonomy is now well-populated. Is there anything that's on multiple pages but still missing a card? Worth a quick pass before Phase 4 starts, so the reference is complete at the transition point.
- **Phase 4 first item:** CSS consolidation is done. Design system is honest. What's the first Phase 4 feature — 48/24hr early signal data, AI insights, or something else? Sequencing decision before the next build session.
---
2026-04-02

## Process log draft

Title: The palette gets honest — tokens all the way down

This session was a color audit and consolidation. Two background primitives that had been doing the same visual job at slightly different values — warm-floor for page background, warm-sidebar for nav — got merged into one token at a new value (#F8F5EC). Cards went to pure white. The design system got updated to reflect what actually exists. And along the way, the chart color palette in utils.js stopped being a parallel registry of hardcoded values and started reading from the CSS tokens it was always supposed to match.

Changelog:
- Consolidated warm-floor (#ede8e0) + warm-sidebar (#e8e2d8) → single warm-floor primitive at #F8F5EC; --nav-bg token removed from :root; all var(--nav-bg) call sites replaced with var(--bg)
- warm-card (#f7f4ef) renamed to light-card at #ffffff; --surface: #ffffff
- .tag-context background changed from var(--nav-bg) → var(--border) — Sloane's call to give the race context pill a more intentional fill rather than blending into the page
- All hardcoded #ede8e0 and #f7f4ef values updated: map path strokes in candidate.html + committee.html; three values in CHART_COLORS (pointBorder, donutBorder, tooltipBg)
- CHART_COLORS in utils.js refactored from 20 hardcoded rgba/hex strings to a getComputedStyle IIFE that reads CSS variables at runtime — charts now follow token changes automatically
- design-system.html: Tier 1 primitive table (warm-sidebar row removed, warm-card → light-card, warm-floor hex updated); Tier 2 semantic token table (--nav-bg row removed, --surface primitive updated, hex cells updated); Background swatches updated; --nav-bg swatch removed; --surface swatch gets border for visibility at #fff
- CLAUDE.md: --bg and --surface values updated; --nav-bg line removed from nav tokens block; CHART_COLORS architecture note updated

Field notes:
The CHART_COLORS refactor is a small change with a disproportionate payoff. Before: changing a CSS token meant finding and updating a parallel copy in utils.js, hoping you didn't miss one. After: the JS reads from the CSS, so there's one source of truth. The IIFE pattern keeps the same object shape so no call sites changed. The one remaining hardcoded value (axisGrid) has no token — and that's the right call, because not every color needs to be in the system. The design token system should capture intent, not catalog every rgba() in the codebase.

Stack tags: none (no new dependencies)

## How Sloane steered the work

**Asking the right audit question first**
Rather than jumping straight to "change these colors," you started by asking exactly what each primitive touches — all pages, all files, all downstream references. That sequence (understand before changing) meant the implementation had no surprises: the tag-context implication was caught before any code was written, not after.

**The tag-context call — var(--border) over blending in**
When the consolidation would have made the race context pill invisible against the page background, you didn't default to the nearest safe option. You picked var(--border) — a choice that turns the pill into something more intentional and distinct than it was before. A background that's clearly a border color reads as a chip, not an accident.

**"Is there any drawback?" before applying**
The question before approving the CHART_COLORS refactor is a good instinct. It's a visible architectural change (plain object → IIFE) and the answer mattered: the only real constraint is load order, which is already guaranteed. Asking the question confirmed the tradeoff was understood, not just trusted.

The through-line: you're treating design decisions and architecture decisions with the same rigor — understand the full blast radius, decide the edge cases explicitly, then execute. Nothing in this session was left as an implicit assumption.

## What to bring to Claude Chat

- **Visual QA on the new palette** — The three token changes (#F8F5EC background, #ffffff cards, var(--border) tag-context) will look notably different on the live site. Worth a browser pass before deciding if any adjustments are needed — particularly the tag-context pill, which is now noticeably more defined.
- **Remaining hardcoded colors** — The donut/contributor chart color arrays in candidate.html and committee.html still have ~16 hardcoded values. Some map to existing tokens; others don't have a token yet. Is there appetite for a color system pass on the chart categories, or is that low priority relative to Phase 4 work?
- **Phase 4 sequencing** — Design system is honest, token system is clean. What's the first Phase 4 feature — 48/24hr early signal data, AI insights, or something else?
---
2026-04-06

## Process log draft

**Title:** The branch that didn't break anything — setting up the redesign runway

This session was pure setup: a new branch, a name change, a font swap, and a design system audit. Nothing on the live site changed. The goal was to create a clean workspace where visual experiments can happen without touching main, and to confirm the full deploy pipeline (branch → Netlify preview) is wired correctly before any real redesign work begins. The font swap from Barlow Condensed/DM Sans to Oswald/IBM Plex Sans was the first substantive experiment — visible in the branch preview, invisible to anyone on main.

**Changelog:**
- Created `redesign` branch, pushed to origin, Netlify branch deploy triggered
- Renamed `ledger.fec` → `FECLedger` across all UI (titles, nav logos, document.title JS strings) and docs (CLAUDE.md, ia.md, TESTING.md, test-cases.md); logo styled as `FEC<em>Ledger</em>`
- Swapped Google Fonts import on all 9 HTML files: Barlow Condensed + DM Sans → Oswald + IBM Plex Sans + IBM Plex Serif (loaded, not yet assigned)
- Updated all font-family declarations in styles.css (21 rules), design-system.html inline style + body inline styles, process-log.html, candidate.html, races.html, search.html
- Audited Typography section of design-system.html: removed 4 phantom specimens (wrong font for nav, sizes with no matching CSS rule, weight 300 not in import); fixed 2 real entries (weight 300→400, added missing font-family on spans, corrected descriptions)
- CLAUDE.md updated with new font stack (annotated as redesign-branch-only)
- 280/280 Playwright tests passing throughout

**Field notes:**
The phantom specimen audit was more interesting than expected. Four of six IBM Plex Mono rows had no font-family declaration on the specimen span itself — they were rendering in body font while claiming to show Mono. The design system had quietly become a document that looked right but wasn't. The right call was to remove the ones with no real-world CSS backing and fix the two that did exist. A design system that shows you what the font looks like by rendering it in the wrong font is worse than no specimen at all.

Stack tags: none (no new dependencies)

## How Sloane steered the work

**Confirming branch before every destructive action**
The explicit "confirm we're on the redesign branch before touching anything" instruction at the start of each task prevented any risk of landing font changes on main. That discipline — treat every session as if it might be running in the wrong context until proven otherwise — is the right default for a branch that exists to be different from production.

**`FEC<em>Ledger</em>` as a follow-through call**
After the initial rename committed as plain FECLedger, you came back to add the em treatment. A small thing, but it shows the difference between "rename done" and "rename done correctly." The design-system demo span got the matching font-style:normal; color:var(--muted) treatment because it should mirror production.

**"Is this used anywhere?" — the right question**
Rather than accepting the design system at face value, you questioned a specific specimen the moment something seemed off. That question led to finding four phantoms, not just one. The follow-up — "check the rest of the Typography section" — is the correct instinct: if one entry is wrong, audit the whole section, not just the one you noticed.

The through-line: you're treating the redesign branch as a place to do real work carefully, not a sandbox to move fast in. The setup discipline (branch confirm, phantom audit, design system honesty) will pay off when the actual visual changes start landing.

## What to bring to Claude Chat

- **Type audit scope for next session:** The goal is to audit all font-family declarations across all pages and check whether they're represented in the design system. Worth confirming the approach: should the audit cover only styles.css (the source of truth) or also every inline style block and inline style= attribute across all pages?
- **IBM Plex Serif:** It's loaded in the font import but not assigned anywhere. Intentional placeholder, or is there a specific use in mind (pull quotes? process log body text? data callouts)?
- **Oswald weight range:** The import only loads 400 and 600. The old Barlow Condensed loaded 400–900, and several rules use font-weight:800 or font-weight:700. Oswald's heaviest weight is 700 — those 800 declarations will silently fall back to 700. Worth deciding whether to update all font-weight:800 declarations to 700, or add 700 to the import explicitly and leave the code as-is.
---
2026-04-06

## Process log draft

Title: Type with intention — the weight audit and the rhythm question

The redesign branch got its first real typographic decisions this session. Oswald was being used at weights that don't exist — 800 and 700, both silently falling back to 700 in the browser, which was itself too heavy. Committing to 600 as the ceiling made the decision explicit and consistent: the code now reflects what's actually rendering. The second half of the session was about rhythm. Body line-height had been sitting at 1.55 — an arbitrary middle value with no clean relationship to anything else. Pulling it to 1.5, and establishing 1.75 and 1 as the other two values, gives the system three intentional stops instead of four random ones.

Changelog:
– styles.css: all Oswald font-weight declarations updated to 600 (was 800 or 700); no visual change since browser was already falling back to 700 → but code now accurately reflects intent
– design-system.html: matching updates to inline CSS, type specimen font-weight values, and all "Oswald 800 / Oswald 700" meta labels → "Oswald 600"
– Google Fonts import confirmed at Oswald:wght@400;600 on all 9 pages — no change needed
– styles.css: .tag-context updated from IBM Plex Mono 0.62rem → IBM Plex Serif 0.875rem; padding adjusted to match
– design-system.html: IBM Plex Serif section added to typography specimens; .tag-context component notes updated with editorial intent
– styles.css: line-height system settled at 1.75 / 1.5 / 1 — body 1.55→1.5, .data-note 1.8→1.75, .callout 1.6→1.75
– CLAUDE.md: redesign branch typography section updated with Serif role, weight constraints, and line-height system note

Field notes:
The font-weight cleanup is a small thing that reveals something about how the old font system worked. Barlow Condensed had weights all the way to 900, so 800 was a real, visually distinct choice. When you swap the font and don't re-audit the weights, you inherit the old system's vocabulary without its palette. The 800 declarations weren't wrong — they were just orphaned. Choosing 600 as the ceiling for Oswald is a real design decision: it says this font should feel authoritative but not aggressive. The IBM Plex Serif for .tag-context is the more interesting call. It signals that some information in this tool isn't data — it's context. A serif sentence reads differently than a mono label, and that difference is intentional.

Stack tags: none (no new dependencies)

## How Sloane steered the work

**Starting from first principles on Oswald weight**
When the weight issue came up, the question wasn't "which fix is easiest?" — it was "what weight do I actually want?" 600 as a ceiling is a considered design position, not a fallback. The explanation of why 800 was being silently rounded down made the decision concrete rather than arbitrary.

**Catching that 700 also needed updating**
After setting the ceiling at 600, immediately recognizing that the just-changed 700 values should also come down. The instinct wasn't "we already fixed the 800s" — it was "700 is also above where I want to be." That's the difference between patching and deciding.

**IBM Plex Serif as editorial register, not decoration**
The instruction to use Serif for "content that feels more special and information is put into a sentence format" is a typographic voice decision, not just a visual one. It draws a clear line between data presentation (Mono/Sans) and editorial narration (Serif). That distinction will shape every future content decision on this branch.

**Codifying line-height as a system with three values**
Rather than accepting whatever values happened to be in the file, you named the three values you want — 1.75, 1.5, 1 — and explicitly deferred the variable work for a dedicated session. That's a product instinct: get the values right now, formalize the system when it's warranted.

The through-line: Sloane is making the redesign branch a place where every typographic property is intentional. Not "what does it currently say" but "what should it say" — weight, family, rhythm, all decided rather than inherited.

## What to bring to Claude Chat

– Line-height variables session: three values are now in use as literals (1.75, 1.5, 1). When's the right moment to formalize as CSS variables (--lh-prose, --lh-body, --lh-tight or similar)? Worth deciding the naming convention before building it.

– IBM Plex Serif expansion: .tag-context is the first use. The health banner's .banner-desc (currently IBM Plex Sans 0.82rem) feels like a natural next candidate — it's prose describing financial health, not a label. Worth a visual check on the branch preview to see if .tag-context alone reads as a system or just a one-off.

– Oswald 400 vs 600 in practice: now that 600 is the ceiling, is there anywhere currently using 600 where 400 would feel more appropriate — or vice versa where the step down from 600 to 400 is too big a jump? A visual review of the branch with fresh eyes would catch this.
---
2026-04-06

## Process log draft

Title: The type system gets honest — three vars and three sizes

This session was two passes, not one. The first formalized the line-height system that had been settled as literals last session: three CSS variables (--lh-expanded, --lh-normal, --lh-tight) now live in :root, and every line-height declaration across styles.css and all the HTML inline style blocks uses them. The audit also caught a batch of off-system values — 1.1, 1.4, 1.55, 1.6, 1.7 — scattered across design-system.html, search.html, and process-log.html that hadn't been cleaned up last session. They got snapped to the correct tier.

The second pass was bigger in scope but simpler in logic: 30+ font-size values collapsed to three. Everything in the 0.5–0.9rem range now resolves to 0.625rem (labels), 0.75rem (body), or 0.875rem (medium UI). The audit found no clean prior system — just drift. Five values below 0.62rem, five more between 0.57 and 0.62, three in the mid-range, four at body, four at medium. Now there are three.

Changelog:
– styles.css: added --lh-expanded: 1.75, --lh-normal: 1.5, --lh-tight: 1 to :root; replaced all 9 literal line-height values in class rules with CSS vars
– design-system.html, search.html, process-log.html: snapped 13 off-system line-height values (1.1, 1.4, 1.55, 1.6, 1.7) to correct tier via var(--lh-*)
– design-system.html: added Line-height system type group to Typography section; added three lh token rows to Tier 2 token table
– font-size: 30+ values in 0.5–0.9rem range collapsed to 0.625/0.75/0.875rem across 10 files (styles.css + 9 HTML)
– design-system.html: updated IBM Plex Sans and IBM Plex Mono specimen meta labels to reflect new sizes
– CLAUDE.md: font-size tier system documented; stale 0.62rem reference updated to 0.625rem; line-height var description updated

Field notes:
The font-size audit number was the tell: 32 distinct values. Line-height had three clean tiers hiding under a few dirty literals. Font-size had no system at all — just six values in a 0.08rem range that were functionally indistinguishable on screen. The decision to collapse to three tiers (0.625 / 0.75 / 0.875) was fast because the groupings were obvious once you saw them clustered. The harder question is always whether any of those drifted values was actually intentional — whether the 0.57rem versus 0.58rem distinction was a real design call or just two people typing different numbers. In this codebase, it was drift. The three-tier system replaces a false precision with an honest one.

Stack tags: none (no new dependencies)

## How Sloane steered the work

**"What about font-size?" — the right follow-up question**
After the letter-spacing audit surfaced a similar fragmentation problem, the immediate instinct was to check font-size. That question produced the 32-value audit, which made the consolidation obvious. Pulling on the thread before moving on is what keeps audits from being one-and-done.

**Naming the tiers precisely before execution**
"All Tiny and Label-dense to .625, all Mid-small and Body to .75, and all Medium to .875" is an executable spec. No ambiguity about which values go where, no room for interpretation. That precision meant the implementation was a straight execution rather than a series of judgment calls mid-flight.

**Catching the scope question on font-size**
When asked to confirm the plan was targeting font-size values specifically, you pushed back on the plan before approving it — asking whether it was explicit enough. That's the right gate: a plan that's ambiguous about scope will produce ambiguous execution. Adding "font-size declarations only" to the context made the boundary clear.

The through-line: you came in with a clear sense of what a systematic typography cleanup looks like — not patching individual values but auditing the full property and deciding the system. Each pass (line-height, then font-size) followed the same shape: audit → identify the real structure → collapse to intentional tiers.

## What to bring to Claude Chat

– Visual QA priority: nav links (0.82rem → 0.75rem) and tab labels (0.9rem → 0.875rem) are the biggest visual steps from the font-size consolidation. Worth a branch preview pass before the next session to confirm they read correctly.
– Letter-spacing next? Font-size and line-height passes are done. Letter-spacing has the same drift pattern — a cluster of values that could collapse to two, plus a breadcrumb discrepancy (0.05em in design-system.html vs 0.08em in styles.css). Is this next, or lower priority than other Oswald/visual work?
– IBM Plex Serif expansion: .tag-context is the only Serif use. .banner-desc was flagged as a candidate. Now that font-size is clean, does .banner-desc at 0.75rem in Serif feel right, or should it stay IBM Plex Sans?
– CSS vars for font-size? The consolidation landed as literals. Is there appetite for --fs-label/--fs-body/--fs-medium vars in a follow-up, or is the three-tier literal system sufficient for this project's scale?

---
2026-04-06 — Typography consolidation: 32 combos → 10 named styles

## Process log draft
Title: From 32 shades of gray to 10 with names

The typography system was technically working — every element had a font-family, a font-size, a weight. But there were 32 distinct combinations, many near-duplicates with slight variations nobody could explain. This session collapsed them into 10 named styles with clear roles: display, stat, heading, tab, subheading, label, caption, body, body-emphasis, prose. Same approach for letter-spacing — seven different values consolidated into two CSS vars. The search page's oversized hero title is gone, replaced by the same .page-title every other page uses. The design system specimens now render from production CSS classes instead of inline styles, which means they can't drift from reality.

Changelog:
– Eliminated .search-hero class; search page now uses shared .page-header + .page-title
– Updated .page-title: font-size to clamp(1.6rem,5vw,5rem), letter-spacing to -0.125rem
– Tabs and cycle select updated to Oswald 1.25rem; cycle-select specificity fixed via .cycle-select.form-select
– Consolidated all 1.1rem/1.2rem/1.3rem font-sizes to 1.25rem across 6 files
– Created letter-spacing system: --ls-tight (-0.125rem) and --ls-expanded (0.1em); collapsed 7 distinct values; stripped ~40 unnecessary letter-spacing:0 declarations
– Defined 10 named type styles; documented in styles.css :root comment block and CLAUDE.md table
– Updated .modal-title and .form-search-btn to subheading (0.875rem); .nav-item to body (0.75rem); .committee-name to body-emphasis (0.875rem); .candidate-card-stat-val to subheading (0.875rem)
– Promoted .candidate-name { min-width:0 } to styles.css (was duplicated in candidate.html + design-system.html)
– Rewrote design-system.html typography section: specimens use production classes; created .ds-demo-label class replacing ~15 inline-styled demo labels; added --ls-tight/--ls-expanded to token table
– CLAUDE.md typography section rewritten with named styles table and enforcement rule

Field notes:
The most interesting discovery was how many letter-spacing values existed. Seven different values between 0.02em and 0.14em, all doing the same job: "slightly spaced small uppercase label." Nobody chose seven — they accumulated, one component at a time, each author picking a number that looked right in isolation. The same thing was happening with font-sizes: 1.1rem, 1.2rem, 1.25rem, 1.3rem — four sizes that are visually indistinguishable at screen distance. The consolidation wasn't about picking the "right" number. It was about deciding there should be one number instead of four. The named styles table in CLAUDE.md is the real deliverable — not because it documents what exists, but because it constrains what can be added next.

Stack tags: CSS custom properties · Typography system · Design tokens

## How Sloane steered the work
**"Align search hero to page title and eliminate the class"**
The opening move set the tone for the entire session. Rather than fixing the search hero's typography, eliminate the class entirely and use the shared pattern. That instinct — consolidate, don't customize — drove every decision that followed.

**Catching the cycle-select mismatch visually**
When the cycle select didn't match the tabs despite the CSS changes, Sloane caught it from a screenshot and pushed until the specificity issue was resolved. A developer might have accepted "the code looks right" — a designer checks whether it *looks* right.

**"What text uses 1.1rem, 1.2rem, 1.35rem, 1.3rem?"**
This question launched the font-size consolidation. Sloane didn't ask to fix a specific element — she asked for the full picture first. That's systems thinking: understand the landscape before making moves.

**"Should letter-spacing be em or rem? What's correct?"**
Rather than accepting the mixed units, Sloane asked for the reasoning. The answer (em for proportional tracking, rem for fixed display tightening) informed the var naming and meant the system was built on understanding, not just pattern-matching.

**"I'd like to limit it to ~10 clearly defined styles"**
This was the session's defining constraint. Not "clean up the typography" — "give me a number." The constraint forced real decisions: modal-title absorbs into subheading (0.875rem), committee-name bumps up to body-emphasis (0.875rem). Without the target count, each of those would have stayed as a comfortable one-off.

**"How can we avoid deviation in future sessions?"**
The final question shifted from execution to durability. The CLAUDE.md enforcement rule ("All text must use one of these 10 styles") is the direct result — a constraint that outlives the session.

The through-line: Sloane consistently treated typography as a *system* to be designed, not a collection of values to be cleaned up. Every question was framed at the system level — how many styles should exist, what units are correct, how do we enforce it — and the implementation followed from the constraints.

## What to bring to Claude Chat
– Typography review on live branch preview — The named styles are defined but need a visual check across all pages at desktop and mobile. Some size changes (modal-title 1rem→0.875rem, form-search-btn 0.75rem→0.875rem, nav-item 1rem→0.75rem) may feel too small or too large in context.
– Mono 0.75rem assessment — Deferred from this session. Several classes use IBM Plex Mono at 0.75rem (.committees-link, .form-input, .filter-bar) — this sits between label (0.625rem) and body (0.75rem Plex Sans). Should it stay as-is, or should those elements use Plex Sans body instead?
– committee-treasurer promotion — .committee-treasurer has no CSS rule in styles.css (only inline styles). Worth promoting as body style.
– The two hardcoded px values — body at 14px and .global-banner-text at 10px are outside the rem system. Worth discussing whether 14px is the right base.

---
2026-04-07

## Process log draft

Title: The spacing system gets a name — 9 tokens instead of 80 numbers

The redesign branch now has a real spacing system. Before this session, every padding, margin, and gap declaration in styles.css was a raw rem value — 0.85rem here, 0.6rem there, 0.3rem somewhere else. Some were clearly intentional; many were accumulated drift. This session replaced all of them with nine named tokens on an 8px grid, from --space-2 (2px, micro-only) to --space-64 (4rem, full-bleed states). The layout tokens that downstream code already used — --page-gutter and --section-gap — now reference the scale instead of raw values. The design system page's Spacing section, which was showing the old ad-hoc values as if they were a system, was rewritten to show the actual named tokens. The CLAUDE.md enforcement rule is explicit: no new raw rem spacing values in styles.css without a documented reason.

Changelog:
– styles.css: 9 --space-* tokens added to :root; --page-gutter → var(--space-48); --section-gap → var(--space-24); --header-h 52px → 48px; --banner-h 36px → 40px (net offset unchanged at 88px)
– styles.css: all padding/margin/gap declarations (~80+ values) replaced with --space-* tokens
– 4 documented --space-2 micro exceptions with inline comments; gap:1px in .stats-grid flagged; margin-bottom:-1px in .tab left as pixel border offset
– Mobile :root gutter override updated from literal 1rem to var(--space-16)
– design-system.html: Spacing section rewritten — 12 ad-hoc rows → 9 named token rows with var() labels; intro note and callout updated
– design-system.html: token table — new "Spacing scale tokens" group; --page-gutter/--section-gap updated with source token; --header-h/--banner-h added
– CLAUDE.md: spacing token system documented with scale table, named exceptions, enforcement rule; layout token block updated
– test-cases.md: test log row appended

Field notes:
The most interesting decision was what not to tokenize. gap:1px in .stats-grid is a hairline border technique — it creates the 1px dividing lines between stat cells using background-color bleed-through. Snapping that to --space-4 (4px) would have broken the visual. Same for margin-bottom:-1px in .tab, which is the active-tab border-overlap trick. The mapping table in the brief anticipated this: it covers rem values, not px micro-techniques. The system is strict about rem spacing and intentionally silent about px techniques. That distinction is worth keeping clear.

Stack tags: CSS custom properties · Design tokens · Spacing system

## How Sloane steered the work

**Arriving with a complete spec — not just a direction**
The opening prompt contained the full token scale, the exact mapping table with rem ranges, the exclusion list, and the edge case rule for micro values. That level of completeness meant the implementation was straight execution. The precision produced a cleaner audit than an open-ended "rationalize spacing" instruction would have.

**"Check spacing for block and inline styling on all pages" — naming the follow-on**
Explicitly scoping this session to styles.css only and naming the follow-on work before the session ended is clean triage. It means the next session starts from a clear boundary rather than having to figure out where this one stopped.

**Ending at the right moment**
Rather than opening the follow-on HTML audit in a context-pressured state, calling end-of-session correctly is the right call. A partial audit on six pages with incomplete documentation is worse than a complete audit on one file with clean docs.

The through-line: Sloane treats spacing as a system to be designed, not a list of numbers to be cleaned up. Arriving with a named token scale and a mapping table is the difference between a design decision and a cleanup task.

## What to bring to Claude Chat

- HTML inline style audit scope: every page has an inline <style> block with raw rem spacing values. Now that styles.css is clean, worth deciding: (a) audit all inline blocks to enforce tokens too, or (b) accept raw values in page blocks per the current "page-specific overrides" principle.
- --space-2 usage review: four call sites use the micro token (donor sub-label, tooltip value, stat cell gap, chip × button). Worth a visual check to confirm the 2px snap feels right vs. the original 0.10–0.15rem values.
- Spacing scale gap at 12px: nothing between --space-8 (8px) and --space-16 (16px). The old 0.75rem values were snapped to --space-8. If the visual needs a 12px step, --space-12 would be the next logical addition.

---
2026-04-07 end of session

## Process log draft
**The last raw values**

After landing the spacing token system in styles.css, I finished the job by sweeping every inline `<style>` block across all nine pages. No more raw rem values anywhere in the codebase — spacing is now fully tokenized, from the global stylesheet down to one-off page overrides. I also tracked down what was causing the brutal localhost lag: a render-blocking Amplitude script that was stalling every page load before a single pixel painted.

Changelog:
- Added `async` to the Amplitude session replay `<script>` tag on all 9 pages — was blocking HTML parsing on every load
- Added null guard in `main.js` for `sessionReplay.plugin()` — async load means it may not exist when Amplitude initializes
- Applied `--space-*` tokens to all inline `<style>` blocks: candidate.html, committee.html, race.html, search.html, design-system.html, process-log.html
- Applied user-provided off-grid mapping table (0.1–2rem → nearest token) to inline blocks and to any residual values in styles.css
- Collapsed shorthand padding when both values mapped to the same token
- Updated 3.5rem and 5rem spacings to `--space-64` (4rem) — hero section padding and section bottom margins now on-grid
- Documented one below-floor exception: `margin-top:0.05rem` on `.changelog-bullet` in process-log.html (0.8px text rendering nudge)
- Updated CLAUDE.md spacing token section to cover inline blocks, added the off-grid mapping table, expanded token usage descriptions

Field notes: The async fix was a good reminder that performance problems aren't always in your code. I'd been blaming CSS variable chain depth, or the font stack — none of it was the culprit. It was a third-party script in `<head>` without `async`, doing a full DNS + TLS roundtrip before the browser could paint anything. The null guard was the necessary follow-on: making something async without accounting for the race condition just trades one bug for another.

The inline block sweep was methodical in a satisfying way. Now the rule is simple: there are no raw rem spacing values anywhere in this codebase.

## How Sloane steered the work

**Naming the mapping instead of leaving it to judgment**
When we hit the off-grid values, you didn't let it be a case-by-case call. You handed me a precise mapping table: 0.1–0.2rem → space-4, 0.4–0.75rem → space-8, and so on. That's a product designer move: instead of living with a fuzzy rule, you defined it explicitly so it could be applied uniformly. The result is a codebase where "what does this spacing mean" has a clean answer.

**Treating 3.5rem and 5rem as intentional, not exceptions**
When I flagged that 3.5rem and 5rem didn't fit neatly into the token scale, you asked where they actually appeared in the UI before deciding. Once you understood the context — DS section bottom margins, the search hero state — you made a deliberate call: update them all to 4rem (--space-64). No special-casing, no footnoted exception. You extended the grid rather than accommodating the outliers.

**Async first, null guard as the required follow-on**
When I proposed adding async to the Amplitude script, you asked about drawbacks before approving. Approving both together rather than the fix in isolation kept the change complete.

The through-line: you're building rules that can be applied without judgment, not guidelines that require interpretation. Every decision this session moved toward fewer special cases and more explicit, enforceable constraints.

## What to bring to Claude Chat

- The inline block sweep is done. Is there anything left on the redesign branch that's "pre-systems" — CSS that predates the token system and hasn't been touched? Worth a pass before building new UI.
- The 10 named type styles are documented but haven't been audited against the live pages. Is a typography audit the right next step, or is there a more visible design goal to move toward first?
- The performance fix (async Amplitude) is live on the redesign branch. Should it be backported to main? It's a pure win — no design changes, just a perf improvement.

---
2026-04-07 End of session

## Process log draft

**Title:** "The nav that stopped fighting gravity"
**Date:** 2026-04-07
**Tags:** css, nav, design-system, typography, playwright

The fixed nav was a wall — everything had to account for it, compensate for it, push away from it. Switching to sticky changed the relationship: the banner scrolls out naturally, the nav anchors when it hits the top, and the page stops needing workarounds to feel right. A small architectural change that made ten other things simpler.

The search bar got the same treatment. The old pattern was a button right-of-input — fine in a vacuum, but the proportions never felt intentional. The icon-leading pattern (search icon inside the field, submit button visually hidden but keyboard-accessible) collapses the visual complexity: one unified input, the affordance is the icon, the action is Enter. Applied it consistently across nav, mobile nav, hero search, and both browse-page filter bars in one pass.

### Changelog
- Added brand color primitives: `--color-navy-950` (nav logo "Ledger") and `--color-red-700` (nav logo "FEC", also backs `--rep` and `--red`)
- Two-tone nav logo: `<span class="logo-fec">FEC</span><span class="logo-ledger">Ledger</span>`
- Global banner: moved before `<nav>` in DOM on all 9 pages; changed from `position:fixed` to in-flow; background `--color-navy-950`; height 32px; IBM Plex Mono label text, `--bg` color; removed `<strong>` wrapper
- Nav: switched to `position:sticky; top:0`; height 56px; no bottom border; padding `0 var(--space-32)`; inverted link states; active state = text color only
- Nav search: transparent/borderless input; icon-leading `.search-field` pattern
- Mobile nav/search top positions updated to `var(--header-h)` (banner no longer in fixed stack)
- `.main { padding-top }` removed from all pages (sticky nav is in-flow)
- Stale mobile padding-top overrides removed from races.html, process-log.html, design-system.html
- `.sr-only` utility and `.search-field` / `.search-field-icon` pattern added to `styles.css`
- Icon-leading search applied across all 9 pages: nav desktop, nav mobile, search.html hero, candidates/committees filter bars
- Playwright: +40 tests — 320 total

### Field notes
The DOM-order requirement for sticky positioning was the surprise of the session. The banner had always lived at the bottom of the body — irrelevant when it was fixed, fatal when it needed to be in flow above the nav. The fix was surgical: move the banner before the nav in all 9 files. What felt like a CSS problem was actually an HTML structure problem, which is the more honest version of most layout bugs.

## How Sloane steered the work

### "The banner should scroll away — not be dismissed"
The original brief said "fix the banner to scroll out above the sticky nav." That's a different contract than a dismissible banner or one that stays forever. You wanted the banner to feel like a physical part of the page — present on arrival, gone when you scroll past it, no interaction required. That shaped everything: the sticky nav architecture, the DOM reorder, removing all the offset padding. A clear UX intention drove a meaningful architectural change.

### Redirecting the search bar direction mid-spec
When asked about the nav search input width, you considered a width adjustment but recognized the real problem was the layout pattern, not the number. "Let's look at a different direction" — and proposed icon-leading search from scratch. That instinct (fix the pattern, not the value) is the difference between local patches and systematic improvement. The resulting pattern is simpler, more accessible, and consistent across every search surface on the site.

### "Wait until the end of session to commit"
When a mid-session commit was about to happen, you redirected: finish the work, then commit once. This keeps the session's intent coherent in git history — one commit, one story.

### No `<strong>` in the banner
Small but deliberate: removing `<strong>` from the banner text. Mono label type, all-caps via CSS, `--bg` color on navy: confident and quiet. Typographic weight is editorial judgment, not markup semantics.

The through-line: you're consistently choosing restraint — in hierarchy, in motion, in affordance. The redesign is becoming more minimal with each session, not through subtraction of features but through elimination of visual hedging.

## What to bring to Claude Chat

- **Banner content decision**: "The FEC, made legible" — is that the right permanent brand statement, or should it rotate/update as the product evolves? Worth deciding before public launch.
- **Search bar scope on nav**: Should nav search go to search.html with ?q= prefilled, or execute inline? The current behavior (redirect) is unverified — worth a gut check on intended UX.
- **Sticky nav on mobile**: Banner is now in-flow, so mobile users see the 32px banner before the nav sticks. Should the banner be hidden ≤860px?
- **Next redesign priority**: Nav and banner are done. Highest-leverage visual surface next: page headers/hero states, card/row visual treatment, or typography specimens in design-system.html?
---
2026-04-07 end of session

## Process log draft

Title: Small fixes, global reach

Most of this session was fixing work that was almost right. The browse-page search buttons were still visible — the icon-leading pattern from last session had been applied to the nav and the hero search, but the filter bar inputs on candidates.html and committees.html were missed. The fix was surgical: move the button inside .search-field, add sr-only, and remove the border-right:none that had been holding space for the visible button. Small, but it matters — a stray button in a filter bar undercuts the whole visual system.

The second half was about follow-through on the nav search typeahead. We'd built it for search.html last session, but it only worked there because the logic was stranded in a page-level inline script. Making it global meant identifying what actually belongs in main.js (officeWord, buildTypeaheadHTML, the show/hide/do cycle, the input wiring) versus what stays page-specific (the __navSearchHandler hook search.html uses to fire inline results instead of redirecting). The architecture question — "does something need to move?" — produced a cleaner outcome than the initial search.html-only implementation.

Changelog:
– candidates.html + committees.html: filter bar search button moved inside .search-field, sr-only applied, SVG removed from button
– styles.css: removed border-right:none from .search-combo .form-input
– search.html #search-input: added role=combobox, aria-haspopup=listbox, aria-expanded (toggled by show/hideTypeahead), aria-controls=typeahead-dropdown, aria-autocomplete=list
– main.js: officeWord + buildTypeaheadHTML moved from search.html; show/hide/doNavTypeahead + navTypeaheadTimer added; bindSearchForm updated with window.__navSearchHandler hook; nav input event wiring (debounce, Escape, click-outside)
– All 9 pages: position:relative on .top-nav-search; #nav-typeahead-dropdown added
– search.html: stripped nav typeahead code (now in main.js); added window.__navSearchHandler to fire inline doSearch on submit
– +11 Playwright tests

Field notes: The clone-the-form approach from the first pass (wireNavSearch) was the right call for a page-specific fix but the wrong architecture for something global. The __navSearchHandler hook is cleaner — main.js stays unaware of search.html internals, and search.html registers its override at load time. The lesson is familiar: the first implementation that works isn't always the one you keep.

Stack tags: accessibility · ARIA · progressive enhancement

## How Sloane steered the work

**"I still see the search button on the browse pages"**
Rather than accepting last session's work as done, you checked the actual result and caught what the implementation missed. The icon-leading pattern had been applied inconsistently — nav and hero correct, filter bar missed. The precise bug report made the diagnosis immediate.

**Accessibility additions as explicit specifications**
The ARIA attribute additions for #search-input were specified exactly — attribute names, values, and the three JS sites to update. That precision meant zero interpretation overhead and zero rework.

**"For attribute on filter labels doesn't match trigger IDs" — then verifying it was fine**
Catching a potential bug and asking to verify before assuming it's broken. The outcome (all labels correctly matched) is less interesting than the instinct — don't assume, check first.

**"Let's make this fix global"**
After the search.html nav typeahead landed, immediately asking whether it should be global. This isn't a feature request — it's a recognition that a page-specific fix is incomplete when the element exists on every page. The follow-on question ("does something need to move?") correctly framed the architecture question.

**Option B on keyboard accessibility**
Rather than adding open-on-focus behavior that would technically improve WCAG AA compliance, you accepted the honest analysis: Space and Enter already work via native button behavior, and open-on-focus is optional.

The through-line: you're catching the gap between "it works somewhere" and "it works everywhere," and you're making the distinction between a patch and a fix.

## What to bring to Claude Chat

– Mobile nav search typeahead: the desktop nav now has a functioning typeahead; the mobile search panel (#top-nav-mobile-search) does not. Worth deciding whether mobile gets the same treatment before the next visual session, or whether it's lower priority.

– Next redesign visual priority: the token system is fully clean (spacing, typography, color). What's the highest-leverage visual surface to tackle next? Page headers/hero states, card/row treatment, or something else?

– FEC API outage: today's outage had no impact on this session (all work was structural/JS/CSS, smoke tests skipped). Worth noting for the next session if smoke tests need to be re-run.

---
2026-04-07 end of session (2)

## Process log draft

Title: The border that wouldn't break free

Three approaches to one visual goal: make the tabs-bar border span the full viewport width. The negative margin breakout was clipped by overflow-x:hidden on .main. Moving tabs-bar outside .main-inner didn't align tab content with the rest of the page at wide viewports. The solution that stuck was both: move tabs-bar outside .main-inner (so the border naturally spans .main's full width), then use a responsive max() padding formula that matches .main-inner's centering math at any viewport size. A CSS problem that required understanding the full containment chain before writing a single line.

The tabs-bar also got a visual overhaul in the same session — navy-950 border, red-700 active indicator, tighter padding, gap-based spacing, and the cycle select pushed to the right end of the bar.

Changelog:
– styles.css: .tabs-bar border updated to 2px solid --color-navy-950; responsive max() padding for full-bleed border with aligned content; gap:var(--space-16) between tabs
– styles.css: .tab padding reduced to --space-4 vertical only; colors updated to --color-navy-950 (default/active) and --muted (hover); active indicator 4px --color-red-700 (was 2px --accent)
– styles.css: .cycle-select margin-left:auto (pushes right), color --color-navy-950
– candidate.html + committee.html: .tabs-bar moved outside .main-inner to direct child of .main; cycle select reordered to last child
– design-system.html: both tabs-bar demos updated (select order + token usage descriptions for navy-950 and red-700)
– CLAUDE.md: tabs-bar architecture documented (placement, responsive padding formula, cycle-select position)
– test-cases.md: cycle switcher position updated, full-viewport border check added, test log row appended

Field notes:
The session was a study in constraint surfacing. The first approach (negative margins) seemed textbook — it's the standard CSS breakout pattern — but overflow-x:hidden on .main killed it silently. The second approach (HTML restructure) was architecturally sound but created a content alignment gap at wide viewports that wasn't visible at normal screen sizes. The third approach combined the HTML move with a padding formula that mirrors .main-inner's centering logic: max(page-gutter, (100% - 1600px) / 2 + page-gutter). Each failed attempt narrowed the problem until the right solution was obvious. Sometimes the fastest path is through two wrong answers.

Stack tags: CSS layout · containment · responsive padding

## How Sloane steered the work

**"I still see the search button" — QA as design enforcement**
Last session's icon-leading search pattern was caught as incomplete on the browse pages. This session's tabs-bar work followed the same pattern: Sloane QA'd the Netlify preview and caught when the negative margin approach wasn't producing the expected result, rather than accepting it.

**Diagnosing before prescribing**
After two failed approaches, instead of guessing at a third, Sloane asked for a diagnostic pass — inspect the actual computed layout, find what's blocking the border, then propose a solution. That shifted the work from trial-and-error to systematic debugging.

**"Should the --page-gutter padding be applied?"**
This question caught a real alignment bug in the max() formula before it shipped. At viewports > 1600px, the tab content would have been offset from page content by exactly one page-gutter. The fix was adding var(--page-gutter) inside the calc — a one-line change that would have been a visible misalignment on ultrawide monitors.

**Knowing when to revert**
Two deliberate reverts in one session — the full-bleed layout restructure (too much structural change for the goal) and the .main-inner split (QA'd the wrong URL, then asked to undo cleanly). Both reverts were decisive, not hesitant. Better to undo cleanly than accumulate structural debt from an approach that isn't working.

**"What documentation do we need to update?"**
Asked proactively after the code stabilized, covering tests, test-cases.md, and design-system.html in one sweep. The habit of treating documentation as part of the deliverable, not an afterthought.

The through-line: Sloane treats visual QA as a first-class constraint — if it doesn't look right on the preview, the code isn't done, regardless of what the tests say.

## What to bring to Claude Chat

– Full-bleed pattern for other elements: the tabs-bar now breaks out of .main-inner for full-viewport border. Should page-header, filter-bar-wrap, or other chrome elements follow the same pattern on the redesign branch? Worth deciding the rule before applying case-by-case.

– Tab bar visual refinement: the active indicator is now 4px red-700. On the preview, check whether the indicator weight feels right relative to the 2px navy border — the 2:1 ratio is intentional but worth eyeballing at different viewport sizes.

– Next redesign priority: tabs-bar is styled, nav is styled, spacing/typography tokens are clean. What's the next highest-leverage visual surface? Cards/rows, page headers, or something else?

---
2026-04-07 end of session (3)

## Process log draft

Title: Stripping it back

Three removals in one session — heading weight dropped from 600 to 400, breadcrumbs deleted sitewide, avatar pulled from the candidate header. None of these were broken; they were just in the way of the redesign taking shape. The heading weight change was surgical (four CSS declarations). The breadcrumb removal was the deepest cut — markup on three pages, a JS function with three call sites, four CSS rules, three Playwright tests, and references scattered across six documentation files. The avatar was similar but smaller. Each removal required tracing every reference through code, tests, and docs to make sure nothing was left dangling.

Changelog:
– Heading type style: Oswald weight 600 → 400 across styles.css, design-system.html, process-log.html (.entry-title was 700, also corrected), CLAUDE.md
– Breadcrumbs removed from candidate.html (markup + updateBreadcrumb() + 2 call sites), committee.html (markup + JS binding), race.html (markup + JS binding)
– Breadcrumb CSS rules removed from styles.css; inline overrides removed from design-system.html
– 3 breadcrumb Playwright tests removed (candidate.spec.js × 2, pages.spec.js × 1); committee nav test updated to scope to .top-nav
– Avatar removed from candidate.html (markup + .avatar CSS + getInitials() function + getElementById call)
– 1 avatar Playwright test removed from candidate.spec.js
– Avatar CSS + demo removed from design-system.html
– All breadcrumb and avatar references cleaned from CLAUDE.md, project-brief.md, test-cases.md, design-system.html, TESTING.md
– Test count: 333 → 329 (4 tests removed, 0 added)

Field notes: Removal sessions are unglamorous but they expose how well-threaded your documentation is. Every breadcrumb reference in CLAUDE.md, test-cases.md, project-brief.md, and design-system.html had to be found and pulled. The fact that the documentation was thorough enough to have all those references is a sign the system is working — but it also means cleanup isn't just deleting code, it's editing six files of prose. The design system is earning its keep as a contract: if you add something to the system, you'll have to remove it from the system too.

Stack tags: CSS · cleanup · design system maintenance

## How Sloane steered the work

**Three precise removals, no debate**
Each request was a single sentence with clear scope — "update heading weight to 400", "remove breadcrumbs sitewide", "remove the .avatar div entirely." No ambiguity about what to do or why. The redesign direction is clear enough that these decisions didn't need justification; they're consequences of a visual direction that's already been established over multiple sessions.

**Commit-and-push cadence**
After each discrete change, immediate "commit and push" — no batching, no waiting to see if the next change might conflict. This keeps the branch preview current and makes each change independently reviewable on Netlify.

The through-line: you're editing the design by subtraction — removing elements that don't earn their place in the new visual system, and doing it decisively.

## What to bring to Claude Chat

– The candidate header is now name + tags + committees link, no avatar. Worth checking the Netlify preview to see if the header feels balanced without the avatar at different viewport sizes, or if something else should anchor the left side.
– Next redesign surface: with nav, tabs bar, typography, spacing, and now header cleanup all done — what's the next highest-leverage visual target? Cards/rows, the stats grid, chart styling, or the overall page chrome?
– The heading weight at 400 is noticeably lighter than before. Check the preview to confirm it reads well for the nav logo and error states — if it feels too light, 500 might be the sweet spot (would require adding weight to the Google Fonts import).

---
2026-04-08 End of session

## Process log draft

Title: The type system, fully audited

Date: 2026-04-08
Tags: css, typography, design-system, cleanup

What started as a single correction — the logo inheriting the wrong weight after last session's heading update — became a full audit of every font-family declaration in the codebase. The Oswald audit from last session was thorough but only covered one family. Sweeping IBM Plex Mono and Sans revealed a second layer of drift: hardcoded sizes that predated the named type system, rules missing weights, and inline style blocks on individual pages duplicating what belonged in styles.css.

The audit surfaced about a dozen corrections across both styles.css and inline blocks in six HTML files. Most were straightforward mappings to existing named styles. A few required judgment calls — modal-title to heading, modal-tab-btn to body-emphasis, committees-link from Mono to body. Each decision is now reflected in the type specimen usage lists in design-system.html, which had never been updated to track actual component usage.

The session also resolved a long-standing layout tension in the race context bar: the "View race →" link now sits inline with the sentence on wide viewports (pill hugs content via width:fit-content) and right-aligns via margin-left:auto when the sentence wraps on narrow screens.

### Changelog
- `.top-nav-logo` weight restored to 600 — documented deviation from heading style (400)
- `.top-nav-inner` padding updated from `--space-32` to `--page-gutter` for content alignment
- Type audit — styles.css: `.modal-title`, `.banner-label`, `.chart-title`, `.donors-head`, `.donors-table .da`, `.donut-center-val`, `.candidate-card-stat-val`, `.retry-btn`, `.committees-link`, `.modal-tab-btn` all corrected to named type styles; `.form-search-btn` font properties stripped (sr-only, never rendered)
- Type audit — inline blocks: `race.html` `.race-meta` + `.year-select`, `committee.html` `.back-link-area a`, `process-log.html` `.view-btn` → body; `search.html` `.no-results strong` → heading
- `.results-header` promoted from three duplicate inline blocks to `styles.css`
- `.cycle-select` stray `margin-right:var(--space-16)` removed
- `.tag-context` layout: `display:flex; width:fit-content; max-width:100%; flex-wrap:wrap` — hugs content on wide viewports, right-aligns link on narrow via `margin-left:auto` on `.tag-context a`
- design-system.html: all type specimen usage lists updated; search combo demos updated to icon-leading pattern; tag-context component demo and notes updated; form controls classes updated
- CLAUDE.md end-of-session ritual: design-system.html audit expanded to four explicit sub-items (token table, type specimen lists, component demos, component notes)
- +1 Playwright test: tag-context flex structure (`.tag-context-text` + `<a>`)

### Field notes
The type audit exposed something structural: the design system reference and the actual CSS had diverged silently. The specimen usage lists in design-system.html were never treated as a living record — they documented what was true when each component was first built, then stopped being updated. The fix wasn't just correcting the CSS; it was establishing that the usage lists need to be maintained like code. That's now written into the end-of-session ritual with specific instructions, so future sessions have a checklist rather than a vague directive.

## How Sloane steered the work

**"The logo was impacted" — catching an unintended consequence**
Last session's heading weight change was intentional for content headings but knocked the logo weight down as a side effect. You caught it on inspection and named it precisely: return the logo to 600, document it as a deviation. That framing — "this is a deliberate exception, not a bug" — is exactly the right way to handle type system divergences.

**Pushing the audit further each time**
After fixing the modal title, you asked: "Do we need a second audit for other cases like this?" After fixing the Oswald cases, you asked: "Let's do a pass on all font families." Each question extended the scope at the right moment — not speculatively up front, but after seeing evidence that more existed. The result was a genuinely complete audit rather than a patchwork of individual fixes.

**Judgment calls on every type mapping**
You made every mapping decision: modal-tab-btn to body-emphasis, committees-link to body, .no-results strong to heading, .donors-table .da to subheading, .donut-center-val to heading. These weren't defaults — each one required reading the component in context and choosing the right register.

**"There's no reason for race.html to have that slight variation"**
When .results-header had a spacing difference between pages, you cut the variation rather than preserving it. Simpler system, one fewer divergence to track.

**Race context layout — three iterations to the right answer**
The "View race →" link went through three CSS approaches before landing. You tested each on the preview, described exactly what was wrong, and gave a clear direction each time. "I want them to sit side-by-side but not have the entire module appear full-width" was a precise enough brief that it pointed directly to the CSS solution.

**Strengthening the end-of-session ritual**
Rather than accepting that documentation keeps getting missed, you asked for the ritual itself to be improved — identifying the root cause (vague instructions) and fixing the process rather than just the current gap.

The through-line: you're treating the design system as a contract, not a reference — when something drifts from it, the fix includes updating the contract, not just the code.

## What to bring to Claude Chat

- **Type system is now fully audited** — every font-family declaration maps to a named style or documented deviation. Worth noting as a milestone before moving to the next visual surface.
- **Next redesign priority** — nav, tabs bar, typography, spacing, and header cleanup are all done. What's the next highest-leverage surface: cards/rows, stats grid, or something else?
- **Race context bar padding** — now that the pill hugs its content, the `#race-context-bar` padding may need a look at different breakpoints. Worth eyeballing on the preview.

---
2026-04-08 End of session (2)

## Process log draft

Title: Headers with intent

This session gave profile headers a clear visual hierarchy — race context above the name, not beside it. The work introduced a new formatting function (formatRaceLabelLong) shared across three pages, restructured the race page to finally have a tabs bar, and cleaned up the committee header. The most consequential moment was discovering mid-session that removing fetchAndRenderBackLink() would also kill the assoc-section card — a dependency that wasn't visible from the function name or its call site alone.

Changelog:
– utils.js: STATE_NAMES (50 states + DC), toOrdinal(), formatRaceLabelLong() — long-form race labels for profile headers
– candidate.html: .candidate-race-label above name (red-700, Oswald uppercase, links to race page); race tag removed from meta-row; party tag only remains
– styles.css: .page-title color → var(--color-navy-950) sitewide
– race.html: long-form title via formatRaceLabelLong(); tabs bar (Candidates/Insights) with split main-inner structure; year-select moved into tabs bar; Senate class label → #race-seat-class in tabs bar; candidate count removed; showTab() added
– committee.html: #back-link-area removed from header and CSS; fetchAndRenderBackLink() split into fetchAndRenderAssocSection() — back-link gone, assoc-section card in Summary tab preserved
– CLAUDE.md, design-system.html, test-cases.md: fully updated
– Tests: 330 → 341 (+11 new, 2 stale corrected)

Field notes: The flag-before-proceeding pattern paid off. "fetchAndRenderBackLink does two things" — that came from reading the whole function body before removing it, not just the name and the call site. The rule is simple: when removing a function, read the full implementation. A function name tells you what it was intended to do; the body tells you what it actually does. In this case, those were different.

Stack tags: CSS · JavaScript · refactor · design system

## How Sloane steered the work

**"Confirm branch" as a standing gate**
Every prompt opened with an explicit branch check. This isn't just a safety check — it signals that the redesign branch is intentional and protected, and that no change lands without a visible stop. The discipline is the message.

**"Read race.html fully before making changes"**
Rather than trusting prior knowledge of the file, you required a complete read before touching anything. That's what surfaced the fetchAndRenderBackLink dependency — a connection that wouldn't have appeared from a partial read or a targeted grep.

**The flag-and-respond pattern**
When flagged about the assoc-section: "Shit. I just saw your flag. Can you revert?" — immediate, clear, no ambiguity. And the correction was precise: not a full revert but a surgical fix that preserved the assoc-section while removing the back-link. That's a different thing than reverting.

**"Update to tab text style" — working from the system**
Rather than specifying pixel values, you referenced the named type style. That's working from the design system, not around it. It means the change is self-documenting and consistent with everything else in the tabs bar.

**Scope discipline throughout**
Every prompt had an explicit scope statement: "No other header changes this session", "No global styles changes this session", "No page changes this session." These constraints kept each piece of work from bleeding into adjacent work before it was solid. The redesign is a sequence of intentional changes, not a free-form refactor.

The through-line: you're managing the redesign like a directed series of commits — each one scoped, confirmed, and closed before the next begins. The flag response ("Shit. I just saw your flag.") shows that the discipline holds even when it creates a detour. That's how complex redesigns stay coherent across sessions.

## What to bring to Claude Chat

– Insights tab on race.html is a coming-soon placeholder. What belongs there eventually — IE data, AI-generated race narrative, aggregate committee spending, something else? Worth deciding before it becomes a build prompt.
– Candidate header on mobile: .candidate-race-label is now a full line above the name. Worth checking the Netlify preview at narrow viewports to confirm it wraps gracefully and the spacing feels right.
– Committee header next steps: back-link is gone, assoc-section intact. Does committee.html need its own long-form label treatment (parallel to candidate.html and race.html), or is the committee name sufficient as the primary header identifier?
– The redesign branch now has substantially different header structure across all three profile pages. Is there a milestone at which some or all of this gets merged to main, or does the redesign branch stay separate until a full visual pass is complete?
