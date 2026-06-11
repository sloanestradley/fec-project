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

// Shared tolerance ($1) — guards against sub-dollar FEC rounding being read as a real
// divergence in any residual reconciliation check. (Until Step 5 it also drove the Gate-1
// non-federal detector; that gate was lifted 2026-06-10, but the constant is retained as the
// canonical $1 tolerance for residual checks.)
var SANKEY_TOLERANCE = 1;

// Numeric field read — anything non-numeric (null / undefined / string) → 0.
function _sankeyNum(rec, key) {
  var v = rec ? rec[key] : 0;
  return (typeof v === 'number' && !isNaN(v)) ? v : 0;
}

// ── Gate detector (Option A: gate lives inside the adapter) ──────────────────
// Returns a reason string when the entity is out of scope, else null.
//   'presidential' — Form 3P. The adapter now models the proven spend-side blocker
//                    (fundraising_disbursements / exempt_legal_accounting_disbursement)
//                    and conserves, BUT the raised side still mislabels Form-3P loans
//                    (loans_received / other_loans_received) into the Other-receipts
//                    remainder — the adapter's Loans node reads only the Form-3/3X names.
//                    So presidential stays gated → donut fallback until that raised-side
//                    field resolution lands (the Gate-2 production flip). See
//                    strategy/sankey-data-model.md §4a Gate 2.
// Gate 1 (non-federal / dual-account) was LIFTED in Step 5 (2026-06-10): the adapter models
// FEA + non-fed transfers (folded into Transfers in) + remainder catch-alls, so dual-account
// committees conserve to the penny and render the Sankey. The prior data-driven detector
// (receipts !== fed_receipts) is removed. `rec` is now unused but kept for signature stability
// (pages + tests call sankeyGateReason(rec, opts)).
function sankeyGateReason(rec, opts) {
  opts = opts || {};
  if (opts.isPresidential) return 'presidential';
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

  var g = function(k) { return _sankeyNum(rec, k); };
  var push = function(arr, node) { if (node.value > 0) arr.push(node); };

  var receiptTotal = g('receipts');
  var disbTotal    = g('disbursements');
  var cohEnd       = g('last_cash_on_hand_end_period');
  // DERIVED for both entities (accounting identity) — guarantees the two sides balance.
  var cohStart     = cohEnd + disbTotal - receiptTotal;

  // FORM-AGNOSTIC field resolution (do NOT branch node fields on opts.entity): committee.html
  // serves BOTH Form-3 candidate PCCs (e.g. /committee/C00806174) and Form-3X PACs/parties,
  // so the Form-3 vs Form-3X field-name pairs are COALESCED (summed — only one is populated
  // per record, since a committee files one form, so no double-count) and the form-specific
  // nodes (self-funding, IE, coordinated, contributions-to-candidates, candidate-contribution
  // refunds, federal funds) are pushed by PRESENCE (value > 0). This is the same approach as
  // the Step 0 donut fix; it makes a candidate PCC viewed on committee.html resolve its Form-3
  // fields + self-funding correctly, and a PAC its Form-3X nodes, regardless of which page
  // mounted it. opts.entity is used only by sankeyGateReason, not here.

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
  push(sources, { name: 'Transfers in',   // coalesce all transfer-in variants:
    // mutually exclusive by form (verified live 2026-06-09): Form 3 = *_other_authorized_committee,
    // Form 3X = *_affiliated_party, Form 3P = *_affiliated_committee (the JFC transfer — e.g. a
    // presidential principal's $534M; presidential still gated, so that term is for the Gate-2 flip).
    // PLUS the committee's own non-federal-account transfers (Step 5 Gate-1 un-gate, 2026-06-10):
    // on a dual-account committee these two fields ARE the entire receipts−fed_receipts gap (verified
    // exact on WI/TX). Folded (NOT a separate node) per the locked representation (a) — soft money stays
    // COMMINGLED rather than fed/non-fed-split; the dedicated hard/soft viz is the separate scoped work.
    // This mirrors the spend side, where the FEA parent keeps its own non-fed child commingled inside it
    // rather than splitting it out. A "Transfers in includes the non-federal account" disclosure tooltip
    // is the (deferred) render-layer honesty mechanism. All terms disjoint → the sum never double-counts.
    value: g('transfers_from_other_authorized_committee') + g('transfers_from_affiliated_party')
         + g('transfers_from_affiliated_committee')
         + g('transfers_from_nonfed_account') + g('transfers_from_nonfed_levin') });
  // Candidate self-funding = own gift + own loan, grouped by source so a self-funder isn't
  // hidden inside Loans (external-only). Form-3 only; 0 for a PAC → dropped by push().
  push(sources, { name: 'Candidate self-funding',
    value: g('candidate_contribution') + g('loans_made_by_candidate') });
  push(sources, { name: 'Loans',                                            // external; Form 3 + 3X names
    value: g('all_other_loans') + g('all_loans_received') });
  // Offsets (contra-receipt) — sum all offset variants PLUS fed_candidate_contribution_refunds
  // (Form-3X line 16: refunds of contributions the committee MADE to candidates, credited back).
  // All four are "amounts credited back to the committee"; folded into one node so "Offsets"
  // denotes the identical field-set as the donut "Offsets" wedge (aligned 2026-06-10 — previously
  // the refund was its own "Candidate-contribution refunds" node, which made the shared "Offsets"
  // label mean different things in the Sankey vs the donut). Conservation unchanged (sum preserved).
  push(sources, { name: 'Offsets',
    value: g('offsets_to_operating_expenditures') + g('offsets_to_fundraising_expenditures')
         + g('offsets_to_legal_accounting') + g('fed_candidate_contribution_refunds') });
  // Federal funds — presidential public financing (Form 3P). Pushed by presence; non-zero only
  // on a publicly-financed presidential record (gated today; for the Gate-2 flip + conservation).
  push(sources, { name: 'Federal funds', value: g('federal_funds') });
  // Other receipts — REMAINDER (receiptTotal − Σ named above), NOT the named other_receipts/
  // other_fed_receipts. Conserves by construction: absorbs any receipt not in a named leaf — the
  // TX-class unexposed residual (verified $17,063.22 in no exposed field), and any non-fed money
  // not folded into Transfers in. On a fed-only committee or candidate the remainder equals the
  // named other_*receipts to the penny (verified DCCC/SAP), so this is a no-op there. other:true
  // keeps it grey + bottom-pinned. max(0,…) is defensive — MECE guarantees ≥0 on every verified record.
  var srcNamed = sources.reduce(function(a, s) { return a + s.value; }, 0);
  push(sources, { name: 'Other receipts', other: true, value: Math.max(0, receiptTotal - srcNamed) });

  // ── Disbursement uses ──
  var uses = [];
  push(uses, { name: 'Operating expenditures', value: g('operating_expenditures') });
  push(uses, { name: 'Independent expenditures', value: g('independent_expenditures') });                           // 3X
  push(uses, { name: 'Coordinated party expenditures', value: g('coordinated_expenditures_by_party_committee') }); // party
  push(uses, { name: 'Contributions to candidates', value: g('fed_candidate_committee_contributions') });          // 3X
  // Federal election activity (Step 5 Gate-1 un-gate, 2026-06-10) — a disjoint top-level 3X leaf
  // (voter registration / GOTV in the pre-election window, funded partly with non-federal money).
  // On a state party it can be the single largest use (WI 44.5%); previously buried in the Other
  // remainder. 0/absent on fed-only committees + candidates → dropped by push(); disjoint from
  // operating_expenditures (the spent MECE closes with both as separate leaves) → never double-counts.
  push(uses, { name: 'Federal election activity', value: g('fed_election_activity') });                            // 3X
  // Presidential exempt spend (Step 5 Gate-2 adapter, 2026-06-10) — the proven spend-side blocker:
  // ~$8M on a publicly-financed campaign (McCain '08: $6.82M + $1.16M, conserves exactly), 0 on
  // modern privately-funded ones. Form-3P only. Itemized (not folded into Other) so a public-financing
  // campaign's exempt spend reads honestly. Renders only once the presidential gate flips.
  push(uses, { name: 'Fundraising', value: g('fundraising_disbursements') });                                      // 3P
  push(uses, { name: 'Exempt legal & accounting', value: g('exempt_legal_accounting_disbursement') });             // 3P
  push(uses, { name: 'Transfers out',                                       // Form 3 + 3X names
    value: g('transfers_to_other_authorized_committee') + g('transfers_to_affiliated_committee') });
  push(uses, { name: 'Loan repayments',                                     // Form 3 + 3X names
    value: g('loan_repayments') + g('loan_repayments_made') });
  push(uses, { name: 'Contribution refunds', value: g('contribution_refunds') });
  // Other disbursements — REMAINDER (disbTotal − Σ named above), mirroring Other receipts. Absorbs
  // the TX-class unexposed spend residual; equals named other_disbursements to the penny on fed-only
  // committees + candidates (verified DCCC/SAP). max(0,…) defensive.
  var useNamed = uses.reduce(function(a, u) { return a + u.value; }, 0);
  push(uses, { name: 'Other disbursements', other: true, value: Math.max(0, disbTotal - useNamed) });

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

// Recommended container height (px) for a model — content-adaptive so a sparse render
// (a candidate's ~6 sources) sits near the sibling timeline-chart's rhythm and a dense
// one (committee/party + COH nodes) grows only as needed, instead of a fixed height
// that leaves excess whitespace on sparse renders. Keyed to the taller column's node
// count. Gated models get a compact box for the "not yet modeled" message.
function sankeyHeight(model) {
  if (!model || model.gated) return 120;
  var L = model.sources.length + (model.cohStart > 0 ? 1 : 0);
  var R = model.uses.length + (model.cohEnd > 0 ? 1 : 0);
  var PER = 46;   // px per node slot — label legibility vs. compactness
  return Math.max(320, Math.min(560, Math.max(L, R) * PER + 24));
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
      // left/right 0 → the outer node rectangles align flush with the card's content
      // edge (labels point inward, so nothing clips outward); top/bottom 8 reserves
      // ~half a label line so a thin (min-height-floored) edge node — Other / Cash-on-
      // hand, pinned to the bottom — doesn't have its centered label clipped.
      type: 'sankey', left: 0, right: 0, top: 8, bottom: 8,
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
  // Re-read the container box: the caller sets the height per-render (sankeyHeight),
  // and on a reused instance setOption alone keeps the old canvas size. Safe when
  // visible (callers only render into a visible container).
  chart.resize();
  return chart;
}
