# Browser testing rules

These games are almost entirely about runtime behaviour (voice, timers, audio, animation).
Reading the code proves nothing. **Run the app and observe it.**

## Baseline

- Serve through the server (`npm start`), not `file://` — the API and mic (secure-context) need it.
- After any logic change, open the affected page and **check the console for errors** first.
- For server/API changes, `curl` the endpoint and read the JSON (see examples below).

## What you CAN verify with automation (headless / devtools)

- Routes, status codes, content-types (`curl -w`).
- API responses — e.g. `POST /api/match-one`:
  ```bash
  curl -s -X POST localhost:3000/api/match-one -H 'Content-Type: application/json' \
    -d '{"expected":"Cat","guess":"a kitty","category":"Animals"}'   # → match:true, source:jev
  ```
  Verify: exact → `source:local score:1`; synonym/Telugu → `source:jev match:true`;
  wrong → `match:false`.
- DOM/state transitions by calling game functions and reading `S` / the DOM (stub
  `navigator.mediaDevices.getUserMedia` to resolve, and `SR.prototype.start` to a no-op so a
  turn can run without a real mic): confirm image loads, score increments, team switches,
  final screen, theme swaps, `langchange` re-renders.
- Layout at mobile width (`resize_window` to ~402×840) via screenshots.
- Visual theme correctness via screenshots in each theme (esp. `daylight` contrast).

## What you CANNOT verify with automation — must be ear/eye-checked on a real device

- **Whether speech synthesis actually makes sound.** Chrome only renders speech after a
  *genuine* user gesture; synthetic/dispatched events don't grant user activation, so
  `speechSynthesis.speak()` reports `speaking:true` but emits nothing in automation. Do not
  claim host voice "works" from `speaking:true`. Ask the user to listen.
- **Whether the mic actually hears the player** and SpeechRecognition transcribes it.
- **iOS Safari / Android Chrome speech + mic.** Different engines, stricter gesture rules,
  no Telugu TTS on most devices (→ captions only, expected).

When you hand off, state plainly what was ear-verified vs reasoned.

## Known-good manual test pass (do this before saying "done")

1. Landing `/`: switch theme (all 4) and language (en/te) — both apply and persist; the
   setting carries to `/vibe` and `/rapid`.
2. Vibe `/vibe`: start a turn (sequence mode); type a guess that should score; confirm the
   board + host caption + score update. `← Menu` returns to landing.
3. Rapid `/rapid`: pick a category, Start game → Start turn; image shows + clock runs; tap
   `Got it ✓` (score +1, next image) and `Skip →`; let the clock hit 0 → buzzer, other team's
   turn; finish all turns → winner screen. In Telugu, a spoken Telugu word should match via Jev.
4. Mobile width: both games' setup + play stage are readable and usable.

## Gotchas that have bitten us

- `speaking:true` ≠ audio (above).
- A hung `volume=0` utterance poisons the speech engine process-wide; clears only on a full
  **Chrome restart**, not a tab reload. We removed the primer — don't reintroduce it.
- Binary assets corrupt if the server stringifies them — keep Buffer passthrough.
- Jev on a host: needs `TYPESAFE_URL` + `JEV_MODEL`, not just the key.
