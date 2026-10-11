// GET /api/poema/admin?action=description   (photontide.eth only)
// Ready-to-paste description for the 1/1 and the edition: title, the poem, and the dreamers
// (ENS names where a wallet has one, otherwise the full address). Names go in the description only.
import { redis, K, ADMIN, OPENING_LINE, MAX_LINES, readToken, send, onlyMethod, voteState, ensName, ensCached } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'GET')) return;
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'only photontide.eth can do this' });

  const [lines, addrs, banned] = await Promise.all([redis.lrange(K.lines, 0, -1), redis.lrange(K.addrs, 0, -1), redis.smembers(K.banned)]);
  const removed = new Set((banned || []).map(String));
  const rows = lines.length
    ? lines.map((t, i) => ({ n: i + 1, text: String(t), wallet: String(addrs[i]) }))
    : [{ n: 1, text: OPENING_LINE, wallet: ADMIN }];
  const vote = await voteState({ complete: rows.length >= MAX_LINES, me: null, isAdmin: true });

  // ENS names: use what's remembered, look up the rest a few at a time within a time budget
  const names = {};
  const wallets = [...new Set(rows.map(r => r.wallet))].filter(w => !removed.has(w));
  const cached = await Promise.all(wallets.map(ensCached));
  const todo = wallets.filter((w, i) => { if (cached[i] !== undefined) { names[w] = cached[i]; return false; } return true; });
  const deadline = Date.now() + 18000;
  for (let i = 0; i < todo.length && Date.now() < deadline; i += 6) {
    const batch = todo.slice(i, i + 6);
    const found = await Promise.all(batch.map(ensName));
    batch.forEach((w, j) => { names[w] = found[j]; });
  }
  const pending = wallets.filter(w => !(w in names)).length;

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

  send(res, 200, { title: vote.title, text, ensFound: Object.values(names).filter(Boolean).length, pending });
}
