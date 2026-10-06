# Agent notes — Party Games

Start here if you're an AI agent (or human) picking up this repo. These notes capture
what isn't obvious from the code or git history. Read the root `CLAUDE.md` and `README.md`
too; this folder adds architecture, build/test rules, and hard-won gotchas.

## What this is

**Party Games** — a zero-dependency Node web app hosting two voice party games that share
one server, one Jev matcher, a global theme system, and a global language (English + Telugu).

- **Vibe Guess** (`public/vibe.html`, route `/vibe`) — the original game. A player describes
  answers on a hidden board; the AI host matches the *vibe* contextually (not exact words)
  and scores it. Wheel or in-sequence turn order. Spoken host, music, sound effects.
- **Rapid Fire** (`public/rapid.html`, route `/rapid`) — rewritten from the `new-year-party-game`
  repo. An image flashes up; two teams race a countdown to shout what it is. Voice answers are
  judged by Jev (handles synonyms + other languages); host can also tap Got it / Skip.
- **Landing** (`public/index.html`, route `/`) — two game cards, global theme + language pickers.

## Files map

```
server.js              HTTP + API. Routes: / /vibe /rapid ; /api/{status,topics,match,match-one,warm}
lib/config.js          .env loader (trims quotes/space from env vars) + thresholds
lib/topics.js          LOCALES + Vibe Guess boards (en.js, te.js)
lib/localMatch.js      Vibe stage-1 local matching
lib/jev.js             Jev (TypeSafe System One) request builder + client
lib/matcher.js         matchGuess() for Vibe (board) ; matchOne() for Rapid Fire (one answer)
public/index.html      Landing
public/vibe.html       Vibe Guess (single self-contained page)
public/rapid.html      Rapid Fire (single self-contained page)
public/theme.css       Shared design tokens, 4 themes via html[data-theme]
public/theme.js        window.Shell: theme + global language, persisted; builds the <select>s
public/rapid/items.js  Generated manifest: window.RAPID_CATEGORIES / RAPID_ITEMS
public/rapid/items/<category>/*.png   Rapid Fire images (answer = cleaned filename)
.agents/               These notes
```

## Topic docs

- [architecture.md](architecture.md) — how the pieces fit, the two matchers, themes, i18n.
- [build-guidelines.md](build-guidelines.md) — conventions, how to change things safely.
- [browser-testing.md](browser-testing.md) — how to actually verify (and the speech gotchas).
- [sound-validation.md](sound-validation.md) — Web Audio + speech synthesis rules.

## Most important gotchas (read before touching audio/voice)

1. **No dependencies, no build step.** `npm start` runs `node server.js`. Keep it that way.
2. **Jev needs 3 env vars on a host, not 1.** `TYPESAFE_API_KEY` *and* `TYPESAFE_URL` *and*
   `JEV_MODEL`. The key here is an OpenRouter key → `TYPESAFE_URL=https://openrouter.ai/api/v1/systemone`,
   `JEV_MODEL=jev-1.13`. `/api/status` returning `jev:true` only means a key exists, not that it works.
3. **Never speak a `volume=0` / empty "primer" utterance.** It hangs the speech engine on desktop
   Chrome and mobile, blocking all later host lines. Speech unlocks naturally when the first
   `say()` runs inside a user-gesture call stack (e.g. the Start tap). See sound-validation.md.
4. **The static server sends raw Buffers** (`server.js`) so PNG/MP3 aren't corrupted. Don't
   re-introduce `.toString()` on file reads.
5. **`speaking:true` is NOT proof of audio.** Automation can't produce a real user gesture, so
   speech never actually renders in headless/synthetic-event tests. Audio must be ear-verified.
