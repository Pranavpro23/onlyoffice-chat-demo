# CLAUDE.md

Notes for an agent (or a new contributor) working in this repo. Read
`README.md` first for what the project is and how to run it — this file is
about *how the code is built* and things that aren't obvious from reading
it once.

## What this actually is

A chat box that edits a live ONLYOFFICE document. The LLM (Claude) never
touches the document — it only maps a natural-language instruction to one
JSON action object from a small fixed vocabulary (per mode, PPTX or DOCX).
The browser is what executes that action against the ONLYOFFICE editor, via
`connector.callCommand()`.

Everything interesting lives in two files:

- `server/server.js` — Express app, the two system prompts (one per mode)
  that define the action vocabulary Claude is allowed to emit, validators
  for each action shape, and the SSE endpoint that streams progress.
- `public/index.html` — the entire frontend: chat UI, Live Trace log,
  DocsAPI wiring, and — the important part — a JS-code-builder for every
  action type, keyed by mode (`PPTX_ACTION_CODE_BUILDERS` /
  `DOCX_ACTION_CODE_BUILDERS`).

If you're adding a new capability, you'll touch both: a new action needs a
JSON shape + validator + few-shot example in `server.js`, and a matching
code builder in `index.html`.

## The one thing that will bite you: `callCommand` has no closures

```js
window.connector.callCommand(function () {
  // this runs INSIDE THE EDITOR IFRAME.
  // It does NOT see any variable from the outer page scope.
}, callback);
```

ONLYOFFICE serializes the function via `.toString()` and re-runs the source
inside the iframe's own JS context. Any data the function needs — the
instruction's text, a slide index, a hex color — must be baked into the
function source as a literal, via a template string, before it's handed to
`callCommand`. That's why every entry in `*_ACTION_CODE_BUILDERS` is a
function that returns a *string* of JS source with `${...}` interpolation,
not a closure capturing outer variables. Grep `buildCommandFunction` in
`public/index.html` for how these get assembled and sent.

## ONLYOFFICE API quirks (verified live against Document Server 9.4.1 —
## do not trust the official docs' signatures without testing)

These were only discovered by testing against the actual running build.
The published API docs did not match in these spots:

- **`Api.CreateTable(rows, cols)`** — despite what the name/typical
  `(cols, rows)` convention suggests, the first argument is rows, second is
  cols. Verified: `CreateTable(3, 2)` produced a table with 2 cells per
  row. Same order in both the Presentation Builder and Document Builder
  APIs.
- **DOCX paragraph styles**: `paragraph.SetStyle()` does not exist. Style
  lives on `paragraph.GetParaPr().SetStyle(oStyleObject)`, and the style
  object must come from `Api.GetDocument().GetStyle("Heading 1")` — passing
  a bare string is rejected because `SetStyle` checks `instanceof` a style
  class internally.
- **DOCX heading detection** (`isHeadingParagraph` in `index.html`):
  checks `paragraph.GetParaPr().GetStyle().GetName() === 'Heading 1'`. This
  is how the code finds "the heading" to reuse/reformat rather than
  duplicating it on every edit. It only matches `"Heading 1"` by design —
  a document with multiple heading levels (Heading 2, etc.) still resolves
  "the heading" to the single top-level one.
- **DOCX paragraph formatting**: `Paragraph` exposes `SetBold(bool)` /
  `SetColor(r, g, b)` directly (raw 0-255 numbers, same convention as the
  pptx `Run.SetColor`) — no need to drop down to individual `Run` objects
  the way the pptx handlers do.
- **PPTX slide tables aren't in `slide.GetAllShapes()`** — they show up
  there as a generic `"shape"`-typed object whose `GetDocContent()` is
  useless for reading cell text. Use `slide.GetAllTables()` to get the
  actual table object (with `GetRow(i).GetCellsCount()` /
  `.GetCell(i).GetContent()`), and note that object's own `GetRow(...)`
  works but it does **not** expose `GetRowsCount()` — you have to `GetRow`
  incrementally and check for `null`/`undefined` to find the end.

## Content-generation scripts (`server/scripts/`)

`create-starter-pptx.js` (via `pptxgenjs`) and `create-starter-docx.js`
(via the `docx` npm package) generate `server/storage/starter.{pptx,docx}`
— the files the editor opens on load. They are **not** committed (see
`.gitignore`); run `npm run generate:starters` after cloning. Both scripts
are deterministic — re-running them just overwrites the output.

If you change the starter content, both files should stay in sync: same
Section/Punishment table data in the pptx's slide table and the docx's
table, so demoing the same underlying facts in either mode looks
consistent.

## Known rough edges

- Mode-switching (the PPTX/DOCX pill) occasionally serves stale cached
  document content right after the underlying file on disk was
  regenerated — a full page reload of `localhost:4000` reliably fixes it.
  Root cause not fully nailed down; suspected to be the editor caching by
  `document.key` rather than re-fetching the URL. Worth revisiting if it
  becomes a recurring demo problem.
- This is a local dev/demo setup: ONLYOFFICE Document Server runs with
  `JWT_ENABLED=false` and `ALLOW_PRIVATE_IP_ADDRESS=true`. Do not carry
  that config into anything internet-facing.
