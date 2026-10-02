// Runs every case in eval/cases.json through the real matcher and prints a scorecard.
// Usage: npm run eval            (uses Jev if TYPESAFE_API_KEY is set, else local only)
//        npm run eval -- te-IN    (one locale only)
//        MULTI_MATCH=false npm run eval   (Choice only, to compare cost and accuracy)
//        FORCE_JEV=1 npm run eval -- te-IN  (Jev decides every case, to measure Jev itself)
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config, jevConfigured } from '../lib/config.js';
import { topicById } from '../lib/topics.js';

// Optional filter: npm run eval -- te-IN   (or en-US)
const only = process.argv[2];
import { matchGuess } from '../lib/matcher.js';

const cases = JSON.parse(await readFile(join(config.root, 'eval', 'cases.json'), 'utf8'))
  .filter((c) => !only || topicById(c.topic).locale === only);
const results = [];

console.log(jevConfigured()
  ? `Matcher: ${config.forceJev ? 'JEV ONLY (local matching skipped)' : 'local + Jev'} (${config.jevModel} via ${new URL(config.jevUrl).host}), accept ≥ ${config.accept}, ask ≥ ${config.confirm}, multiMatch=${config.multiMatch}`
  : 'Matcher: LOCAL ONLY (no TYPESAFE_API_KEY). Expect paraphrases to fail.');
console.log('');

for (const c of cases) {
  const topic = topicById(c.topic);
  const r = await matchGuess(topic, c.guess);
  const expect = new Set(c.expect);
  const allowed = new Set([...c.expect, ...(c.soft || [])]);
  const hits = new Set(r.hits);
  const same = hits.size === expect.size && [...hits].every((k) => expect.has(k));
  const falsePositive = [...hits].some((k) => !allowed.has(k));
  let verdict;
  if (same) verdict = 'PASS';
  else if (falsePositive) verdict = 'FALSE+';
  else if (r.confirm && allowed.has(r.confirm) && hits.size === 0) verdict = 'ASKED';
  else if (c.soft && [...hits].every((k) => allowed.has(k)) && hits.size > 0) verdict = 'SOFT';
  else verdict = 'MISS';
  results.push({ ...c, verdict, hits: r.hits, confirm: r.confirm, source: r.source, latencyMs: r.latencyMs, jev: r.jev, error: r.error });

  const got = r.hits.length ? r.hits.join(' + ') : r.confirm ? `ask: ${r.confirm}` : '—';
  const p = r.jev ? ` p=${r.jev.pickProbability}` : '';
  console.log(`${verdict.padEnd(6)} ${String(r.latencyMs).padStart(5)}ms ${r.source.padEnd(9)} "${c.guess}" → ${got}${p}${r.error ? `  ⚠ ${r.error}` : ''}`);
}

const count = (v) => results.filter((r) => r.verdict === v).length;
const jevMs = results.filter((r) => r.jev).map((r) => r.jev.ms).sort((a, b) => a - b);
const pct = (q) => (jevMs.length ? jevMs[Math.min(jevMs.length - 1, Math.floor(jevMs.length * q))] : '–');
const tokens = results.reduce((s, r) => s + (r.jev?.usage?.input_tokens || 0), 0);
const local = results.filter((r) => r.source === 'local' && r.hits.length).length;

console.log(`
Cases ${results.length} · pass ${count('PASS')} · soft ${count('SOFT')} · asked ${count('ASKED')} · miss ${count('MISS')} · false positives ${count('FALSE+')}
Answered locally: ${local}/${results.length} (${Math.round((local / results.length) * 100)}%)
Jev latency p50 ${pct(0.5)} ms · p90 ${pct(0.9)} ms · input tokens ${tokens} (~$${((tokens * 0.042) / 1e6).toFixed(5)})`);

const out = join(config.root, 'eval', `results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
await writeFile(out, JSON.stringify(results, null, 2));
console.log(`Saved ${out}`);
