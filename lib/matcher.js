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
