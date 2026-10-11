// POST /api/poema/admin?action=decide  { title }   (photontide.eth only)
// Sets the final title — used to break a tie when the vote closes. An empty title clears it.
import { redis, K, ADMIN, readToken, cleanTitle, send, onlyMethod } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'POST')) return;
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'only photontide.eth can set the title' });

  const raw = (req.body || {}).title;
  if (typeof raw === 'string' && !raw.trim()) { await redis.del(K.title); return send(res, 200, { title: null }); }
  const { title, error } = cleanTitle(raw);
  if (error) return send(res, 400, { error });
  await redis.set(K.title, title);
  send(res, 200, { title });
}
