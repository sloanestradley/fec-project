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

// ── API fetch ────────────────────────────────────────────────────────────────

async function apiFetch(path, params) {
  var p  = Object.assign({ api_key: API_KEY }, params || {});
  var qs = Object.keys(p).map(function(k) { return k + '=' + encodeURIComponent(p[k]); }).join('&');
  var res = await fetch(BASE + path + '?' + qs);
  if (!res.ok) throw new Error('FEC ' + res.status + ' — ' + path);
  return res.json();
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

// ── Party utilities ──────────────────────────────────────────────────────────

function partyClass(p) {
  if (!p) return 'tag-neutral';
  var u = p.toUpperCase();
  if (u === 'DEM' || u.startsWith('DEMOCRAT')) return 'tag-dem';
  if (u === 'REP' || u.startsWith('REPUBLICAN')) return 'tag-rep';
  return 'tag-ind';
}

function partyLabel(p) {
  if (!p) return '';
  var u = p.toUpperCase();
  if (u === 'DEM' || u.startsWith('DEMOCRAT')) return 'Democrat';
  if (u === 'REP' || u.startsWith('REPUBLICAN')) return 'Republican';
  return p;
}

// ── Race utilities ───────────────────────────────────────────────────────────

// Format a race name for display: 'House • WA-03', 'Senate • NY'
function formatRaceName(office, state, district) {
  var officeNames = { H: 'House', S: 'Senate', P: 'President' };
  var officeName  = officeNames[office] || office || '';
  var districtStr = (office === 'H' && district) ? '-' + district : '';
  return officeName + ' \u2022 ' + (state || '') + districtStr;
}

// ── Committee utilities ──────────────────────────────────────────────────────

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
