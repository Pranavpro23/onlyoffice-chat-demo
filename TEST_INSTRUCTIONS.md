# Test Instructions — Slides & Document Demo

A script of instructions to type into the chat box while demoing this
project, covering both modes plus deliberate edge cases. All instructions
below assume the **prefilled starter content** (see `README.md` /
`CLAUDE.md` for how it's generated):

- **PPTX** — 4 slides: 1 = title slide, 2 = Defining the Offence,
  3 = Exceptions, 4 = Punishment Framework
- **DOCX** — one structured document on IPC 299–304 (heading, intro
  paragraph, two H2 sections with body text and a bulleted list, and a
  Punishment Framework table)

Slide numbers below are the natural 1-based numbers a person would say out
loud ("slide 1", "slide 3") — Claude is expected to translate that to the
0-based `slide_index` the backend actually uses.

> **Before you run these live**: read "Known gaps and quirks" at the
> bottom first. Several of the instructions below exercise actions that
> either aren't implemented yet or behave slightly differently than the
> plain-English instruction implies — that's flagged inline and again in
> that section so nothing here surprises you mid-demo.

## Slides Demo

### Text and headings

```
Set the title of slide 1 to Murder Under Indian Law: A Junior Associate's Primer
Set the subtitle of slide 1 to A Case-Based Introduction
Add a bullet to slide 2: Section 299 requires either intention or knowledge of likely death
Add a bullet to slide 3: Exception 5 covers death with the victim's own consent
Remove the second bullet from slide 2
Change the first bullet on slide 3 to say Exception 1 requires provocation given by the deceased
Add speaker notes to slide 4: Cite Mithu v. State of Punjab on mandatory death penalty
```

> ⚠️ **Speaker notes are not implemented.** There's no `add_speaker_notes`
> (or similar) action in the PPTX vocabulary — Claude will either fail to
> produce a valid action (triggering the retry-then-error path) or force
> the instruction into the nearest action it does know, which won't
> actually add notes. Good one to demo the error/retry path with, not the
> happy path.

### Formatting

```
Make the title of slide 1 bold
Make the title of slide 4 dark blue
Center the title on slide 2
Make the title font size 40 on slide 1
Change the font on slide 1 to Georgia
Underline the second bullet on slide 3
Italicize the first bullet on slide 2
```

> ⚠️ `format_text` currently only supports **bold** and **color** on a
> whole placeholder (title/body/subtitle) — not alignment, font size, font
> family, underline, or italic, and not targeting a single bullet within a
> body placeholder. Only the first two instructions in this block
> ("bold", "dark blue") will actually apply; the rest are good
> not-yet-supported / graceful-failure demos.

### Tables

```
Add a table to slide 4 comparing punishments under Sections 302, 304 Part I, and 304 Part II
Add a row to the table on slide 4 for Section 303
Set the header row of the table on slide 4 to a navy background
```

> ⚠️ Slide 4 already has a Punishment Framework table. `add_table` always
> inserts a **new** table at a fixed position rather than replacing or
> merging with an existing one — running the first instruction will drop
> a second table on top of the existing one, not extend it. The second
> and third instructions (add a row, recolor the header) correctly target
> the existing table and work as expected.

### Slide structure

```
Add a new slide
Add a new slide titled Case Application
Delete slide 3
Set the title on slide 5 to Practical Example
```

> ⚠️ Each chat instruction produces exactly **one** structured action.
> "Add a new slide titled Case Application" reads like two steps (add,
> then title it) — expect Claude to only perform one of them (almost
> certainly just `add_slide`), leaving the new slide untitled. Follow up
> with a separate "Set the title on slide 5 to Case Application" if you
> want the title to actually land.

### Theme and background

```
Apply a professional navy and gold theme
Make the background of slide 1 light gray
Give slide 4 a gradient background
```

> ⚠️ `apply_theme` (recoloring the presentation's whole theme palette) **is
> implemented** and is a strong demo moment — Claude picks all 12 theme
> colors itself. Per-slide background color and gradients are **not
> implemented** — no matching action exists yet.

### Shapes (if implemented)

```
Add a rectangle to slide 1
Add an arrow pointing right on slide 3
Make the rectangle on slide 1 red
```

> ⚠️ Not implemented — there's no shape-drawing action in the current
> vocabulary beyond the fixed textbox (`add_textbox`). Expect these to
> fail gracefully (or hit the retry/error path), not silently no-op.

## Document Demo

Only four action types are supported here — `set_heading`,
`add_paragraph`, `format_text`, `add_table`.

### Headings

```
Set the heading to Murder Under Indian Law
Change the heading to Culpable Homicide and Murder Under the IPC
```

### Paragraphs

```
Add a paragraph explaining the role of intention under Section 299
Add a paragraph summarizing the four aggravating conditions in Section 300
Add a paragraph: This lesson is intended for junior associates preparing for their first criminal law rotation
```

### Formatting

```
Make the heading bold
Make the heading dark blue
Bold the last paragraph
```

### Tables

```
Add a table comparing Sections 302, 304 Part I, and 304 Part II
Add a table with 2 columns and 3 rows showing Section and Punishment
```

> Note: unlike the PPTX table quirk above, `add_table` in DOCX mode
> appends the new table to the end of the document rather than overlapping
> anything on screen — the starter document's existing Punishment
> Framework table will just be followed by a second one further down.

## Edge cases worth trying deliberately

```
make it better                          (vague — no clear action)
set the title on slide 9                (out-of-range slide index)
what's the weather today                (off-topic, not an edit request)
convert this to a video                 (unsupported action type)
                                         (empty instruction)
add a bullet and also make it blue and also add a table   (multiple requests bundled in one)
```

Expected behavior, based on how the backend is built (see
`server/server.js`):

- **Vague / off-topic / unsupported action type**: Claude is constrained
  by the system prompt to respond with only one JSON action from the
  fixed vocabulary. If it can't produce a valid one, `parseEditAction`
  rejects the response and `getEditActionFromClaude` retries once before
  raising `"Claude did not return a valid action after retrying"`, which
  surfaces as an `error` event in the Live Trace panel.
- **Out-of-range slide index**: the action itself still validates and
  executes (the JSON shape is fine), but the in-editor code checks the
  slide index against the actual slide count and returns `false` rather
  than throwing — shows up in the trace as "not applied", not a crash.
- **Empty instruction**: check whether the Send button/Enter key even
  fires a request for blank input before assuming this hits the backend
  at all.
- **Bundled multi-action instruction**: only one action can come back per
  request, so at most one of the three requested edits will actually
  happen — useful for demonstrating the one-instruction-one-action
  constraint explicitly.

## Known gaps and quirks (summary)

| Area | Status |
|---|---|
| PPTX: title/subtitle text, bullets (add/remove/edit), tables (add row, recolor header), delete slide, add slide, theme recolor, textbox | ✅ implemented |
| PPTX: speaker notes | ❌ not implemented |
| PPTX: font size, font family, underline, italic, text alignment | ❌ not implemented (`format_text` only does bold + color) |
| PPTX: per-slide background color / gradients | ❌ not implemented |
| PPTX: shapes (rectangle, arrow, etc.) | ❌ not implemented |
| PPTX: `add_table` on a slide that already has one | ⚠️ adds a second, overlapping table rather than replacing it |
| One chat instruction → one action | ⚠️ by design — compound instructions only get one part fulfilled |
| DOCX: heading, paragraphs, table, bold/color on heading or last paragraph | ✅ implemented |
| DOCX: everything else (alignment, other formatting, images, etc.) | ❌ not implemented — only 4 actions exist in this mode |
