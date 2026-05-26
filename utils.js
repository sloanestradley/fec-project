/**
 * utils.js — Shared utilities for ledger.fec
 *
 * Loaded by every page via <script src="utils.js"></script> (after main.js,
 * before the page's own inline <script> block).
 *
 * Only genuinely shared, page-agnostic utilities live here.
 * Page-specific logic stays in each page's own <script> block.
 */

// ── FEC API config ───────────────────────────────────────────────────────────

var BASE = '/api/fec';

// The FEC API rejects keyword (`q=`) searches shorter than 3 characters
// ("Invalid keyword. The keyword must be at least 3 characters in length.").
// Shared by initSearchPanel's query guard and the browse-page submit guard so
// there is one named source for the rule. Do not lower to 2.
var FEC_MIN_KEYWORD_LENGTH = 3;

// ── API fetch (concurrency-limited) ──────────────────────────────────────────

var MAX_CONCURRENT = 4;
var _inFlight = 0;
var _queue = [];

function _drain() {
  while (_inFlight < MAX_CONCURRENT && _queue.length > 0) {
    var item = _queue.shift();
    _execute(item.path, item.params, item.resolve, item.reject);
  }
}

function _execute(path, params, resolve, reject) {
  _inFlight++;
  var p  = params || {};
  var qs = Object.keys(p).map(function(k) {
    var v = p[k];
    if (Array.isArray(v)) return v.map(function(item) { return k + '=' + encodeURIComponent(item); }).join('&');
    return k + '=' + encodeURIComponent(v);
  }).join('&');
  fetch(BASE + path + '?' + qs).then(function(res) {
    if (!res.ok) throw new Error('FEC ' + res.status + ' — ' + path);
    return res.json();
  }).then(function(data) {
    _inFlight--;
    _drain();
    resolve(data);
  }).catch(function(err) {
    _inFlight--;
    _drain();
    reject(err);
  });
}

function apiFetch(path, params) {
  return new Promise(function(resolve, reject) {
    if (_inFlight < MAX_CONCURRENT) {
      _execute(path, params, resolve, reject);
    } else {
      _queue.push({ path: path, params: params, resolve: resolve, reject: reject });
    }
  });
}

// ── Tab-error UI helpers (T12.5) ─────────────────────────────────────────────
// Detects FEC API rate-limit errors thrown by apiFetch (which surfaces non-2xx
// status as `'FEC ' + status + ' — ' + path`). Used by tab-error rendering on
// candidate.html and committee.html to swap copy + hide the retry button.
function is429(err) {
  return !!(err && err.message && /\bFEC 429\b/.test(err.message));
}

// Shared copy strings for the tab-error UI variants. 429 vs init-stage non-429
// vs everything else. Defined once here so future copy edits don't drift across
// files. Each per-tier render error branch falls through to its own
// retry-button copy when neither variant matches.
var TAB_ERROR_RATE_LIMIT_MSG  = '⚠ FEC API rate limit reached. Please wait a minute, then reload the page.';
var TAB_ERROR_INIT_FAILURE_MSG = "⚠ Couldn't load this page. Please reload to try again.";

// ── Formatting ───────────────────────────────────────────────────────────────

// Compact dollar format: $3.5M, $450K, $950
function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  var abs = Math.abs(n);
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(n).toLocaleString();
}

// Strip timestamps: "2024-07-15T00:00:00" → "Jul 15, 2024"
function fmtDate(s) {
  if (!s) return '';
  var d = s.split('T')[0].split('-');
  if (d.length < 3) return s.split('T')[0];
  var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return M[parseInt(d[1]) - 1] + ' ' + parseInt(d[2]) + ', ' + d[0];
}

// ── Name utilities ───────────────────────────────────────────────────────────

// FEC names are "LAST, FIRST MIDDLE" — convert to "First Last"
function toTitleCase(name) {
  if (!name) return '';
  var parts = name.split(',');
  var last  = (parts[0] || '').trim().toLowerCase().replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  var first = (parts[1] || '').trim().toLowerCase().replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  return first ? first + ' ' + last : last;
}

// Semantic alias for rendering candidate names at call sites
function formatCandidateName(n) { return toTitleCase(n); }

// ── Party utilities ──────────────────────────────────────────────────────────

function partyClass(p) {
  if (!p) return 'tag-neutral';
  var u = p.toUpperCase();
  if (u === 'DEM' || u.startsWith('DEMOCRAT')) return 'tag-dem';
  if (u === 'REP' || u.startsWith('REPUBLICAN')) return 'tag-rep';
  return 'tag-ind';
}

function partyLabel(p) {
  if (!p) return 'Party N/A';
  var naGroup = ['NNE','NON','UNK','OTH','NPA','UN','W','O'];
  if (naGroup.indexOf(p.toUpperCase()) !== -1) return 'Party N/A';
  var map = { DEM: 'Democrat', REP: 'Republican', LIB: 'Libertarian', GRE: 'Green Party', IND: 'Independent' };
  var u = p.toUpperCase();
  if (map[u]) return map[u];
  if (u.startsWith('DEMOCRAT'))   return 'Democrat';
  if (u.startsWith('REPUBLICAN')) return 'Republican';
  return p; // raw code fallback for unmapped named parties
}

// Returns a title attribute value for a party tag.
// Named parties: shows party_full title-cased (e.g. "Republican Party").
// N/A bucket: explains why.
// party_full comes from the API as ALL CAPS — title-case it before display.
function partyTooltip(p, party_full) {
  if (!p) return 'No party affiliation on file';
  var naGroup = ['NNE','NON','UNK','OTH','NPA','UN','W','O'];
  if (naGroup.indexOf(p.toUpperCase()) !== -1) return 'No party affiliation on file';
  if (party_full) {
    return party_full.charAt(0).toUpperCase() + party_full.slice(1).toLowerCase();
  }
  var fallback = { DEM: 'Democratic Party', REP: 'Republican Party', LIB: 'Libertarian Party', GRE: 'Green Party', IND: 'Independent' };
  return fallback[p.toUpperCase()] || '';
}

// ── Race utilities ───────────────────────────────────────────────────────────

// Format a race name for display: 'House • WA-03', 'Senate • NY', 'US President'
function formatRaceName(office, state, district) {
  if (office === 'P') return 'US President';
  var officeNames = { H: 'House', S: 'Senate' };
  var officeName  = officeNames[office] || office || '';
  var districtStr = (office === 'H' && district && district !== '00') ? '-' + district : '';
  return officeName + ' \u2022 ' + (state || '') + districtStr;
}

// ── State name lookup ────────────────────────────────────────────────────────

var STATE_NAMES = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
  CO:'Colorado', CT:'Connecticut', DE:'Delaware', DC:'District of Columbia',
  FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois',
  IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky', LA:'Louisiana',
  ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota',
  MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada',
  NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NY:'New York',
  NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma', OR:'Oregon',
  PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota',
  TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia',
  WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming'
};

function toOrdinal(n) {
  var i = parseInt(n, 10);
  var mod100 = i % 100;
  var mod10  = i % 10;
  if (mod100 >= 11 && mod100 <= 13) return i + 'th';
  if (mod10 === 1) return i + 'st';
  if (mod10 === 2) return i + 'nd';
  if (mod10 === 3) return i + 'rd';
  return i + 'th';
}

// Format a long-form race label for profile page headers:
//   'H', 'WA', '03' → "US House: Washington's 3rd District"
//   'S', 'WA', ''   → "US Senate: Washington"
//   'P', '', ''     → "US Presidential"
//   'H', 'AK', '00' → "US House: Alaska"  (at-large — omit district)
function formatRaceLabelLong(office, state, district) {
  if (office === 'P') return 'US Presidential';
  var stateName = STATE_NAMES[state] || state || '';
  if (office === 'S') return 'US Senate: ' + stateName;
  // House
  if (!district || district === '00') return 'US House: ' + stateName;
  return 'US House: ' + stateName + '\u2019s ' + toOrdinal(district) + ' District';
}

// Build a /race URL. Two cases that the prior inline construction
// (candidate.html ~1824) got wrong are encoded here:
//   - Presidential: state must be 'US' (race.html otherwise reports
//     "No race specified" with an empty state param)
//   - At-large House (district === '00'): district MUST be sent
//     explicitly \u2014 race.html's /elections/ call 422s when it's omitted
//     for a House race
function raceHref(office, state, district, year) {
  if (office === 'P') {
    return '/race?state=US&office=P&year=' + year;
  }
  var url = '/race?state=' + encodeURIComponent(state || '')
          + '&office='   + encodeURIComponent(office || '')
          + '&year='     + year;
  if (office === 'H') {
    url += '&district=' + (district || '00');
  }
  return url;
}

// ── Committee utilities ──────────────────────────────────────────────────────

function filingFrequencyLabel(code) {
  var map = { A: 'Administratively Terminated', D: 'Debt', M: 'Monthly Filer',
              Q: 'Quarterly Filer', T: 'Terminated', W: 'Waived' };
  return map[code] || code || '—';
}

function filingFrequencyDotClass(code) {
  return (code === 'T' || code === 'A') ? 'dot-terminated' : 'dot-active';
}

function committeeTypeLabel(t) {
  var map = {
    P: 'Principal Campaign Committee',
    J: 'Joint Fundraising Committee',
    D: 'Leadership PAC',
    O: 'Super PAC',
    Q: 'PAC — Qualified',
    N: 'PAC — Non-Qualified',
    V: 'Hybrid PAC',
    H: 'House Candidate Committee',
    S: 'Senate Candidate Committee',
    Y: 'Party Committee',
    I: 'Independent Expenditure (Non-Contribution)',
    U: 'Single Candidate IE',
  };
  return map[t] || ('Type ' + t);
}

// Shared candidate card markup. Single source of truth for the canonical 3-tag
// shape rendered on candidates.html and search.html (race tag + party tag +
// latest-cycle tag, in that order). Whole-card link semantics (the <a> is the
// card itself), hover/border/spacing via .candidate-card + .candidate-card-meta
// CSS. race.html uses .candidate-card directly with a structural variant (tags
// inline in name + .candidate-card-stats below) and does NOT use this helper.
//
// opts:
//   fromPage       — string, used for ?from= URL param + amplitude from_page
//   resultPosition — int, position in list (logged in amplitude)
//   query          — optional string, logged in amplitude (search context)
//   includeName    — bool, defaults to true; include candidate_name in amplitude
//                    payload (set false to omit)
//   trackEvent     — defaults to 'Candidate Result Clicked' (aggregates across
//                    callers in dashboards; from_page distinguishes context)
function candidateCardHTML(c, opts) {
  opts = opts || {};
  var fromPage = opts.fromPage || 'candidate-card';
  var name     = formatCandidateName(c.name);
  var pcls     = partyClass(c.party || c.party_full);
  var plbl     = partyLabel(c.party || c.party_full);
  var ptt      = partyTooltip(c.party, c.party_full);
  var office   = formatRaceName(c.office, c.state, c.district);
  var latestCycle = c.election_years && c.election_years.length
    ? Math.max.apply(null, c.election_years) : '';
  var trackProps = { candidate_id: c.candidate_id, from_page: fromPage };
  if (opts.includeName !== false) trackProps.candidate_name = name;
  if (opts.resultPosition != null) trackProps.result_position = opts.resultPosition;
  if (opts.query) trackProps.query = opts.query;
  var trackName = opts.trackEvent || 'Candidate Result Clicked';
  return '<a class="candidate-card" href="/candidate/' + c.candidate_id + '?from=' + encodeURIComponent(fromPage) + '"'
    + ' onclick="amplitude.track(' + JSON.stringify(trackName) + ',' + JSON.stringify(trackProps) + ')">'
    + '<div class="candidate-card-name">' + name + '</div>'
    + '<div class="candidate-card-meta">'
    + (office ? '<span class="tag tag-neutral">' + office + '</span>' : '')
    + (latestCycle ? '<span class="tag tag-neutral">' + latestCycle + '</span>' : '')
    + '<span class="tag ' + pcls + '" title="' + ptt + '">' + plbl + '</span>'
    + '</div></a>';
}

// Shared committee row markup. Single source of truth for the row shape rendered
// on candidates' committee modal, /committees browse, and /search results. All
// callers get the same hover/border/spacing via .committee-row + .committee-card-meta
// CSS, with whole-row link semantics (the <a> is the row itself).
//
// opts:
//   fromPage       — string, used for ?from= URL param + amplitude from_page
//   resultPosition — int, position in list (logged in amplitude)
//   query          — optional string, logged in amplitude (search context)
//   trackEvent     — defaults to 'Committee Result Clicked' (aggregates across
//                    callers in dashboards; from_page distinguishes context)
function committeeRowHTML(c, opts) {
  opts = opts || {};
  var fromPage  = opts.fromPage || 'committee-row';
  var dotCls    = filingFrequencyDotClass(c.filing_frequency);
  var freqLbl   = filingFrequencyLabel(c.filing_frequency);
  var trackProps = { committee_id: c.committee_id, from_page: fromPage };
  if (opts.resultPosition != null) trackProps.result_position = opts.resultPosition;
  if (opts.query) trackProps.query = opts.query;
  var trackName = opts.trackEvent || 'Committee Result Clicked';
  // Off-office PCC tag: fires only when caller passes opts.referenceOffice (today,
  // only candidate.html modal does — see "*Active from a prior candidacy" footnote).
  // Gate on designation==='P' and a known H/S/P committee_type so the tag is bounded
  // to candidate-office committees.
  var offOfficeTag = '';
  if (opts.referenceOffice
      && c.designation === 'P'
      && (c.committee_type === 'H' || c.committee_type === 'S' || c.committee_type === 'P')
      && c.committee_type !== opts.referenceOffice) {
    offOfficeTag = '<span class="tag tag-transparent">*Active from a prior candidacy</span>';
  }
  return '<a class="committee-row" href="/committee/' + c.committee_id + '?from=' + encodeURIComponent(fromPage) + '"'
    + ' onclick="amplitude.track(' + JSON.stringify(trackName) + ',' + JSON.stringify(trackProps) + ')">'
    + '<div class="committee-name">' + (c.name || '—') + '</div>'
    + '<div class="committee-card-meta">'
    + '<span class="tag tag-neutral">' + committeeTypeLabel(c.committee_type) + '</span>'
    + '<span class="tag tag-neutral"><span class="status-dot ' + dotCls + '"></span>' + freqLbl + '</span>'
    + offOfficeTag
    + '</div>'
    + '</a>';
}

// ── Shared chart color palette ────────────────────────────────────────────────
// Used by any page with Chart.js charts (candidate.html, committee.html, etc.)
var CHART_COLORS = (function() {
  var s = getComputedStyle(document.documentElement);
  var v = function(name) { return s.getPropertyValue(name).trim(); };
  return {
    raised:           v('--chart-raised'),
    raisedSolid:      v('--chart-raised-solid'),
    spent:            v('--chart-spent'),
    spentSolid:       v('--chart-spent-solid'),
    coh:              v('--chart-coh'),
    cohSolid:         v('--chart-coh-solid'),
    spentBar:         v('--chart-spent-bar'),
    overlayToday:     v('--chart-overlay-today'),
    tooltipBg:        v('--surface'),
    tooltipTitle:     v('--muted'),
    tooltipBody:      v('--text'),
    tooltipBorder:    v('--border'),
    axisGrid:         'rgba(205,199,188,0.6)',
    axisTick:         v('--muted'),
    axisBorder:       v('--border'),
    donutBorder:      v('--surface'),
    donutBorderHover: v('--surface'),
    pointBorder:      v('--bg')
  };
})();

// ── Shared entity type labels (Schedule A/B contributor and recipient types) ──
var ENTITY_TYPE_LABELS = {
  'PAC': 'PAC', 'PTY': 'Party committee', 'COM': 'Committee',
  'CCM': 'Candidate committee', 'ORG': 'Organization', 'CAN': 'Candidate (self)', 'IND': 'Individual'
};

// ── Disbursement purpose bucketing (Spent tab — candidate and committee) ──
// Patterns ordered so more-specific descriptions match before broad ones.
// e.g. "DIGITAL CONSULTING" → Digital & Online (DIGITAL matches first)
var PURPOSE_MAP = [
  { label: 'TV & Radio',         patterns: ['TELEVISION','RADIO','BROADCAST','MEDIA ADVERTISING','MEDIA PRODUCTION'] },
  { label: 'Digital & Online',   patterns: ['DIGITAL','ONLINE ADVERTISING','EMAIL','TEXT MESSAGING','INTERNET'] },
  { label: 'Direct Mail',        patterns: ['DIRECT MAIL','POSTAGE','MAILING'] },
  { label: 'Printing',           patterns: ['PRINTING'] },
  { label: 'Staff & Payroll',    patterns: ['SALARY','PAYROLL','WAGES','PERSONNEL'] },
  { label: 'Legal & Compliance', patterns: ['LEGAL','COMPLIANCE','ACCOUNTING'] },
  { label: 'Events & Travel',    patterns: ['CATERING','LODGING','AIR TRAVEL','TRAVEL','EVENT SUPPLIES','SITE RENTAL','VENUE','HOTEL'] },
  { label: 'Consulting',         patterns: ['CONSULTING','STRATEGY','ADVISOR','POLLING','RESEARCH'] }
];

function purposeBucket(desc) {
  if (!desc) return 'Other';
  var u = desc.toUpperCase();
  for (var i = 0; i < PURPOSE_MAP.length; i++) {
    var cat = PURPOSE_MAP[i];
    for (var j = 0; j < cat.patterns.length; j++) {
      if (u.indexOf(cat.patterns[j]) !== -1) return cat.label;
    }
  }
  return 'Other';
}

// ── Inline-SVG icons (Material Symbols Outlined, weight 400) ─────────────────
// Five glyphs used by the menu-btn component. Paths copied verbatim from
// @material-symbols/svg-400/outlined/{name}.svg (Apache 2.0). 960×960 negative-Y
// viewBox is Google's standard for this family. Site convention is inline SVG
// for every icon (search button, hamburger, cycle-back chevron); no icon font
// is loaded and none is added by this helper.
var ICON_PATHS = {
  more_horiz:     'M207.86-432Q188-432 174-446.14t-14-34Q160-500 174.14-514t34-14Q228-528 242-513.86t14 34Q256-460 241.86-446t-34 14Zm272 0Q460-432 446-446.14t-14-34Q432-500 446.14-514t34-14Q500-528 514-513.86t14 34Q528-460 513.86-446t-34 14Zm272 0Q732-432 718-446.14t-14-34Q704-500 718.14-514t34-14Q772-528 786-513.86t14 34Q800-460 785.86-446t-34 14Z',
  trending_flat:  'm702-301-43-42 106-106H120v-60h646L660-615l42-42 178 178-178 178Z',
  expand_content: 'M200-200v-240h60v180h180v60H200Zm500-320v-180H520v-60h240v240h-60Z',
  compare_arrows: 'm317-160-42-42 121-121H80v-60h316L275-504l42-42 193 193-193 193Zm326-254L450-607l193-193 42 42-121 121h316v60H564l121 121-42 42Z',
  rss_feed:       'M142-142.04q-22-22.05-22-53Q120-226 142.04-248q22.05-22 53-22Q226-270 248-247.96q22 22.05 22 53Q270-164 247.96-142q-22.05 22-53 22Q164-120 142-142.04ZM710-120q0-123-46-229.5T537-537q-81-81-187.58-127Q242.85-710 120-710v-90q142 0 265 53t216 146q93 93 146 216t53 265h-90Zm-258 0q0-70-25.8-131.48Q400.4-312.96 355-360q-45-47-105.03-73.5Q189.95-460 120-460v-90q89 0 165.5 33.5t133.64 92.42q57.15 58.93 90 137Q542-209 542-120h-90Z'
};

// Return inline SVG markup for a named glyph. Returns empty string + warns
// for unknown names so an item render never throws on a typo.
function iconSvg(name) {
  var path = ICON_PATHS[name];
  if (!path) { try { console.warn('iconSvg: unknown glyph ' + name); } catch (e) {} return ''; }
  return '<svg class="icon-svg icon-' + name + '" aria-hidden="true" focusable="false" '
       + 'width="20" height="20" viewBox="0 -960 960 960" fill="currentColor">'
       + '<path d="' + path + '"/></svg>';
}

// ── initComboDropdown ────────────────────────────────────────────────────────
// Factory for accessible filter dropdowns: keyboard nav, ARIA, mobile fallback.
//
// config:
//   trigger    — <input> (filterable) or <button> (non-filterable)
//   dropdown   — .typeahead-dropdown[role="listbox"]
//   native     — hidden <select> shown at ≤860px (optional)
//   filterable — true → text-filter rows on input; false → button click toggles
//   getValue   — () => string   current value (reads from caller's activeFilters)
//   onSelect   — (value, label) => void   called on every selection/clear
//
// Returns: { setValue(v), setDisabled(bool) }
function initComboDropdown(config) {
  var trigger    = config.trigger;
  var dropdown   = config.dropdown;
  var native     = config.native   || null;
  var filterable = !!config.filterable;
  var getValue   = config.getValue;
  var onSelect   = config.onSelect;
  var kbRow      = null;
  var blurTimer  = null;

  function getRows() {
    return Array.from(dropdown.querySelectorAll('.typeahead-row'));
  }

  function getVisibleRows() {
    return getRows().filter(function(r) { return r.style.display !== 'none'; });
  }

  function syncAriaSelected() {
    var current = getValue();
    getRows().forEach(function(r) {
      r.setAttribute('aria-selected', r.dataset.value === current ? 'true' : 'false');
    });
  }

  function open() {
    dropdown.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    syncAriaSelected();
  }

  function close() {
    dropdown.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    if (kbRow) { kbRow.style.background = ''; kbRow = null; }
  }

  function selectRow(row) {
    var val   = row.dataset.value;
    var label = row.dataset.label;
    getRows().forEach(function(r) {
      r.setAttribute('aria-selected', r === row ? 'true' : 'false');
      if (filterable) r.style.display = '';
    });
    if (!filterable) trigger.textContent = label;
    if (filterable)  trigger.value = val;
    if (native) native.value = val;
    close();
    onSelect(val, label);
  }

  // ── Trigger events ──────────────────────────────────────────────────────────

  if (filterable) {
    trigger.addEventListener('focus', function() {
      if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
      open();
    });

    trigger.addEventListener('blur', function() {
      blurTimer = setTimeout(function() { blurTimer = null; close(); }, 150);
    });

    trigger.addEventListener('input', function() {
      var val = this.value.toLowerCase();
      getRows().forEach(function(row) {
        row.style.display = (!val || row.dataset.label.toLowerCase().indexOf(val) !== -1) ? '' : 'none';
      });
      if (kbRow && kbRow.style.display === 'none') {
        kbRow.style.background = '';
        kbRow = null;
        trigger.removeAttribute('aria-activedescendant');
      }
      open();
      if (!val && getValue()) {
        if (native) native.value = '';
        onSelect('', '');
      }
    });
  } else {
    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      if (dropdown.classList.contains('open')) { close(); } else { open(); }
    });

    document.addEventListener('click', function(e) {
      if (!dropdown.classList.contains('open')) return;
      if (!dropdown.contains(e.target) && e.target !== trigger) close();
    });
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────

  trigger.addEventListener('keydown', function(e) {
    var vrows, idx, next;
    if (e.key === 'Escape') {
      close();
      if (filterable) this.blur();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!dropdown.classList.contains('open')) open();
      vrows = getVisibleRows();
      if (!vrows.length) return;
      idx = kbRow ? vrows.indexOf(kbRow) : -1;
      if (e.key === 'ArrowUp') {
        if (idx <= 0) {
          if (kbRow) { kbRow.style.background = ''; kbRow = null; }
          trigger.removeAttribute('aria-activedescendant');
          return;
        }
        next = vrows[idx - 1];
      } else {
        next = vrows[Math.min(idx + 1, vrows.length - 1)];
      }
      if (kbRow) kbRow.style.background = '';
      kbRow = next;
      kbRow.style.background = 'var(--accent-dim)';
      trigger.setAttribute('aria-activedescendant', kbRow.id);
      kbRow.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && kbRow) {
      selectRow(kbRow);
    }
  });

  // ── Dropdown click ──────────────────────────────────────────────────────────

  dropdown.addEventListener('click', function(e) {
    var row = e.target.closest('.typeahead-row');
    if (!row) return;
    selectRow(row);
  });

  // ── Native select (mobile) ──────────────────────────────────────────────────

  if (native) {
    native.addEventListener('change', function() {
      var idx = this.selectedIndex;
      var label = idx >= 0 ? this.options[idx].text : '';
      onSelect(this.value, label);
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    setValue: function(value) {
      if (filterable) {
        trigger.value = value;
      } else {
        var matchRow = getRows().filter(function(r) { return r.dataset.value === value; })[0];
        trigger.textContent = matchRow ? matchRow.dataset.label : '';
      }
      if (native) native.value = value;
      getRows().forEach(function(r) {
        r.setAttribute('aria-selected', r.dataset.value === value ? 'true' : 'false');
      });
    },
    setDisabled: function(disabled) {
      trigger.disabled = !!disabled;
      if (native) native.disabled = !!disabled;
      if (disabled) close();
    }
  };
}

// ── initCompactHeader ─────────────────────────────────────────────────────────
// Sticky-header compact-mode listener for profile pages. Lifted from inline
// copies in candidate.html / committee.html / race.html (T-nav-scroll arc,
// 2026-05-15) — the three copies had grown a third reason to converge after
// T6.5 (scroll-clamp guard via mainEl.paddingBottom), T14 (compactThreshold
// expose for getDetailScrollTarget), and T-nav-scroll (CSS-custom-property
// write replacing the inline tabsBarEl.style.top write). The nav-scroll
// listener that originally motivated the property-write has been reverted,
// but the lift + property mechanism stays — both improvements on the prior
// three-inline-copies shape.
//
// Writes --compact-header-h on :root. .tabs-bar's top is
// var(--compact-header-h) — the listener owns the entire compact-state
// composition now that the nav is no longer sticky (top:0 base).
//
// STICKY_TOP is the threshold at which the profile-header pins to viewport.
// Matches the CSS `top:0` rule on #profile-header / #committee-header /
// #race-header (set when the nav was un-stickied — nav no longer occupies
// the viewport-top band, so profile-header anchors at 0 instead of 56).
// If the profile-header sticky-top value ever changes in CSS, update here.
//
// headerId — 'profile-header' | 'committee-header' | 'race-header'
// Returns the compactThreshold (page offset at which compact engages) so
// candidate.html and committee.html can expose it to getDetailScrollTarget.
// race.html ignores the return value.
function initCompactHeader(headerId) {
  var STICKY_TOP = 0;
  var headerEl   = document.getElementById(headerId);
  var sentinelEl = document.getElementById('profile-header-sentinel');
  var mainEl     = document.querySelector('.main');
  var compactThreshold = Math.max(0, sentinelEl.getBoundingClientRect().top + window.scrollY - STICKY_TOP + 1);
  var isCompact      = false;
  var compactHeaderH = null;
  var suppressUntil  = 0;
  function update() {
    if (Date.now() < suppressUntil) return;
    var compact = sentinelEl.getBoundingClientRect().top < STICKY_TOP;
    if (compact === isCompact) return;
    isCompact = compact;
    suppressUntil = Date.now() + 100;
    if (compact) {
      var fullH = headerEl.offsetHeight;
      headerEl.classList.add('compact');
      if (compactHeaderH === null) compactHeaderH = headerEl.offsetHeight;
      mainEl.style.paddingBottom = Math.min(80, Math.max(0, fullH - compactHeaderH)) + 'px';
      document.documentElement.style.setProperty('--compact-header-h', compactHeaderH + 'px');
    } else {
      headerEl.classList.remove('compact');
      mainEl.style.paddingBottom = '';
      document.documentElement.style.setProperty('--compact-header-h', '0px');
    }
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
  return compactThreshold;
}

// ── initViewSwitcher ─────────────────────────────────────────────────────────
// Profile-page in-place transitions between an index view (career stats + cycle
// table) and a detail view (cycle-scoped tabs + content). Lifted from
// candidate.html in T9 with committee.html as the second consumer (T10).
//
// Behavior preserved from candidate.html's original switchView():
//   - Detail entry: capture window.scrollY, hide index, show detail w/ RAF
//     reveal, scroll to compact-aware target, await loadCycle, restore tab
//   - Index entry (T-load-4a, 2026-05-19 — scaffold-then-hydrate): hide
//     detail, call fetchIndexData (returns object of promises), show index,
//     call renderIndexScaffold sync, RAF reveal + scrollTo restore, await
//     Promise.all on the promises, call renderIndex with resolved values.
//     Was: hide detail, await fetchIndexData (resolved values), show index,
//     render. The old flow left strips display:none for the entire fetch
//     window — header + nothing below felt broken on slow loads.
//   - Fetch-race token: helper-owned counter, exposed via claimToken/
//     isCurrentToken so the page's own loadCycle can participate in the same
//     namespace. Single counter is required — separate counters wouldn't
//     invalidate each other's in-flight fetches and stale DOM writes could
//     land on hidden elements. Also used by per-page retry handlers (T-load-4a)
//     to invalidate stale retries when a newer cycle-switch fires.
//
// config:
//   indexElements          — [{id, display}] elements to show on index entry
//   detailElements         — [{id, display}] elements to show on detail entry
//   mainEl                 — HTMLElement for minHeight scroll-clamp guard
//   fetchIndexData         — () => { keyP: Promise, ... }  returns object of
//                             in-flight promises (T-load-4a). Helper does
//                             Promise.all and strips 'P' suffix from keys
//                             before passing to renderIndex.
//   renderIndexScaffold    — () => void  sync render BEFORE await (T-load-4a).
//                             Required. Writes year labels + skeleton
//                             placeholders. Helper throws on init if missing.
//   renderIndex            — (data) => void  sync DOM render after await;
//                             hydrates over the scaffold. data keys are the
//                             fetchIndexData keys with 'P' suffix stripped.
//   loadCycle              — (cycle) => Promise   page's existing loader
//   getDetailScrollTarget  — (indexScrollY) => number   compact-aware target
//   restoreTab             — (tabHash) => void    page picks tab from hash
//   trackPageViewed        — (viewName) => void   'detail' | 'index'
//   onIndexError           — (err) => void        page's error UI for full
//                             failure (entity or scaffold-time). Used when
//                             onPartialError isn't provided.
//   onPartialError         — (err) => void  optional (T-load-4a). Called
//                             instead of onIndexError when fetchIndexData
//                             rejects AFTER scaffold rendered. Page handler
//                             resolves skeleton cells to dashes + renders
//                             .tab-error retry UI. If absent, helper falls
//                             through to onIndexError (escape-hatch path,
//                             defers partial-retry to T-load-4c).
//
// Returns: { switchTo, claimToken, isCurrentToken }
//   T14.5 retired headerEl (.detail-view toggle) and wasIndexShown() — both
//   served the masthead back-affordance, which is now inside the Cycle card
//   in the stats-grid. The Cycle card chevron always calls switchTo(false,NaN)
//   and indexScrollY restoration handles in-session vs fresh-load uniformly.
function initViewSwitcher(config) {
  var indexElements         = config.indexElements;
  var detailElements        = config.detailElements;
  var mainEl                = config.mainEl;
  var fetchIndexData        = config.fetchIndexData;
  var renderIndexScaffold   = config.renderIndexScaffold;
  var renderIndex           = config.renderIndex;
  var loadCycle             = config.loadCycle;
  var getDetailScrollTarget = config.getDetailScrollTarget;
  var restoreTab            = config.restoreTab;
  var trackPageViewed       = config.trackPageViewed;
  var onIndexError          = config.onIndexError;
  var onPartialError        = config.onPartialError;

  // T-load-4a — atomic single-mode migration. renderIndexScaffold is required.
  if (typeof renderIndexScaffold !== 'function') {
    throw new Error('initViewSwitcher: renderIndexScaffold is required (T-load-4a contract)');
  }

  var tokenCounter = 0;
  var indexScrollY = 0;

  function show(spec)  { var el = document.getElementById(spec.id); el.style.display = spec.display; return el; }
  function hide(spec)  { var el = document.getElementById(spec.id); el.classList.remove('visible'); el.style.display = 'none'; }
  function reveal(spec){ document.getElementById(spec.id).classList.add('visible'); }

  async function switchTo(isDetailView, hashCycle) {
    if (isDetailView) {
      // Capture scroll BEFORE hiding index — restored on back-navigation
      indexScrollY = window.scrollY;
      indexElements.forEach(hide);
      detailElements.forEach(show);
      requestAnimationFrame(function() { detailElements.forEach(reveal); });

      // Compact-aware scroll target. If extending past 0, .main needs a
      // temporary minHeight so the document can reach the target — detail
      // view in skeleton state is shorter than viewport and scrollTo would
      // be silently clamped to 0 by the browser.
      var targetScrollY = getDetailScrollTarget(indexScrollY);
      if (targetScrollY > 0) {
        mainEl.style.minHeight = (targetScrollY + window.innerHeight + 10) + 'px';
      }
      window.scrollTo(0, targetScrollY);

      trackPageViewed('detail');

      // Restore tab BEFORE the await window (T-bug fix, 2026-05-14). Leaving
      // detail view (chevron click → switchTo(false, NaN) → detailElements hide)
      // hides the parent #content but leaves child tab-panel inline `display`
      // styles untouched. Re-entering detail at a different cycle without an
      // explicit panel reset means the previously-visible tab (e.g. #tab-raised)
      // stays visible on the new cycle's render. Calling restoreTab in the
      // synchronous portion of switchTo (pre-microtask-queue, pre-await)
      // eliminates the window during which the panel state can desync from the
      // URL hash. Default to 'summary' so URLs without a tab segment produce
      // deterministic behavior (matches the cycle-row hrefs which always
      // include #summary). loadCycle's internal history.replaceState then reads
      // the now-correct .tab.active and writes the right URL on first try, so
      // no corrective post-await restoreTab call is needed.
      var hParts  = window.location.hash.replace(/^#/, '').split('#');
      var tabHash = hParts[1];
      restoreTab(tabHash || 'summary');

      await loadCycle(hashCycle);
      // minHeight is intentionally NOT cleared here. The original T6.5 design
      // cleared it after loadCycle, on the assumption that loadCycle populates
      // enough content to fill the document naturally — true on candidate.html
      // (loadCycle awaits totals fetches and DOM grows during the await) but
      // false on committee.html (loadCycle is a sync wrap; detail content stays
      // skeleton-short with raised/spent tabs in lazy-load state). Clearing
      // mid-flight collapses the document, the browser silently clamps scrollY
      // to its new max (often 0), and the compact scroll listener subsequently
      // disengages compact. We can't measure natural content height while
      // minHeight is set (mainEl.scrollHeight reflects the clamped value), and
      // even a momentary clear-then-restore triggers the browser-side scroll
      // clamp. Leaving minHeight as a floor is harmless: when natural content
      // exceeds it (typical after tab switches) it's a no-op; when natural is
      // shorter (committee detail in skeleton state) it preserves the document
      // height required for the in-place scroll target to remain valid.

    } else {
      detailElements.forEach(hide);
      trackPageViewed('index');

      var myToken = ++tokenCounter;
      // T-load-4a — scaffold first, hydrate after. Show index elements +
      // render scaffold BEFORE awaiting so the user sees structural
      // placeholders during the fetch window instead of header-and-nothing.
      var promises = fetchIndexData();
      indexElements.forEach(show);
      renderIndexScaffold();
      requestAnimationFrame(function() {
        window.scrollTo(0, indexScrollY);
        indexElements.forEach(reveal);
      });
      try {
        var keys = Object.keys(promises);
        var resolved = await Promise.all(keys.map(function(k){ return promises[k]; }));
        if (myToken !== tokenCounter) return; // newer transition started
        // Strip 'P' suffix from promise keys for the resolved data shape.
        var data = {};
        keys.forEach(function(k, i) { data[k.replace(/P$/, '')] = resolved[i]; });
        renderIndex(data);
      } catch(err) {
        if (myToken !== tokenCounter) return; // newer transition started
        // Scaffold was rendered (sync, before await). If page provides a
        // partial-error handler (resolves skeletons to dashes + .tab-error
        // retry), use it. Else fall through to onIndexError (escape-hatch
        // path — hides scaffold and shows page-level error per pre-T-load-4a
        // behavior; partial-retry deferred to T-load-4c).
        if (typeof onPartialError === 'function') {
          onPartialError(err);
        } else {
          onIndexError(err);
        }
      }
    }
  }

  return {
    switchTo: switchTo,
    claimToken: function() { return ++tokenCounter; },
    isCurrentToken: function(id) { return id === tokenCounter; }
  };
}

// ── Page-level loading-state timers (T-load-1) ──────────────────────────────
// Skeleton profile-header is visible from first paint; the entity-call await
// hydrates it. When entity-call latency exceeds 10s, surface a "still loading"
// message under the header. At 30s, swap to a "loading is taking longer"
// message with a retry button (location.reload — simplest universally-
// understood action). Both timers cleared on entity-resolve OR on catch-branch;
// state-msg hidden again on success (self-healing if 10s already fired).
//
// Visual treatments reuse T12 primitives (.inline-status-msg, .retry-btn)
// adapted at page scope. Thresholds match T12's .inline-status-msg 10s timer.
//
// stateMsgEl — the #state-msg DOM element (each page positions it after the
//   profile-header in document flow so messages appear below the skeleton).
// Returns: { clear }
function initPageLoadingTimers(stateMsgEl) {
  function show(html) {
    stateMsgEl.className = 'state-msg';
    stateMsgEl.style.display = '';
    stateMsgEl.innerHTML = html;
  }
  var stillLoadingT = setTimeout(function() {
    show('<div class="inline-status-msg">Still loading — the FEC API can be slow during high-traffic periods.</div>');
  }, 10000);
  var retryT = setTimeout(function() {
    show('Loading is taking longer than expected. <button class="retry-btn" type="button" onclick="location.reload()">Try again</button>');
  }, 30000);
  return {
    clear: function() {
      clearTimeout(stillLoadingT);
      clearTimeout(retryT);
    }
  };
}

// ── Stats-grid skeleton helper (T-load-3) ───────────────────────────────────
// Renders a .skeleton span sized in ch units (scales with font) at 2rem height
// (matches .stat-value font-size). Used to (1) re-seed skeletons on cycle-switch
// in candidate.html's loadCycle reset, and (2) factor out the inline span
// markup so the same shape isn't duplicated across pages.
function setStatSkeleton(id, widthCh) {
  var el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '<span class="skeleton" style="width:' + widthCh + 'ch;height:2rem"></span>';
}

// ── Tab section helper ──────────────────────────────────────────────────────
// Wires WAI-ARIA tabs behavior on a `.tab-section` root: click + keyboard
// activation (←/→ wrap, Home/End, Enter/Space), aria-selected + roving
// tabindex, panel [hidden] toggling. Emits `tab-section:change` CustomEvent
// on the root with detail.{activePanelId, activeTabId, previousPanelId} so
// consumers can react (e.g. committee.html toggles slow-tier indicator
// visibility based on which tab is active).
//
// Returns { activate, getActive, removeTab } — removeTab is used on
// committee.html when topCommitteesIsConduit fires post-fetch.
function initTabSection(rootEl) {
  if (!rootEl) return null;
  var tablistEl = rootEl.querySelector('[role="tablist"]');
  if (!tablistEl) return null;

  function getTabs() {
    return Array.prototype.slice.call(tablistEl.querySelectorAll('[role="tab"]'));
  }
  function getPanel(tab) {
    var id = tab.getAttribute('aria-controls');
    return id ? document.getElementById(id) : null;
  }
  function findActiveTab() {
    var tabs = getTabs();
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('aria-selected') === 'true') return tabs[i];
    }
    return null;
  }
  function applyState(activeTab) {
    getTabs().forEach(function(t) {
      var isActive = (t === activeTab);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      t.setAttribute('tabindex', isActive ? '0' : '-1');
      t.classList.toggle('active', isActive);
      var panel = getPanel(t);
      if (panel) {
        if (isActive) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      }
    });
  }
  function activate(tabOrId) {
    var target = tabOrId;
    if (typeof tabOrId === 'string') {
      target = getTabs().filter(function(t) {
        return t.id === tabOrId || t.getAttribute('aria-controls') === tabOrId;
      })[0];
    }
    if (!target) return;
    var prev = findActiveTab();
    if (prev === target) return;
    applyState(target);
    rootEl.dispatchEvent(new CustomEvent('tab-section:change', {
      detail: {
        activePanelId: target.getAttribute('aria-controls'),
        activeTabId: target.id,
        previousPanelId: prev ? prev.getAttribute('aria-controls') : null
      },
      bubbles: false
    }));
  }

  // Initial state — honor pre-marked aria-selected="true" in markup, else first tab
  var tabs = getTabs();
  if (tabs.length === 0) return null;
  var initial = findActiveTab() || tabs[0];
  applyState(initial);

  // Click activation
  tablistEl.addEventListener('click', function(e) {
    var btn = e.target.closest('[role="tab"]');
    if (btn && tablistEl.contains(btn)) {
      activate(btn);
      btn.focus();
    }
  });

  // Keyboard nav — arrows wrap, Home/End jump, Enter/Space activates focused
  tablistEl.addEventListener('keydown', function(e) {
    var current = getTabs();
    var idx = current.indexOf(document.activeElement);
    if (idx === -1) return;
    var next = null;
    switch (e.key) {
      case 'ArrowLeft':  next = current[(idx - 1 + current.length) % current.length]; break;
      case 'ArrowRight': next = current[(idx + 1) % current.length]; break;
      case 'Home':       next = current[0]; break;
      case 'End':        next = current[current.length - 1]; break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        activate(current[idx]);
        return;
      default: return;
    }
    if (next) {
      e.preventDefault();
      activate(next);
      next.focus();
    }
  });

  return {
    activate: activate,
    getActive: function() {
      var t = findActiveTab();
      return t ? { tabId: t.id, panelId: t.getAttribute('aria-controls') } : null;
    },
    // Removes a tab + its panel from the DOM. If the removed tab was active,
    // activates the first remaining tab. Used by committee.html when
    // topCommitteesIsConduit fires (Conduits tab is structurally meaningless
    // on a conduit committee).
    removeTab: function(tabId) {
      var tab = getTabs().filter(function(t) { return t.id === tabId; })[0];
      if (!tab) return;
      var panel = getPanel(tab);
      var wasActive = (tab.getAttribute('aria-selected') === 'true');
      if (tab.parentNode) tab.parentNode.removeChild(tab);
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
      if (wasActive) {
        var remaining = getTabs();
        if (remaining.length) activate(remaining[0]);
      }
    }
  };
}

// ── initSearchPanel ──────────────────────────────────────────────────────────
// Live, debounced, as-you-type search rendering two result groups (candidates +
// committees) inline. Single source of truth for the search-results UI — built
// two-consumer-ready (T-search-inline-results, Phase 1 of the search-overlay
// arc; /search is the sole consumer this ticket, the Ticket-2 overlay is the
// second).
//
// Single-funnel design: every entry point — the internal debounced input
// listener, Enter-submit, ?q= init, __navSearchHandler — calls query(q).
// query(q) dedups on lastQuery (the most recent dispatched query string), so
// repeated entry points for the same string never double-fetch or double-
// render. This makes Enter-after-results a structural no-op, not a special
// case. lastQuery is reset to '' on fetch error so a retry / re-Enter of the
// same string can re-attempt.
//
// config:
//   inputEl     — the search <input>; factory attaches its own debounced listener
//   resultsEl   — shown in the results state; factory writes the group markup in
//   loadingEl   — shown only on a cold query (no prior results visible)
//   noResultsEl — shown when both result sets are empty
//   errorEl     — shown on fetch failure
//   fromPage    — string → candidateCardHTML/committeeRowHTML opts.fromPage
//
// Soft-update: on a query fired while results are already visible, the prior
// results stay on screen and `resultsEl` gets a `refetching` class (a 2px
// progress affordance) instead of flashing the cold loading state.
//
// Returns { query(q), clear(), destroy() }.
function initSearchPanel(config) {
  var inputEl     = config.inputEl;
  var resultsEl   = config.resultsEl;
  var loadingEl   = config.loadingEl;
  var noResultsEl = config.noResultsEl;
  var errorEl     = config.errorEl;
  var fromPage    = config.fromPage || 'search';

  var DEBOUNCE_MS = 300;
  var debounceTimer = null;
  var token = 0;
  var lastQuery = '';

  // Visually-hidden polite live region — concise count summary, not the list.
  var liveRegion = document.createElement('div');
  liveRegion.className = 'sr-only';
  liveRegion.setAttribute('aria-live', 'polite');
  resultsEl.parentNode.insertBefore(liveRegion, resultsEl.nextSibling);

  function showState(name) {
    loadingEl.style.display   = name === 'loading'    ? 'block' : 'none';
    resultsEl.style.display   = name === 'results'    ? 'block' : 'none';
    noResultsEl.style.display = name === 'no-results' ? 'block' : 'none';
    errorEl.style.display     = name === 'error'      ? 'block' : 'none';
  }

  function groupHTML(groupKey, items, total, q, rowFn) {
    var rows = items.map(function(item, i) { return rowFn(item, i); }).join('');
    var noun = groupKey === 'candidates' ? 'candidate' : 'committee';
    var countText = total + ' ' + noun + (total !== 1 ? 's' : '')
      + ' for “' + q + '”';
    var viewAll = '';
    if (total > 5) {
      var browse = groupKey === 'candidates' ? '/candidates' : '/committees';
      viewAll = '<a class="results-view-all" href="' + browse + '?q='
        + encodeURIComponent(q) + '">View all ' + total + ' →</a>';
    }
    return '<div class="results-group" data-group="' + groupKey + '">'
      + '<div class="results-group-header"><span>' + countText + '</span>'
      + viewAll + '</div>'
      + '<div class="results-list">' + rows + '</div></div>';
  }

  function render(q, cands, comms, cTotal, coTotal) {
    var html = '<div class="results-area">';
    if (cands.length) {
      html += groupHTML('candidates', cands, cTotal, q, function(c, i) {
        return candidateCardHTML(c, { fromPage: fromPage, resultPosition: i, query: q });
      });
    }
    if (comms.length) {
      html += groupHTML('committees', comms, coTotal, q, function(c, i) {
        return committeeRowHTML(c, { fromPage: fromPage, resultPosition: i, query: q });
      });
    }
    html += '</div>';
    resultsEl.innerHTML = html;
  }

  function summaryText(cTotal, coTotal) {
    var parts = [];
    if (cTotal)  parts.push(cTotal  + ' candidate' + (cTotal  !== 1 ? 's' : ''));
    if (coTotal) parts.push(coTotal + ' committee' + (coTotal !== 1 ? 's' : ''));
    return parts.length ? parts.join(' and ') + ' found' : 'No results found';
  }

  function query(q) {
    clearTimeout(debounceTimer);
    q = (q || '').trim();

    if (q.length < FEC_MIN_KEYWORD_LENGTH) {
      lastQuery = '';
      token++;
      resultsEl.classList.remove('refetching');
      resultsEl.innerHTML = '';
      liveRegion.textContent = '';
      showState('bare');
      return;
    }
    if (q === lastQuery) return; // already dispatched/showing this string

    lastQuery = q;
    var myToken = ++token;

    // Soft-update: keep visible results on screen during refetch; only show the
    // cold loading state when there are no prior results to keep.
    if (resultsEl.style.display !== 'none' && resultsEl.innerHTML) {
      resultsEl.classList.add('refetching');
    } else {
      showState('loading');
    }

    Promise.all([
      apiFetch('/candidates/', { q: q, per_page: 5, sort: '-receipts' }),
      apiFetch('/committees/', { q: q, per_page: 5, sort: '-receipts' })
    ]).then(function(res) {
      if (myToken !== token) return; // superseded by a newer query
      resultsEl.classList.remove('refetching');
      var cands = res[0].results || [];
      var comms = res[1].results || [];
      var cTotal  = (res[0].pagination && res[0].pagination.count)  || cands.length;
      var coTotal = (res[1].pagination && res[1].pagination.count) || comms.length;
      if (!cands.length && !comms.length) {
        resultsEl.innerHTML = '';
        showState('no-results');
        liveRegion.textContent = summaryText(0, 0);
        return;
      }
      render(q, cands, comms, cTotal, coTotal);
      showState('results');
      liveRegion.textContent = summaryText(cTotal, coTotal);
    }).catch(function(err) {
      if (myToken !== token) return; // superseded by a newer query
      resultsEl.classList.remove('refetching');
      lastQuery = ''; // allow retry / re-Enter of the same string to re-attempt
      showState('error');
      liveRegion.textContent = 'Couldn’t load search results.';
      console.error('search error:', err);
    });
  }

  function clear() {
    clearTimeout(debounceTimer);
    lastQuery = '';
    token++;
    resultsEl.classList.remove('refetching');
    resultsEl.innerHTML = '';
    liveRegion.textContent = '';
    showState('bare');
  }

  function onInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() { query(inputEl.value); }, DEBOUNCE_MS);
  }
  inputEl.addEventListener('input', onInput);

  function destroy() {
    clearTimeout(debounceTimer);
    inputEl.removeEventListener('input', onInput);
    if (liveRegion.parentNode) liveRegion.parentNode.removeChild(liveRegion);
  }

  return { query: query, clear: clear, destroy: destroy };
}

// ── initMenuButton ───────────────────────────────────────────────────────────
// Action menu: a navy split button (MENU text + more_horiz icon) that toggles a
// dropdown of links/actions. Used in profile-page headers (candidate.html,
// committee.html) starting in T-menu-btn-profile-header.
//
// Not a value-selector — does NOT use aria-selected / aria-activedescendant.
// role="menu" on the dropdown, role="menuitem" on items. ArrowUp/Down CLAMP at
// the ends (do not wrap — matches initComboDropdown). Escape closes and returns
// focus to the trigger. Click outside closes (lifted from initComboDropdown).
//
// The factory owns the markup: pass an empty container as hostEl; factory
// injects the trigger button and the dropdown into it. The site call site
// stays a single <div class="menu-btn-wrap" id="…"></div>.
//
// config:
//   hostEl     — empty container element (gets .menu-btn-wrap class)
//   items      — array of item descriptors (see below)
//   showText   — bool, default true; false = icon-only variant (mobile)
//   text       — string; visible label inside the text segment when showText
//                is true. Page integrations pass page-specific values
//                ('Candidate' on candidate.html, 'Committee' on committee.html);
//                defaults to 'Menu' for the design-system demo + any other
//                generic caller
//   ariaLabel  — string; aria-label on the trigger button (required when
//                showText:false, recommended otherwise to override the default
//                'Menu' reading)
//   onOpen     — optional () => void; fires after the dropdown opens
//   onClose    — optional () => void; fires after the dropdown closes
//
// Item descriptor:
//   { id, label, icon, disabled?, href?, onClick? }
//   Exactly one of href / onClick. href items render as <a>, action items as
//   <button>. Disabled items render as <button aria-disabled="true"> regardless
//   (a disabled <a> has no semantic equivalent).
//
// Returns: { open, close, isOpen, updateItem, destroy }
//   updateItem(id, patch) — patch a subset of { disabled, label, href, onClick,
//     icon }. The single item's DOM node is rebuilt in place; other items and
//     focus state are untouched.
//   destroy() — removes the document-level outside-click listener and clears
//     hostEl. Required for test cleanup so listeners don't leak across tests.
function initMenuButton(config) {
  var hostEl    = config.hostEl;
  var items     = (config.items || []).slice();   // shallow clone — patches mutate per-item state
  var showText  = config.showText !== false;
  // Visible label inside the text segment when showText:true. Page integrations
  // pass page-specific values (candidate.html: 'Candidate'; committee.html:
  // 'Committee'); design-system demos and any other caller fall back to 'Menu'.
  var text      = config.text || 'Menu';
  var ariaLabel = config.ariaLabel || 'Menu';
  var onOpen    = config.onOpen;
  var onClose   = config.onClose;

  hostEl.innerHTML = '';
  hostEl.classList.add('menu-btn-wrap');

  // ── Trigger ──────────────────────────────────────────────────────────
  var triggerEl = document.createElement('button');
  triggerEl.type = 'button';
  triggerEl.className = 'menu-btn';
  triggerEl.setAttribute('aria-haspopup', 'true');
  triggerEl.setAttribute('aria-expanded', 'false');
  triggerEl.setAttribute('aria-label', ariaLabel);
  function renderTriggerInner() {
    triggerEl.innerHTML = showText
      ? '<span class="menu-btn-text">' + escHtml(text) + '</span><span class="menu-btn-icon">' + iconSvg('more_horiz') + '</span>'
      : '<span class="menu-btn-icon">' + iconSvg('more_horiz') + '</span>';
  }
  renderTriggerInner();

  // ── Dropdown ─────────────────────────────────────────────────────────
  var dropdownEl = document.createElement('div');
  dropdownEl.className = 'menu-btn-dropdown';
  dropdownEl.setAttribute('role', 'menu');

  // Item DOM nodes keyed by id; rebuilt in-place by updateItem.
  var itemNodes = {};

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function buildItemNode(item) {
    var isLink = !!item.href && !item.disabled;
    var el = document.createElement(isLink ? 'a' : 'button');
    if (isLink) {
      el.href = item.href;
    } else {
      el.type = 'button';
    }
    el.className = 'menu-item';
    el.setAttribute('role', 'menuitem');
    el.dataset.itemId = item.id;
    el.tabIndex = -1;   // roving focus: arrow keys call .focus() directly
    if (item.disabled) {
      el.setAttribute('aria-disabled', 'true');
    }
    el.innerHTML =
      '<span class="menu-item-label">' + escHtml(item.label) + '</span>' +
      '<span class="menu-item-icon">'  + iconSvg(item.icon)  + '</span>';

    if (item.disabled) {
      // Swallow clicks on disabled items — preventDefault keeps an
      // accidentally-disabled <a> from navigating.
      el.addEventListener('click', function(e) { e.preventDefault(); });
    } else if (isLink) {
      // Links navigate naturally; close menu on the same tick so a same-page
      // link doesn't leave the dropdown open.
      el.addEventListener('click', function() { close(); });
    } else if (typeof item.onClick === 'function') {
      el.addEventListener('click', function(e) {
        item.onClick.call(el, e);
        close();
      });
    }
    return el;
  }

  function renderItems() {
    dropdownEl.innerHTML = '';
    itemNodes = {};
    items.forEach(function(item) {
      var node = buildItemNode(item);
      dropdownEl.appendChild(node);
      itemNodes[item.id] = node;
    });
  }

  function getEnabledItemNodes() {
    return items.filter(function(i) { return !i.disabled; })
                .map(function(i)    { return itemNodes[i.id]; });
  }

  // CLAMP behavior (Q4): at the ends, focus stays put — do not wrap.
  function focusItemByDelta(delta) {
    var enabled = getEnabledItemNodes();
    if (!enabled.length) return;
    var idx = enabled.indexOf(document.activeElement);
    var target;
    if (idx === -1) {
      target = delta > 0 ? 0 : enabled.length - 1;
    } else {
      target = idx + delta;
      if (target < 0) target = 0;
      if (target >= enabled.length) target = enabled.length - 1;
    }
    enabled[target].focus();
  }

  // ── State ────────────────────────────────────────────────────────────
  function open() {
    if (dropdownEl.classList.contains('open')) return;
    dropdownEl.classList.add('open');
    triggerEl.setAttribute('aria-expanded', 'true');
    var enabled = getEnabledItemNodes();
    if (enabled.length) enabled[0].focus();
    if (typeof onOpen === 'function') onOpen();
  }

  function close() {
    if (!dropdownEl.classList.contains('open')) return;
    dropdownEl.classList.remove('open');
    triggerEl.setAttribute('aria-expanded', 'false');
    if (typeof onClose === 'function') onClose();
  }

  function isOpen() { return dropdownEl.classList.contains('open'); }

  // ── Trigger interaction ──────────────────────────────────────────────
  triggerEl.addEventListener('click', function(e) {
    e.stopPropagation();
    if (isOpen()) { close(); triggerEl.focus(); } else { open(); }
  });

  triggerEl.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen()) open();
      else focusItemByDelta(e.key === 'ArrowDown' ? 1 : -1);
    }
    // Enter / Space on a button trigger fires click via the browser default.
  });

  // ── Dropdown interaction ─────────────────────────────────────────────
  dropdownEl.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      triggerEl.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItemByDelta(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItemByDelta(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      var enabledH = getEnabledItemNodes();
      if (enabledH.length) enabledH[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      var enabledE = getEnabledItemNodes();
      if (enabledE.length) enabledE[enabledE.length - 1].focus();
    }
    // Enter / Space on a focused menuitem fires click via browser default.
  });

  // Outside-click closes — lifted from initComboDropdown:473–476 pattern.
  function outsideClickHandler(e) {
    if (!isOpen()) return;
    if (!dropdownEl.contains(e.target) && !triggerEl.contains(e.target)) close();
  }
  document.addEventListener('click', outsideClickHandler);

  // ── Initial render ───────────────────────────────────────────────────
  renderItems();
  hostEl.appendChild(triggerEl);
  hostEl.appendChild(dropdownEl);

  // ── Public API ───────────────────────────────────────────────────────
  return {
    open:   function() { open(); },
    close:  function() { close(); },
    isOpen: isOpen,
    updateItem: function(id, patch) {
      var item = items.find(function(i) { return i.id === id; });
      if (!item || !patch) return;
      Object.keys(patch).forEach(function(k) { item[k] = patch[k]; });
      var oldNode = itemNodes[id];
      if (!oldNode || !oldNode.parentNode) return;
      var newNode = buildItemNode(item);
      oldNode.parentNode.replaceChild(newNode, oldNode);
      itemNodes[id] = newNode;
    },
    // Idempotent text/icon-variant swap. Rebuilds the trigger's innerHTML;
    // does NOT touch dropdownEl (its open state, items, and item focus are
    // preserved). Driven by a page-level matchMedia listener (see
    // bindMenuBreakpoint on candidate.html / committee.html).
    setShowText: function(newShowText) {
      newShowText = !!newShowText;
      if (newShowText === showText) return;
      showText = newShowText;
      renderTriggerInner();
    },
    destroy: function() {
      document.removeEventListener('click', outsideClickHandler);
      hostEl.innerHTML = '';
      hostEl.classList.remove('menu-btn-wrap');
    }
  };
}

// ── Info modal — singleton, lazy-injected on first open ──────────────────────
// One modal DOM instance for the whole app, injected on first openInfoModal()
// call. Used as the teaser for the Compare / Follow menu-btn items (wired in
// T-menu-btn-profile-header). Copy is static.
//
// Mechanics deliberately minimal: overlay scrim + Escape + outside-click +
// X button. NO focus trap, NO scroll lock — explicitly out of scope. Does NOT
// touch the committees modal.
var INFO_MODAL_HTML =
  '<div id="info-modal" class="modal-overlay" style="display:none">' +
    '<div class="modal-panel modal-panel--narrow">' +
      '<div class="modal-header">' +
        '<div class="modal-title">Wouldn’t that be nice...</div>' +
        '<button type="button" class="modal-close" id="info-modal-close" aria-label="Close">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<p class="modal-prose">FECLedger is an experimental build. ‘Compare’ and ‘Follow’ features are the future of this app. We’ll let you know when they’re available!</p>' +
      '</div>' +
    '</div>' +
  '</div>';

function injectInfoModal() {
  if (document.getElementById('info-modal')) return;
  document.body.insertAdjacentHTML('beforeend', INFO_MODAL_HTML);
  var modalEl = document.getElementById('info-modal');
  modalEl.addEventListener('click', function(e) {
    if (e.target === modalEl) closeInfoModal();   // outside-click closes
  });
  document.getElementById('info-modal-close').addEventListener('click', closeInfoModal);
  // Escape listener installed once at injection; guarded by visibility check
  // so it's a no-op when the modal is closed.
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    var el = document.getElementById('info-modal');
    if (el && el.style.display !== 'none') closeInfoModal();
  });
}

function openInfoModal() {
  injectInfoModal();
  document.getElementById('info-modal').style.display = 'flex';
}

function closeInfoModal() {
  var el = document.getElementById('info-modal');
  if (el) el.style.display = 'none';
}
