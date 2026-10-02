// Does Jev understand Telugu? Asks Jev the same 24 everyday decisions in four forms
// and compares them with English. No game aliases, no local matching: Jev alone.
//
//   en        English item, English options                (the baseline)
//   te        Telugu script item, English options          (how the game sends it)
//   te-roman  romanized Telugu item, English options       (what speech-to-text sometimes returns)
//   te-te     Telugu script item, Telugu option descriptions
//
// Each request asks a Choice (which category?) and a Noul (can you eat it?).
// Usage: npm run probe            ~96 requests, roughly a tenth of a cent
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config, jevConfigured } from '../lib/config.js';
import { askJev } from '../lib/jev.js';

const CATEGORIES = {
  fruit: { en: 'A fruit', te: 'పండు' },
  vegetable: { en: 'A vegetable', te: 'కూరగాయ' },
  animal: { en: 'An animal', te: 'జంతువు' },
  vehicle: { en: 'A vehicle or way to travel', te: 'వాహనం' },
  clothing: { en: 'Clothing someone wears', te: 'బట్టలు, దుస్తులు' },
  place: { en: 'A place or building', te: 'ప్రదేశం' },
};
const EDIBLE = new Set(['fruit', 'vegetable']);

// [category, English, Telugu script, romanized Telugu]
const ITEMS = [
  ['fruit', 'mango', 'మామిడి పండు', 'mamidi pandu'],
  ['fruit', 'banana', 'అరటి పండు', 'arati pandu'],
  ['fruit', 'guava', 'జామ పండు', 'jama pandu'],
  ['fruit', 'jackfruit', 'పనస పండు', 'panasa pandu'],
  ['vegetable', 'brinjal', 'వంకాయ', 'vankaya'],
  ['vegetable', 'okra', 'బెండకాయ', 'bendakaya'],
  ['vegetable', 'bitter gourd', 'కాకరకాయ', 'kakarakaya'],
  ['vegetable', 'drumstick', 'మునక్కాయ', 'munakkaya'],
  ['animal', 'buffalo', 'గేదె', 'gede'],
  ['animal', 'monkey', 'కోతి', 'kothi'],
  ['animal', 'snake', 'పాము', 'pamu'],
  ['animal', 'elephant', 'ఏనుగు', 'enugu'],
  ['vehicle', 'bullock cart', 'ఎడ్ల బండి', 'edla bandi'],
  ['vehicle', 'boat', 'పడవ', 'padava'],
  ['vehicle', 'aeroplane', 'విమానం', 'vimanam'],
  ['vehicle', 'train', 'రైలు బండి', 'railu bandi'],
  ['clothing', 'saree', 'చీర', 'cheera'],
  ['clothing', 'dhoti', 'పంచె', 'panche'],
  ['clothing', 'shirt', 'చొక్కా', 'chokka'],
  ['clothing', 'blouse', 'రవిక', 'ravika'],
  ['place', 'temple', 'గుడి', 'gudi'],
  ['place', 'village market', 'సంత', 'santa'],
  ['place', 'school', 'బడి', 'badi'],
  ['place', 'well', 'బావి', 'baavi'],
];

const VARIANTS = {
  en: { text: (i) => i[1], lang: 'en' },
  te: { text: (i) => i[2], lang: 'en' },
  'te-roman': { text: (i) => i[3], lang: 'en' },
  'te-te': { text: (i) => i[2], lang: 'te' },
};

function questions(lang) {
  return {
    category: {
      type: 'choice',
      instructions: 'What kind of thing is `item`?',
      criteria: Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, v[lang]])),
    },
    edible: { type: 'noul', instructions: 'Is `item` something people eat as food?' },
  };
}

if (!jevConfigured()) {
  console.error('Set TYPESAFE_API_KEY in .env first (a TypeSafe key, or an OpenRouter key with TYPESAFE_URL pointed at OpenRouter).');
  process.exit(1);
}

// One call first, so a bad key or URL fails with a clear message instead of 96 times.
try {
  const r = await askJev({ item: 'mango' }, questions('en'));
  console.log(`Connected: ${config.jevUrl} · model ${r.model} · ${r.ms} ms\n`);
} catch (e) {
  console.error(`Could not reach Jev at ${config.jevUrl}\n${e.message}`);
  console.error(e.status === 401 ? 'The key was rejected. Check TYPESAFE_API_KEY.' : e.status === 404 ? 'Wrong URL or model id. Check TYPESAFE_URL and JEV_MODEL.' : '');
  process.exit(1);
}

const rows = [];
const jobs = [];
for (const [variant, v] of Object.entries(VARIANTS)) {
  for (const item of ITEMS) jobs.push({ variant, v, item });
}
// Small concurrency keeps the run under a minute without nearing rate limits.
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { variant, v, item } = jobs[next++];
    const [cat, en] = item;
    const text = v.text(item);
    try {
      const r = await askJev({ item: text }, questions(v.lang));
      const c = r.answers.category;
      const pCorrect = c.probabilities[cat] ?? 0;
      const edibleOk = (r.answers.edible.noul >= 0.5) === EDIBLE.has(cat);
      rows.push({ variant, en, text, expect: cat, got: c.choice, pCorrect, confidence: c.confidence, noul: r.answers.edible.noul, edibleOk, ms: r.ms, tokens: r.usage?.input_tokens ?? 0 });
    } catch (e) {
      rows.push({ variant, en, text, expect: cat, error: e.message });
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (n, d) => `${Math.round((n / d) * 100)}%`.padStart(4);

console.log('variant    category  mean p(correct)  can-you-eat-it  median ms  tokens/req  errors');
const summary = {};
for (const variant of Object.keys(VARIANTS)) {
  const all = rows.filter((r) => r.variant === variant);
  const ok = all.filter((r) => !r.error);
  const s = {
    category: ok.filter((r) => r.got === r.expect).length / ITEMS.length,
    pCorrect: mean(ok.map((r) => r.pCorrect)),
    edible: ok.filter((r) => r.edibleOk).length / ITEMS.length,
    ms: median(ok.map((r) => r.ms)),
    tokens: Math.round(mean(ok.map((r) => r.tokens))),
    errors: all.length - ok.length,
  };
  summary[variant] = s;
  console.log(`${variant.padEnd(10)} ${pct(s.category * 24, 24)}      ${s.pCorrect.toFixed(2)}             ${pct(s.edible * 24, 24)}            ${String(s.ms).padStart(5)}      ${String(s.tokens).padStart(5)}     ${s.errors}`);
}

const wrong = rows.filter((r) => !r.error && (r.got !== r.expect || !r.edibleOk) && r.variant !== 'en');
if (wrong.length) {
  console.log('\nTelugu items Jev got wrong:');
  for (const r of wrong) console.log(`  ${r.variant.padEnd(9)} ${r.text} (${r.en}) → ${r.got} p=${r.pCorrect.toFixed(2)}${r.edibleOk ? '' : `, edible=${r.noul.toFixed(2)}`}`);
}

const en = summary.en.category, te = summary.te.category;
const gap = Math.round((en - te) * 100);
console.log('\nVerdict:', te >= 0.9 && gap <= 5
  ? `Jev handles Telugu script about as well as English (${Math.round(te * 100)}% vs ${Math.round(en * 100)}%). Go ahead with Telugu matching.`
  : te >= 0.75
    ? `Jev partly understands Telugu (${Math.round(te * 100)}% vs ${Math.round(en * 100)}% in English). Keep the English glosses and lean on local aliases.`
    : `Jev does not reliably understand Telugu (${Math.round(te * 100)}% vs ${Math.round(en * 100)}% in English). Use the romanized or translated path, or try an open multilingual model.`);
if (summary['te-roman'].category > te + 0.1) console.log('Romanized Telugu did noticeably better than Telugu script; consider transliterating guesses before sending.');

const out = join(config.root, 'eval', `probe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
await writeFile(out, JSON.stringify({ url: config.jevUrl, model: config.jevModel, summary, rows }, null, 2));
console.log(`Saved ${out}`);
