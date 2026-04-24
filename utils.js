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
  return (code === 'T' || code === 'A') ? 'dot-gray' : 'dot-active';
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
