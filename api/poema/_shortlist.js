// POST /api/poema/admin?action=shortlist  { titles: [...] }   (photontide.eth only)
// Puts 2–8 titles on the ballot and opens the 72-hour vote. Can be changed until the first vote is cast.
import { redis, K, ADMIN, MAX_LINES, VOTE_MS, readToken, cleanTitle, send, onlyMethod } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'POST')) return;
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'only photontide.eth can open the vote' });

  const [count, voters] = await Promise.all([redis.llen(K.lines), redis.hlen(K.votes)]);
  if (count < MAX_LINES) return send(res, 409, { error: 'the vote opens once all 47 lines are written' });
  if (voters > 0) return send(res, 409, { error: 'votes have already been cast — the ballot is locked' });

  const raw = Array.isArray((req.body || {}).titles) ? req.body.titles : [];
  const titles = [];
  for (const r of raw) {
    const { title, error } = cleanTitle(r);
    if (error) return send(res, 400, { error: `“${r}”: ${error}` });
    if (!titles.includes(title)) titles.push(title);
  }
  if (titles.length < 2 || titles.length > 8) return send(res, 400, { error: 'choose between 2 and 8 titles' });

  const start = Date.now();
  await Promise.all([redis.set(K.shortlist, JSON.stringify(titles)), redis.set(K.voteStart, String(start)), redis.del(K.title)]);
  send(res, 200, { titles, endsAt: start + VOTE_MS });
}
