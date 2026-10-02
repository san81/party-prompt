// Stage 2: TypeSafe Jev (System One) decision model.
// API: POST {state, model, questions} -> {model, answers, usage}. See docs.typesafe.ai/api
import { config } from './config.js';
import { localeOf } from './topics.js';

export const NONE = 'none_of_these';

export class JevError extends Error {
  constructor(status, body) {
    super(`Jev ${status}: ${String(body).slice(0, 200)}`);
    this.status = status;
  }
}

export async function askJev(state, questions) {
  const body = JSON.stringify({ model: config.jevModel, state, questions });
  for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = performance.now();
    const res = await fetch(config.jevUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.jevKey}`, 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(config.jevTimeoutMs),
    });
    if ((res.status === 429 || res.status === 529) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    if (!res.ok) throw new JevError(res.status, await res.text());
    const data = await res.json();
    return { ...data, ms: Math.round(performance.now() - t0) };
  }
}

// One request: a Choice over the whole board (plus "none"), and optionally one
// yes/no Noul per answer so a single utterance can name several answers.
// Already-matched answers stay on the board so repeats are recognised as repeats
// instead of being pushed onto the nearest remaining answer.
// Instructions stay in English for every locale; answers carry an English gloss
// so the model has two ways to recognise a Telugu (or any non-English) answer.
export function buildQuestions(topic) {
  const hint = localeOf(topic).jevHint;
  const describe = (a) => {
    const head = a.gloss ? `${a.text} (${a.gloss})` : a.text;
    return a.aliases.length ? `${head}. Also said as: ${a.aliases.join(', ')}.` : head;
  };
  const criteria = {};
  for (const a of topic.answers) criteria[a.key] = describe(a);
  criteria[NONE] =
    'The guess names nothing on the board, is off-topic, or is too vague to single out one answer (for example "party" or "stuff").';

  const questions = {
    pick: {
      type: 'choice',
      instructions: `Players are naming items from a hidden answer board for \`game_topic\`. Which board answer does \`player_guess\` name or clearly describe? Accept synonyms, brand names and everyday phrasings. ${hint}`,
      criteria,
    },
  };

  if (config.multiMatch) {
    topic.answers.forEach((a, i) => {
      questions[`mention_${i}`] = {
        type: 'noul',
        instructions: {
          board_answer: describe(a),
          question: `Does \`player_guess\` name or clearly describe \`board_answer\`? ${hint}`,
        },
      };
    });
  }
  return questions;
}

export const buildState = (topic, guess) => ({
  game_topic: topic.promptGloss ? `${topic.prompt} (${topic.promptGloss})` : topic.prompt,
  player_guess: guess,
});
