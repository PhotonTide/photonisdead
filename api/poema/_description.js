// GET /api/poema/admin?action=description   (photontide.eth only)
// Ready-to-paste description for the 1/1 and the edition: title, the poem, and the dreamers
// (ENS names where a wallet has one, otherwise the full address). Names go in the description only.
import { redis, K, ADMIN, OPENING_LINE, MAX_LINES, readToken, send, onlyMethod, voteState, ensName } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'GET')) return;
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'only photontide.eth can do this' });

  const [lines, addrs, banned] = await Promise.all([redis.lrange(K.lines, 0, -1), redis.lrange(K.addrs, 0, -1), redis.smembers(K.banned)]);
  const removed = new Set((banned || []).map(String));
  const rows = lines.length
    ? lines.map((t, i) => ({ n: i + 1, text: String(t), wallet: String(addrs[i]) }))
    : [{ n: 1, text: OPENING_LINE, wallet: ADMIN }];
  const vote = await voteState({ complete: rows.length >= MAX_LINES, me: null, isAdmin: true });

  // look up ENS names a few at a time
  const names = {};
  const todo = [...new Set(rows.map(r => r.wallet))].filter(w => !removed.has(w));
  for (let i = 0; i < todo.length; i += 8) {
    const batch = todo.slice(i, i + 8);
    const found = await Promise.all(batch.map(ensName));
    batch.forEach((w, j) => { names[w] = found[j]; });
  }

  const dreamers = rows.map(r => `${r.n} · ${removed.has(r.wallet) ? '—' : (names[r.wallet] || r.wallet)}`);
  const text = [
    vote.title || '[title]',
    '',
    ...rows.map(r => r.text),
    '',
    '—',
    '',
    `A poem dreamed by ${rows.length} people, one line each. Each dreamer could read only the line before theirs; the whole poem was revealed only when the last line was written. The dreamers chose its title.`,
    '',
    'Collective Unconscious — Photon Tide, 2026',
    '',
    'the dreamers:',
    ...dreamers,
  ].join('\n');

  send(res, 200, { title: vote.title, text, ensFound: Object.values(names).filter(Boolean).length });
}
