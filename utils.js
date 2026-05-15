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
  return '<a class="committee-row" href="/committee/' + c.committee_id + '?from=' + encodeURIComponent(fromPage) + '"'
    + ' onclick="amplitude.track(' + JSON.stringify(trackName) + ',' + JSON.stringify(trackProps) + ')">'
    + '<div class="committee-name">' + (c.name || '—') + '</div>'
    + '<div class="committee-card-meta">'
    + '<span class="tag tag-neutral">' + committeeTypeLabel(c.committee_type) + '</span>'
    + '<span class="tag tag-neutral"><span class="status-dot ' + dotCls + '"></span>' + freqLbl + '</span>'
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
// copies in candidate.html / committee.html / race.html (T-nav-scroll bundle,
// 2026-05-15) — the three copies had grown a third reason to converge after
// T6.5 (scroll-clamp guard via mainEl.paddingBottom), T14 (compactThreshold
// expose for getDetailScrollTarget), and T-nav-scroll (CSS-custom-property
// write replacing the inline tabsBarEl.style.top write so the nav-scroll
// listener and compact listener can compose without stepping on each other).
//
// Coordinates with T-nav-scroll by writing --compact-header-h on :root instead
// of tabsBarEl.style.top inline. .tabs-bar's top is calc(var(--nav-offset) +
// var(--compact-header-h)) — each listener owns its own property.
//
// T-nav-scroll v2 (2026-05-15): reads window.__navOffsetTarget (the nav
// listener's source-of-truth value) as the compact-engagement threshold
// instead of the static --header-h constant. This is required because under
// v2 the profile-header's sticky-top is dynamic (0 when nav in natural flow,
// var(--header-h) when revealed) — using --header-h would fire compact 56px
// early in the default not-revealed state. Reading the TARGET value rather
// than the live --nav-offset CSS computed value avoids flicker during the
// 200ms reveal animation when --nav-offset is mid-transition.
//
// headerId — 'profile-header' | 'committee-header' | 'race-header'
// Returns the compactThreshold (page offset at which compact engages) so
// candidate.html and committee.html can expose it to getDetailScrollTarget.
// race.html ignores the return value.
function initCompactHeader(headerId) {
  var headerEl   = document.getElementById(headerId);
  var sentinelEl = document.getElementById('profile-header-sentinel');
  var mainEl     = document.querySelector('.main');
  function navOffset() {
    return typeof window.__navOffsetTarget === 'number' ? window.__navOffsetTarget : 0;
  }
  var compactThreshold = Math.max(0, sentinelEl.getBoundingClientRect().top + window.scrollY - navOffset() + 1);
  var isCompact      = false;
  var compactHeaderH = null;
  var suppressUntil  = 0;
  function update() {
    if (Date.now() < suppressUntil) return;
    var compact = sentinelEl.getBoundingClientRect().top < navOffset();
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
//   - Index entry: hide detail, await fetchIndexData, render, RAF reveal +
//     scrollTo restore (no-op on first visit when scrollY=0)
//   - Fetch-race token: helper-owned counter, exposed via claimToken/
//     isCurrentToken so the page's own loadCycle can participate in the same
//     namespace. Single counter is required — separate counters wouldn't
//     invalidate each other's in-flight fetches and stale DOM writes could
//     land on hidden elements.
//
// config:
//   indexElements          — [{id, display}] elements to show on index entry
//   detailElements         — [{id, display}] elements to show on detail entry
//   mainEl                 — HTMLElement for minHeight scroll-clamp guard
//   fetchIndexData         — () => Promise<any>   page handles caching
//   renderIndex            — (data) => void       sync DOM render
//   loadCycle              — (cycle) => Promise   page's existing loader
//   getDetailScrollTarget  — (indexScrollY) => number   compact-aware target
//   restoreTab             — (tabHash) => void    page picks tab from hash
//   trackPageViewed        — (viewName) => void   'detail' | 'index'
//   onIndexError           — (err) => void        page's error UI
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
  var renderIndex           = config.renderIndex;
  var loadCycle             = config.loadCycle;
  var getDetailScrollTarget = config.getDetailScrollTarget;
  var restoreTab            = config.restoreTab;
  var trackPageViewed       = config.trackPageViewed;
  var onIndexError          = config.onIndexError;

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
      // Programmatic scroll — flag so the nav-scroll listener treats it as
      // non-user input and doesn't reveal the nav from the resulting upward
      // delta (T-nav-scroll). 100ms covers the scroll-settle frame + margin.
      window.__navScrollSuppressUntil = Date.now() + 100;
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
      try {
        var data = await fetchIndexData();
        if (myToken !== tokenCounter) return; // newer transition started
        indexElements.forEach(show);
        renderIndex(data);
        requestAnimationFrame(function() {
          window.__navScrollSuppressUntil = Date.now() + 100;
          window.scrollTo(0, indexScrollY);
          indexElements.forEach(reveal);
        });
      } catch(err) {
        onIndexError(err);
      }
    }
  }

  return {
    switchTo: switchTo,
    claimToken: function() { return ++tokenCounter; },
    isCurrentToken: function(id) { return id === tokenCounter; }
  };
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
