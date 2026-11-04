// GET /api/poema/admin?action=alerts[&list=shop]   (photontide.eth only)
// Everyone who asked to hear about new drops, or with list=shop, about the shop.
import { redis, ADMIN, readToken, send, onlyMethod, hashObject } from './_lib.js';
import { ALERTS_KEY, SHOP_ALERTS_KEY } from '../alerts.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'GET')) return;
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'only photontide.eth can see the sign-up lists' });
  const key = req.query.list === 'shop' ? SHOP_ALERTS_KEY : ALERTS_KEY;
  const all = hashObject(await redis.hgetall(key));
  const people = Object.entries(all).map(([email, added]) => ({ email, added: String(added) }))
    .sort((a, b) => a.added.localeCompare(b.added));
  send(res, 200, { count: people.length, people });
}
