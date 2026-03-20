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
  var qs = Object.keys(p).map(function(k) { return k + '=' + encodeURIComponent(p[k]); }).join('&');
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

// Format a race name for display: 'House • WA-03', 'Senate • NY'
function formatRaceName(office, state, district) {
  var officeNames = { H: 'House', S: 'Senate', P: 'President' };
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
