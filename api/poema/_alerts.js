// GET /api/poema/admin?action=alerts   (photontide.eth only)
// Everyone who asked to hear about new drops.
import { redis, ADMIN, readToken, send, onlyMethod, hashObject } from './_lib.js';
import { ALERTS_KEY } from '../alerts.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'GET')) return;
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'only photontide.eth can see the drop-alert list' });
  const all = hashObject(await redis.hgetall(ALERTS_KEY));
  const people = Object.entries(all).map(([email, added]) => ({ email, added: String(added) }))
    .sort((a, b) => a.added.localeCompare(b.added));
  send(res, 200, { count: people.length, people });
}
