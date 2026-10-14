# Party Games

A zero-dependency web app hosting **two** voice party games that share one server, one Jev
matcher, a global theme system, and a global language (English + Telugu). Aimed at Andhra
Pradesh and Telangana students.

- **Vibe Guess** (`/vibe`) — the original: describe answers on a hidden board, the AI host
  matches the *vibe* contextually and scores it. Spin-the-wheel or in-sequence turns.
- **Rapid Fire** (`/rapid`) — Pink (left half) and Blue (right half) alternate pictures; a fire
  spreads from the centre to the active team's edge. Right answer = +1 and the fire jumps sides;
  fire hits your edge = you burn, the other team +1, round over. Jev judges voice answers.
- **Landing** (`/`) — two game cards + global theme/language pickers + the Everyone/Kids switch.
- **Kid mode** (global, `Shell.getKids()`, `pg-kids`, `html[data-kids]`): kid boards only
  (`kids: true`), Rapid Fire kid categories + Addition/Subtraction, longer timers, more hints,
  softer sounds, encouraging host lines (`KID_STR` merged over `STR`), illustrated kids poster.

**New to this repo? Read `.agents/` first** — architecture, build guidelines, browser-testing
and sound-validation rules, and the audio/voice gotchas. Human setup is in `README.md`.

## Commands

- `npm start` serves everything on http://localhost:3000 (`/` landing, `/vibe`, `/rapid`)
- `npm run lint-topics` checks the question bank. Run after any edit to `lib/topics/*.js`; it must print "No problems found."
- `npm run eval` runs 78 labelled guesses through the real matcher. `npm run eval -- te-IN` for one language; `FORCE_JEV=1` makes Jev decide every case
- `npm run probe` tests whether Jev understands Telugu vs English (needs a key)
- No `npm install`: there are zero dependencies. Keep it that way unless asked

## Layout

- `server.js` HTTP server + API: `/api/{status,topics,match,match-one,warm,feedback}`; routes `/ /vibe /rapid`
- `lib/feedback.js` + `public/feedback.js` player feedback / high-fives → Discord webhook (`DISCORD_WEBHOOK_URL`)
- `lib/matcher.js` `matchGuess()` (Vibe, board) and `matchOne()` (Rapid Fire, one answer); `lib/localMatch.js` stage 1; `lib/jev.js` stage 2
- `lib/topics.js` languages (`LOCALES`); Vibe boards in `lib/topics/en.js` and `lib/topics/te.js`
- `public/index.html` landing · `public/vibe.html` Vibe Guess · `public/rapid.html` Rapid Fire — each a single self-contained page, sounds synthesised with Web Audio
- `public/theme.css` + `public/theme.js` shared design tokens (4 themes) and `window.Shell` (global theme + language); `public/rapid/items*` generated image manifest + assets
- `.agents/` architecture + build/test/sound rules for the next agent
- `eval/` eval cases and scripts; `logs/matches.jsonl` gets every match the server makes

## How matching works (keep these invariants)

1. Stage 1, local: split the guess on "and"/"మరియు"/commas, then exact, alias, plural-stem and small-typo matching. Free and instant. If a part is ambiguous it goes to stage 2; never guess between two answers locally.
2. Stage 2, Jev (TypeSafe System One decision model): one request with a Choice over the whole board plus `none_of_these`, and one Noul (yes/no) per answer so a single utterance can score several answers.
3. Thresholds in `lib/config.js`: auto-accept at ≥ 0.75, host asks "Did you mean…?" at 0.45–0.75, otherwise not on the board.
- Already-matched answers stay in the Jev question so repeats are detected as repeats.
- Jev `state` is only the topic and the guess. Extra context can flip Jev's decisions, so never add chat history or transcripts.
- Jev instructions stay in English for every language; Telugu answers carry an English `gloss`.
- On any Jev error, fall back to the local result. The game must never stall on the network.
- The API key lives only on the server (`.env`). Never send it to the browser.

## Game rules encoded in the client

- Guesses resolve in parallel, tagged by sequence number. A guess that resolves after the buzzer never scores.
- Music is silenced while the talk button is held (the mic would hear it) and dips while the host speaks.
- The host never talks over a player holding the button, except for turn announcements and "Did you mean…?"
- Topics are drawn at random per language without repeats until all are used; each turn's board is a rotating subset of the pool (`boardFor`), and `/api/match` gets its `keys` so only on-screen answers can score.
- Rapid Fire decks come from each category's full pool (all sums for maths) with no repeats in a game; `rapid-seen-<category>` makes the next game start with unseen questions.
- When the device has no voice for the language, the host shows captions only. Never read Telugu with an English voice.

## Writing topics

- Boards must be fun and relatable, never a knowledge test. Think power cuts, homework excuses, things Amma says, gully cricket. No trivia, dates, place facts or "name the ritual" boards.
- Telugu boards are written natively, not translated from English. Include both Andhra and Telangana words as aliases (బొబ్బట్లు/భక్ష్యాలు, గేదెలు/బర్రెలు).
- Each board is a pool of 18–30 answers, mixed difficulty (`common` 1 pt, `medium` 2, `obscure` 3; obscure means the funnier, less obvious answer). A turn shows `SHOW` (5/4/3, `lib/topics.js`) picked at random, preferring answers not shown before on that device, so every difficulty needs spares; `npm run lint-topics` enforces it.
- New answers must not overlap existing ones in meaning (the eval matches against the whole pool); re-run `npm run eval` and keep false positives at the baseline.
- Aliases should cover how people actually say it: Telugu script, English words, romanized Telugu, spelling variants.
- Every Telugu answer needs a short English `gloss`; every Telugu board needs `promptGloss`.
- Mark a board `kids: true` if it suits young children; kid mode shows only those boards.
- A native Telugu speaker has not yet reviewed the Telugu text. Flag wording you're unsure of instead of guessing.

## Conventions

- Node ≥ 18, ES modules, no build step, no frameworks. Pages are single self-contained HTML files.
- Both pages share a dark game-show look via CSS tokens on `:root`. Reuse the tokens; don't add literal colours.
- Telugu text must render correctly: keep `Noto Sans Telugu` and the platform Telugu fonts in the font stacks, and trim text by grapheme (`Intl.Segmenter`), never by code point.
- User-facing strings live in the `STR` object in each page, one block per language. Add both languages when adding a string.

## Testing

- No unit test framework yet. For logic changes, run `npm run lint-topics` and `npm run eval` and compare pass and false-positive counts before and after. False positives must stay at 0.
- For UI changes, play-test in a real browser. Playwright with Chromium works well headless: type guesses into `#typedGuess`, and shorten a turn by setting `S.deadline = Date.now()` in the page.
- Speech recognition and the host voice only work in a real browser with a microphone (Chrome is best for Telugu). Say so rather than claiming they were tested headless.

## Status and next steps

- Real Jev accuracy and latency are unmeasured. Steps are in README "Validate end to end": get an OpenRouter key, `npm run probe`, then `FORCE_JEV=1 npm run eval`.
- Telugu speech recognition and voices need testing on Android Chrome and iPhone Safari.
- Telugu topics and host lines need native-speaker review.
- Later: port `lib/` behind a Supabase Edge Function and build the Expo app per `docs/original-spec.md`. Treat that spec's Haiku matcher and visual-only host as superseded by Jev and the spoken host here.
