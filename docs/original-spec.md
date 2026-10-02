> Original brainstorming spec from May 2026, kept for history. Where it differs from CLAUDE.md or README.md (Claude Haiku matching, visual-only host), those files are current.

# Voice Party Game — Brainstorming & Design Spec

*Captured from brainstorming session, May 27, 2026. Living doc — update as decisions evolve.*

This document captures the original idea, refined scope, architectural decisions, Phase 1 prototype design (including the async coordination logic embedded in `GameScreen.tsx`), and open questions. It is the handoff document for continuing work in Claude Code.

---

## 1. Original Idea (as proposed)

### Core Concept
- AI agent acts as an on-device, instantaneous voice host.
- Private, offline-capable experience utilizing an on-device voice assistant.
- Gameplay relies on voice input to guess hidden answers associated with specific topics or categories.

### Gameplay & Scoring
- Example topic: New Year's celebration brainstorming.
- Tiered scoring system: varies by difficulty.
- Matching mechanism: semantic matching, recognizing synonyms and related concepts rather than exact text.

### Technical & Interface
- User input: push-to-talk button defaulting to mute.
- Feedback: real-time transcription and contextual matching displayed on the screen.
- Cross-platform support: iOS and Android apps.
- Features: screen casting support, external microphone compatibility, history and progress tracking for revision, sharing of custom topics.

---

## 2. Refined Scope (after clarifying questions)

Three decisions locked in early:

1. **Voice approach:** Hybrid — on-device STT + cloud LLM matching.
2. **Player model:** Party game (one phone, multiple people taking turns).
3. **Build resources:** Solo, nights/weekends.

These three answers reshape everything downstream.

---

## 3. Red Flags & Open Concerns

### From initial spec
1. **"Offline-capable" + "semantic matching" is the central tension.** Real semantic matching needs an LLM or embeddings. True offline matching is a downgrade. Decision: spec should be reframed as *"works on flaky networks, instant transcription, smart cloud matching"* — honest and still compelling.
2. **STT latency vs. "instantaneous host."** On-device Whisper is 1–2s; native iOS Speech / Android SpeechRecognizer is faster but inconsistent across devices.
3. **Push-to-talk-defaulting-to-mute conflicts with party-game energy.** People shout, pass the phone, talk over each other. Need to test PTT vs. open-mic-with-timer.
4. **Content cold-start.** One topic isn't enough; need 50–100 quality topics at launch.
5. **Screen casting + external mic on both platforms** is multi-month native work. Defer to v2.
6. **Tiered scoring underspecified.** Per-topic? Per-answer? Hint-level? Coupled to matching confidence — must be nailed down before scoring code.

### From refined scope (party + hybrid + solo)
7. **Cloud LLM latency floor (400–800ms)** kills momentum in a party game. Mitigation: local fast-path first, LLM only on miss.
8. **Cloud cost at scale.** Each guess = potential API call. Use freemium gating (RevenueCat) to cap costs: free tier = local fuzzy match only, paid tier = full LLM matching.
9. **Solo nights/weekends + cross-platform + casting + external mic = too much for v1.** Cut casting and external mic from v1 entirely.
10. **Content is the real bottleneck, not code.** Build a topic-generation pipeline as a parallel workstream.
11. **"AI agent acts as voice host"** implies TTS host voice. Decision: v1 is **visual-only**. Add TTS in v2 if playtest demand exists.

---

## 4. Phased Action Plan (~3–4 months to TestFlight/Play beta)

### Phase 1 — Validate the core loop (3–4 weekends)
- Single-screen Expo app, iOS only.
- One hardcoded topic with ~15 answers.
- Push-to-talk via `expo-speech-recognition`.
- Two-stage matcher: local normalize+fuzzy → Haiku fallback.
- Flat scoring, no persistence.
- **Goal:** Answer one question — *does the matching feel magical or frustrating?*

### Phase 2 — Gameplay shape (4–6 weekends)
- Tiered scoring (difficulty as per-answer property: common=1pt, medium=2pt, obscure=3pt).
- 60s turn timer, multi-round, end-of-round reveal.
- 20 curated topics.
- Local SQLite for history (reuse DistroLearn patterns).
- Still iOS only.
- Introduce locale dimension to the data model (see §7).
- Extract `useGameSession` as explicit state machine (see §12).

### Phase 3 — Android + beta (3–4 weekends)
- Bring up Android via Expo. Budget extra time for SpeechRecognizer quirks across OEMs.
- TestFlight + Play internal testing with 20–30 real users.

### v2 Deferred List (write down, don't get tempted)
- Screen casting.
- External mic support.
- Custom topic sharing + UGC moderation.
- Party-mode open-mic.
- Leaderboards / online multiplayer.
- TTS host voice.
- Full multi-locale content library.

### Parallel Workstream: Content Pipeline
- Python script that prompts Claude/GPT for `{topic, description, answers_with_difficulty_tags}` JSON.
- 10 minutes per topic to curate.
- Goal: 30–50 topics by end of Phase 2.
- **Make it locale-aware from day one** (generate `en-US`, `en-GB`, `es-ES`, `ja-JP` variants in parallel, with culture-specific prompting).

---

## 5. Locked Architectural Decisions

- **Framework:** React Native / Expo (reuse DistroLearn knowledge, free cross-platform).
- **STT:** `expo-speech-recognition` (wraps native iOS Speech + Android SpeechRecognizer, falls back gracefully).
- **Matching LLM:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) via thin Supabase Edge Function (never ship API key in app beyond Phase 1 local testing).
- **Local state:** SQLite for game history.
- **Cloud state:** Supabase Postgres for accounts + custom topic sync (Phase 2+).
- **State management:** `useReducer` for Phase 1, Redux Toolkit from Phase 2 (consistent with DistroLearn).
- **Monetization:** RevenueCat freemium — free tier = 5 topics + local fuzzy match only; paid = full library + cloud LLM matching. Doubles as API cost cap.

---

## 6. Phase 1 Prototype — Detailed Design

### 6.1 Scope (deliberately minimal)
- iOS only, runs via Expo Go on personal device or TestFlight build for friends.
- One topic: *"Things you'd find at a New Year's Eve party"*.
- ~15 answers with difficulty tags.
- Push-to-talk, 60s timer, score display, end-of-round reveal.
- Two-stage matcher.
- No persistence, no accounts, restart = fresh game.

### 6.2 File Structure
```
party-guess-proto/
├── App.tsx
├── .env                         # ANTHROPIC_API_KEY (gitignored, local only)
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   └── GameScreen.tsx       # integration point — see §6.7
│   ├── game/
│   │   ├── topics.ts            # hardcoded topic + answers
│   │   └── gameState.ts         # useReducer hook with pending/resolve actions
│   ├── matching/
│   │   ├── normalize.ts
│   │   ├── localMatch.ts        # fuzzy match stage 1
│   │   ├── llmMatch.ts          # Haiku call stage 2
│   │   └── matcher.ts           # orchestrator
│   ├── voice/
│   │   └── useSpeechRecognition.ts
│   └── components/
│       ├── PTTButton.tsx
│       ├── TranscriptView.tsx
│       ├── AnswerGrid.tsx
│       └── Timer.tsx
```

### 6.3 Topic Schema (Phase 1)
```typescript
export type Difficulty = 'common' | 'medium' | 'obscure';

export type Answer = {
  canonical: string;
  aliases: string[];      // hand-curated synonyms for fast local match
  difficulty: Difficulty;
};

export type Topic = {
  id: string;
  prompt: string;
  description: string;
  answers: Answer[];
};
```

### 6.4 Sample Topic Data
Hardcoded NYE topic with ~15 answers spanning common (champagne, fireworks, countdown, confetti), medium (midnight kiss, ball drop, noisemakers, resolutions, party hats), and obscure (Auld Lang Syne, sparklers, disco ball, twelve grapes, first foot, black-eyed peas). **Note:** this answer set is implicitly US-English / Western; see §7 for localization plan.

### 6.5 Stage 1 — Local Fuzzy Match
- `normalize()`: lowercase, strip punctuation, collapse whitespace, remove stopwords (a/an/the/some/of).
- `localMatch()`: for each candidate (canonical + aliases), check exact match, substring containment (for guesses ≥4 chars), and bounded Levenshtein (max distance = 20% of candidate length, ≥1). Levenshtein has early termination when min row exceeds maxDist.
- Returns `{ kind: 'hit', answer, confidence }` or `{ kind: 'miss' }`.
- Catches 60–75% of valid guesses with zero latency.

### 6.6 Stage 2 — Claude Haiku Fallback
- Prompt includes: topic, player's guess, list of **still-available** answers only (matched answers excluded).
- Hedge in prompt: *"Be generous with synonyms and related concepts, but reject vague or off-topic."*
- JSON-only response: `{"match": bool, "answer": "<canonical>", "reason": "<10 words>"}`.
- Wrap in try/catch — one stray token breaks JSON parsing.
- Tunable knob: the "be generous but reject vague" hedge is the highest-leverage prompt instruction. Tune based on playtest data on false positives vs. false negatives.

### 6.7 GameScreen — Async Coordination (The Real Design Work)

The matcher and reducer are pure logic. GameScreen is where every async edge case surfaces. Five decisions are deliberately encoded:

**Decision 1: Parallel LLM calls with sequence numbers, not queued.**
When a player rattles off three guesses in 2 seconds, queuing would mean the third guess waits 2.4s for its result. Each new `finalGuess` from the hook gets a monotonic `seq`, is dispatched as `'pending'` immediately, and fires its own `processGuess` without awaiting. Out-of-order resolutions are handled by the reducer matching on `seq`.

**Decision 2: Hard buzzer at t=60s.**
Inside `processGuess`, after `await match(...)`, check `stateRef.current.status !== 'playing'`. If the round ended while waiting, resolve as `'missed'` regardless of match outcome. Players never get points for late guesses. The PTT button also disables when status flips to `'finished'`.

**Decision 3: Pending guesses are first-class state.**
Each guess enters the feed as `{ status: 'pending', guess, seq }` immediately on dispatch, then transitions to `'matched' | 'missed' | 'duplicate'` when its async result arrives. UI shows pending count ("thinking (2)") in the status row. No silent gap between speech and result.

**Decision 4: Recognizer is source of truth for listening state.**
The PTT button visually reflects `speech.isListening` (from the hook's `'end'` and `'error'` events), not its own pressed state. If iOS auto-ends the recognizer due to silence or timeout, the button releases visually. The button's own pressed state only drives press-feedback styling.

**Decision 5: Dedup-on-resolve, not on dispatch.**
Two parallel guesses can race for the same answer ("champagne" + "bubbly" in quick succession). Both fire LLM calls; whichever resolves first scores, the second becomes `'duplicate'`. Checking `matchedIds` only at dispatch time would race-condition the result. The reducer's `'resolve'` action checks `matchedIds` at resolution time.

**Implementation patterns used:**
- `stateRef.current` pattern: async handlers read latest state without re-binding on every render.
- `processedCountRef`: tracks how many `finalGuesses` we've already processed, since the hook accumulates them across the session.
- Snapshot `matchedIds` at call time, re-check at resolve time — both views of state are needed.
- Defensive fallback: if matcher returns an `answerId` not in the topic's answer list, treat as miss. Cheap insurance.

**Game state reducer actions:**
- `start` → status: playing, timeLeft: 60
- `tick` → decrement timeLeft, transition to finished at 0
- `pending` → add `{ seq, status: 'pending', guess }` to feed head
- `resolve` → find feed entry by `seq`, replace with outcome, update score+matchedIds if matched and status is still playing
- `finish` → status: finished, timeLeft: 0
- `reset` → fresh state from topic

### 6.8 Speech Recognition Hook
- Wraps `expo-speech-recognition`.
- `continuous: true` mode — one PTT hold captures multiple guesses with natural pauses.
- `requiresOnDeviceRecognition: true` on iOS for offline STT.
- Listens to `result`, `end`, `error` events; accumulates `finalGuesses` array.
- Exposes `transcript`, `isListening`, `finalGuesses`, `start`, `stop`, `clearGuesses`.

**Phase 2 refactor note:** the append-only `finalGuesses` array + `processedCountRef` pattern is a hack that works but doesn't scale. Phase 2 should restructure the hook to emit guesses via an event callback (`onFinalGuess: (text) => void`) rather than accumulating in state.

### 6.9 Component Inventory
- `PTTButton`: pressable that reflects `isListening` state, disabled when round finished.
- `Timer`: shows seconds left, turns red ≤10s.
- `AnswerGrid`: shows answer slots, lights up on match (color by difficulty), reveals all on round end (missed = dimmed).
- `TranscriptView`: live STT text on top, feed of recent guesses below with status badges (pending/matched/missed/duplicate) and latency tags.

### 6.10 What's Deliberately Out
No haptics, no sound effects, no animations, no avatars, no leaderboard, no settings screen, no error UI, no offline-detection banner, no ResultsScreen (GameScreen auto-returns after 1.5s; AnswerGrid `revealAll` shows missed answers in place). **Every hour spent on polish in Phase 1 is an hour not spent playtesting.**

---

## 7. Localization & Cultural Variance (Major Open Concern)

**This is one of the sharpest issues raised.** Aliases and answer sets vary significantly across cultures, ages, regions, and languages. Treating it as engineering-only is wrong — it's a content problem first.

### Four Layers of Variance

1. **Answer set varies by culture.** "NYE party" has completely different canonical answers in Spain (twelve grapes, cava), Japan (toshikoshi soba, hatsumode, otoshidama), Scotland (first-footing, black bun), American South (black-eyed peas, collard greens). "Twelve grapes" is `obscure` from a US perspective but `common` in Spain.
2. **Aliases vary by locale within one language.** US "soda" vs UK "fizzy drink" vs Indian English "cold drink"; "pop" in US Midwest.
3. **Language itself.** Spanish, Hindi, Mandarin players want native language gameplay. STT model, prompt language, and answer language all need to swap.
4. **Generational/subcultural references.** "Disco ball" reads differently by age. TikTok-era references miss with older players.

### Phased Localization Strategy

**Phase 1:** Explicitly scope to US English, single locale. Acknowledge in playtest notes that signal is "does matching feel magical for US-English players with US-centric topics."

**Phase 2:** Restructure topic data model:
```typescript
type Topic = {
  id: string;
  locales: {
    [locale: string]: {  // 'en-US', 'en-GB', 'es-ES', 'ja-JP', etc.
      prompt: string;
      description: string;
      answers: Answer[];
      culturalNotes?: string;
    }
  };
  ageRange?: 'all' | '18+' | '30+';
  culturalContext?: string[];
};
```
- Locale picker in onboarding (locale + language).
- Topic library filters to user's locale.
- STT language follows locale.
- LLM prompt instructions stay in English; guesses and answers in player's language (Haiku handles multilingual matching well).
- Add to LLM prompt: *"Player's locale: es-ES. Be aware of regional synonyms and culturally-specific phrasings."*

**Phase 3+:** UGC topic creation with moderation. Community fills in the long tail of locales / generations / subcultures you can't curate yourself. This is *the* solution to localization scale — the "share custom topics" feature in the original spec is really the answer to this problem.

**Tags & filters for generational/subcultural variance:** age-coded topics get explicit tags ("90s nostalgia," "Gen Z," "family-friendly"); users filter at the topic-picker level. Don't try to make every topic universal.

### Hard Truth
*No amount of LLM cleverness fixes a fundamentally Americentric answer set.* Spanish players will feel the game wasn't made for them even if Haiku correctly matches their Spanish guesses. **The localization work is content work, not engineering work.** Plan for it as a content-curation workstream with locale-aware topic generation from day one.

### Content Pipeline Implication
When building the topic-generation script (Phase 2), make it locale-aware:
> "Generate a list of 15 answers for the topic 'New Year's Eve party' as it would be celebrated in [locale]. Use culturally authentic items, not translations of American ones. Tag each as common/medium/obscure within that culture."

---

## 8. Phase 1 — What to Measure

Three numbers from each playtest session:

1. **% of valid guesses caught by local match.**
   - Target: 60–75%.
   - Too low → expand aliases.
   - Too high (95%+) → LLM not earning its cost; reduce.
2. **Median LLM round-trip latency.**
   - Target: <800ms end-to-end.
   - Higher → reduce prompt size, consider streaming.
3. **False positives / false negatives.**
   - Track per session.
   - False positives ("they accepted 'fun' as an answer?!") are far more damaging than false negatives.
   - Tune LLM prompt toward stricter matching if false positives appear.

The feed UI already shows source (`local`/`llm`) and `latencyMs` per guess — Phase 1 instrumentation comes for free. Capture screen recordings of playtests to retroactively extract these numbers.

---

## 9. Build Order (Phase 1 weekend-by-weekend)

- **Weekend 1:** Expo skeleton, hardcoded topic, `normalize` + `localMatch` with unit tests. Dumb text-input prototype (type guesses, no voice). Validate matching against 50 sample guesses written by hand. **This is the cheapest playtest possible — it tells you whether aliases catch realistic STT outputs before wiring up the microphone.**
- **Weekend 2:** Add `expo-speech-recognition`, PTT button, live transcript. Play with text-input matching results to confirm STT quality is acceptable on a real iOS device.
- **Weekend 3:** Wire up Haiku fallback. Add timer, scoring, end-of-round reveal. End-to-end loop works.
- **Weekend 4:** Real playtest with 4–6 friends. Gather data on the three metrics in §8. Decide whether to commit to Phase 2.

---

## 10. Setup Steps (Claude Code starting point)

The prototype skeleton lives in `party-guess-proto.zip`. To set up:

1. `npx create-expo-app party-guess --template blank-typescript`
2. `npx expo install expo-speech-recognition`
3. Drop the skeleton files in, replacing `App.tsx`.
4. Create `.env` with `EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...` (gitignore it).
5. Configure iOS Info.plist for microphone + speech recognition usage descriptions (see `expo-speech-recognition` README).
6. `npx expo run:ios` on a real device (simulator's microphone is unreliable).

**Important:** the API key in `.env` is for personal local testing only. Do not ship a build with the key embedded beyond your own device. Phase 2 moves the key behind a Supabase Edge Function.

---

## 11. Open Questions / TODOs

- [ ] Settle on scoring formula details: flat per-difficulty, or with combo/streak bonuses?
- [ ] Define moderation policy for UGC topics (Phase 3+).
- [ ] Decide locale picker UX — auto-detect from device locale vs. explicit choice at onboarding?
- [ ] Validate that `expo-speech-recognition` `requiresOnDeviceRecognition` actually works reliably on iOS 17+ devices being targeted.
- [ ] Test PTT vs. open-mic-with-timer mode early in Phase 1 — which feels better for a party game?
- [ ] Decide brand / app name.
- [ ] Write unit tests for `normalize.ts` and `localMatch.ts` covering 50+ realistic STT outputs (Weekend 1 first task).
- [ ] Decide whether to split "Start round" and PTT into two buttons (current GameScreen has PTT do double-duty on first press — awkward).

---

## 12. Phase 2 Refactor Targets (Notes for Future Self)

Things in Phase 1 that are intentional hacks and should be cleaned up later:

- **Extract `useGameSession` as a proper state machine.** The async transitions in `GameScreen` (pending → matched | missed | duplicate, plus buzzer cutoff) are a state machine in disguise. Phase 2: formalize with XState or `useReducer`+effects.
- **Speech hook event-style API.** Replace append-only `finalGuesses` array + `processedCountRef` with an event callback (`onFinalGuess: (text) => void`).
- **Request manager with cancellation.** The "snapshot matchedIds at call time, re-check at resolve" pattern generalizes to a request manager with abort tokens for flaky-network LLM calls.
- **Split PTT and "Start round" buttons.** Current double-duty is awkward.
- **Move Anthropic API key behind Supabase Edge Function.** Phase 1 ships key in `.env` for local dev only.
- **Add ResultsScreen.** Currently GameScreen auto-returns with revealed AnswerGrid; a dedicated screen with stats and "play again" is Phase 2 polish.

---

*End of document. Update as decisions evolve.*
