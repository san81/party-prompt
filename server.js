// Zero-dependency server: serves the game page and keeps the Jev key off the browser.
import http from 'node:http';
import { readFile, appendFile } from 'node:fs/promises';
import { join, extname, normalize as normPath } from 'node:path';
import { config, jevConfigured } from './lib/config.js';
import { TOPICS, POINTS, LOCALES, topicById } from './lib/topics.js';
import { matchGuess } from './lib/matcher.js';
import { askJev } from './lib/jev.js';

const PUBLIC = join(config.root, 'public');
const LOG = join(config.root, 'logs', 'matches.jsonl');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Error('body too large');
  }
  return raw ? JSON.parse(raw) : {};
}

const routes = {
  'GET /api/status': () => ({ jev: jevConfigured(), model: config.jevModel, accept: config.accept, confirm: config.confirm, multiMatch: config.multiMatch }),

  'GET /api/topics': () => ({
    points: POINTS,
    locales: Object.fromEntries(Object.entries(LOCALES).map(([code, l]) => [code, { name: l.name, speech: l.speech }])),
    topics: TOPICS.map(({ id, locale, style, prompt, answers }) => ({ id, locale, style, prompt, answers: answers.map(({ key, text, difficulty }) => ({ key, text, difficulty })) })),
  }),

  'POST /api/match': async (req) => {
    const { topicId, guess, player } = await readJson(req);
    const topic = topicById(topicId);
    if (!topic) return [400, { error: `Unknown topic "${topicId}"` }];
    if (typeof guess !== 'string' || !guess.trim()) return [400, { error: 'Send a non-empty guess.' }];
    const result = await matchGuess(topic, guess.slice(0, 300));
    appendFile(LOG, JSON.stringify({ at: new Date().toISOString(), topicId, player, ...result }) + '\n').catch(() => {});
    return result;
  },

  // Opens the HTTPS connection before a turn starts; a cold connection adds ~1s to the first guess.
  'POST /api/warm': async () => {
    if (!jevConfigured()) return { warmed: false };
    try {
      const r = await askJev('warm up', { ok: { type: 'noul', instructions: 'Is this a greeting?' } });
      return { warmed: true, ms: r.ms };
    } catch (e) {
      return { warmed: false, error: e.message };
    }
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const handler = routes[`${req.method} ${url.pathname}`];
  try {
    if (handler) {
      const out = await handler(req);
      return Array.isArray(out) ? send(res, out[0], out[1]) : send(res, 200, out);
    }
    if (req.method !== 'GET') return send(res, 404, { error: 'Not found' });
    const rel = url.pathname === '/' ? 'index.html' : url.pathname === '/wheel' ? 'wheel.html' : normPath(url.pathname).replace(/^([/\\])+/, '');
    if (rel.includes('..')) return send(res, 400, { error: 'Bad path' });
    const file = await readFile(join(PUBLIC, rel));
    send(res, 200, file.toString(), TYPES[extname(rel)] || 'text/plain');
  } catch (e) {
    if (e.code === 'ENOENT') return send(res, 404, { error: 'Not found' });
    console.error(e);
    send(res, 500, { error: e.message });
  }
});

server.listen(config.port, () => {
  console.log(`Party Guess running at http://localhost:${config.port}  (spin-the-wheel mode: http://localhost:${config.port}/wheel)`);
  console.log(jevConfigured() ? `Jev matching on (${config.jevModel})` : 'No TYPESAFE_API_KEY found: local matching only');
});
