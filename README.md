# Engineering Document Practice Tool

A timed training app for practicing engineering document analysis. An AI client gives you a request, supporting documents, and data to analyze — all under time pressure. Then Claude reviews your performance.

## Quick Start

### 1. Set up your API key

```bash
cp .env.example .env
# Edit .env and add your Anthropic API key
```

### 2. Install dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 3. Run the app

**Option A: Development mode** (hot-reload for both frontend and backend)

Terminal 1 — Backend:
```bash
cd backend
python main.py
```

Terminal 2 — Frontend:
```bash
cd frontend
npm run dev
```

Then open http://localhost:5173

**Option B: Production mode** (single server)

```bash
cd frontend
npm run build
cd ../backend
python main.py
```

Then open http://localhost:8000

## How It Works

### Exercise Flow (7 steps, ~50-60 minutes)

1. **Scenario Generation** — Claude creates a realistic engineering scenario
2. **Read Request** (7 min) — Read the client's request, summarize what the deliverable should look like
3. **Document 1** (7 min) — Read and take notes
4. **Document 2** (7 min) — Read and take notes
5. **Document 3** (7 min) — Read and take notes
6. **Data Predictions** (7 min) — Predict what patterns you expect in the data
7. **Examine Data** (7 min) — Analyze the actual data and take notes
8. **AI Review** — Claude evaluates your work with detailed feedback

### Note-Taking Shortcuts
- **Enter** → New bullet point
- **Tab** → Indent to sub-bullet
- **Shift+Tab** → Outdent
- **Enter on empty bullet** → Exit bullet mode

### Previous Notes
- Click the "NOTES" tab on the left edge to view notes from earlier steps
- On the predictions step, all notes are displayed on screen

## Architecture

```
eng-doc-trainer/
├── backend/
│   ├── main.py           # FastAPI server & routes
│   ├── claude_client.py   # Anthropic API wrapper
│   ├── prompts.py         # All AI prompts
│   ├── session_store.py   # JSON file storage
│   ├── token_tracker.py   # Cost tracking
│   └── config.py          # Settings & model config
├── frontend/
│   └── src/
│       ├── App.tsx         # Main app & step router
│       ├── api.ts          # Backend API calls
│       ├── types.ts        # TypeScript interfaces
│       ├── hooks/          # useTimer, useSession
│       └── components/     # UI components
└── sessions/               # Saved session JSON files
```

### Key Design Decisions

- **Only 2-3 API calls per session** — scenario generation + review (+ optional improvement comparison). No AI calls during the timed exercise itself.
- **~$0.87 per session with Opus 4.6** — well under the $4 budget.
- **JSON file storage** — no database needed. Sessions are human-readable files.
- **Sessions track progress** — future sessions load past results for improvement comparison.

## Settings

Open settings via the ⚙️ icon:

- **Model**: Opus 4.6 (default), Sonnet 4.5, Haiku 4.5
- **Timer duration**: Configurable per step (default 7 minutes)
- **Engineering domain**: Specify or leave random
- **Difficulty**: Beginner / Intermediate / Advanced
- **Cost limit**: Default $4.00 per session

## Cost Estimates

| Model | Est. Cost/Session |
|-------|-------------------|
| Opus 4.6 | ~$0.87 |
| Sonnet 4.5 | ~$0.17 |
| Haiku 4.5 | ~$0.04 |
