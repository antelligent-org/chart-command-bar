/**
 * tools.js: the twelve things this dashboard is allowed to do.
 *
 * These are ordinary functions. They existed before any model did, they are what
 * the settings panel calls, and `tools.json` is a description of exactly this
 * object written in JSON Schema.
 *
 * Every one of them validates its own arguments. That is not defensiveness about
 * AI: it is the same thing you would do with a form field, and it is the reason
 * a wrong answer from the model is a no-op rather than an exception.
 */
window.CCB = window.CCB || {};

/* ── Argument guards ───────────────────────────────────────────────────────── */

function oneOf(value, allowed, fallback) {
  const v = String(value ?? '').trim().toLowerCase();
  const hit = allowed.find((a) => a.toLowerCase() === v);
  if (hit) return hit;
  if (fallback !== undefined) return fallback;
  throw new CCB.ToolError(`expected one of ${allowed.join(', ')}, got ${JSON.stringify(value)}`);
}

function bool(value) {
  if (typeof value === 'boolean') return value;
  const v = String(value ?? '').trim().toLowerCase();
  if (['true', 'yes', 'on', '1', 'show', 'visible'].includes(v)) return true;
  if (['false', 'no', 'off', '0', 'hide', 'hidden'].includes(v)) return false;
  throw new CCB.ToolError(`expected true or false, got ${JSON.stringify(value)}`);
}

function num(value) {
  // Tolerate the shapes a model actually emits: "50k", "$1,200", " 12 ".
  if (typeof value === 'number' && isFinite(value)) return value;
  const raw = String(value ?? '').trim().toLowerCase().replace(/[$,\s]/g, '');
  const m = /^(-?\d*\.?\d+)([km])?$/.exec(raw);
  if (!m) throw new CCB.ToolError(`expected a number, got ${JSON.stringify(value)}`);
  const n = parseFloat(m[1]);
  return m[2] === 'k' ? n * 1e3 : m[2] === 'm' ? n * 1e6 : n;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Match a series name loosely. The model will say "self serve", "Self-Serve" and
 * "the self-serve line" for the same thing, and none of those are worth a miss.
 */
function series(value) {
  const want = String(value ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!want) throw new CCB.ToolError('no series named');
  const hit = CCB.data.series.find((s) => {
    const have = s.label.toLowerCase().replace(/[^a-z]/g, '');
    return have === want || have.includes(want) || want.includes(have);
  });
  if (!hit) {
    const names = CCB.data.series.map((s) => s.label).join(', ');
    throw new CCB.ToolError(`no series called ${JSON.stringify(value)}. Known: ${names}`);
  }
  return hit.label;
}

/** Thrown by a guard. The orchestrator catches it and logs a refusal. */
CCB.ToolError = class ToolError extends Error {};

/* ── The tools ─────────────────────────────────────────────────────────────── */

CCB.TOOLS = {
  set_chart_type({ type }) {
    CCB.state.type = oneOf(type, ['bar', 'line', 'pie', 'doughnut', 'radar']);
    return `chart type is now ${CCB.state.type}`;
  },

  set_title({ text }) {
    CCB.state.title = String(text ?? '').slice(0, 80);
    return CCB.state.title ? `title is now “${CCB.state.title}”` : 'title cleared';
  },

  set_axis_scale({ axis, scale }) {
    const a = oneOf(axis, ['x', 'y']);
    const s = oneOf(scale, ['linear', 'logarithmic']);
    CCB.state.axes[a].scale = s;
    // Recorded either way, but only y carries values on these chart types, so
    // say so rather than silently doing nothing.
    if (a === 'x') return `noted, though x is a category axis here so nothing changes`;
    if (s === 'logarithmic' && CCB.state.axes.y.min === 0) CCB.state.axes.y.min = null;
    return `y axis is now ${s}`;
  },

  set_axis_range({ axis, min, max }) {
    const a = oneOf(axis, ['x', 'y']);
    CCB.state.axes[a].min = min === undefined || min === null ? null : num(min);
    CCB.state.axes[a].max = max === undefined || max === null ? null : num(max);
    const { min: lo, max: hi } = CCB.state.axes[a];
    if (lo === null && hi === null) return `${a} axis range is automatic again`;
    return `${a} axis pinned to ${lo === null ? 'auto' : CCB.money(lo)} – ${hi === null ? 'auto' : CCB.money(hi)}`;
  },

  set_series_colour({ series: name, colour }) {
    const label = series(name);
    CCB.state.colours[label] = oneOf(colour, Object.keys(CCB.PALETTE));
    return `${label} is now ${CCB.state.colours[label]}`;
  },

  toggle_series({ series: name, visible }) {
    const label = series(name);
    const show = bool(visible);
    if (show) delete CCB.state.hidden[label];
    else CCB.state.hidden[label] = true;
    return `${label} is now ${show ? 'shown' : 'hidden'}`;
  },

  set_legend_position({ position }) {
    CCB.state.legend = oneOf(position, ['top', 'bottom', 'left', 'right', 'hidden']);
    return CCB.state.legend === 'hidden' ? 'legend hidden' : `legend moved to the ${CCB.state.legend}`;
  },

  set_stacked({ enabled }) {
    CCB.state.stacked = bool(enabled);
    return CCB.state.stacked ? 'series are stacked' : 'series are side by side';
  },

  sort_data({ order }) {
    CCB.state.sort = oneOf(order, ['asc', 'desc', 'original']);
    return CCB.state.sort === 'original' ? 'back in calendar order' : `sorted ${CCB.state.sort}ending`;
  },

  filter_months({ from, to }) {
    const lo = clamp(Math.round(num(from)), 1, 12);
    const hi = clamp(Math.round(num(to)), 1, 12);
    CCB.state.months = { from: Math.min(lo, hi), to: Math.max(lo, hi) };
    const m = CCB.data.months;
    return `showing ${m[CCB.state.months.from - 1]} to ${m[CCB.state.months.to - 1]}`;
  },

  toggle_gridlines({ axis, visible }) {
    const a = oneOf(axis, ['x', 'y']);
    CCB.state.axes[a].grid = bool(visible);
    return `${a} gridlines ${CCB.state.axes[a].grid ? 'shown' : 'hidden'}`;
  },

  reset_chart() {
    CCB.state = CCB.defaultState();
    return 'back to defaults';
  },
};
