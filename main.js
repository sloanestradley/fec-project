// ── Amplitude Analytics ─────────────────────────────
!function(){"use strict";!function(e,t){var r=e.amplitude||{_q:[],_iq:{}};if(r.invoked)e.console&&console.error&&console.error("Amplitude snippet has been loaded.");else{r.invoked=!0;var n=t.createElement("script");n.type="text/javascript";n.async=!0;n.src="https://cdn.amplitude.com/libs/analytics-browser-2.11.1-min.js.gz";n.onload=function(){e.amplitude.runQueuedFunctions||console.log("[Amplitude] Error: could not load SDK")};var s=t.getElementsByTagName("script")[0];function v(e,t){e.prototype[t]=function(){return this._q.push({name:t,args:Array.prototype.slice.call(arguments,0)}),this}}s.parentNode.insertBefore(n,s);for(var o=function(){return this._q=[],this},i=["add","append","clearAll","prepend","set","setOnce","unset","preInsert","postInsert","remove","getUserProperties"],a=0;a<i.length;a++)v(o,i[a]);r.Identify=o;for(var c=function(){return this._q=[],this},u=["getEventProperties","setProductId","setQuantity","setPrice","setRevenue","setRevenueType","setEventProperties"],l=0;l<u.length;l++)v(c,u[l]);r.Revenue=c;var p=["getDeviceId","setDeviceId","getSessionId","setSessionId","getUserId","setUserId","setOptOut","setTransport","reset","extendSession"],d=["init","add","remove","track","logEvent","identify","groupIdentify","setGroup","revenue","flush"];function f(e){function t(t,r){e[t]=function(){var n={promise:new Promise((r=>{e._q.push({name:t,args:Array.prototype.slice.call(arguments,0),resolve:r})}))};if(r)return n.promise;return n}}for(var r=0;r<p.length;r++)t(p[r],!1);for(var n=0;n<d.length;n++)t(d[n],!0)}f(r);e.amplitude=r}}(window,document)}();
amplitude.init('62280d38083601e001bf153dbcf38a9b', { defaultTracking: false });
if (window.sessionReplay) amplitude.add(window.sessionReplay.plugin({ sampleRate: 1 }));

// ── Hamburger nav (drawer drops down from top) ───────
// Toggles #mobile-nav + a body-level dimming overlay (.mobile-nav-overlay,
// injected once below). The menu closes on: hamburger re-tap, nav-item click,
// tap/click outside the drawer (excluding the hamburger, so the opening tap
// doesn't self-close), Escape, and scroll. aria-expanded stays in sync on every
// path.
//
// Close-on-scroll is load-bearing, not polish: the banner-uncovered design
// assumes the drawer only lives at scroll-top (.top-nav is in-flow and scrolls
// away with the hamburger). But the overlay is position:fixed while the nav +
// drawer are not — so scrolling with the menu open would slide the nav/drawer
// out of view while the fixed scrim stays, exposing page content in the 32px
// strip above it where the banner should be. Closing on scroll keeps that
// invariant valid. Chosen over a scroll-lock (search-overlay's overflow:hidden
// approach) because the menu is only meaningful at the top — closing is lighter
// and doesn't trap the user on a frozen page.
(function() {
  var btn = document.getElementById('hamburger');
  if (!btn) return;
  var nav = document.getElementById('mobile-nav');

  // Body-level overlay — a sibling of .top-nav so it sits OUTSIDE the nav's
  // z-index:200 stacking context (an inline child couldn't render below the nav
  // while above page content). Stacking is governed by z-index (198), so
  // appending at end-of-body is equivalent to placing it adjacent to .top-nav.
  var overlay = document.getElementById('mobile-nav-overlay');
  if (!overlay) {
    document.body.insertAdjacentHTML('beforeend', '<div class="mobile-nav-overlay" id="mobile-nav-overlay"></div>');
    overlay = document.getElementById('mobile-nav-overlay');
  }

  function isOpen() { return nav.classList.contains('open'); }
  function setMenu(open) {
    nav.classList.toggle('open', open);
    btn.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  }
  function closeMenu() { if (isOpen()) setMenu(false); }

  btn.addEventListener('click', function() { setMenu(!isOpen()); });

  nav.querySelectorAll('.nav-item').forEach(function(el) {
    el.addEventListener('click', closeMenu);
  });

  // Outside-tap: close when open and the interaction is outside the drawer AND
  // not the hamburger (its own handler owns the toggle). The scrim is outside
  // #mobile-nav, so a tap on it is covered here too — no separate handler.
  document.addEventListener('click', function(e) {
    if (!isOpen()) return;
    if (nav.contains(e.target) || btn.contains(e.target)) return;
    closeMenu();
  });
  // Escape closes (mirrors the search overlay's Esc affordance).
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeMenu();
  });
  // Scroll closes — see the close-on-scroll rationale above.
  window.addEventListener('scroll', closeMenu, { passive: true });
})();

// ── Search overlay (T-search-overlay) ─────────────────────────────────────
// The search experience as a layer over the current page. Opened from the nav
// search button (desktop) or the mobile search-toggle; closed via the X,
// Escape, or browser-back — all routed through history.back() so the popstate
// handler is the single close path.
//
// State-only pushState: opening pushes ONE history entry at the SAME url
// (fragment included), so it never fires hashchange — the profile-page
// hashchange listeners (candidate.html / committee.html) stay dormant. Refresh
// closes the overlay (init never opens it; history.state is not consulted on
// load). bfcache restore of an overlay-open page is snapped closed via pageshow.
//
// Injected once on every nav page; the panel reuses initSearchPanel (utils.js)
// with overlay-prefixed IDs so it never collides with /search's page-mode IDs.
(function() {
  var OVERLAY_HTML = `
    <div id="search-overlay" class="search-overlay" role="dialog" aria-modal="true" aria-labelledby="search-overlay-title">
      <div class="search-overlay-head">
        <h2 id="search-overlay-title" class="sr-only">Search candidates and committees</h2>
        <button type="button" class="search-overlay-close" id="search-overlay-close" aria-label="Close search">✕</button>
      </div>
      <div class="search-overlay-inner">
        <div class="search-overlay-search">
          <div class="search-field">
            <svg class="search-field-icon" aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" class="form-input" id="overlay-search-input" placeholder="Search candidates and committees" autocomplete="off" spellcheck="false" aria-label="Search candidates and committees"/>
          </div>
        </div>
        <div id="overlay-loading" style="display:none">
          <div class="state-msg"><div class="loader"></div><span>Searching FEC records…</span></div>
        </div>
        <div id="overlay-results" style="display:none"></div>
        <div id="overlay-no-results" style="display:none">
          <div class="no-results"><strong>No results found</strong> No candidates or committees matched your search. Try a different name or spelling.</div>
        </div>
        <div id="overlay-error" style="display:none">
          <div class="error-prompt"><strong>Couldn't load results</strong> There was a problem fetching data from the FEC API. <div><button class="retry-btn">Retry</button></div></div>
        </div>
      </div>
    </div>`;

  var overlayPanel = null;
  var lastFocused = null;

  function overlayEl()     { return document.getElementById('search-overlay'); }
  function overlayIsOpen() { var el = overlayEl(); return !!el && el.classList.contains('open'); }

  // from_page for the Search Opened event — derived from the URL path.
  function pageName() {
    return (location.pathname.split('/')[1] || 'index').replace(/\.html$/, '');
  }

  // Every direct child of <body> except the overlay — made inert while open.
  function backgroundEls() {
    var ov = overlayEl();
    return Array.prototype.filter.call(document.body.children, function(c) { return c !== ov; });
  }

  function openOverlay() {
    var el = overlayEl();
    if (!el || overlayIsOpen()) return;
    lastFocused = document.activeElement;
    // State-only: same url, fragment included → no hashchange.
    history.pushState({ overlay: true }, '', location.href);
    var input = document.getElementById('overlay-search-input');
    input.value = '';                 // Decision 5 — overlay opens empty
    if (overlayPanel) overlayPanel.clear();
    backgroundEls().forEach(function(c) { c.setAttribute('inert', ''); });
    document.body.style.overflow = 'hidden';
    el.classList.add('open');
    input.focus();
    amplitude.track('Search Opened', { from_page: pageName() });
  }

  // Reset the overlay DOM to closed. Does NOT touch history — the popstate
  // that triggered this already moved the history pointer.
  function closeOverlayDOM() {
    var el = overlayEl();
    if (!el || !overlayIsOpen()) return;
    el.classList.remove('open');
    backgroundEls().forEach(function(c) { c.removeAttribute('inert'); });
    document.body.style.overflow = '';
    if (overlayPanel) overlayPanel.clear();   // also discards any in-flight fetch
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }

  // X / Escape / browser-back all close the same way: pop the history entry.
  // The popstate handler is the sole closeOverlayDOM caller during normal use.
  function requestClose() { if (overlayIsOpen()) history.back(); }

  // Focus trap — Tab cycles within the overlay's visible focusables. The inert
  // background already removes everything else from the tab order; this wraps
  // the ends so focus never leaves the overlay.
  function trapFocus(e) {
    if (e.key !== 'Tab' || !overlayIsOpen()) return;
    var f = Array.prototype.filter.call(
      overlayEl().querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])'),
      function(n) { return n.offsetParent !== null; }
    );
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function injectSearchOverlay() {
    if (document.getElementById('search-overlay')) return;
    // The overlay reuses initSearchPanel (utils.js). Every nav page loads
    // utils.js — guard anyway so a future page that forgets it degrades to
    // "no overlay" rather than a half-injected, broken one.
    if (typeof initSearchPanel !== 'function') return;
    document.body.insertAdjacentHTML('beforeend', OVERLAY_HTML);
    overlayPanel = initSearchPanel({
      inputEl:     document.getElementById('overlay-search-input'),
      resultsEl:   document.getElementById('overlay-results'),
      loadingEl:   document.getElementById('overlay-loading'),
      noResultsEl: document.getElementById('overlay-no-results'),
      errorEl:     document.getElementById('overlay-error'),
      fromPage:    'search'
    });
    var retry = document.querySelector('#overlay-error .retry-btn');
    if (retry) retry.addEventListener('click', function() {
      overlayPanel.query(document.getElementById('overlay-search-input').value);
    });
    document.getElementById('search-overlay-close').addEventListener('click', requestClose);
    overlayEl().addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { e.preventDefault(); requestClose(); }
      else trapFocus(e);
    });
    // Triggers — desktop nav button + mobile search-toggle. The /search nav
    // button carries aria-current="page" and is left unwired (no-op there).
    var navBtn = document.getElementById('nav-search-btn');
    if (navBtn && navBtn.getAttribute('aria-current') !== 'page') {
      navBtn.addEventListener('click', openOverlay);
    }
    // Parity with #nav-search-btn: on /search the toggle carries
    // aria-current="page" and stays unwired (muted no-op — already on search).
    var mobileToggle = document.getElementById('top-nav-search-toggle');
    if (mobileToggle && mobileToggle.getAttribute('aria-current') !== 'page') {
      mobileToggle.addEventListener('click', openOverlay);
    }
  }

  // DOMContentLoaded — by then utils.js has loaded, so initSearchPanel exists.
  document.addEventListener('DOMContentLoaded', injectSearchOverlay);

  // Browser-back (and X / Escape, routed through history.back()) → close.
  window.addEventListener('popstate', function(e) {
    if (overlayIsOpen() && !(e.state && e.state.overlay)) closeOverlayDOM();
  });
  // bfcache restore of an overlay-open page → snap closed deterministically.
  window.addEventListener('pageshow', function(e) {
    if (e.persisted && overlayIsOpen()) closeOverlayDOM();
  });
})();
