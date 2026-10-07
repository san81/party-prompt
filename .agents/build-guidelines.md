# Build guidelines

## Golden rules

- **No dependencies, no build step, no framework.** Node ≥ 18, ES modules. `npm start` =
  `node server.js`. There is no bundler; pages are single self-contained HTML files with inline
  CSS/JS (plus the two shared files `theme.css` / `theme.js` and the generated `rapid/items.js`).
  Don't add `npm install` steps unless the user explicitly asks.
- **Match the surrounding style.** Comment density, naming, idioms. These pages favour terse,
  readable vanilla JS and a small `STR` i18n object per page.
- **Never hardcode colours.** Use the theme tokens (`var(--brass)` etc.). New visual elements
  must work in all four themes — check `daylight` (light) especially, since text/really needs
  contrast there.
- **New visible string → add it to `STR` for BOTH `en-US` and `te-IN`.** Both games must stay
  fully playable in both languages.
- **Secrets stay server-side.** The Jev key is only in `.env` / the host's env. Never ship it
  to the browser.

## Running locally

```bash
npm start                 # http://localhost:3000  (landing); /vibe and /rapid
npm run lint-topics       # after editing lib/topics/*.js — must print "No problems found."
npm run eval              # Vibe matcher scorecard (needs a key for the Jev path)
```

`.env` (git-ignored) for Jev via OpenRouter:

```
TYPESAFE_API_KEY=sk-or-...
TYPESAFE_URL=https://openrouter.ai/api/v1/systemone
JEV_MODEL=jev-1.13
```

## Deploying (Render)

`render.yaml` defines the web service. On the host set **all three** Jev env vars above
(not just the key) or Jev 401s / silently falls back to local. `/api/status` showing `jev:true`
only proves a key is present, not that it authenticates — test `/api/match-one` with a synonym.

## Regenerating Rapid Fire items

If you add/remove images under `public/rapid/items/<category>/`, regenerate the manifest:

```bash
node scripts/gen-rapid-items.mjs      # writes public/rapid/items.js
```

Notes:
- Add a `LABELS` entry in that script for any new category (English + Telugu) so the dropdown
  is translated; otherwise the folder key is used verbatim.
- `missingPerson` is excluded (personal photos); empty folders (e.g. `teluguCinema` until you
  add images) are skipped so nothing broken ships.
- Two categories share the `letters/` images (single A–X letter pictures):
  `alphabet` (answer = the letter shown) and `priorAlphabet` (answer = the letter *before* it,
  with `shown` = the displayed letter, `imgDir: 'letters'`). The "prior" rule is baked into the
  expected answer. Letter matching (rapid.html `letterLocal`): filler like "letter"/"it's" is
  stripped; the exact letter or its spoken name ("dee") scores; a word that merely starts with
  the letter ("Ditto", "Dog") asks "Did you mean D?"; a different letter is rejected; anything
  else goes to Jev via `match-one` with `kind: 'letter'` (mishearing-aware prompt), whose
  0.45–0.75 band also asks "Did you mean?".
  rapid.html resolves the image path with `category.imgDir || category.key`.

Filenames with spaces (e.g. `Bill Gates.jpg`) are fine — the answer is the cleaned file name,
and the server decodes the request path.

## Adding a third game (pattern)

1. New `public/<game>.html` — copy the head block (theme head-script + fonts + theme.css),
   a top bar with `← Menu`, Jev pill, Sounds/Host toggles, `langSel`, `themeSel`.
2. Add a route in `server.js`'s `pretty` map and a card on the landing (`public/index.html`).
3. If it needs matching, add an endpoint + a function in `lib/matcher.js` reusing `askJev`.
4. Give it its own `STR` (en + te), wire `Shell.fillThemeSelect` / `fillLangSelect` and a
   `langchange` listener. Reuse the mic/`say()` pattern from an existing game verbatim.
