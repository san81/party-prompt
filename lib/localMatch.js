// Stage 1: free, instant matching for exact words, aliases and small speech-to-text slips.
// Works on any script: tokens are split on whitespace, so it doesn't rely on \b,
// which only understands Latin letters in JavaScript regexes.

const EN = { splitWords: ['and', 'or'], fillers: [], stem: (s) => s.replace(/(es|s)$/, '') };

// Word-level phrase removal that works for Telugu as well as English.
function dropPhrases(text, phrases) {
  let s = ` ${text} `;
  for (const p of [...phrases].sort((a, b) => b.length - a.length)) {
    const needle = ` ${p} `;
    while (s.includes(needle)) s = s.replace(needle, ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

export function normalize(text, locale = EN) {
  const cleaned = String(text)
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[-_/]/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ') // keep letters and vowel signs of any script
    .replace(/\s+/g, ' ')
    .trim();
  return dropPhrases(cleaned, locale.fillers);
}

// "champagne, fireworks and confetti" -> three parts; "ముగ్గులు మరియు గాలిపటాలు" -> two.
export function splitGuess(guess, locale = EN) {
  const tokens = String(guess).normalize('NFC').replace(/[,;،、।]/g, ' , ').split(/\s+/);
  const parts = [[]];
  for (const tok of tokens) {
    if (tok === ',' || locale.splitWords.includes(tok.toLowerCase())) parts.push([]);
    else parts[parts.length - 1].push(tok);
  }
  return parts.map((p) => normalize(p.join(' '), locale)).filter(Boolean);
}

// Edit distance over code points, so a Telugu vowel sign counts as one edit.
function editDistance(a, b, max) {
  const A = Array.from(a), B = Array.from(b);
  if (Math.abs(A.length - B.length) > max) return max + 1;
  let prev = Array.from({ length: B.length + 1 }, (_, i) => i);
  for (let i = 1; i <= A.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= B.length; j++) {
      curr[j] = A[i - 1] === B[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[B.length];
}

const len = (s) => Array.from(s).length;

// Returns the single answer a part refers to, or null (no match, or ambiguous).
export function localMatch(part, answers, locale = EN) {
  const g = normalize(part, locale);
  if (!g) return null;
  const stem = locale.stem || ((x) => x);
  const same = (x, y) => x === y || stem(x) === stem(y);
  const exact = new Set();
  const fuzzy = new Set();

  for (const answer of answers) {
    for (const raw of [answer.text, ...answer.aliases]) {
      const c = normalize(raw, locale);
      if (!c) continue;
      if (same(c, g)) { exact.add(answer); continue; }
      const containsWord = len(c) >= 4 && ` ${g} `.includes(` ${c} `);
      const insideAnswer = len(g) >= 5 && ` ${c} `.includes(` ${g} `);
      const maxDist = len(c) < 5 ? 0 : Math.max(1, Math.floor(len(c) * 0.2));
      if (containsWord || insideAnswer || (maxDist > 0 && editDistance(g, c, maxDist) <= maxDist)) {
        fuzzy.add(answer);
      }
    }
  }
  if (exact.size === 1) return [...exact][0];
  if (exact.size === 0 && fuzzy.size === 1) return [...fuzzy][0];
  return null; // nothing, or ambiguous ("ball" could be ball drop or disco ball): let Jev decide
}
