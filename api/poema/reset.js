// TEMPORARY — preview deployments only, for testing. Wipes the preview poem. Never works on the live site.
import { redis, K, ADMIN, readToken, send, onlyMethod } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'POST')) return;
  if (process.env.VERCEL_ENV === 'production') return send(res, 404, { error: 'not found' });
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'moderator only' });
  await redis.del(K.lines, K.addrs, K.idx, K.banned, K.title, K.proposals, K.shortlist, K.voteStart, K.votes);
  send(res, 200, { reset: true });
}
