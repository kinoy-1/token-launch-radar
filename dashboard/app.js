// Token Radar — the dashboard (no framework, no network).
//
// Reads window.RADAR (written by main.ts into data.js), renders the ranked
// board with search, filters and sorting, a detail view for every protocol
// with its model breakdown and its seven-step farm plan, a live-token view
// for comparison, and a top-ten chart. Hash routing, so each view has an
// address: #<slug> opens a protocol, #watchlist shows the watchlist only,
// #category=<name> filters to one category.

(function () {
  'use strict';

  var D = window.RADAR;
  var tbody = document.getElementById('rows');
  var detailEl = document.getElementById('detail');
  var allRows = D.rows.slice();
  var state = { q: '', cat: '', chain: '', scope: 'all', sort: 'rank', dir: 1 };

  // ---------- formatting ----------
  function money(n) {
    if (n === null || n === undefined) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) {
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    return s;
  }
  function pctClass(n) {
    if (n === null || n === undefined) return 'flat';
    return n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
  }
  function age(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 365) return (n / 365).toFixed(1) + 'y';
    return n + 'd';
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- header, stats, chart ----------
  function renderMeta() {
    document.getElementById('meta').textContent =
      'Snapshot ' + D.as_of + ' · floor $' + (D.floor_usd / 1e6).toFixed(0) + 'M · ' +
      D.board_size + ' protocols ranked · model ' + D.model_version;
    var total = 0;
    for (var i = 0; i < allRows.length; i++) total += allRows[i].implied_value_usd;
    var med = allRows.slice().sort(function (a, b) { return a.age_days - b.age_days; });
    var medAge = med.length ? med[Math.floor(med.length / 2)].age_days : null;
    var stats = [
      [String(D.board_size), 'ranked'],
      [String(D.watchlist_size), 'on watchlist'],
      [String(D.early_size), 'early finds'],
      [money(total), 'total implied'],
      [medAge === null || medAge === undefined ? '—' : age(medAge), 'median age'],
    ];
    document.getElementById('stats').innerHTML = stats
      .map(function (s) { return '<div class="stat"><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>'; })
      .join('');
  }

  function renderChart() {
    var top = allRows.slice(0, 10);
    var max = top.length ? top[0].implied_value_usd : 1;
    var W = 1080, rowH = 34, topPad = 8;
    var H = topPad + top.length * rowH + 8;
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Top ten protocols by implied value">'];
    for (var i = 0; i < top.length; i++) {
      var r = top[i];
      var w = Math.max(4, (r.implied_value_usd / max) * 640);
      var y = topPad + i * rowH;
      out.push(
        '<text x="0" y="' + (y + 15) + '" fill="#9aa7b8" font-size="13">' + (i + 1) + '.</text>',
        '<text x="28" y="' + (y + 15) + '" fill="#e6edf3" font-size="13">' + esc(r.name) + '</text>',
        '<rect x="240" y="' + (y + 3) + '" width="' + w.toFixed(0) + '" height="18" rx="4" fill="#58a6ff" opacity="0.85"/>',
        '<text x="' + (240 + w + 10) + '" y="' + (y + 16) + '" fill="#e6edf3" font-size="13">' + money(r.implied_value_usd) + '</text>'
      );
    }
    out.push('</svg>');
    document.getElementById('chart').innerHTML = out.join('');
  }

  // ---------- filters ----------
  function fillSelects() {
    var cats = {}, chains = {};
    for (var i = 0; i < allRows.length; i++) {
      if (allRows[i].category) cats[allRows[i].category] = 1;
      for (var j = 0; j < allRows[i].chains.length; j++) chains[allRows[i].chains[j]] = 1;
    }
    var catSel = document.getElementById('cat');
    Object.keys(cats).sort().forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c; catSel.appendChild(o);
    });
    var chSel = document.getElementById('chain');
    Object.keys(chains).sort().forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c; chSel.appendChild(o);
    });
  }

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    var out = [];
    for (var i = 0; i < allRows.length; i++) {
      var r = allRows[i];
      if (state.scope === 'watchlist' && !r.on_watchlist) continue;
      if (state.scope === 'early' && r.on_watchlist) continue;
      if (state.cat && r.category !== state.cat) continue;
      if (state.chain && r.chains.indexOf(state.chain) < 0) continue;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) continue;
      out.push(r);
    }
    var k = state.sort;
    out.sort(function (a, b) {
      var d = 0;
      if (k === 'rank') d = a.rank - b.rank;
      else if (k === 'tvl') d = b.tvl_usd - a.tvl_usd;
      else if (k === 'growth') d = (b.change_7d === null ? -1e9 : b.change_7d) - (a.change_7d === null ? -1e9 : a.change_7d);
      else if (k === 'age') d = (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days);
      else if (k === 'name') d = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      else if (k === 'implied') d = b.implied_value_usd - a.implied_value_usd;
      return d * state.dir;
    });
    return out;
  }

  function renderBoard() {
    var rows = visibleRows();
    document.getElementById('count').textContent = rows.length + ' of ' + allRows.length + ' shown';
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var badge = r.on_watchlist
        ? '<span class="badge watch">Watchlist</span>'
        : '<span class="badge early">Early</span>';
      html += '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td class="name">' + esc(r.name) + badge + '<small>' + esc(r.slug) + '</small></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 2).join(', ') || '—') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + pctClass(r.change_7d) + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td>' +
        '</tr>';
    }
    tbody.innerHTML = html || '<tr><td colspan="8" class="empty">No protocol matches these filters.</td></tr>';
  }

  // ---------- live view ----------
  function renderLive() {
    var html = '';
    for (var i = 0; i < D.live.length; i++) {
      var r = D.live[i];
      html += '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="name">' + esc(r.name) + '<small>' + esc(r.slug) + '</small></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + (r.mcap_usd === null ? '—' : money(r.mcap_usd)) + '</td>' +
        '<td class="num ' + pctClass(r.change_7d) + '">' + pct(r.change_7d) + '</td>' +
        '</tr>';
    }
    document.getElementById('liveRows').innerHTML = html;
  }

  // ---------- detail view ----------
  function bySlug(slug) {
    for (var i = 0; i < allRows.length; i++) if (allRows[i].slug === slug) return allRows[i];
    return null;
  }

  function renderDetail(slug) {
    var r = bySlug(slug);
    if (!r) {
      detailEl.hidden = true;
      detailEl.innerHTML = '';
      document.body.classList.remove('detail-only');
      return;
    }
    document.body.classList.add('detail-only');
    var steps = r.farm_steps || [];
    var stepsHtml = steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var m = D.model;
    detailEl.innerHTML =
      '<h2>' + esc(r.name) + ' <span class="badge ' + (r.on_watchlist ? 'watch' : 'early') + '">' +
      (r.on_watchlist ? 'Watchlist' : 'Early find') + '</span></h2>' +
      '<p class="slug">' + esc(r.slug) + ' · rank #' + r.rank + ' of ' + allRows.length + '</p>' +
      '<dl>' +
      '<div><dt>Implied value</dt><dd>' + moneyFull(r.implied_value_usd) + '</dd></div>' +
      '<div><dt>TVL</dt><dd>' + moneyFull(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7-day change</dt><dd class="' + pctClass(r.change_7d) + '">' + pct(r.change_7d) + '</dd></div>' +
      '<div><dt>Age</dt><dd>' + (r.age_days === null ? 'unknown' : r.age_days + ' days') + '</dd></div>' +
      '<div><dt>Category</dt><dd>' + esc(r.category || '—') + '</dd></div>' +
      '<div><dt>Chains</dt><dd>' + esc(r.chains.join(', ') || '—') + '</dd></div>' +
      '<div><dt>Listed</dt><dd>' + esc(r.listed_at || '—') + '</dd></div>' +
      '<div><dt>Token</dt><dd>none recorded</dd></div>' +
      '</dl>' +
      '<h3>Why this value</h3>' +
      '<p class="formula">implied = TVL × ' + m.base_multiple + ' × growth × maturity × chains\n' +
      '  = ' + moneyFull(r.tvl_usd) + ' × ' + m.base_multiple + ' × ' + r.growth_multiplier.toFixed(4) +
      ' × ' + r.maturity_multiplier.toFixed(4) + ' × ' + r.chain_multiplier.toFixed(4) +
      '\n  = ' + moneyFull(r.implied_value_usd) + '</p>' +
      '<h3>How to farm it — seven steps</h3>' +
      '<ol class="steps">' + stepsHtml + '</ol>' +
      '<button class="back" id="backBtn" type="button">← Back to the board</button>';
    detailEl.hidden = false;
    document.getElementById('backBtn').addEventListener('click', function () {
      location.hash = '';
    });
  }

  // ---------- wiring ----------
  function bind() {
    document.getElementById('q').addEventListener('input', function (e) {
      state.q = e.target.value; renderBoard();
    });
    document.getElementById('cat').addEventListener('change', function (e) {
      state.cat = e.target.value; renderBoard();
    });
    document.getElementById('chain').addEventListener('change', function (e) {
      state.chain = e.target.value; renderBoard();
    });
    document.getElementById('scope').addEventListener('change', function (e) {
      state.scope = e.target.value; renderBoard();
    });
    document.getElementById('sort').addEventListener('change', function (e) {
      state.sort = e.target.value; state.dir = 1; renderBoard();
    });
    document.querySelectorAll('#board thead th').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (state.sort === k && k !== 'rank') state.dir = -state.dir;
        else { state.sort = k; state.dir = 1; }
        document.querySelectorAll('#board thead th').forEach(function (x) { x.classList.remove('sorted'); });
        th.classList.add('sorted');
        renderBoard();
      });
    });
    tbody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-slug]');
      if (tr) location.hash = tr.getAttribute('data-slug');
    });
    window.addEventListener('hashchange', route);
  }

  // ---------- routing ----------
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!h) {
      detailEl.hidden = true;
      detailEl.innerHTML = '';
      document.body.classList.remove('detail-only');
      return;
    }
    if (h === 'watchlist') {
      state.scope = 'watchlist';
      document.getElementById('scope').value = 'watchlist';
      renderBoard();
      return;
    }
    if (h.indexOf('category=') === 0) {
      var cat = h.slice('category='.length);
      state.cat = cat;
      document.getElementById('cat').value = cat;
      renderBoard();
      return;
    }
    renderDetail(h);
  }

  // ---------- boot ----------
  renderMeta();
  renderChart();
  fillSelects();
  renderBoard();
  renderLive();
  bind();
  route();
  document.querySelector('main').setAttribute('aria-busy', 'false');
})();
