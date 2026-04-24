# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project: LeadScrapper Paraguay

Herramienta Streamlit que extrae leads comerciales de Google Maps en Paraguay usando Playwright (headless Chromium).

---

## Commands

```bash
# Install dependencies
pip install -r requirements.txt
playwright install chromium

# Run the app
streamlit run app.py
```

No test suite exists. Validation is manual via the Streamlit UI at `http://localhost:8501`.

---

## Architecture

### Data flow

```
app.py  →  scraper.py  →  cleaner.py  →  app.py (display)
  UI         Playwright       pandas
```

1. **`app.py`** — Streamlit UI. Manages `st.session_state` (leads DataFrame, batch offset, scraping flags). Spawns Playwright in a separate thread via `run_scraper_in_thread()` using a `ProactorEventLoop` (required on Windows for asyncio + Playwright compatibility).

2. **`scraper.py`** — Async Playwright engine. Opens Google Maps search, scrolls the feed until `BATCH_SIZE` cards are visible, then opens each business in a second tab to extract phone + full address from the detail panel. Applies stealth plugin and pre-sets Google consent cookies to skip the consent wall. Returns `list[dict]`.

3. **`cleaner.py`** — Normalizes raw dicts: strips control chars, normalizes phones, infers Localidad/Ciudad/Barrio from address string, and discards records from non-Paraguay addresses.

4. **`config.py`** — Single source of truth for all constants: `BATCH_SIZE`, scroll timing, `GOOGLE_MAPS_BASE`, `BUSINESS_TYPES`, `PARAGUAY_LOCATIONS`, `OUTPUT_COLUMNS`, and UI theme colors.

### Key design decisions

- **Batching**: `batch_offset` in session state allows "Extraer más" to re-run the scraper from a higher card index within the same search.
- **Resource blocking**: images, fonts, and media are aborted by Playwright to speed up page loads.
- **Thread isolation**: Playwright cannot run inside Streamlit's event loop; a new `ProactorEventLoop` is created in a daemon thread for each scrape call.
- **Selector fallback chains**: Both `scraper.py` extractor functions try multiple CSS selectors in order, since Google Maps DOM classes change frequently.

---

## Workflow Rules

1/ **[Plan Mode Default]**
Enter plan mode ONLY when task complexity justifies it (3+ meaningful steps).
If something goes wrong, STOP and re-plan immediately — don't keep pushing.

2/ **[Subagent Strategy]**
Use subagents ONLY for complex or parallelizable tasks to keep the main context window clean.

3/ **[Self-Improvement Loop]**
After any correction from the user, update `tasks/lessons.md` with the pattern.

4/ **[Verification Before Done]**
Never mark a task complete without proving it works. Ask: "Would a staff engineer approve this?"

5/ **[Demand Elegance (Balanced)]**
For non-trivial changes, ask: "Is there a more elegant solution?" Skip for simple fixes.

6/ **[Autonomous Bug Fixing]**
When given a bug report: just fix it. Use logs, errors, and failing tests to diagnose.

7/ **[Task Management]**
1. Plan First: Write the plan in `tasks/todo.md` with checkable items
2. Verify Plan: Confirm before implementation
3. Track Progress: Mark items complete as you go
4. Explain Changes: Provide a high-level summary at each step
5. Document Results: Add a review section to `tasks/todo.md`
6. Capture Lessons: Update `tasks/lessons.md` after corrections

8/ **[Code Discipline — CRITICAL]**
- Nunca asumir requisitos. Declarar supuestos antes de implementar.
- Escribir el mínimo código posible. Prohibido sobreingeniería.
- Solo modificar lo necesario. No tocar código no relacionado.
- Definir criterios verificables antes de implementar. No marcar como terminado sin prueba.
