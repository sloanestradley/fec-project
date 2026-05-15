// ── Amplitude Analytics ─────────────────────────────
!function(){"use strict";!function(e,t){var r=e.amplitude||{_q:[],_iq:{}};if(r.invoked)e.console&&console.error&&console.error("Amplitude snippet has been loaded.");else{r.invoked=!0;var n=t.createElement("script");n.type="text/javascript";n.async=!0;n.src="https://cdn.amplitude.com/libs/analytics-browser-2.11.1-min.js.gz";n.onload=function(){e.amplitude.runQueuedFunctions||console.log("[Amplitude] Error: could not load SDK")};var s=t.getElementsByTagName("script")[0];function v(e,t){e.prototype[t]=function(){return this._q.push({name:t,args:Array.prototype.slice.call(arguments,0)}),this}}s.parentNode.insertBefore(n,s);for(var o=function(){return this._q=[],this},i=["add","append","clearAll","prepend","set","setOnce","unset","preInsert","postInsert","remove","getUserProperties"],a=0;a<i.length;a++)v(o,i[a]);r.Identify=o;for(var c=function(){return this._q=[],this},u=["getEventProperties","setProductId","setQuantity","setPrice","setRevenue","setRevenueType","setEventProperties"],l=0;l<u.length;l++)v(c,u[l]);r.Revenue=c;var p=["getDeviceId","setDeviceId","getSessionId","setSessionId","getUserId","setUserId","setOptOut","setTransport","reset","extendSession"],d=["init","add","remove","track","logEvent","identify","groupIdentify","setGroup","revenue","flush"];function f(e){function t(t,r){e[t]=function(){var n={promise:new Promise((r=>{e._q.push({name:t,args:Array.prototype.slice.call(arguments,0),resolve:r})}))};if(r)return n.promise;return n}}for(var r=0;r<p.length;r++)t(p[r],!1);for(var n=0;n<d.length;n++)t(d[n],!0)}f(r);e.amplitude=r}}(window,document)}();
amplitude.init('62280d38083601e001bf153dbcf38a9b', { defaultTracking: false });
if (window.sessionReplay) amplitude.add(window.sessionReplay.plugin({ sampleRate: 1 }));

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
    if (open && searchPanel) searchPanel.classList.remove('open');
  });
  nav.querySelectorAll('.nav-item').forEach(function(el) {
    el.addEventListener('click', function() {
      nav.classList.remove('open');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
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
    if (open && nav) {
      nav.classList.remove('open');
      if (hamburger) { hamburger.classList.remove('open'); hamburger.setAttribute('aria-expanded', 'false'); }
    }
    if (open) {
      var inp = document.getElementById('top-nav-mobile-search-input');
      if (inp) inp.focus();
    }
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
