// POST /api/poema/title  { title }   (photontide.eth only)
// Sets the poem's title. Visitors only see it once all 47 lines are written.
import { redis, K, ADMIN, readToken, send, onlyMethod } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'POST')) return;
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'only photontide.eth can set the title' });

  const raw = (req.body || {}).title;
  const title = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (title.length > 80) return send(res, 400, { error: 'keep the title under 80 characters' });

  if (title) await redis.set(K.title, title);
  else await redis.del(K.title);
  send(res, 200, { title: title || null });
}
