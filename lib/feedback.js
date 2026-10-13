// Player feedback and high-fives. The server checks each one, keeps a local copy and
// forwards it to a Discord channel via webhook (Render's disk is wiped on every deploy,
// so the webhook is the durable copy). The webhook URL stays on the server.
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.js';

const LOG = join(config.root, 'logs', 'feedback.jsonl');
const RATINGS = ['😞', '🙁', '😐', '🙂', '😍'];
const GAP_MS = 15_000;            // one of each kind per address this often
const recent = new Map();         // `${address} ${kind}` -> last accepted time

const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
// Only these context keys are kept, each a short string, so the page can't send anything bulky.
const CONTEXT_KEYS = ['page', 'game', 'lang', 'kids', 'theme', 'category', 'screen', 'result'];

export function clientAddress(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

// Returns [status, body]. Bots that fill the hidden field get a fake success.
export async function handleFeedback(body, { address, userAgent }) {
  if (str(body.website, 200)) return [200, { ok: true }];
  const kind = body.kind === 'high-five' ? 'high-five' : 'feedback';
  const rating = Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating : null;
  // Keep the player's line breaks in the message; collapse other whitespace.
  const message = typeof body.message === 'string' ? body.message.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1000) : '';
  const contact = str(body.contact, 120);
  if (kind === 'feedback' && !rating && !message) return [400, { ok: false, error: 'Add a rating or a message.' }];

  const now = Date.now();
  const key = `${address} ${kind}`;   // a high-five never blocks a written message
  if (now - (recent.get(key) || 0) < GAP_MS) return [429, { ok: false, error: 'slow down' }];
  recent.set(key, now);
  if (recent.size > 5000) for (const [k, t] of recent) if (now - t > GAP_MS) recent.delete(k);

  const ctx = {};
  for (const k of CONTEXT_KEYS) { const v = str(String(body.context?.[k] ?? ''), 60); if (v) ctx[k] = v; }
  const entry = { at: new Date(now).toISOString(), kind, rating, message, contact, context: ctx, ua: str(userAgent, 160) };
  appendFile(LOG, JSON.stringify(entry) + '\n').catch(() => {});

  const forwarded = await toDiscord(entry);
  return [200, { ok: true, forwarded }];
}

export const feedbackConfigured = () => Boolean(config.feedbackWebhook);

async function toDiscord(e) {
  if (!config.feedbackWebhook) return false;
  const where = [e.context.game || e.context.page, e.context.lang, e.context.kids === 'true' ? 'kids' : '', e.context.category]
    .filter(Boolean).join(' · ');
  const payload = {
    username: 'Party Games',
    allowed_mentions: { parse: [] },   // a player typing @everyone must not ping the server
  };
  if (e.kind === 'high-five') {
    payload.content = `🙌 High-five${where ? ` — ${where}` : ''}`;
  } else {
    const fields = [];
    if (e.rating) fields.push({ name: 'Rating', value: `${RATINGS[e.rating - 1]} ${e.rating}/5`, inline: true });
    if (where) fields.push({ name: 'Where', value: where, inline: true });
    if (e.contact) fields.push({ name: 'Reply to', value: e.contact });
    const extra = [e.context.theme && `theme ${e.context.theme}`, e.context.screen, e.context.result].filter(Boolean).join(' · ');
    if (extra) fields.push({ name: 'Context', value: extra });
    payload.embeds = [{
      title: '💌 Feedback',
      description: e.message || '_(no message)_',
      color: 0xffd23f,
      fields,
      footer: { text: e.ua || 'unknown browser' },
      timestamp: e.at,
    }];
  }
  try {
    const r = await fetch(config.feedbackWebhook, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) console.error(`Discord webhook ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.ok;
  } catch (err) {
    console.error('Discord webhook failed:', err.message);
    return false;
  }
}
