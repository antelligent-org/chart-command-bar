/**
 * app.js: the wiring. Chart mount, the command bar, the call log, the settings
 * drawer, the endpoint drawer, the theme toggle.
 *
 * Nothing here is part of the lesson. The interesting files are tools.js and
 * orchestrator.js; this one exists so those two have somewhere to live.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  /* ── Chart.js has to be here or nothing works ────────────────────────────── */
  if (typeof Chart === 'undefined') {
    const b = $('banner');
    b.innerHTML = 'Chart.js did not load. Run <code>npm run vendor</code> once to keep a local copy, ' +
                  'or connect to a network so the CDN fallback can work.';
    b.hidden = false;
    return;
  }

  /* ── Theme ───────────────────────────────────────────────────────────────── */
  try {
    const saved = localStorage.getItem('ccb.mode');
    if (saved) document.documentElement.setAttribute('data-mode', saved);
  } catch { /* private mode */ }

  $('btnMode').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-mode') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-mode', next);
    try { localStorage.setItem('ccb.mode', next); } catch { /* private mode */ }
    CCB.render();
  });

  /* ── Mount ───────────────────────────────────────────────────────────────── */
  CCB.mount($('chart'));

  /* ── The call log ────────────────────────────────────────────────────────── */
  const log = $('log');

  /** Render a tool call the way it would be written in code. */
  function formatCall(call) {
    const args = call.arguments && Object.keys(call.arguments).length
      ? JSON.stringify(call.arguments).replace(/^\{|\}$/g, '').replace(/","/g, '", "')
      : '';
    return '<span class="fn">' + escapeHtml(call.name) + '</span>({' +
           (args ? ' <span class="k">' + escapeHtml(args) + '</span> ' : '') + '})';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  let pendingUtterance = null;

  function appendLog(entry) {
    const li = document.createElement('li');

    if (entry.error) {
      li.className = 'bad';
      li.innerHTML = '<div class="note">' + escapeHtml(entry.error) + '</div>';
    } else if (!entry.call) {
      li.innerHTML = '<div class="note">' + escapeHtml(entry.note || 'no call') + '</div>';
    } else {
      const ok = entry.result && entry.result.ok;
      li.className = (ok ? '' : 'bad') + (entry.manual ? ' manual' : '');
      li.innerHTML =
        (entry.manual ? '<span class="tag">manual</span>' : '') +
        (pendingUtterance ? '<div class="said">“' + escapeHtml(pendingUtterance) + '”</div>' : '') +
        '<div class="call">' + formatCall(entry.call) + '</div>' +
        '<div class="note">' + escapeHtml(entry.result ? entry.result.note : '') + '</div>';
    }

    pendingUtterance = null;
    log.prepend(li);
  }

  $('btnClear').addEventListener('click', () => { log.innerHTML = ''; });

  /* ── The command bar ─────────────────────────────────────────────────────── */
  const askForm = $('askForm');
  const ask = $('ask');
  const askBtn = $('askBtn');

  askForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ask.value.trim();
    if (!text) return;

    ask.value = '';
    pendingUtterance = text;
    askBtn.disabled = true;
    askBtn.textContent = '…';
    try {
      await CCB.run(text, appendLog);
    } finally {
      askBtn.disabled = false;
      askBtn.textContent = 'Send';
      syncSettings();
      ask.focus();
    }
  });

  /* Suggestions double as the demo's running order. */
  const SUGGESTIONS = [
    'show this as bars',
    'the small numbers are invisible',
    'make enterprise green',
    'biggest first',
    'just the last quarter',
    "drop the legend, it's in the way",
    'stack them',
    'start over',
  ];
  const suggestions = $('suggestions');
  SUGGESTIONS.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s;
    b.addEventListener('click', () => {
      ask.value = s;
      askForm.requestSubmit();
    });
    suggestions.appendChild(b);
  });

  /* ── Manual mode ─────────────────────────────────────────────────────────── */
  $('manualForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('manual').value.trim();
    if (!text) return;
    CCB.runManual(text, appendLog);
    syncSettings();
  });

  /* ── Drawers ─────────────────────────────────────────────────────────────── */
  function openDrawer(id) { $(id).hidden = false; }
  function closeDrawer(id) { $(id).hidden = true; }

  $('btnSettings').addEventListener('click', () => { syncSettings(); openDrawer('settings'); });
  $('btnEndpoint').addEventListener('click', () => {
    $('endpointUrl').value = CCB.getEndpoint();
    paintEndpointState();
    openDrawer('endpoint');
  });
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => closeDrawer(b.getAttribute('data-close'))));
  document.querySelectorAll('.drawer').forEach((d) =>
    d.addEventListener('click', (e) => { if (e.target === d) d.hidden = true; }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.drawer').forEach((d) => (d.hidden = true));
  });

  /* ── Endpoint drawer ─────────────────────────────────────────────────────── */
  function paintEndpointState() {
    const url = CCB.getEndpoint();
    $('endpointState').textContent = url
      ? 'Currently calling ' + url
      : 'No endpoint set. The command bar will not work until you add one, but manual mode will.';
  }
  $('endpointSave').addEventListener('click', () => {
    CCB.setEndpoint($('endpointUrl').value);
    paintEndpointState();
    closeDrawer('endpoint');
  });
  paintEndpointState();

  /* ── Settings drawer ─────────────────────────────────────────────────────────
     The same twelve operations, behind the sort of panel the command bar is
     meant to replace. It writes straight to `CCB.state` rather than going
     through the tools, because a click is already unambiguous. */
  const cfg = {
    type: $('cfgType'), title: $('cfgTitle'), legend: $('cfgLegend'), stacked: $('cfgStacked'),
    yScale: $('cfgYScale'), yMin: $('cfgYMin'), yMax: $('cfgYMax'),
    gridY: $('cfgGridY'), gridX: $('cfgGridX'),
    sort: $('cfgSort'), from: $('cfgFrom'), to: $('cfgTo'),
  };

  function syncSettings() {
    const s = CCB.state;
    cfg.type.value = s.type;
    cfg.title.value = s.title;
    cfg.legend.value = s.legend;
    cfg.stacked.checked = s.stacked;
    cfg.yScale.value = s.axes.y.scale;
    cfg.yMin.value = s.axes.y.min === null ? '' : s.axes.y.min;
    cfg.yMax.value = s.axes.y.max === null ? '' : s.axes.y.max;
    cfg.gridY.checked = s.axes.y.grid;
    cfg.gridX.checked = s.axes.x.grid;
    cfg.sort.value = s.sort;
    cfg.from.value = s.months.from;
    cfg.to.value = s.months.to;
    paintSeriesRows();
  }

  function readSettings() {
    const s = CCB.state;
    s.type = cfg.type.value;
    s.title = cfg.title.value;
    s.legend = cfg.legend.value;
    s.stacked = cfg.stacked.checked;
    s.axes.y.scale = cfg.yScale.value;
    s.axes.y.min = cfg.yMin.value === '' ? null : Number(cfg.yMin.value);
    s.axes.y.max = cfg.yMax.value === '' ? null : Number(cfg.yMax.value);
    s.axes.y.grid = cfg.gridY.checked;
    s.axes.x.grid = cfg.gridX.checked;
    s.sort = cfg.sort.value;
    s.months = {
      from: Math.min(12, Math.max(1, Number(cfg.from.value) || 1)),
      to: Math.min(12, Math.max(1, Number(cfg.to.value) || 12)),
    };
    CCB.render();
  }

  Object.values(cfg).forEach((el) => el.addEventListener('change', readSettings));

  function paintSeriesRows() {
    const host = $('cfgSeries');
    host.innerHTML = '';
    CCB.data.series.forEach((s) => {
      const name = CCB.state.colours[s.label] || s.colour;
      const row = document.createElement('div');
      row.className = 'series-row';

      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      const mode = document.documentElement.getAttribute('data-mode') === 'light' ? 'light' : 'dark';
      swatch.style.background = (CCB.PALETTE[name] || CCB.PALETTE.gold)[mode];

      const label = document.createElement('span');
      label.className = 'name';
      label.textContent = s.label;

      const select = document.createElement('select');
      Object.keys(CCB.PALETTE).forEach((c) => {
        const o = document.createElement('option');
        o.value = c;
        o.textContent = c;
        select.appendChild(o);
      });
      select.value = name;
      select.addEventListener('change', () => {
        CCB.state.colours[s.label] = select.value;
        CCB.render();
        paintSeriesRows();
      });

      const shown = document.createElement('input');
      shown.type = 'checkbox';
      shown.checked = !CCB.state.hidden[s.label];
      shown.title = 'Show this series';
      shown.addEventListener('change', () => {
        if (shown.checked) delete CCB.state.hidden[s.label];
        else CCB.state.hidden[s.label] = true;
        CCB.render();
      });

      row.append(swatch, label, select, shown);
      host.appendChild(row);
    });
  }

  $('cfgReset').addEventListener('click', () => {
    CCB.reset();
    syncSettings();
  });

  /* Keep the panel honest when the model changes something behind its back. */
  CCB.onRender = syncSettings;

  syncSettings();
  ask.focus();
})();
