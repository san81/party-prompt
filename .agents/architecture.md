# Architecture

## Server (`server.js`)

Zero-dependency Node HTTP server. Serves static files from `public/` and a small JSON API.
The Jev API key lives only on the server (`.env`), never sent to the browser.

- Pretty routes: `{ '/': 'index.html', '/vibe': 'vibe.html', '/rapid': 'rapid.html' }`.
- Static files are read as Buffers and sent as-is (so images/audio aren't corrupted). MIME
  types are in the `TYPES` map — add new extensions there.
- API:
  - `GET /api/status` → `{ jev, model, accept, confirm, multiMatch }`.
  - `GET /api/topics` → Vibe boards (incl. `style`) + `locales` + `points`. The landing and
    both games read `locales` here to agree on language labels.
  - `POST /api/match` → Vibe: match a guess against a whole board (`matchGuess`).
  - `POST /api/match-one` → Rapid Fire: match one spoken guess against one expected answer
    (`matchOne`). Body `{ expected, guess, category }`.
  - `POST /api/warm` → opens the Jev connection before a turn (first call is ~1s slower cold).

## Matching (two paths, one Jev client)

Both games are two-stage: a free/instant local check first, Jev only when needed.

- **Vibe (`matchGuess` in `lib/matcher.js`)** — splits the guess, does exact/alias/plural/typo
  local matching against the board, and for anything ambiguous asks Jev one request with a
  Choice over the board + a Noul per answer. Thresholds in `lib/config.js` (accept ≥ 0.75,
  confirm ≥ 0.45). See root `CLAUDE.md` for the full invariants — keep them.
- **Rapid Fire (`matchOne` in `lib/matcher.js`)** — stage 1 is a Levenshtein similarity
  (≥ 0.8 = match, English only, fast). Stage 2 asks Jev a single Noul: "does `player_guess`
  name/describe `expected_answer`?" This is **cross-lingual**: a Telugu/Hindi word for the
  item matches the English answer (verified: "పిల్లి" → "Cat" ≈ 0.97). Falls back to the local
  result on any Jev error. On any error the game still works via the host's Got it/Skip buttons.

## Themes (`public/theme.css` + `public/theme.js`)

- Colour/elevation tokens (`--stage`, `--panel`, `--brass`, `--coral`, `--mint`, `--seg1..6`,
  `--glow`, …) are defined per theme under `html[data-theme="..."]`. Fonts live in `:root`.
- Four themes: `celebration` (default, high-energy), `midnight`, `neon`, `daylight` (light).
- `window.Shell` (theme.js) reads/writes `localStorage['pg-theme']`, applies `data-theme`, and
  builds the theme `<select>`. A tiny inline `<head>` script on every page sets `data-theme`
  before CSS loads to avoid a flash — keep that script when adding pages.
- Pages reference tokens only; they must not hardcode colours. `color-mix()` is used for the
  radial backdrop so it tints per theme.

## Global language / i18n (`pg-lang`)

- `Shell.getLang()/setLang()` persist `localStorage['pg-lang']` and fire a `langchange` event.
- Each page has a per-page `STR` object keyed by locale (`en-US`, `te-IN`) with every visible
  string, and an `applyLang(code)` that re-renders. Pages listen for `langchange` so switching
  language anywhere updates everywhere. Vibe keeps its own `sg-locale` in sync with `pg-lang`.
- Rapid Fire category labels are bilingual in `RAPID_CATEGORIES` (`en`/`te`). Answers stay in
  English; Jev handles the player speaking Telugu.
- Telugu host voice depends on a device TTS voice; most devices have none → captions only (by
  design). Test spoken host with English.

## Rapid Fire assets

- Images copied from the old repo into `public/rapid/items/<category>/`. `missingPerson`
  (personal photos) was excluded.
- `public/rapid/items.js` is generated — it lists `{ file, answer }` per category with cleaned
  display/answer names (camelCase split, extension stripped). Regenerate with the script in
  [build-guidelines.md](build-guidelines.md) if images change.
