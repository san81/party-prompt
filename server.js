// Zero-dependency server: serves the game page and keeps the Jev key off the browser.
import http from 'node:http';
import { readFile, appendFile } from 'node:fs/promises';
import { join, extname, normalize as normPath } from 'node:path';
import { config, jevConfigured } from './lib/config.js';
import { TOPICS, POINTS, LOCALES, PACKS, topicById } from './lib/topics.js';
import { matchGuess, matchOne } from './lib/matcher.js';
import { askJev } from './lib/jev.js';
import { handleFeedback, clientAddress, feedbackConfigured } from './lib/feedback.js';
import { analyticsScript, analyticsConfigured } from './lib/analytics.js';

const PUBLIC = join(config.root, 'public');
const LOG = join(config.root, 'logs', 'matches.jsonl');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ico': 'image/x-icon',
};

// SITE_URL / RENDER_EXTERNAL_URL when set; otherwise the request's own host (only safe characters).
function siteOrigin(req) {
  if (config.siteUrl) return config.siteUrl;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return '';
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' ? 'https' : 'http';
  return `${proto}://${host}`;
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(Buffer.isBuffer(body) ? body : typeof body === 'string' ? body : JSON.stringify(body));
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
  'GET /api/status': () => ({ jev: jevConfigured(), model: config.jevModel, accept: config.accept, confirm: config.confirm, multiMatch: config.multiMatch, feedback: feedbackConfigured() }),

  'GET /api/topics': () => ({
    points: POINTS,
    locales: Object.fromEntries(Object.entries(LOCALES).map(([code, l]) => [code, { name: l.name, speech: l.speech }])),
    packs: PACKS,
    topics: TOPICS.map(({ id, locale, style, kids, packs, prompt, answers }) => ({ id, locale, style, kids: Boolean(kids), packs: packs || [], prompt, answers: answers.map(({ key, text, difficulty }) => ({ key, text, difficulty })) })),
  }),

  'POST /api/match': async (req) => {
    const { topicId, guess, player, keys } = await readJson(req);
    const full = topicById(topicId);
    if (!full) return [400, { error: `Unknown topic "${topicId}"` }];
    if (typeof guess !== 'string' || !guess.trim()) return [400, { error: 'Send a non-empty guess.' }];
    // A turn shows a random subset of the board's pool; match only against what is on screen.
    const shown = Array.isArray(keys) ? full.answers.filter((a) => keys.includes(a.key)) : [];
    const topic = shown.length >= 3 ? { ...full, answers: shown } : full;
    const result = await matchGuess(topic, guess.slice(0, 300));
    appendFile(LOG, JSON.stringify({ at: new Date().toISOString(), topicId, player, ...result }) + '\n').catch(() => {});
    return result;
  },

  // Rapid Fire: match one spoken guess against one image's expected name.
  'POST /api/match-one': async (req) => {
    const { expected, guess, category, kind } = await readJson(req);
    if (typeof expected !== 'string' || !expected.trim()) return [400, { error: 'expected required' }];
    if (typeof guess !== 'string' || !guess.trim()) return [400, { error: 'Send a non-empty guess.' }];
    const result = await matchOne(expected.slice(0, 120), guess.slice(0, 200), { category: (category || '').slice(0, 60), kind: ['letter', 'number'].includes(kind) ? kind : '' });
    appendFile(LOG, JSON.stringify({ at: new Date().toISOString(), game: 'rapid', expected, category, guess, ...result }) + '\n').catch(() => {});
    return result;
  },

  // Player feedback / high-fives → Discord webhook (see lib/feedback.js).
  'POST /api/feedback': async (req) => handleFeedback(await readJson(req), { address: clientAddress(req), userAgent: req.headers['user-agent'] }),

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
    if (url.pathname === '/analytics.js') return send(res, 200, analyticsScript(), TYPES['.js']);
    const pretty = { '/': 'index.html', '/vibe': 'vibe.html', '/rapid': 'rapid.html' };
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return send(res, 400, { error: 'Bad path' }); }
    const rel = pretty[pathname] || normPath(pathname).replace(/^([/\\])+/, '');
    if (rel.includes('..')) return send(res, 400, { error: 'Bad path' });
    const file = await readFile(join(PUBLIC, rel));   // Buffer — sent as-is so images/audio aren't corrupted
    // Link previews need absolute URLs, so pages carry __ORIGIN__ and get the site's origin here.
    if (extname(rel) === '.html') return send(res, 200, file.toString('utf8').replaceAll('__ORIGIN__', siteOrigin(req)), TYPES['.html']);
    send(res, 200, file, TYPES[extname(rel)] || 'text/plain');
  } catch (e) {
    if (e.code === 'ENOENT') return send(res, 404, { error: 'Not found' });
    console.error(e);
    send(res, 500, { error: e.message });
  }
});

server.listen(config.port, () => {
  console.log(`Party Guess running at http://localhost:${config.port}`);
  console.log(jevConfigured() ? `Jev matching on (${config.jevModel})` : 'No TYPESAFE_API_KEY found: local matching only');
  console.log(feedbackConfigured() ? 'Feedback goes to Discord' : 'No DISCORD_WEBHOOK_URL: feedback is only logged locally');
  console.log(analyticsConfigured() ? `Google Analytics on (${config.gaId})` : 'No GA_MEASUREMENT_ID: analytics off');
});
