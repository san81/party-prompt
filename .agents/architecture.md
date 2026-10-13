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
- Grown-up themes: `celebration` (default, high-energy), `fall`, `midnight`, `neon`, `daylight`
  (light). Kid mode has its own three (see Kid mode below).
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

## Kid mode (global)

- `Shell.getKids()/setKids()/bindKidsToggle()` in theme.js persist `localStorage['pg-kids']`,
  set `html[data-kids="on|off"]` (also in each page's head script) and fire `kidschange`.
- Each page merges a `KID_STR` block over `STR` when kid mode is on. Games read the flag at
  setup/between turns; a switch mid-turn applies afterwards.
- Vibe: only `kids: true` boards (style filter ignored), 60/90/120 s turns, a first-letter
  hint on a hidden tile after 10 s without a score, major-key music, softer buzzer/miss.
- Rapid Fire: `KID_CATS` (Addition, Subtraction, Alphabet, Animals, Kitchen), 10–30 s shots,
  three hints (maths: dots → counting strategy → range; words: … → `Z _ B _ A` mask), toy-like
  sounds, star burst instead of an explosion. Maths sums are generated client-side
  (`mathDeck`); answers are read locally by `readNumber` (digits, English, Telugu script,
  romanized Telugu), otherwise `match-one` with `kind: 'number'`.
- Landing: Everyone/Kids switch; the hero photo is replaced by an inline SVG kids poster.
- Kid palettes: `KID_THEMES` (candy (default), jungle, space) in theme.js/theme.css. While Kids
  is on, the theme picker lists only these and saves to `pg-kids-theme`; grown-up themes keep
  `pg-theme`. `setKids()` switches palette and fires `themechange` (Vibe redraws its wheel).

## Rapid Fire game flow

- One round = alternating shots. The active team's picture card (`#shot`) is moved into its
  half; the fire (`.fire`, `--p` 0→1 set every frame from `S.deadline`) is the clock.
- Correct → +1, `S.curTeam` flips, fresh clock. Skip → new picture, same clock. Clock out →
  `burn()`: other team +1, round ends, reveal waits. Starting team alternates per round.
- Team colours are the `--team1`/`--team2` tokens in `theme.css`; fire colours derive from
  `--brass` → `--coral`, so each theme gets its own fire.

## Rapid Fire assets

- Images copied from the old repo into `public/rapid/items/<category>/`. `missingPerson`
  (personal photos) was excluded.
- `public/rapid/items.js` is generated — it lists `{ file, answer }` per category with cleaned
  display/answer names (camelCase split, extension stripped). Regenerate with the script in
  [build-guidelines.md](build-guidelines.md) if images change.
