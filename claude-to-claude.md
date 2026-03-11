# claude-to-claude.md
*A running log of session handoffs — appended automatically by Claude Code at the end of every session. Bring this file to Claude Chat when you need context on recent sessions.*

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
