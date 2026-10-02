// Loads .env (no dependency) and exposes runtime settings.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^['"]|['"]$/g, '');
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  root,
  port: num(process.env.PORT, 3000),
  jevKey: process.env.TYPESAFE_API_KEY || '',
  jevUrl: process.env.TYPESAFE_URL || 'https://api.typesafe.ai/v1/systemone',
  jevModel: process.env.JEV_MODEL || 'jev-latest',
  jevTimeoutMs: num(process.env.JEV_TIMEOUT_MS, 4000),
  // Probability at or above which a guess scores automatically.
  accept: num(process.env.ACCEPT_THRESHOLD, 0.75),
  // Probability band [confirm, accept) where the host asks "Did you mean…?"
  confirm: num(process.env.CONFIRM_THRESHOLD, 0.45),
  // Ask one yes/no question per answer so "champagne and fireworks" scores both.
  multiMatch: (process.env.MULTI_MATCH || 'true') !== 'false',
  // Testing only: skip local matching so every guess is decided by Jev alone.
  forceJev: process.env.FORCE_JEV === '1' || process.env.FORCE_JEV === 'true',
};

export const jevConfigured = () => Boolean(config.jevKey);
