// Orchestrates stage 1 (local) and stage 2 (Jev) and turns probabilities into game decisions.
import { config, jevConfigured } from './config.js';
import { localMatch, splitGuess } from './localMatch.js';
import { askJev, buildQuestions, buildState, NONE } from './jev.js';
import { localeOf } from './topics.js';

const ms = (t0) => Math.round(performance.now() - t0);
const top = (entries, n = 3) =>
  entries.sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, p]) => [k, Math.round(p * 1000) / 1000]);

/**
 * Result shape:
 * { guess, hits: [answerKey], confirm: answerKey|null, source: 'local'|'jev'|'local+jev',
 *   latencyMs, jev: {...}|null, error?: string }
 * hits may include answers already on the board; the client decides new vs repeat.
 */
export async function matchGuess(topic, guess) {
  const t0 = performance.now();
  const locale = localeOf(topic);
  const parts = splitGuess(guess, locale);
  const localHits = new Set();
  let unresolved = 0;
  for (const part of parts) {
    const a = localMatch(part, topic.answers, locale);
    if (a) localHits.add(a.key);
    else unresolved++;
  }

  if (config.forceJev) { localHits.clear(); unresolved = Math.max(1, parts.length); }

  const base = { guess, hits: [...localHits], confirm: null, source: 'local', jev: null };
  if (parts.length === 0) return { ...base, latencyMs: ms(t0), note: 'empty' };
  if (unresolved === 0) return { ...base, latencyMs: ms(t0) };
  if (!jevConfigured()) return { ...base, latencyMs: ms(t0), note: 'jev-not-configured' };

  let data;
  try {
    data = await askJev(buildState(topic, guess), buildQuestions(topic));
  } catch (e) {
    return { ...base, latencyMs: ms(t0), error: e.message };
  }

  const pick = data.answers.pick;
  const pPick = pick.probabilities[pick.choice] ?? 0;
  const hits = new Set(localHits);

  const noulScores = [];
  topic.answers.forEach((a, i) => {
    const ans = data.answers[`mention_${i}`];
    if (!ans) return;
    noulScores.push([a.key, ans.noul]);
    if (ans.noul >= config.accept) hits.add(a.key);
  });
  if (pick.choice !== NONE && pPick >= config.accept) hits.add(pick.choice);

  let confirm = null;
  if (hits.size === 0 && pick.choice !== NONE && pPick >= config.confirm) confirm = pick.choice;

  return {
    guess,
    hits: [...hits],
    confirm,
    source: localHits.size ? 'local+jev' : 'jev',
    latencyMs: ms(t0),
    jev: {
      model: data.model,
      ms: data.ms,
      pick: pick.choice,
      pickProbability: Math.round(pPick * 1000) / 1000,
      confidence: pick.confidence,
      topChoices: top(Object.entries(pick.probabilities)),
      topMentions: top(noulScores),
      usage: data.usage,
    },
  };
}

// ── Rapid Fire: match one spoken guess against one expected answer (an image's name) ──
// Stage 1 is a local fuzzy check (fast, English only). Stage 2 asks Jev a single yes/no,
// which also handles synonyms and cross-language guesses (e.g. Telugu word for the item).
const normOne = (s) => s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      m[i][j] = b[i - 1] === a[j - 1] ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
  return m[b.length][a.length];
}
function localSim(guess, expected) {
  let g = normOne(guess), e = normOne(expected);
  if (!g || !e) return 0;
  if (g === e) return 1;
  g = g.replace(/\b(the|a|an)\b/g, '').trim();
  e = e.replace(/\b(the|a|an)\b/g, '').trim();
  if (g === e) return 1;
  const d = lev(g, e), max = Math.max(g.length, e.length);
  return max ? (max - d) / max : 0;
}

export async function matchOne(expected, guess, { category = '' } = {}) {
  const t0 = performance.now();
  const sim = localSim(guess, expected);
  if (sim >= 0.8) return { match: true, source: 'local', score: Math.round(sim * 100) / 100, latencyMs: ms(t0), jev: null };
  if (!jevConfigured()) return { match: false, source: 'local', score: Math.round(sim * 100) / 100, latencyMs: ms(t0), jev: null };
  try {
    const subject = category ? `${expected} (${category})` : expected;
    const questions = {
      match: {
        type: 'noul',
        instructions: {
          expected_answer: subject,
          question: 'A player is shown a picture of `expected_answer` and must name it aloud. Does `player_guess` correctly name or clearly describe it? Accept synonyms, brand names, close spellings, singular or plural forms, and guesses spoken in another language (for example Telugu or Hindi) that mean the same thing.',
        },
      },
    };
    const data = await askJev({ expected_answer: subject, player_guess: guess }, questions);
    const noul = data.answers.match.noul;
    return { match: noul >= config.accept, source: 'jev', score: Math.round(noul * 1000) / 1000, latencyMs: ms(t0), jev: { ms: data.ms, noul, usage: data.usage } };
  } catch (e) {
    return { match: sim >= 0.8, source: 'local', score: Math.round(sim * 100) / 100, latencyMs: ms(t0), error: e.message, jev: null };
  }
}
