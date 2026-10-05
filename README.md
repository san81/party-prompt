# Party Guess — web prototype with Jev matching

A voice-hosted party guessing game you can play in a browser, in English or Telugu. Players take turns holding a button and shouting answers; a two-stage matcher scores them and the host announces results out loud.

This is the web version of Phase 1. Its job is to answer one question with real players: **does Jev's matching feel magical or frustrating?**

## Run it

Requires Node 18 or newer. No `npm install` needed; there are no dependencies.

```bash
cp .env.example .env        # then paste your key into TYPESAFE_API_KEY
npm start                   # http://localhost:3000
```

Open **http://localhost:3000** in Chrome, Edge or Safari. On the setup screen, "Pick the next player by" chooses how turns are handed out: spinning a wheel or going through the roster in sequence. Allow the microphone when asked. Firefox has no speech recognition, so use the "type a guess" box there.

Without a key the game still runs with local matching only; the badge in the top bar shows which mode you're in.

**Getting a Jev key.** Direct TypeSafe access is waitlisted. OpenRouter has no waitlist and accepts this app's requests unchanged: create a key at openrouter.ai/settings/keys, then use Option A in `.env.example` (`TYPESAFE_URL=https://openrouter.ai/api/v1/systemone`, `JEV_MODEL=jev-1.13`).

### Playing on a phone

Browsers only allow the microphone on `https://` or `localhost`, so opening `http://<your-laptop-ip>:3000` on a phone won't get voice. Put an HTTPS tunnel in front of the server, for example:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Then open the printed `https://…trycloudflare.com` address on the phone. Anyone with that address can play (and spend your Jev credits), so close the tunnel when you're done.

## Picking who's next

One player plays at a time. "Pick the next player by" on the setup screen chooses how:

- **Spinning a wheel** — a prize wheel of the names picks at random.
- **Going in sequence** — a simple "next up" card walks through the roster in order; tap **Start now** when the player is ready, and it advances to the next name after each turn.

### The wheel

- **The wheel** is split evenly between the names on it. Spin with the button, by tapping the wheel, or with the space bar. It clicks past each peg, whooshes while fast, and plays a fanfare with confetti when it stops.
- **The side panel** adds names (paste a comma- or line-separated list to add a whole class) and removes them with ×. Names are kept on the device between sessions.
- **The chosen player** is shown big, and the host calls their name. A five-second countdown then starts the turn in the chosen language. Use **Start now** to skip ahead or **Spin again** to re-pick.
- **During a turn** a light music loop plays. Sounds mark the start, halfway (with a chime and "halfway" call), and each of the last ten seconds, where the music speeds up and the final three beeps get higher. Turns end with a buzzer, or a cheer and confetti if the board is cleared. Correct, repeated, missed and "did you mean" guesses each have their own sound.
- **Music drops to silence while the button is held**, so the microphone hears the player, not the speaker, and it dips while the host talks.
- **Back to the wheel** adds the turn's points to the leaderboard. Turn on **Everyone plays once before anyone repeats** to take names off the wheel after their turn; a new round starts when everyone has played.
- **Music, Sounds and Host voice** can each be switched off in the top bar.

Topics are picked at random from the chosen language without repeats until every topic has been used, and each board's squares are shuffled so the easy answers aren't always first.

## Question bank

31 boards and 392 answers: 19 Telugu, 12 English. They're written to be fun and relatable for Andhra and Telangana students, not to test knowledge.

- **Telugu:** Sankranti, Telugu wedding, kitchen, power cut, homework excuses, when relatives visit, things Amma always says, bus journey, midnight snacks, night before exams, childhood games, rainy day, summer holidays, morning tiffins, Ugadi, Bathukamma, Deepavali, gully cricket, classroom fun.
- **English:** New Year's Eve, kitchen, beach day, late for work, homework excuses, power cut, things moms say, gully cricket, midnight snacks, birthday party, monsoon, street food.

`npm run lint-topics` checks every board: each answer and alias must match only its own answer, Telugu answers need an English gloss, and boards should have 10 to 15 answers. Run it after editing `lib/topics/en.js` or `lib/topics/te.js`.

## Languages

Pick **English** or **తెలుగు** on the setup screen. The choice switches four things together: the topics, the speech-recognition language (`te-IN`), the host's script and voice, and the words accepted for yes/no ("అవును", "కాదు", plus English).

Telugu topics are written for Telugu players, not translated, and use both Andhra and Telangana words (బొబ్బట్లు and భక్ష్యాలు, గేదెలు and బర్రెలు, బిళ్ళంగోడు and చిర్రగోనె). Telugu singular and plural forms match each other locally (టపాసు and టపాసులు).

How matching copes with Telugu:

- **Local matching works on any script.** It splits on spaces instead of relying on English word boundaries, compares Telugu vowel signs as single edits, and splits guesses on మరియు / ఇంకా / లేదా as well as "and".
- **Aliases cover how people actually talk:** Telugu script, English words ("kites", "mixie"), romanized Telugu ("galipatalu") and common spelling variants (పెళ్లి / పెళ్ళి).
- **Jev gets English instructions plus an English gloss for each answer**, and a note that guesses may mix Telugu, English and romanized Telugu. A Telugu request is about twice the size of an English one, still around a hundredth of a cent per guess.

Local-only results: Telugu 29 of 35 correct, English 21 of 43, zero false positives in both. Run one language with `npm run eval -- te-IN`.

What needs a real device to confirm:

- **Speech recognition:** Chrome on Android and desktop supports Telugu. Safari's support varies by iOS version.
- **Host voice:** Android usually has a Google Telugu voice. Many desktops and iPhones don't; the host then shows captions only and says so, rather than reading Telugu with an English voice.
- **Jev's Telugu accuracy** is unpublished. `npm run probe` measures it (see Validate end to end).

Adding a language means one entry in `LOCALES` and some topics in `lib/topics.js`, a strings block in `public/index.html`, and eval cases.

## Validate end to end

Cheapest and most decisive first. Steps 1 to 3 need only a laptop and a key; the whole run costs well under a cent.

1. **Connect.** Fill in `.env`, then `npm run probe`. Its first line confirms the key, URL and model, or says which one is wrong.
2. **Does Jev understand Telugu?** The probe asks Jev 24 everyday questions ("what kind of thing is వంకాయ?", "can you eat it?") in English, Telugu script, romanized Telugu, and Telugu with Telugu option text, then prints accuracy for each and a verdict. TypeSafe hasn't published language support, so this table is the answer.
3. **Jev on the real game.** `FORCE_JEV=1 npm run eval -- te-IN` makes Jev decide every case alone, which measures Jev itself; repeat with `-- en-US` to compare. Then `npm run eval` measures the real two-stage system. Check false positives first, then misses, then p90 latency.
4. **Full stack in a browser.** `npm start`, play a round in each language with typed guesses, and open **Match log**. Rows with source `jev` and a Jev time prove the browser → server → Jev path.
5. **On phones with real voices.** Tunnel to an Android phone in Chrome (best Telugu speech and voice support) and an iPhone in Safari. Play three or four rounds with real people, copy the match log, and add surprising guesses to `eval/cases.json`. Rerun step 3.
6. **Native-speaker review** of the Telugu topics and host lines.

Suggested pass bar: Telugu probe within 5 points of English; no false positives in the game eval; Jev p90 under 800 ms; the phone recognises Telugu speech. If Telugu falls short, the probe says whether romanized input does better. If it does, transliterating guesses before sending is a small change. The open-weight Laya model is the fallback: it claims 100+ languages, though Telugu isn't named.

## Measure it

```bash
npm run eval                      # 78 labelled guesses (43 English, 35 Telugu)
npm run eval -- te-IN             # one language
FORCE_JEV=1 npm run eval          # Jev decides every case (skips local matching)
npm run probe                     # Telugu vs English language probe
MULTI_MATCH=false npm run eval    # Choice only, no per-answer questions
ACCEPT_THRESHOLD=0.85 npm run eval
```

Prints PASS / SOFT / ASKED / MISS / FALSE+ per case, then local-hit rate, Jev p50/p90 latency and token cost. Results are saved to `eval/results-*.json`. Add your own cases to `eval/cases.json`, especially real transcripts copied from the in-game match log.

Local-only baseline (no key): 21 of 43 correct, 0 false positives. Every miss is a paraphrase, brand, regional word or mis-transcription, which is exactly what Jev is for.

In the game, **Match log** (top bar) shows every guess with its source, round-trip time, Jev time and Jev's top probabilities. **Copy as JSON** exports it. The server also appends every match to `logs/matches.jsonl`.

## How matching works

```
spoken guess ──► split on "and", commas ──► local match each part
                                               │ all parts matched? ──► done (0 ms, free)
                                               ▼
                                        one Jev request
                                        ├─ Choice: which board answer? (+ none_of_these)
                                        └─ Noul per answer: does the guess mention it?
                                               ▼
                         any Noul ≥ 0.75 or Choice ≥ 0.75  ──► score it
                         else Choice between 0.45 and 0.75 ──► host asks "Did you mean …?"
                         else                              ──► not on the board
```

Design decisions worth knowing:

- **Already-matched answers stay in the question.** If "champagne" is taken and someone says "bubbly", Jev can say "that's Champagne" and the game reports a repeat. Removing matched answers would push Jev toward the nearest remaining answer instead.
- **`none_of_these` is an explicit option** with examples of vague guesses ("party", "stuff"), so the model has a correct place to put junk.
- **State is only the topic and the guess.** Research on Jev shows natural-sounding extra context can flip decisions, so no transcript history goes in.
- **One Noul per answer** lets "champagne and fireworks" score twice. It costs roughly 1,100 input tokens per guess (about $0.00005). Set `MULTI_MATCH=false` to compare against Choice alone.
- **Local matching refuses to guess on ambiguity.** "Ball" could be Ball drop or Disco ball, so it goes to Jev rather than picking the first.
- **The connection is warmed** at the start of each turn. A cold HTTPS connection adds about a second to the first guess.
- **Jev errors fall back** to the local result and are flagged in the log; the game never stalls on the network.

## Game flow

Setup (up to 4 players, 45/60/90-second turns) → each player gets a random topic → the host reads the topic aloud, then the clock starts (hold the button to start early) → guesses resolve in parallel and appear in the feed → at 10 seconds the host warns → at zero the board is revealed and the host reads the score and two missed answers → next player → final standings.

Rules encoded in the client:

- **Hard buzzer.** Guesses that resolve after time is up don't score, even if correct.
- **The host doesn't talk over you.** Reactions are skipped while the button is held; the caption still updates. "Did you mean…?" and turn announcements interrupt.
- **Yes/no by voice.** When the host asks for confirmation, saying "yes", "yeah", "nope" and so on answers it; the prompt expires after 7 seconds.
- **Clearing the board ends the turn early.**

## Files

```
server.js            HTTP server: page, /api/topics, /api/match, /api/warm, /api/status
lib/config.js        .env loader and thresholds
lib/topics.js        languages; boards are in lib/topics/en.js (12) and lib/topics/te.js (19)
lib/localMatch.js    stage 1: normalize, fillers, plurals, aliases, typo distance
lib/jev.js           stage 2: request builder and client with one retry on 429/529
lib/matcher.js       combines both stages and applies thresholds
public/index.html    the whole game, with synthesised music and sound effects; wheel or in-sequence turn order
eval/cases.json      labelled test guesses
eval/run.js          scorecard
eval/probe-language.js  Telugu vs English probe of Jev alone
eval/lint-topics.js  checks the question bank for alias collisions
```

## Known limits

- Jev is two weeks old, closed-weight and in early access. Treat thresholds as starting points and tune them with `npm run eval` on real transcripts.
- English topics are US-centric (see spec §7). Two eval cases use Australian words on purpose to show the gap.
- The setup screen and match log stay in English in both languages.
- Browser speech recognition quality and behavior vary: Chrome sends audio to Google's servers; Safari may recognize on device.
- The host uses the device's built-in voice. It's clear but robotic; a cloud voice is a later decision.
- No accounts, persistence or history yet.

## Next steps

1. Add a key, run `npm run eval`, and compare `MULTI_MATCH` on and off.
2. Play three or four rounds with friends, copy the match log, and turn surprising guesses into new eval cases.
3. Tune `ACCEPT_THRESHOLD` and `CONFIRM_THRESHOLD` against false positives first; wrongly accepted answers hurt more than missed ones.
4. Port `lib/` unchanged into the Expo app's backend (a Supabase Edge Function) once the numbers look right.
