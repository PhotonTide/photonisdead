// POST /api/poema/vote  { choice }   (a dreamer who wrote a line)
// One vote per wallet while the 72-hour vote is open. Votes can't be changed.
import { redis, K, MAX_LINES, VOTE_MS, readToken, send, onlyMethod, rateLimited } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'POST')) return;
  if (await rateLimited(req, 'vote', 30)) return send(res, 429, { error: 'too many requests — breathe, then try again' });

  const me = readToken(req);
  if (!me) return send(res, 401, { error: 'connect your wallet first' });
  const [mine, count, shortlistRaw, startRaw, title] = await Promise.all([
    redis.hget(K.idx, me), redis.llen(K.lines), redis.get(K.shortlist), redis.get(K.voteStart), redis.get(K.title),
  ]);
  if (!mine) return send(res, 403, { error: 'only dreamers who wrote a line can vote' });
  if (count < MAX_LINES || !shortlistRaw || !startRaw || title) return send(res, 409, { error: 'the vote is not open' });
  if (Date.now() >= Number(startRaw) + VOTE_MS) return send(res, 409, { error: 'the vote has closed' });

  const options = JSON.parse(String(shortlistRaw));
  const choice = Number((req.body || {}).choice);
  if (!Number.isInteger(choice) || choice < 0 || choice >= options.length) return send(res, 400, { error: 'choose one of the titles' });

  const fresh = await redis.hsetnx(K.votes, me, String(choice));
  if (!fresh) return send(res, 409, { error: 'this wallet has already voted' });
  send(res, 200, { voted: choice });
}
