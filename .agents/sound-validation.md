# Sound & voice validation rules

Two independent audio systems. They fail differently, so validate them separately.

## 1. Web Audio (music, beeps, timer ticks, buzzer, fanfare)

- All sound effects are **synthesised** with the Web Audio API — there are no audio files to
  load. (Vibe has a fuller `Sound` module with a music loop + ducking; Rapid Fire has a compact
  one.) Keep it synthesised; don't add mp3 assets.
- `AudioContext` starts **suspended** and must be `resume()`d inside a user gesture. Both games
  call this on the first `pointerdown` (`unlockAudio`) and in the play/mic handlers. Keep that.
- **iOS hardware mute switch silences ALL Web Audio** (music + beeps), regardless of code, while
  speech synthesis still plays. If a user reports "no music/beeps on iPhone," first ask them to
  flip the ring/silent switch off. This is not a bug to fix in code.
- Respect the Sounds/Music toggles (`S.soundOn`, Vibe's `Sound.prefs`). New effects must check
  the toggle before playing.

### How to validate Web Audio
- You can confirm the context resumes and `music.playing` / scheduler state in automation.
- You **cannot** confirm it's audible headless. For "does it actually sound right," a human
  must listen. State which you did.

## 2. Speech synthesis (the spoken host)

This is the fragile one. Hard-won rules:

- **Never speak a silent/empty primer utterance** (`''` or `' '` with `volume=0`). It never
  fires `onend` on desktop Chrome and mobile, so it **hangs the serial speech queue** and every
  later host line is blocked. We removed it. Don't bring it back as a "mobile unlock."
- **Unlock speech by speaking the first real line inside a user gesture.** In both games the
  turn intro `say(...)` runs synchronously from the Start-tap call stack (no `await` before it),
  which satisfies iOS/Android. Preserve that call ordering — don't put an `await` before the
  first `say()`.
- `say()` calls `speechSynthesis.resume()` right before `speak()` (Chrome sometimes leaves the
  engine paused). On page load we `cancel()+resume()` once to clear a stuck utterance from a
  previous session. Keep both.
- **`speaking:true` is NOT proof of audio.** In automation (no real gesture) speech never
  renders. A poisoned engine (from an old hung utterance) only clears on a **full Chrome quit**,
  not a reload — so if a dev reports "no voice" after our fixes, have them restart the browser.
- **Telugu:** most devices have no Telugu TTS voice → `canSpeak` is false → host shows captions
  only. That's by design. Validate spoken host in **English**.
- An English voice must never read Telugu text (unintelligible) — `pickVoice()` only sets
  `canSpeak` when a matching-language voice exists.

### How to validate the host voice
1. In automation: confirm `canSpeak`, a voice is selected, and `say()` is reached in the flow
   (wrap it to log). That's the ceiling for headless.
2. On a real machine, **listen**: start a turn, hear the intro; score a point, hear the cheer;
   let time run out, hear the buzzer line. Do this per browser you claim to support.
3. If silent but code looks right: check the Host-voice toggle, the OS output device, that a
   same-language voice exists, and (Chrome) that the engine isn't stuck — restart the browser.

## Mic / speech recognition

- Permission is requested **during the untimed intro** (`warmMic` → `getUserMedia`) so the
  prompt doesn't eat turn time; the clock waits until the permission resolves. Preserve this.
- Recognition is restarted on `onend` while the turn is active (browsers stop after silence).
- Can't be validated headless (no real mic). Stub `getUserMedia`/`SR.start` to exercise the
  surrounding flow; ear/voice-test the real thing on a device.
