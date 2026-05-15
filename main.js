// ── Amplitude Analytics ─────────────────────────────
!function(){"use strict";!function(e,t){var r=e.amplitude||{_q:[],_iq:{}};if(r.invoked)e.console&&console.error&&console.error("Amplitude snippet has been loaded.");else{r.invoked=!0;var n=t.createElement("script");n.type="text/javascript";n.async=!0;n.src="https://cdn.amplitude.com/libs/analytics-browser-2.11.1-min.js.gz";n.onload=function(){e.amplitude.runQueuedFunctions||console.log("[Amplitude] Error: could not load SDK")};var s=t.getElementsByTagName("script")[0];function v(e,t){e.prototype[t]=function(){return this._q.push({name:t,args:Array.prototype.slice.call(arguments,0)}),this}}s.parentNode.insertBefore(n,s);for(var o=function(){return this._q=[],this},i=["add","append","clearAll","prepend","set","setOnce","unset","preInsert","postInsert","remove","getUserProperties"],a=0;a<i.length;a++)v(o,i[a]);r.Identify=o;for(var c=function(){return this._q=[],this},u=["getEventProperties","setProductId","setQuantity","setPrice","setRevenue","setRevenueType","setEventProperties"],l=0;l<u.length;l++)v(c,u[l]);r.Revenue=c;var p=["getDeviceId","setDeviceId","getSessionId","setSessionId","getUserId","setUserId","setOptOut","setTransport","reset","extendSession"],d=["init","add","remove","track","logEvent","identify","groupIdentify","setGroup","revenue","flush"];function f(e){function t(t,r){e[t]=function(){var n={promise:new Promise((r=>{e._q.push({name:t,args:Array.prototype.slice.call(arguments,0),resolve:r})}))};if(r)return n.promise;return n}}for(var r=0;r<p.length;r++)t(p[r],!1);for(var n=0;n<d.length;n++)t(d[n],!0)}f(r);e.amplitude=r}}(window,document)}();
amplitude.init('62280d38083601e001bf153dbcf38a9b', { defaultTracking: false });
if (window.sessionReplay) amplitude.add(window.sessionReplay.plugin({ sampleRate: 1 }));

// ── Nav natural-scroll-out, animated reveal (T-nav-scroll v2) ────────────
// Asymmetric pattern: nav is in natural document flow by default (NOT sticky).
// Scroll-down → nav scrolls out of view naturally with the document, no
// animation. Scroll-up past 80px upward accumulator → add .revealed class →
// nav becomes sticky at top:0 AND @keyframes navSlideIn runs once. Hide
// direction (scroll-down 10px while revealed) → remove .revealed → nav snaps
// back to natural flow, instantly out of viewport. Programmatic scrolls are
// gated by window.__navScrollSuppressUntil (set by utils.js view.switchTo).
// Overlay states (mobile drawer, search panel, modal) force the nav visible
// via window.__navForceVisible(key, on) — under v2 this can trigger the
// slide-in animation if the nav was in natural-flow scrolled-out state when
// the overlay opened (intended; user invoked an overlay, nav should appear).
// Nav state does NOT persist across page loads — every page starts in
// natural-flow default (not revealed).
//
// window.__navOffsetTarget exposes the target sticky-top value for surfaces
// below the nav (compact-header listener reads this instead of the live
// --nav-offset CSS value to avoid mid-animation flicker during the 200ms
// reveal transition; see initCompactHeader in utils.js).
(function() {
  var nav = document.getElementById('top-nav');
  if (!nav) return;
  if (typeof window.__navScrollSuppressUntil !== 'number') window.__navScrollSuppressUntil = 0;
  var headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 56;
  window.__navOffsetTarget = 0; // default: nav in natural flow, no sticky offset below
  var lastScrollY = window.scrollY;
  var lastScrollHeight = document.documentElement.scrollHeight;
  var upwardAccumulator = 0;
  var downwardAccumulator = 0;
  var isRevealed = false;
  var forceKeys = {};
  var forceCount = 0;
  var animatingTimer = null;

  function setRevealed(reveal) {
    if (reveal === isRevealed) return;
    if (!reveal && forceCount > 0) return;
    isRevealed = reveal;
    // html.nav-animating gates the asymmetric `top` transitions on the
    // profile-header / tabs-bar / committee-header / race-header chain.
    // Applied only on reveal direction — hide is instant per the asymmetric
    // design. Removed after 250ms (animation duration + margin).
    if (reveal) {
      document.documentElement.classList.add('nav-animating');
      if (animatingTimer) clearTimeout(animatingTimer);
      animatingTimer = setTimeout(function() {
        document.documentElement.classList.remove('nav-animating');
        animatingTimer = null;
      }, 250);
    }
    nav.classList.toggle('revealed', reveal);
    window.__navOffsetTarget = reveal ? headerH : 0;
    if (reveal) document.documentElement.style.setProperty('--nav-offset', headerH + 'px');
    else document.documentElement.style.removeProperty('--nav-offset');
  }

  window.__navForceVisible = function(key, on) {
    if (on) {
      if (!forceKeys[key]) { forceKeys[key] = true; forceCount++; }
      setRevealed(true);
    } else if (forceKeys[key]) {
      forceKeys[key] = false; forceCount--;
    }
  };

  window.addEventListener('scroll', function() {
    if (Date.now() < window.__navScrollSuppressUntil) {
      lastScrollY = window.scrollY;
      lastScrollHeight = document.documentElement.scrollHeight;
      return;
    }
    var y = window.scrollY;
    var h = document.documentElement.scrollHeight;
    var prevY = lastScrollY;
    var dy = y - prevY;
    lastScrollY = y;
    lastScrollHeight = h;
    // Clamp-event filter (T-nav-scroll v2): if the previous scrollY would now
    // be beyond the page's new max-scroll (because scrollHeight shrank), the
    // browser will have clamped scrollY downward — the negative dy is the
    // clamp adjustment, not user input. Skip direction processing. Distinct
    // from a simple `dh < 0` check: a page that shrinks slightly during a
    // legitimate user scroll-up still has the prev position within the new
    // max, so we process it correctly. Only the case where the prev position
    // is now invalid is filtered. (lastScrollY/Height sync above already
    // happened so the next real event compares from the clamped state.)
    var newMaxScroll = Math.max(0, h - window.innerHeight);
    if (prevY > newMaxScroll) return;
    if (dy > 0) {
      upwardAccumulator = 0;
      // Hide direction: 10px downward accumulator before removing .revealed.
      // Prevents micro-oscillation on trackpad/precise input from flickering
      // the nav state. Asymmetric with the 80px reveal accumulator — hide is
      // forgiving, reveal requires deliberate upward intent.
      if (isRevealed) {
        downwardAccumulator += dy;
        if (downwardAccumulator >= 10) {
          downwardAccumulator = 0;
          setRevealed(false);
        }
      }
    } else if (dy < 0) {
      downwardAccumulator = 0;
      if (!isRevealed) {
        upwardAccumulator -= dy;
        if (upwardAccumulator >= 80) {
          upwardAccumulator = 0;
          setRevealed(true);
        }
      }
    }
  }, { passive: true });
})();

// ── Hamburger nav (drawer drops down from top) ───────
(function() {
  var btn = document.getElementById('hamburger');
  if (!btn) return;
  var nav = document.getElementById('mobile-nav');
  var searchPanel = document.getElementById('top-nav-mobile-search');
  btn.addEventListener('click', function() {
    var open = nav.classList.toggle('open');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open && searchPanel && searchPanel.classList.contains('open')) {
      searchPanel.classList.remove('open');
      if (window.__navForceVisible) window.__navForceVisible('search', false);
    }
    if (window.__navForceVisible) window.__navForceVisible('drawer', open);
  });
  nav.querySelectorAll('.nav-item').forEach(function(el) {
    el.addEventListener('click', function() {
      nav.classList.remove('open');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      // Force-visible release omitted — nav-item click navigates to a new
      // page and the fresh load resets nav state to default-visible.
    });
  });
})();

// ── Search icon toggle (mobile) ──────────────────────
(function() {
  var toggle = document.getElementById('top-nav-search-toggle');
  if (!toggle) return;
  var panel = document.getElementById('top-nav-mobile-search');
  var nav = document.getElementById('mobile-nav');
  var hamburger = document.getElementById('hamburger');
  toggle.addEventListener('click', function() {
    var open = panel.classList.toggle('open');
    if (open && nav && nav.classList.contains('open')) {
      nav.classList.remove('open');
      if (hamburger) { hamburger.classList.remove('open'); hamburger.setAttribute('aria-expanded', 'false'); }
      if (window.__navForceVisible) window.__navForceVisible('drawer', false);
    }
    if (open) {
      var inp = document.getElementById('top-nav-mobile-search-input');
      if (inp) inp.focus();
    }
    if (window.__navForceVisible) window.__navForceVisible('search', open);
  });
})();

// ── Nav search typeahead ──────────────────────────────

function officeWord(code) {
  return { H: 'House', S: 'Senate', P: 'President' }[code] || code || '';
}

function buildTypeaheadHTML(candidates, committees) {
  var html = '';
  html += '<div class="typeahead-group-label">Candidates</div>';
  if (candidates.length) {
    html += candidates.map(function(c) {
      var name = formatCandidateName(c.name);
      return '<a class="typeahead-row" href="/candidate/' + c.candidate_id + '">'
        + '<span class="typeahead-row-left">' + name
        + ' <span class="typeahead-row-id">(' + c.candidate_id + ')</span></span>'
        + '<span class="typeahead-row-right">' + officeWord(c.office) + '</span>'
        + '</a>';
    }).join('');
  } else {
    html += '<div class="typeahead-empty">No candidates found</div>';
  }
  html += '<div class="typeahead-group-label">Committees</div>';
  if (committees.length) {
    html += committees.map(function(c) {
      var dotCls = filingFrequencyDotClass(c.filing_frequency);
      return '<a class="typeahead-row" href="/committee/' + c.committee_id + '">'
        + '<span class="typeahead-row-left">' + c.name
        + ' <span class="typeahead-row-id">(' + c.committee_id + ')</span></span>'
        + '<span class="typeahead-row-right">'
        + '<span class="typeahead-status-dot ' + dotCls + '"></span>'
        + '</span>'
        + '</a>';
    }).join('');
  } else {
    html += '<div class="typeahead-empty">No committees found</div>';
  }
  return html;
}

var navTypeaheadTimer = null;

function showNavTypeahead(html) {
  var d = document.getElementById('nav-typeahead-dropdown');
  if (!d) return;
  d.innerHTML = html;
  d.style.display = 'block';
}

function hideNavTypeahead() {
  var d = document.getElementById('nav-typeahead-dropdown');
  if (!d) return;
  d.style.display = 'none';
  d.innerHTML = '';
}

async function doNavTypeahead(query) {
  if (query.length < 2) { hideNavTypeahead(); return; }
  var d = document.getElementById('nav-typeahead-dropdown');
  if (!d) return;
  d.innerHTML = '<div class="typeahead-loading">Searching…</div>';
  d.style.display = 'block';
  try {
    var results = await Promise.all([
      apiFetch('/candidates/', { q: query, per_page: 5, sort: '-receipts' }),
      apiFetch('/committees/', { q: query, per_page: 5, sort: '-receipts' }),
    ]);
    showNavTypeahead(buildTypeaheadHTML(results[0].results || [], results[1].results || []));
  } catch(e) {
    hideNavTypeahead();
  }
}

// ── Global search form submit ─────────────────────────
(function() {
  function bindSearchForm(formId) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var inp = form.querySelector('input[type="search"]');
      var q = inp ? inp.value.trim() : '';
      if (!q) return;
      if (typeof window.__navSearchHandler === 'function') {
        window.__navSearchHandler(q);
      } else {
        window.location.href = '/search?q=' + encodeURIComponent(q);
      }
    });
  }
  bindSearchForm('top-nav-search-form');
  bindSearchForm('top-nav-mobile-search-form');

  // ── Nav input typeahead wiring ──────────────────────
  var navInput = document.getElementById('top-nav-search-input');
  if (navInput) {
    navInput.addEventListener('input', function() {
      clearTimeout(navTypeaheadTimer);
      var v = navInput.value.trim();
      navTypeaheadTimer = setTimeout(function() { doNavTypeahead(v); }, 300);
    });
    navInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') hideNavTypeahead();
    });
    document.addEventListener('click', function(e) {
      var d = document.getElementById('nav-typeahead-dropdown');
      if (d && !d.contains(e.target) && e.target !== navInput) hideNavTypeahead();
    });
  }
})();
