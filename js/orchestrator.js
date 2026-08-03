/**
 * orchestrator.js: the part everybody forgets.
 *
 * A Fernfly model does not call your code. It cannot. It reads a sentence and
 * hands back a tool call as data, and then it is finished. Something has to take
 * that data and act on it, and that something is this file: ordinary software,
 * with no AI in it at all.
 *
 * Three things worth noticing while reading it:
 *
 *   1. `CCB.TOOLS` is an allow-list, and that is the security model. A name that
 *      is not a key in that object cannot execute, whatever the model returns.
 *   2. Validation lives here, not in the model. Every tool guards its own
 *      arguments, exactly the way you would guard a form field.
 *   3. `calls` is an array. One sentence can legitimately produce more than one
 *      call, which is why there is a loop and why the repaint sits outside it.
 */
window.CCB = window.CCB || {};

/* ── Where the model lives ─────────────────────────────────────────────────── */

const ENDPOINT_KEY = 'ccb.endpoint';

/**
 * A deployed Fernfly project endpoint:
 *
 *   POST https://fernfly.com/api/p/<project-id>/infer
 *   { "utterance": "show this as bars" }
 *   -> { "calls": [ { "name": "set_chart_type", "arguments": { "type": "bar" } } ] }
 *
 * Set it in the UI rather than in code. Use a project with keyless public
 * inference and this page's origin on its allow-list, which is how the embed
 * widget works. Do not put an API key in front-end source: anyone can read it.
 */
CCB.getEndpoint = function () {
  try { return localStorage.getItem(ENDPOINT_KEY) || ''; } catch { return ''; }
};

CCB.setEndpoint = function (url) {
  try { localStorage.setItem(ENDPOINT_KEY, (url || '').trim()); } catch { /* private mode */ }
};

/* ── Asking the model ──────────────────────────────────────────────────────── */

/** Returns { calls, reply, error }. Never throws. */
CCB.askModel = async function (utterance) {
  const endpoint = CCB.getEndpoint();
  if (!endpoint) {
    return { calls: [], error: 'No endpoint set. Add your Fernfly project URL, or use manual mode below.' };
  }

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utterance }),
    });
  } catch (err) {
    return { calls: [], error: `Could not reach the endpoint (${err.message}). Manual mode still works.` };
  }

  if (!res.ok) {
    return { calls: [], error: `Endpoint returned ${res.status}. Check the project id and its allowed origins.` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { calls: [], error: 'Endpoint did not return JSON.' };
  }

  if (data && data.out_of_scope) {
    return { calls: [], reply: data.reply || "That one is outside this model's tools." };
  }
  return { calls: Array.isArray(data && data.calls) ? data.calls : [], reply: data && data.reply };
};

/* ── Acting on the answer ──────────────────────────────────────────────────── */

/**
 * Execute one tool call. This is the whole of the "agent" that isn't the model.
 * Returns a short human-readable outcome for the log.
 */
CCB.execute = function (call) {
  const tool = CCB.TOOLS[call && call.name];

  // The refusal branch. In production this is also where you would hand an
  // out-of-scope request off to a frontier model.
  if (!tool) {
    return { ok: false, note: `refused: ${JSON.stringify(call && call.name)} is not in the tool list` };
  }

  try {
    const note = tool(call.arguments || {});
    return { ok: true, note };
  } catch (err) {
    if (err instanceof CCB.ToolError) return { ok: false, note: `refused: ${err.message}` };
    throw err;
  }
};

/**
 * The full path: sentence in, chart changed. `log` is called once per call with
 * ({ call, result }) so the UI can show the raw tool call next to what it did.
 */
CCB.run = async function (utterance, log) {
  const { calls, reply, error } = await CCB.askModel(utterance);

  if (error) { log({ error }); return; }
  if (!calls.length) { log({ note: reply || 'no call returned' }); return; }

  for (const call of calls) {
    log({ call, result: CCB.execute(call) });
  }

  CCB.render();      // one repaint for the batch, not one per call
};

/* ── Manual mode ───────────────────────────────────────────────────────────── */

/**
 * Parse a hand-typed call so the executor can be driven with no model and no
 * network. Accepts any of:
 *
 *   set_chart_type({"type": "bar"})
 *   set_chart_type {"type":"bar"}
 *   {"name":"set_chart_type","arguments":{"type":"bar"}}
 *   reset_chart()
 */
CCB.parseCall = function (text) {
  const input = (text || '').trim();
  if (!input) return null;

  if (input.startsWith('{')) {
    try {
      const obj = JSON.parse(input);
      if (obj && typeof obj.name === 'string') {
        return { name: obj.name, arguments: obj.arguments || {} };
      }
    } catch { /* fall through to the call syntax */ }
    return null;
  }

  const m = /^([a-z_][a-z0-9_]*)\s*(?:\(([\s\S]*)\)|([\s\S]*))$/i.exec(input);
  if (!m) return null;

  const body = (m[2] !== undefined ? m[2] : m[3] || '').trim();
  if (!body) return { name: m[1], arguments: {} };

  try {
    const args = JSON.parse(body);
    if (args && typeof args === 'object' && !Array.isArray(args)) return { name: m[1], arguments: args };
  } catch { /* reported below */ }
  return null;
};

CCB.runManual = function (text, log) {
  const call = CCB.parseCall(text);
  if (!call) {
    log({ error: 'Could not read that. Try set_chart_type({"type": "bar"}).' });
    return;
  }
  log({ call, result: CCB.execute(call), manual: true });
  CCB.render();
};
