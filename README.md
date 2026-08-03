# Chart command bar

A revenue dashboard you drive with a sentence. Say _"the small numbers are
invisible"_ and the y axis goes logarithmic.

A demo of the whole intent-to-action shape: twelve
ordinary functions, a fine-tuned model that turns a sentence into a call to one
of them, and a handful of lines of orchestration in between.

It is deliberately small enough to read in one sitting.

## Running it

```bash
npm run vendor   # once, downloads Chart.js into vendor/
npm start        # serves on http://localhost:5174
```

`npm run vendor` is what makes the offline promise real. Without it the page
falls back to the Chart.js CDN, which is fine at your desk and a bad bet in a
conference room.

You can also just open `index.html` by double-clicking. Manual mode works that
way; the command bar needs a real origin, so use `npm start` for that.

## Pointing it at a model

Click **Model** and paste a deployed [Fernfly](https://fernfly.com) project's inference URL:

```
https://fernfly.com/api/p/YOUR_PROJECT_ID/infer
```

The project needs **keyless public inference** with this page's origin
(`http://localhost:5174`) on its allowed-origins list. That is how the embed
widget works, and it is why there is no API key anywhere in this repository.
Never put one in front-end code; anyone can read it.

The endpoint contract is two fields in and one out:

```
POST { "utterance": "show this as bars" }
  ->  { "calls": [ { "name": "set_chart_type", "arguments": { "type": "bar" } } ] }
```

To build the model: create a Fernfly project, upload [`tools.json`](tools.json) in Source step and
import [`pairs.jsonl`](pairs.jsonl) in Generate step
before you train.

### No model yet?

**Manual mode**, bottom right, runs the same executor from a hand-typed call. It
takes any of these:

```
set_chart_type({"type": "bar"})
set_chart_type {"type":"bar"}
{"name":"set_chart_type","arguments":{"type":"bar"}}
reset_chart()
```

## What's here

| File                     | What it is                                                                |
| ------------------------ | ------------------------------------------------------------------------- |
| `index.html`             | The dashboard, the command bar, the call log, the settings drawer         |
| `js/data.js`             | Twelve months of revenue across three product lines. Never mutated.       |
| `js/dashboard.js`        | One `state` object, and the renderer that turns it into a Chart.js config |
| **`js/tools.js`**        | **The twelve tools, and the guards on their arguments**                   |
| **`js/orchestrator.js`** | **The endpoint call, the allow-list, and the executor**                   |
| `js/app.js`              | UI wiring. Not part of the lesson.                                        |
| `tools.json`             | The same twelve tools as JSON Schema, for Fernfly                         |
| `pairs.jsonl`            | ~1400 seed training pairs                                                 |

The two bold files are the interesting ones, and together they are under 300
lines including comments.

## The idea

The **settings drawer** is the "before". Every one of the twelve operations is in
there somewhere, two or three clicks deep, which is every BI tool you have ever
used. Users find about six of the controls.

The **command bar** is the "after". Same twelve functions, one sentence in front
of them.

The **call log** on the right is the point of the whole thing. It shows the raw
`{ name, arguments }` the model returned, next to what it did. Without that panel
this looks like magic; with it, you can see that the model's entire contribution
is picking a name and filling in some arguments, and that everything after that
is ordinary code.

### Three things the code is trying to show

1. **`CCB.TOOLS` is an allow-list, and that is the security model.** A name that
   isn't a key in that object cannot execute, whatever comes back. Try
   `delete_everything({})` in manual mode.
2. **Validation lives in your code, not in the model.** Every tool guards its own
   arguments the way you would guard a form field. Try
   `set_chart_type({"type":"3d-pie"})`, or ask it to colour a series that doesn't
   exist.
3. **`calls` is an array.** One sentence can legitimately produce more than one
   call, so the executor loops and the repaint happens once, after the batch.

The refusal branch in `orchestrator.js` is also where you would hand an
out-of-scope request to a frontier model in production. It is one `if`.

## The data

Self-serve is roughly forty times Enterprise, so on a linear axis Enterprise is a
flat line along the bottom and you cannot see that it grew 7x over the year.

That is not decoration. It is what makes _"the small numbers are invisible"_ a
real complaint from a real analyst rather than a staged line, and switching to a
log scale genuinely reveals something.

## Adding a tool

1. Write the function in `js/tools.js`. Guard its arguments.
2. Describe it in `tools.json`, matching the name exactly.
3. Add a handful of pairs to `pairs.jsonl` covering the sloppy ways people would
   ask for it.
4. Retrain on Fernfly.com.

## Conventions

Plain HTML, CSS and JS. No build, no framework, no dependencies beyond a
vendored Chart.js (MIT).

---

© 2026 [antelligent](https://antelligent.org/)
