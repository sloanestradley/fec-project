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

var BASE    = 'https://api.open.fec.gov/v1';
var API_KEY = 'Y7CL6AyMB9NPbwuuMWHduJ6LVu6OWsv49TDZcXZT';

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
  var p  = Object.assign({ api_key: API_KEY }, params || {});
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
var CHART_COLORS = {
  raised:           'rgba(74,144,217,0.9)',
  raisedSolid:      'rgba(74,144,217,1)',
  spent:            'rgba(217,74,74,0.85)',
  spentSolid:       'rgba(217,74,74,1)',
  coh:              'rgba(61,191,122,0.85)',
  cohSolid:         'rgba(61,191,122,1)',
  spentBar:         'rgba(217,74,74,0.72)',
  overlayDeadline:  'rgba(90,96,112,0.4)',
  overlayElection:  'rgba(232,160,32,0.75)',
  overlayToday:     'rgba(136,144,160,0.18)',
  tooltipBg:        '#f7f4ef',
  tooltipTitle:     '#625b52',
  tooltipBody:      '#1a1510',
  tooltipBorder:    '#cdc7bc',
  axisGrid:         'rgba(205,199,188,0.6)',
  axisTick:         '#625b52',
  axisBorder:       '#cdc7bc',
  donutBorder:      '#f7f4ef',
  donutBorderHover: '#f7f4ef',
  pointBorder:      '#ede8e0'
};

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
