# ONLYOFFICE Chat Demo

A demo of chat-driven document editing: you type a plain-English instruction
("add a bullet about IPC Section 300"), Claude turns it into a structured
edit action, and that action is executed live inside an embedded ONLYOFFICE
editor — no manual clicking, no re-uploading a file.

It supports two document types, switchable from a pill in the UI:

- **PPTX** — a presentation, edited via ONLYOFFICE's Presentation Builder API
- **DOCX** — a Word document, edited via ONLYOFFICE's Document Builder API

Both start pre-loaded with real content (a short "Murder Under Indian Law"
lesson — title/heading, body text, bullets, a formatted table) rather than a
blank page, so the demo has something to point at immediately.

## How it fits together

```
Browser (public/index.html)
  ├─ embeds the ONLYOFFICE editor via DocsAPI.DocEditor,
  │  pointed at ONLYOFFICE Document Server (Docker, localhost:8080)
  ├─ chat panel + "Live Trace" log
  └─ on send: POSTs the instruction to the Express backend over SSE

Express backend (server/server.js, localhost:4000)
  ├─ serves public/ as static files
  ├─ serves the starter .pptx/.docx from server/storage/
  ├─ POST /api/edit-instruction (SSE): sends the instruction + a mode-
  │  specific system prompt to Claude, gets back ONE JSON action object
  │  (e.g. {"action":"add_bullet","slide_index":1,"text":"..."}),
  │  validates its shape, and streams progress events back to the browser
  └─ POST /callback: required by ONLYOFFICE Document Server, no-op here

Browser, on receiving the action
  └─ builds a JS function from a per-action template (baking the action's
     data in as literals — see "A note for whoever extends this" below),
     and runs it inside the editor via connector.callCommand(fn)
```

Claude never touches the document directly. It only classifies the
instruction into one of a small, fixed set of actions (see
`PPTX_SYSTEM_PROMPT` / `DOCX_SYSTEM_PROMPT` in `server/server.js` for the
full list per mode). The browser is what actually calls the ONLYOFFICE API.

## Prerequisites

- **Node.js** 18+ and npm
- **Docker Desktop** (to run ONLYOFFICE Document Server locally)
- An **Anthropic API key** (https://console.anthropic.com/)

## Setup

### 1. Start ONLYOFFICE Document Server

This demo requires the **Developer Edition** image, not Community Edition.
`connector.callCommand()` — the mechanism this whole demo runs on — needs
`docEditor.createConnector()`, which only ships in Developer/Enterprise
Edition. Community Edition's `api.js` doesn't have it at all, so anything
built against it will fail with `window.connector` staying permanently
undefined ("connector not ready" no matter how long you wait).

```bash
docker run -i -t -d -p 8080:80 --restart=always \
  -e JWT_ENABLED=false \
  -e ALLOW_PRIVATE_IP_ADDRESS=true \
  onlyoffice/documentserver-de
```

`onlyoffice/documentserver-de` is a public image — a plain anonymous pull
works, no Docker Hub login and no license file needed. Developer Edition
is free to run for dev/demo purposes with the full Automation/Builder API
available; it's just not licensed for production deployment.

Give it a minute to boot, then confirm it's up by opening
`http://localhost:8080` — you should see the ONLYOFFICE welcome page.

JWT is deliberately disabled and private-IP requests are allowed — this is
a local dev/demo setup, not a production config.

### 2. Install server dependencies

```bash
cd server
npm install
```

### 3. Add your API key

```bash
cp .env.example .env
```

Then edit `.env` and set `ANTHROPIC_API_KEY` to your real key. `.env` is
gitignored — never commit it.

### 4. Generate the starter documents

```bash
npm run generate:starters
```

This writes `server/storage/starter.pptx` and `server/storage/starter.docx`
(generated content, not committed to the repo — see `server/scripts/`).

### 5. Run the server

```bash
npm start
```

### 6. Open the app

Go to `http://localhost:4000`.

The frontend loads ONLYOFFICE's client script from `localhost:8080` but
fetches the actual document files via `http://host.docker.internal:4000/...`
— that hostname is how the Document Server container reaches back out to
your host machine's Express server. If Document Server is running
somewhere other than Docker Desktop's default setup, that URL (in
`public/index.html`, `MODE_FILES`) may need to change to whatever address
your Document Server container can use to reach `localhost:4000` on the
host.

## Using it

- Use the **PPTX / DOCX** pill (top right of the Live Trace panel) to
  switch document types. Switching reloads the editor with that mode's
  starter file.
- Type an instruction in the chat box and hit send. The Live Trace panel
  shows each step (received → calling Claude → got action → executing →
  done) with timing.
- Example instructions:
  - "Set the title to Introduction to Criminal Law"
  - "Add a bullet about IPC Section 302 to slide 2"
  - "Make the heading bold and dark blue"
  - "Add a table row: 305, Up to 10 years"
  - "Delete slide 3"

Each mode only accepts its own fixed set of actions (a presentation action
sent in DOCX mode, or vice versa, is rejected before it reaches the editor)
— see the system prompts in `server/server.js` for the exact action
vocabulary per mode.

## Project structure

```
onlyoffice-chat-demo/
├── README.md
├── CLAUDE.md                    # notes for agents working in this repo
├── .gitignore
├── public/
│   └── index.html               # entire frontend: UI, chat, DocsAPI wiring,
│                                 # per-action JS builders for both modes
└── server/
    ├── server.js                # Express app: static hosting, file routes,
    │                             # /api/edit-instruction (SSE), /callback
    ├── package.json
    ├── .env.example
    ├── scripts/
    │   ├── create-starter-pptx.js   # generates server/storage/starter.pptx
    │   └── create-starter-docx.js   # generates server/storage/starter.docx
    └── storage/                 # generated output (gitignored)
```

## Troubleshooting

- **Editor never loads / blank iframe**: confirm `http://localhost:8080`
  loads the ONLYOFFICE welcome page first. If it doesn't, the Document
  Server container isn't up yet, or Docker itself isn't running.
- **Chat instructions permanently fail with "connector not ready yet"**,
  no matter how long you wait after the page loads: you're almost
  certainly running Community Edition (`onlyoffice/documentserver`)
  instead of Developer Edition (`onlyoffice/documentserver-de`).
  Community Edition's `api.js` has no `createConnector` at all, so
  `window.connector` never gets set — this isn't a timing issue and
  waiting longer won't fix it. Check which image is actually running with
  `docker ps`, and if you see `onlyoffice/documentserver` without the
  `-de` suffix, stop it and start the Developer Edition image instead (see
  Setup step 1). If you *are* on `-de` and still see this on a single
  attempt, it's more likely an ordinary race — reload the page and wait
  for the "Editor ready, connector created" line in Live Trace before
  typing.
- **Docker Desktop won't start on Windows** (engine crashes referencing a
  `.sock` file "cannot be accessed by the system"): kill any leftover
  Docker processes, run `wsl --shutdown`, then relaunch Docker Desktop. If
  it still fails, the stuck socket directory usually needs to be renamed
  out of the way before Docker will start cleanly.
- **Mode switch shows stale content after regenerating starter files**: do
  a full page reload (`localhost:4000`) rather than just clicking the
  pill — the editor caches by document key, and a plain mode switch doesn't
  always pick up a freshly regenerated file on disk.
- **"Api.XxxYyy is not a function"**: this usually means an action ran
  against the wrong mode's document (e.g. a presentation call against a
  Word document). Check `document.querySelector('.mode-btn.active')` to
  confirm which mode is actually loaded before debugging further.

## A note for whoever extends this

`connector.callCommand(fn)` serializes `fn` via `.toString()` and runs it
inside the editor iframe with **no closure access** to any outer variable —
all data the function needs must be baked in as literals (see
`buildCommandFunction` and the `*_ACTION_CODE_BUILDERS` maps in
`public/index.html`). It's an easy thing to trip on when adding a new
action type.

See `CLAUDE.md` for the specific ONLYOFFICE Automation/Builder API
behaviors (method names, signatures, quirks) that were only discoverable by
testing against this specific Document Server build — the official docs
don't fully match.
