require('dotenv').config();
const path = require('path');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = 4000;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HEX_COLOR = '[0-9A-Fa-f]{6}';

const PPTX_SYSTEM_PROMPT = `You control a presentation editor. Given an instruction, respond with ONLY JSON matching exactly one of these shapes - nothing else, no explanation, no markdown fences:

{"action": "add_slide", "layout": "title_and_content"}
{"action": "set_title", "slide_index": 0, "text": "..."}
{"action": "set_subtitle", "slide_index": 0, "text": "..."}
{"action": "add_bullet", "slide_index": 0, "text": "..."}
{"action": "remove_bullet", "slide_index": 0, "bullet_index": 2}
{"action": "format_text", "slide_index": 0, "target": "title", "bold": true, "color": "1F3864"}
{"action": "add_table", "slide_index": 0, "rows": 3, "cols": 2, "data": [["Section", "Punishment"], ["302", "Death/life"], ["304", "Up to life"]]}
{"action": "add_table_row", "slide_index": 0, "row_data": ["305", "Up to 10 years"]}
{"action": "format_table", "slide_index": 0, "row_index": 0, "color": "1F3864"}
{"action": "apply_theme", "colors": ["1F3864", "FFFFFF", "203864", "F2F2F2", "2E5395", "C9A227", "4472C4", "8C6D1F", "70AD47", "A5A5A5", "0563C1", "954F72"]}
{"action": "edit_bullet", "slide_index": 0, "bullet_index": 1, "text": "..."}
{"action": "add_textbox", "slide_index": 0, "text": "...", "x": 100, "y": 100}
{"action": "delete_slide", "slide_index": 2}

slide_index, bullet_index, and row_index are 0-based (row_index 0 = header row). "target" for format_text is a placeholder type such as "title", "body", or "subTitle". "color" is a 6-digit hex string with no "#". "x"/"y" for add_textbox are the top-left position.

For apply_theme, "colors" is always exactly 12 hex strings (no "#") in this fixed order: [dk1, lt1, dk2, lt2, accent1, accent2, accent3, accent4, accent5, accent6, hyperlink, followed_hyperlink]. dk1/dk2 should be genuinely dark, lt1/lt2 genuinely light, and the 6 accents should be visually distinct from each other while fitting the requested style. Use your own design judgment to pick all 12 values that cohere with the requested style - do not just repeat one color 12 times.

Examples:
Instruction: "Change the title to Quarterly Results"
Response: {"action": "set_title", "slide_index": 0, "text": "Quarterly Results"}

Instruction: "Make the title bold and dark blue"
Response: {"action": "format_text", "slide_index": 0, "target": "title", "bold": true, "color": "1F3864"}

Instruction: "Delete slide 3"
Response: {"action": "delete_slide", "slide_index": 2}

Instruction: "Add a row to the table: 305, Up to 10 years"
Response: {"action": "add_table_row", "slide_index": 0, "row_data": ["305", "Up to 10 years"]}

Instruction: "Set the header row background to navy"
Response: {"action": "format_table", "slide_index": 0, "row_index": 0, "color": "1F3864"}

Instruction: "Apply a professional navy and gold theme"
Response: {"action": "apply_theme", "colors": ["1F3864", "FFFFFF", "203864", "F2F2F2", "2E5395", "C9A227", "4472C4", "8C6D1F", "70AD47", "A5A5A5", "0563C1", "954F72"]}

Instruction: "Change bullet 2 to say Fines apply in minor cases"
Response: {"action": "edit_bullet", "slide_index": 0, "bullet_index": 1, "text": "Fines apply in minor cases"}

Instruction: "Add a text box saying Draft - not final at position 100, 100"
Response: {"action": "add_textbox", "slide_index": 0, "text": "Draft - not final", "x": 100, "y": 100}`;

const PPTX_ACTION_VALIDATORS = {
  add_slide: (a) => typeof a.layout === 'string',
  set_title: (a) => typeof a.slide_index === 'number' && typeof a.text === 'string',
  set_subtitle: (a) => typeof a.slide_index === 'number' && typeof a.text === 'string',
  add_bullet: (a) => typeof a.slide_index === 'number' && typeof a.text === 'string',
  remove_bullet: (a) => typeof a.slide_index === 'number' && typeof a.bullet_index === 'number',
  format_text: (a) =>
    typeof a.slide_index === 'number' &&
    typeof a.target === 'string' &&
    (a.bold === undefined || typeof a.bold === 'boolean') &&
    (a.color === undefined || (typeof a.color === 'string' && new RegExp(`^${HEX_COLOR}$`).test(a.color))),
  add_table: (a) =>
    typeof a.slide_index === 'number' &&
    typeof a.rows === 'number' &&
    typeof a.cols === 'number' &&
    Array.isArray(a.data) &&
    a.data.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string')),
  add_table_row: (a) =>
    typeof a.slide_index === 'number' &&
    Array.isArray(a.row_data) &&
    a.row_data.every((cell) => typeof cell === 'string'),
  format_table: (a) =>
    typeof a.slide_index === 'number' &&
    typeof a.row_index === 'number' &&
    typeof a.color === 'string' &&
    new RegExp(`^${HEX_COLOR}$`).test(a.color),
  apply_theme: (a) =>
    Array.isArray(a.colors) &&
    a.colors.length === 12 &&
    a.colors.every((c) => typeof c === 'string' && new RegExp(`^${HEX_COLOR}$`).test(c)),
  edit_bullet: (a) =>
    typeof a.slide_index === 'number' && typeof a.bullet_index === 'number' && typeof a.text === 'string',
  add_textbox: (a) =>
    typeof a.slide_index === 'number' &&
    typeof a.text === 'string' &&
    typeof a.x === 'number' &&
    typeof a.y === 'number',
  delete_slide: (a) => typeof a.slide_index === 'number',
};

const DOCX_SYSTEM_PROMPT = `You control a word processing document. Given an instruction, respond with ONLY JSON matching exactly one of these shapes - nothing else, no explanation, no markdown fences:

{"action": "set_heading", "text": "..."}
{"action": "add_paragraph", "text": "..."}
{"action": "format_text", "target": "heading", "bold": true, "color": "1F3864"}
{"action": "add_table", "rows": 3, "cols": 2, "data": [["Section", "Punishment"], ["302", "Death/life"], ["304", "Up to life"]]}

"target" for format_text is either "heading" or "last_paragraph". "color" is a 6-digit hex string with no "#". These are the ONLY four actions available in this mode - this is a word processing document, not a presentation, so never invoke slide/presentation-only actions like add_slide, add_bullet, delete_slide, apply_theme, or add_textbox here.

Examples:
Instruction: "Set the heading to Introduction to Criminal Law"
Response: {"action": "set_heading", "text": "Introduction to Criminal Law"}

Instruction: "Add a paragraph saying This section covers the basics of criminal liability"
Response: {"action": "add_paragraph", "text": "This section covers the basics of criminal liability"}

Instruction: "Make the heading bold and dark blue"
Response: {"action": "format_text", "target": "heading", "bold": true, "color": "1F3864"}

Instruction: "Bold the last paragraph"
Response: {"action": "format_text", "target": "last_paragraph", "bold": true}

Instruction: "Add a table with 2 columns and 3 rows showing Section and Punishment: 302 is Death or life, 304 is Up to life"
Response: {"action": "add_table", "rows": 3, "cols": 2, "data": [["Section", "Punishment"], ["302", "Death or life"], ["304", "Up to life"]]}`;

const DOCX_ACTION_VALIDATORS = {
  set_heading: (a) => typeof a.text === 'string',
  add_paragraph: (a) => typeof a.text === 'string',
  format_text: (a) =>
    (a.target === 'heading' || a.target === 'last_paragraph') &&
    (a.bold === undefined || typeof a.bold === 'boolean') &&
    (a.color === undefined || (typeof a.color === 'string' && new RegExp(`^${HEX_COLOR}$`).test(a.color))),
  add_table: (a) =>
    typeof a.rows === 'number' &&
    typeof a.cols === 'number' &&
    Array.isArray(a.data) &&
    a.data.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string')),
};

const MODE_CONFIG = {
  pptx: { systemPrompt: PPTX_SYSTEM_PROMPT, validators: PPTX_ACTION_VALIDATORS },
  docx: { systemPrompt: DOCX_SYSTEM_PROMPT, validators: DOCX_ACTION_VALIDATORS },
};

function parseEditAction(rawText, validators) {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { error: 'response was not valid JSON' };
  }

  const validate = typeof parsed === 'object' && parsed !== null ? validators[parsed.action] : null;
  if (!validate || !validate(parsed)) {
    return { error: 'response JSON did not match the expected shape' };
  }
  return { action: parsed };
}

async function getEditActionFromClaude(instruction, mode) {
  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG.pptx;

  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: modeConfig.systemPrompt,
      messages: [{ role: 'user', content: instruction }],
    });

    const rawText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const result = parseEditAction(rawText, modeConfig.validators);
    if (result.action) {
      return result.action;
    }
  }
  throw new Error('Claude did not return a valid action after retrying');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/files/starter.pptx', (req, res) => {
  res.download(
    path.join(__dirname, 'storage', 'starter.pptx'),
    'starter.pptx',
    {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    }
  );
});

app.get('/files/starter.docx', (req, res) => {
  res.download(
    path.join(__dirname, 'storage', 'starter.docx'),
    'starter.docx',
    {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    }
  );
});

app.post('/callback', (req, res) => {
  res.json({ error: 0 });
});

// e.g. "set_title" -> "handleSetTitle", "add_table" -> "handleAddTable".
// Used purely for the log line naming a handler - it's not tied to an
// actual named function anywhere, just a readable stand-in.
function actionFunctionName(actionType) {
  const pascal = actionType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return `handle${pascal}`;
}

app.post('/api/edit-instruction', async (req, res) => {
  const { instruction, mode } = req.body;
  if (typeof instruction !== 'string' || !instruction.trim()) {
    return res.status(400).json({ error: 'instruction is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const startedAt = Date.now();

  sendEvent({ step: 'received', detail: `Instruction: ${instruction}` });

  try {
    sendEvent({ step: 'calling_llm', detail: 'Sending to Claude...' });
    const action = await getEditActionFromClaude(instruction, mode);
    sendEvent({ step: 'llm_response', detail: action });

    const functionName = actionFunctionName(action.action);
    sendEvent({ step: 'executing', action_type: action.action, detail: `Calling ${functionName}()...` });
    sendEvent({
      step: 'done',
      detail: `✓ ${functionName}() completed`,
      duration_ms: Date.now() - startedAt,
    });
  } catch (err) {
    sendEvent({ step: 'error', detail: err.message });
  }

  res.end();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
