// Checks every board before players see it: each answer and each of its aliases must
// match only its own answer locally, Telugu answers need an English gloss, and boards
// should hold a pool of 18 to 30 answers with spares in every difficulty. Usage: npm run lint-topics
import { TOPICS, LOCALES, localeOf } from '../lib/topics.js';
import { localMatch, normalize } from '../lib/localMatch.js';
import { SHOW } from '../lib/topics.js';

const problems = [];
const warn = (topic, msg) => problems.push(`${topic.id}: ${msg}`);

for (const topic of TOPICS) {
  const locale = localeOf(topic);
  if (!LOCALES[topic.locale]) warn(topic, `unknown locale ${topic.locale}`);
  // Each board is a pool; a turn shows SHOW of each difficulty, so keep spares to rotate.
  const n = topic.answers.length;
  if (n < 18 || n > 30) warn(topic, `${n} answers in the pool (aim for 18 to 30)`);
  for (const [d, need] of Object.entries(SHOW)) {
    const have = topic.answers.filter(a => a.difficulty === d).length;
    if (have < need + 1) warn(topic, `only ${have} ${d} answers (need at least ${need + 1} so a turn's ${need} can rotate)`);
  }
  const keys = new Set();
  const seen = new Map();
  for (const a of topic.answers) {
    if (keys.has(a.key)) warn(topic, `duplicate answer "${a.key}"`);
    keys.add(a.key);
    if (!['common', 'medium', 'obscure'].includes(a.difficulty)) warn(topic, `"${a.key}" has difficulty "${a.difficulty}"`);
    if (topic.locale !== 'en-US' && !a.gloss) warn(topic, `"${a.key}" has no English gloss`);
    for (const raw of [a.text, ...a.aliases]) {
      const norm = normalize(raw, locale);
      if (!norm) { warn(topic, `"${raw}" on "${a.key}" is empty after cleanup (only filler words)`); continue; }
      if (seen.has(norm) && seen.get(norm) !== a.key) warn(topic, `"${raw}" is listed under both "${seen.get(norm)}" and "${a.key}"`);
      seen.set(norm, a.key);
      const hit = localMatch(raw, topic.answers, locale);
      if (!hit) warn(topic, `saying "${raw}" doesn't match "${a.key}" locally (ambiguous or filtered)`);
      else if (hit.key !== a.key) warn(topic, `saying "${raw}" matches "${hit.key}" instead of "${a.key}"`);
    }
  }
  if (topic.locale !== 'en-US' && !topic.promptGloss) warn(topic, 'no promptGloss');
}

const byLocale = {};
for (const t of TOPICS) {
  byLocale[t.locale] ??= { boards: 0, answers: 0 };
  byLocale[t.locale].boards++;
  byLocale[t.locale].answers += t.answers.length;
}
for (const [loc, c] of Object.entries(byLocale)) console.log(`${LOCALES[loc]?.name ?? loc}: ${c.boards} boards, ${c.answers} answers`);
console.log(problems.length ? `\n${problems.length} problems:\n  ${problems.join('\n  ')}` : '\nNo problems found.');
process.exitCode = problems.length ? 1 : 0;
