# VITE · BioBuzz Alliance Matrix - Agent Instructions

## Repository Structure

- `frontend/` - React + Vite + Tailwind frontend application
- `server.py` - FastAPI backend (API proxies for FIRST, TOA, FTCScout, Gemini)
- `engine/` - Backend modules (FTCScout GraphQL client, Gemini AI)
- `frontend/src/lib/model.js` - **Single source of truth** for all math (synergy, Monte Carlo, statistics)
- `frontend/src/lib/store.js` - LocalStorage + IndexedDB persistence
- `frontend/src/lib/i18n.js` - Translations (Russian/English)
- `render.yaml` - Render deployment configuration

## Key Architectural Decisions

### Single Math Engine
- **Frontend-only math**: All calculations happen in `model.js` in the browser
- **No Python math engines**: Deleted synergy.py, monte_carlo.py, stats.py, scoring.py, db.py
- **Reason**: Frontend uses `model.js`, Python backend only proxies external APIs
- **DO NOT** recreate Python math engines - they would duplicate logic

### Offline-First Architecture
- Scout data stays in browser (localStorage + IndexedDB)
- No server-side storage of scout notes
- API calls are optional (FTCScout, FIRST, TOA)
- Application works fully offline after initial load

### Deployment
- Single Render service (frontend + backend together)
- Base path: `/` (not `/VITE/`)
- GitHub Pages workflow removed
- Auto-deploys from GitHub main branch

## Rules for Code Changes

### 1. Before Making Changes
- Read existing code to understand patterns
- Check if similar functionality already exists
- Follow existing code style and conventions
- Verify all imports before adding new ones

### 2. Model.js Changes
- **DO NOT** change without updating all consumers
- Consumers: `store.js`, `Scouting.jsx`, `Teams.jsx`, `Analysis.jsx`, `Draft.jsx`, `Notebook.jsx`
- Run `grep -rn "from.*model"` in `frontend/src` to find all imports
- After changes: run `npm test` and `npm run build`

### 3. Adding Dependencies
- Check if package.json already uses the library
- Prefer established libraries over new ones
- For frontend: use `npm add <package>` (not manual package.json edits)
- For backend: add to requirements.txt with version constraints
- NEVER add dependencies that require keys stored in browser

### 4. API Credentials
- **NEVER** commit API keys to repository
- Store only in server environment variables (Render)
- Frontend must never receive credentials
- Valid env vars: `FTC_API_USERNAME`, `FTC_API_TOKEN`, `TOA_API_KEY`, `GOOGLE_API_KEY`

### 5. Breaking Changes
- DO NOT change function signatures without checking all callers
- Use `grep -rn <function_name>` to find usage
- If renaming, update all occurrences in one commit
- Test pages still work after signature changes

### 6. Data Deletion
- **NEVER** automatically delete user data without explicit consent
- Settings page has manual "Delete all data" button
- Event switching should preserve records when possible
- Demo data is clearly labeled and isolated

## Testing Commands

### Frontend
```bash
cd frontend
npm install
npm run dev        # http://127.0.0.1:5173
npm test          # Vitest tests
npm run build     # Production build
```

### Backend
```bash
py -3 -m pip install -r requirements.txt
py -3 -m uvicorn server:app --host 127.0.0.1 --port 8000
curl http://127.0.0.1:8000/api/health
```

## Things NOT to Do

- **DO NOT** recreate Python math engines (synergy, monte_carlo, stats, scoring, db)
- **DO NOT** store API keys in browser or commit them
- **DO NOT** add third-party analytics or tracking scripts
- **DO NOT** change game rules/scoring without referencing official BIOBUZZ manual
- **DO NOT** make breaking changes to model.js without updating all consumers
- **DO NOT** automatically delete user scout data
- **DO NOT** add dependencies from <7 days old (security risk)

## Game Rules Configuration

If game rules change for a new season:
- Create `frontend/src/config/game.{season}.js` with season-specific values
- Points thresholds and weights should be constants, not magic numbers
- Reference BIOBUZZ Competition Manual in comments
- DO NOT change rules mid-season without explicit user request

## Accessibility Guidelines

- Maintain monochrome color scheme (black, zinc, white, gray #27272a)
- Keep keyboard navigation (Tab, Escape, 1-9 keys)
- Maintain ARIA labels on all interactive elements
- Ensure focus-visible states on all buttons/inputs
- Legal/privacy components in `Legal.jsx` must stay up to date

## Current Known Limitations

- FTCScout GraphQL uses `eventsOnDate` (verified working)
- Gemini AI backend exists but not connected to UI (user explicitly said not needed)
- Russian strings still exist in some pages (Data.jsx, Scouting.jsx, etc.) - needs cleanup
- PWA/Service Worker not yet implemented (manual service-worker.js in legacy/)
