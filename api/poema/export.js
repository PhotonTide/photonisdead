// GET /api/poema/export   (photontide.eth only)
// The full poem with each dreamer's wallet — for the artwork description and the edition airdrop.
import { redis, K, ADMIN, OPENING_LINE, MAX_LINES, readToken, send, onlyMethod, voteState, hashObject } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'GET')) return;
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'only photontide.eth can export the poem' });

  const [lines, addrs, proposals, banned] = await Promise.all([
    redis.lrange(K.lines, 0, -1), redis.lrange(K.addrs, 0, -1), redis.hgetall(K.proposals), redis.smembers(K.banned),
  ]);
  const removed = new Set((banned || []).map(String));
  const rows = lines.length
    ? lines.map((t, i) => ({ n: i + 1, text: String(t), wallet: addrs[i] }))
    : [{ n: 1, text: OPENING_LINE, wallet: ADMIN }];

  const vote = await voteState({ complete: rows.length >= MAX_LINES, me: null, isAdmin: true });
  send(res, 200, {
    title: vote.title,
    vote: { options: vote.options, results: vote.results, voters: vote.voters, endsAt: vote.endsAt, phase: vote.phase },
    proposals: hashObject(proposals),
    series: 'collective unconscious',
    poem: rows.map(r => r.text).join('\n'),
    dreamers: rows,
    wallets: [...new Set(rows.map(r => r.wallet))],
    // everyone who should receive an edition: line owners, minus wallets whose line was removed
    airdrop: [...new Set(rows.map(r => r.wallet))].filter(w => w && !removed.has(w)),
    removed: [...removed],
  });
}
