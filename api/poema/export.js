// GET /api/poema/export   (photontide.eth only)
// The full poem with each dreamer's wallet — for the artwork description and the edition airdrop.
import { redis, K, ADMIN, OPENING_LINE, readToken, send, onlyMethod } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'GET')) return;
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'only photontide.eth can export the poem' });

  const [lines, addrs, title] = await Promise.all([redis.lrange(K.lines, 0, -1), redis.lrange(K.addrs, 0, -1), redis.get(K.title)]);
  const rows = lines.length
    ? lines.map((t, i) => ({ n: i + 1, text: String(t), wallet: addrs[i] }))
    : [{ n: 1, text: OPENING_LINE, wallet: ADMIN }];

  send(res, 200, {
    title: title ? String(title) : null,
    series: 'collective unconscious',
    poem: rows.map(r => r.text).join('\n'),
    dreamers: rows,
    wallets: [...new Set(rows.map(r => r.wallet))],
  });
}
