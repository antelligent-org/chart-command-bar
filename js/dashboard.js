/**
 * dashboard.js: the chart itself.
 *
 * One `state` object is the single source of truth for how the chart should
 * look. Nothing else in this app touches Chart.js. Tools mutate `state`, then
 * call `CCB.render()`, which rebuilds the live chart's config in place and lets
 * Chart.js animate the difference.
 *
 * Keeping it this way is what makes the tools in tools.js three lines each,
 * which is the point being made on stage: once the state is modelled properly,
 * "let a model drive it" is a small change, not an architecture.
 */
window.CCB = window.CCB || {};

/** Named colours the tools are allowed to choose from. Fernfly's warm palette. */
CCB.PALETTE = {
  gold:    { dark: '#eda94a', light: '#de8b22' },
  emerald: { dark: '#45c29a', light: '#0f6e56' },
  violet:  { dark: '#a78bfa', light: '#6d28d9' },
  red:     { dark: '#f87171', light: '#c23a2a' },
  slate:   { dark: '#8fa3b8', light: '#5b7085' },
};

CCB.defaultState = function () {
  return {
    type: 'bar',
    title: 'Revenue by product line',
    legend: 'top',
    stacked: false,
    sort: 'original',
    months: { from: 1, to: 12 },
    axes: {
      x: { scale: 'linear', min: null, max: null, grid: true },
      y: { scale: 'linear', min: null, max: null, grid: true },
    },
    colours: {},        // label -> palette name, overriding data.js
    hidden: {},         // label -> true
  };
};

CCB.state = CCB.defaultState();

/* ── Theme ─────────────────────────────────────────────────────────────────
   Chart.js needs concrete colour values, not CSS variables, so the theme is
   resolved from the stylesheet at every render. Flipping the theme re-renders. */
function theme() {
  const mode = document.documentElement.getAttribute('data-mode') === 'light' ? 'light' : 'dark';
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return { mode, ink: v('--ink'), ink3: v('--ink3'), line: v('--line') };
}

function colourFor(label) {
  const name = CCB.state.colours[label] || (CCB.data.series.find((s) => s.label === label) || {}).colour || 'gold';
  const entry = CCB.PALETTE[name] || CCB.PALETTE.gold;
  return entry[theme().mode];
}

/* ── Deriving what to draw ─────────────────────────────────────────────────── */

/** Apply the month filter and the sort order. Returns { labels, series }. */
function shape() {
  const { from, to } = CCB.state.months;
  const lo = Math.min(from, to) - 1;
  const hi = Math.max(from, to);

  let rows = CCB.data.months.slice(lo, hi).map((month, i) => ({
    month,
    values: CCB.data.series.map((s) => s.values[lo + i]),
  }));

  if (CCB.state.sort !== 'original') {
    // Rank by the total of the *visible* series, so hiding one changes the order
    // the way a reader would expect it to.
    const visible = CCB.data.series.map((s) => !CCB.state.hidden[s.label]);
    const total = (row) => row.values.reduce((sum, v, i) => sum + (visible[i] ? v : 0), 0);
    rows = rows.slice().sort((a, b) => (CCB.state.sort === 'asc' ? total(a) - total(b) : total(b) - total(a)));
  }

  return {
    labels: rows.map((r) => r.month),
    series: CCB.data.series.map((s, i) => ({
      label: s.label,
      values: rows.map((r) => r.values[i]),
      hidden: !!CCB.state.hidden[s.label],
    })),
  };
}

/** Pie and doughnut can't show a series per month, so collapse each to its total. */
function isCircular() {
  return CCB.state.type === 'pie' || CCB.state.type === 'doughnut';
}

function buildData() {
  const shaped = shape();

  if (isCircular()) {
    const shown = shaped.series.filter((s) => !s.hidden);
    return {
      labels: shown.map((s) => s.label),
      datasets: [{
        label: 'Total',
        data: shown.map((s) => s.values.reduce((a, b) => a + b, 0)),
        backgroundColor: shown.map((s) => colourFor(s.label)),
        borderColor: theme().mode === 'dark' ? '#17130e' : '#ffffff',
        borderWidth: 2,
      }],
    };
  }

  return {
    labels: shaped.labels,
    datasets: shaped.series.map((s) => {
      const colour = colourFor(s.label);
      return {
        label: s.label,
        data: s.values,
        hidden: s.hidden,
        backgroundColor: CCB.state.type === 'line' || CCB.state.type === 'radar' ? colour + '33' : colour,
        borderColor: colour,
        borderWidth: 2,
        pointBackgroundColor: colour,
        tension: 0.3,
        fill: CCB.state.type === 'radar',
      };
    }),
  };
}

function buildOptions() {
  const t = theme();
  const s = CCB.state;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 550 },
    plugins: {
      title: {
        display: !!s.title,
        text: s.title,
        color: t.ink,
        font: { size: 17, weight: '600' },
        padding: { bottom: 14 },
      },
      legend: {
        display: s.legend !== 'hidden',
        position: s.legend === 'hidden' ? 'top' : s.legend,
        labels: { color: t.ink3, usePointStyle: true, boxWidth: 8, padding: 14 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label || ctx.label}: ${CCB.money(ctx.parsed.y ?? ctx.parsed)}`,
        },
      },
    },
  };

  if (isCircular()) return options;

  if (s.type === 'radar') {
    options.scales = {
      r: {
        grid: { color: t.line },
        angleLines: { color: t.line },
        pointLabels: { color: t.ink3 },
        ticks: { color: t.ink3, backdropColor: 'transparent' },
      },
    };
    return options;
  }

  options.scales = {
    // x is a category axis on bar and line charts, so it takes no scale type.
    x: {
      stacked: s.stacked,
      grid: { color: t.line, display: s.axes.x.grid },
      ticks: { color: t.ink3 },
    },
    y: {
      type: s.axes.y.scale,
      stacked: s.stacked,
      grid: { color: t.line, display: s.axes.y.grid },
      ticks: { color: t.ink3, callback: (v) => CCB.money(v) },
    },
  };

  // A logarithmic axis cannot start at zero, and a null min lets Chart.js decide.
  if (s.axes.y.min !== null) options.scales.y.min = s.axes.y.scale === 'logarithmic' ? Math.max(s.axes.y.min, 1) : s.axes.y.min;
  if (s.axes.y.max !== null) options.scales.y.max = s.axes.y.max;

  return options;
}

CCB.money = function (n) {
  if (typeof n !== 'number' || !isFinite(n)) return String(n);
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k';
  return '$' + n;
};

/* ── Rendering ─────────────────────────────────────────────────────────────── */

let chart = null;

CCB.mount = function (canvas) {
  chart = new Chart(canvas, { type: CCB.state.type, data: buildData(), options: buildOptions() });
  return chart;
};

/** Rebuild the live chart from `state`. Safe to call as often as you like. */
CCB.render = function () {
  if (!chart) return;
  chart.config.type = CCB.state.type;
  chart.data = buildData();
  chart.options = buildOptions();
  chart.update();
  if (CCB.onRender) CCB.onRender(CCB.state);
};

CCB.reset = function () {
  CCB.state = CCB.defaultState();
  CCB.render();
};
