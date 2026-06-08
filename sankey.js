// ─────────────────────────────────────────────────────────────────────────────
// sankey.js — Raised → Spent money-flow Sankey (candidate.html + committee.html)
//
// Two responsibilities, kept separate:
//   • buildSankeyModel(rec, opts) — PURE data adapter. FEC /totals/ record → a
//     conserving node/flow model, or a {gated} sentinel. No DOM, no echarts, no
//     token reads — unit-testable in isolation (tests/sankey.spec.js).
//   • renderSankey(elId, model)   — ECharts (SVG) render of a non-gated model.
//
// Authoritative specs: strategy/sankey-examples.html (visual model — color-by-rank,
// labels, tooltip, contra treatment, COH nodes, min-height floor) and
// strategy/sankey-data-model.md (leaf set per form type, §1 trap fields, §4a gates).
// Where they overlap the prototype wins.
//
// Conservation contract: receipt node values sum to rec.receipts and disbursement
// node values sum to rec.disbursements to the penny (verified across the §verify-set).
// cohStart is DERIVED for BOTH entities (end + disbursements − receipts) — never the
// filed cash_on_hand_beginning_period, which doesn't always reconcile (ActBlue ~$889).
// This is a cash-identity fix, independent of the §4a gates (leaf-coverage limits).
// ─────────────────────────────────────────────────────────────────────────────

// Shared tolerance ($1) — used by the gate detector AND any residual reconciliation
// check. Guards against sub-dollar FEC rounding being read as a real divergence.
var SANKEY_TOLERANCE = 1;

// Numeric field read — anything non-numeric (null / undefined / string) → 0.
function _sankeyNum(rec, key) {
  var v = rec ? rec[key] : 0;
  return (typeof v === 'number' && !isNaN(v)) ? v : 0;
}

// ── Gate detector (Option A: gate lives inside the adapter) ──────────────────
// Returns a reason string when the entity is out of v1 scope, else null.
//   'presidential' — Form 3P (extra leaves: federal_funds / fundraising_disbursements
//                    / exempt_legal_accounting_disbursement) the v1 model doesn't render.
//   'non-federal'  — a committee whose TOTAL receipts/disbursements fold in non-federal
//                    (soft-money) activity the v1 leaf set doesn't model. Detected
//                    data-driven (NOT by committee type): receipts !== fed_receipts ||
//                    disbursements !== fed_disbursements, with the $1 tolerance.
// The committee gate is entity-guarded because candidate (Form 3) totals carry NO
// fed_receipts field — an un-guarded compare would flag every candidate.
function sankeyGateReason(rec, opts) {
  opts = opts || {};
  if (opts.isPresidential) return 'presidential';
  if (opts.entity === 'committee') {
    var fr = rec.fed_receipts, fd = rec.fed_disbursements;
    if (typeof fr === 'number' &&
        Math.abs(_sankeyNum(rec, 'receipts') - fr) > SANKEY_TOLERANCE) return 'non-federal';
    if (typeof fd === 'number' &&
        Math.abs(_sankeyNum(rec, 'disbursements') - fd) > SANKEY_TOLERANCE) return 'non-federal';
  }
  return null;
}

// Transparent "not yet modeled" copy for a gated entity (shared by candidate +
// committee mount points). Locked copy — see strategy/sankey-data-model.md §4a.
function sankeyGateCopy(reason) {
  if (reason === 'presidential')
    return "Presidential committees include public-financing and other categories the money-flow view doesn't model yet, so it's omitted here.";
  if (reason === 'non-federal')
    return "This committee operates a non-federal (state/local) account alongside its federal account. The money-flow view models federal activity only for now — showing it here would understate the totals, so it's omitted. The figures above remain complete.";
  return "A money-flow view isn't available for this committee yet.";
}

// ── Pure adapter: FEC /totals/ record → Sankey model (or gated sentinel) ─────
// opts: { entity: 'candidate' | 'committee', isPresidential?: bool, hubName?: string }
// Returns either { gated:true, reason } or a full model:
//   { gated:false, hubName, receiptTotal, disbTotal, cohStart, cohEnd, debt,
//     sources:[{name, value, group?, other?}], uses:[{name, value, other?}] }
function buildSankeyModel(rec, opts) {
  opts = opts || {};
  rec = rec || {};
  var reason = sankeyGateReason(rec, opts);
  if (reason) return { gated: true, reason: reason };

  var cand = opts.entity === 'candidate';
  var g = function(k) { return _sankeyNum(rec, k); };
  var push = function(arr, node) { if (node.value > 0) arr.push(node); };

  var receiptTotal = g('receipts');
  var disbTotal    = g('disbursements');
  var cohEnd       = g('last_cash_on_hand_end_period');
  // DERIVED for both entities (accounting identity) — guarantees the two sides balance.
  var cohStart     = cohEnd + disbTotal - receiptTotal;

  // ── Receipt sources ──
  var sources = [];
  // Contributions group — the three leaves ONLY. NEVER the `contributions` aggregate,
  // which also contains candidate_contribution (already in the self-funding node) and
  // would double-count it. (data-model §3 / prototype Field-mapping footnote ‡.)
  push(sources, { name: 'Individuals', group: 'contributions',
    value: g('individual_itemized_contributions') + g('individual_unitemized_contributions') });
  push(sources, { name: 'PACs & other committees', group: 'contributions',
    value: g('other_political_committee_contributions') });
  push(sources, { name: 'Party committees', group: 'contributions',
    value: g('political_party_committee_contributions') });
  // Transfers in / Loans / Other receipts — form-dependent field names.
  push(sources, { name: 'Transfers in',
    value: cand ? g('transfers_from_other_authorized_committee') : g('transfers_from_affiliated_party') });
  // Candidate self-funding (candidate committees only) = own gift + own loan, grouped
  // by source so a self-funder isn't hidden inside Loans (which is external-only).
  if (cand) push(sources, { name: 'Candidate self-funding',
    value: g('candidate_contribution') + g('loans_made_by_candidate') });
  push(sources, { name: 'Loans',
    value: cand ? g('all_other_loans') : g('all_loans_received') });
  // Offsets (contra-receipt) — sum the candidate offset variants; committees carry only
  // operating offsets in scope. Rendered as an ordinary ranked node (no netting).
  push(sources, { name: 'Offsets',
    value: g('offsets_to_operating_expenditures')
         + (cand ? g('offsets_to_fundraising_expenditures') + g('offsets_to_legal_accounting') : 0) });
  // Committee-only receipt: refunds of contributions the committee made (Form 3X line 16).
  if (!cand) push(sources, { name: 'Candidate-contribution refunds',
    value: g('fed_candidate_contribution_refunds') });
  // Federal funds — presidential public financing; gated out of v1, so 0 for every
  // non-gated record. Guarded push keeps conservation robust if a stray value appears.
  if (cand) push(sources, { name: 'Federal funds', value: g('federal_funds') });
  push(sources, { name: 'Other receipts', other: true,
    value: cand ? g('other_receipts') : g('other_fed_receipts') });

  // ── Disbursement uses ──
  var uses = [];
  push(uses, { name: 'Operating expenditures', value: g('operating_expenditures') });
  if (!cand) {
    push(uses, { name: 'Independent expenditures', value: g('independent_expenditures') });
    push(uses, { name: 'Coordinated party expenditures', value: g('coordinated_expenditures_by_party_committee') });
    push(uses, { name: 'Contributions to candidates', value: g('fed_candidate_committee_contributions') });
  }
  push(uses, { name: 'Transfers out',
    value: cand ? g('transfers_to_other_authorized_committee') : g('transfers_to_affiliated_committee') });
  push(uses, { name: 'Loan repayments',
    value: cand ? g('loan_repayments') : g('loan_repayments_made') });
  push(uses, { name: 'Contribution refunds', value: g('contribution_refunds') });
  push(uses, { name: 'Other disbursements', other: true, value: g('other_disbursements') });

  return {
    gated: false,
    hubName: opts.hubName || 'Committee',
    receiptTotal: receiptTotal,
    disbTotal: disbTotal,
    cohStart: cohStart,
    cohEnd: cohEnd,
    debt: g('last_debts_owed_by_committee'),
    sources: sources,
    uses: uses
  };
}

// ── ECharts render (SVG) of a non-gated model ────────────────────────────────
function renderSankey(elId, model) {
  if (!model || model.gated) return;            // gated models render the page's gate state, not here
  if (typeof echarts === 'undefined') { console.warn('renderSankey: echarts not loaded'); return; }
  var el = document.getElementById(elId);
  if (!el) return;

  var pal  = CATEGORY_COLORS.sankey;            // ramp[] + other + cash + hub (token-sourced)
  var RAMP = pal.ramp, CAT_OTHER = pal.other, GREY = pal.cash, HUB = pal.hub;
  var hub  = model.hubName;
  var isMobile = window.innerWidth < 640;

  function nodeStyle(color) { return { color: color, borderColor: 'transparent', borderWidth: 1 }; }
  function descByValue(a, b) { return b.value - a.value; }

  var nodes = [], links = [];
  // Min visible node height: ECharts has no native minimum, so floor each node's LAYOUT
  // value to 0.5% of its column. True value drives label + tooltip (_val). Negligible
  // nodes are thus slightly over-represented in height; the data still conserves exactly.
  var MIN_FRAC = 0.005;
  var floorL = (model.receiptTotal + Math.max(0, model.cohStart)) * MIN_FRAC;
  var floorR = (model.disbTotal + Math.max(0, model.cohEnd)) * MIN_FRAC;

  // LEFT — contributions are one grouped unit (ranked by combined total, all one color);
  // every other source ranks individually by size; Other catch-all pinned to the bottom.
  var contribSub = model.sources.filter(function(s) { return s.group === 'contributions'; })
                                 .slice().sort(descByValue);
  var otherSrc   = model.sources.filter(function(s) { return s.group !== 'contributions'; });
  var units = [];
  if (contribSub.length) units.push({ total: contribSub.reduce(function(a, s){ return a + s.value; }, 0), members: contribSub });
  otherSrc.forEach(function(c) { units.push({ total: c.value, members: [c] }); });
  units.sort(function(a, b) {
    var ao = (a.members.length === 1 && a.members[0].other) ? 1 : 0;
    var bo = (b.members.length === 1 && b.members[0].other) ? 1 : 0;
    if (ao !== bo) return ao - bo;              // Other pinned to the bottom
    return b.total - a.total;                   // otherwise by size
  });
  var ri = 0;
  units.forEach(function(u) {
    var isOther = u.members.length === 1 && u.members[0].other;
    var color = isOther ? CAT_OTHER : RAMP[(ri++) % RAMP.length];
    u.members.forEach(function(m) {
      nodes.push({ name: m.name, itemStyle: nodeStyle(color), label: { position: 'right' },
        _val: m.value, _pct: m.value / model.receiptTotal });
      links.push({ source: m.name, target: hub, value: Math.max(m.value, floorL),
        _val: m.value, _pct: m.value / model.receiptTotal });
    });
  });
  if (model.cohStart > 0) {
    nodes.push({ name: 'Cash on hand (start)', itemStyle: nodeStyle(GREY), label: { position: 'right' }, _val: model.cohStart, _pct: null });
    links.push({ source: 'Cash on hand (start)', target: hub, value: model.cohStart, _val: model.cohStart });
  }

  // HUB — single slate node (commingled funds).
  nodes.push({ name: hub, itemStyle: nodeStyle(HUB), label: { show: false }, _val: null, _pct: null });

  // RIGHT — every use ranks individually by size; Other pinned to the bottom.
  var catUse = model.uses.slice().sort(function(a, b) {
    var ao = a.other ? 1 : 0, bo = b.other ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return b.value - a.value;
  });
  var rj = 0;
  catUse.forEach(function(u) {
    var color = u.other ? CAT_OTHER : RAMP[(rj++) % RAMP.length];
    nodes.push({ name: u.name, itemStyle: nodeStyle(color), label: { position: 'left' },
      _val: u.value, _pct: u.value / model.disbTotal });
    links.push({ source: hub, target: u.name, value: Math.max(u.value, floorR),
      _val: u.value, _pct: u.value / model.disbTotal });
  });
  if (model.cohEnd > 0) {
    nodes.push({ name: 'Cash on hand (end)', itemStyle: nodeStyle(GREY), label: { position: 'left' }, _val: model.cohEnd, _pct: null });
    links.push({ source: hub, target: 'Cash on hand (end)', value: model.cohEnd, _val: model.cohEnd });
  }

  var chart = echarts.getInstanceByDom(el) || echarts.init(el, null, { renderer: 'svg' });
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item', backgroundColor: '#FFFFFF', borderColor: '#D7D1C7', borderWidth: 1, padding: [8, 10],
      textStyle: { color: '#1A1510', fontFamily: '"IBM Plex Sans",sans-serif', fontSize: 12 },
      // v1 styles over the library tooltip; full .viz-tt alignment is a Step 5 follow-up.
      formatter: function(p) {
        var label, val, pct;
        if (p.dataType === 'edge') {
          label = (p.data.source === hub) ? p.data.target : p.data.source;
          val = (p.data._val != null) ? p.data._val : p.data.value; pct = p.data._pct;
        } else {
          label = p.name; val = (p.data._val != null) ? p.data._val : p.value; pct = p.data._pct;
        }
        var pctStr = (pct != null) ? ' • ' + (pct * 100).toFixed(1) + '%' : '';
        return '<b>' + label + '</b><br>' + fmt(val) + pctStr;
      }
    },
    series: [{
      type: 'sankey', left: '1%', right: '1%', top: '2%', bottom: '2%',
      nodeWidth: 13, nodeGap: 16, nodeAlign: 'justify', draggable: false, layoutIterations: 0,
      emphasis: { focus: 'adjacency' },
      blur: { lineStyle: { opacity: 0.40 }, itemStyle: { opacity: 0.50 }, label: { opacity: 0.85 } },
      label: {
        color: '#1A1510', fontFamily: '"IBM Plex Sans",sans-serif', fontSize: 12,
        formatter: isMobile
          ? function(p) { return p.name; }
          : function(p) { return p.data._val != null ? p.name + '  ' + fmt(p.data._val) : p.name; }
      },
      lineStyle: { color: 'gradient', opacity: 0.48, curveness: 0.5 },
      data: nodes, links: links
    }]
  }, true);
  return chart;
}
