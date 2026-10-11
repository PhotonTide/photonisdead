// POST /api/poema/propose  { title }   (a dreamer who has written a line)
// Suggest a title for the poem. One suggestion per wallet; it can be changed until the dream wakes.
import { redis, K, MAX_LINES, readToken, cleanTitle, send, onlyMethod, rateLimited } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'POST')) return;
  if (await rateLimited(req, 'propose', 30)) return send(res, 429, { error: 'too many requests — breathe, then try again' });

  const me = readToken(req);
  if (!me) return send(res, 401, { error: 'connect your wallet first' });
  const [mine, count] = await Promise.all([redis.hget(K.idx, me), redis.llen(K.lines)]);
  if (!mine) return send(res, 403, { error: 'write your line first — then you can suggest a title' });
  if (count >= MAX_LINES) return send(res, 409, { error: 'the dream has woken — suggestions are closed' });

  const { title, error } = cleanTitle((req.body || {}).title);
  if (error) return send(res, 400, { error });
  await redis.hset(K.proposals, { [me]: title });
  send(res, 200, { title });
}
