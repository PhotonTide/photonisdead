// TEMPORARY — preview only, removed before going live. Checks the server's ENS lookup.
import { ensName, send } from './_lib.js';
export default async function handler(req, res) {
  if (process.env.VERCEL_ENV === 'production') return send(res, 404, { error: 'not found' });
  const t0 = Date.now();
  send(res, 200, { name: await ensName(String(req.query.address || '').toLowerCase()), ms: Date.now() - t0 });
}
