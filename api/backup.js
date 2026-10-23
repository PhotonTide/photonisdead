// GET /api/backup — run by Vercel every Monday (see vercel.json): saves a dated copy of the poem.
// It never returns any of the poem, and saves at most one copy every 6 days, so calling it by hand does nothing harmful.
import { send } from './poema/_lib.js';
import { saveWeekly } from './poema/_backup.js';

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) return send(res, 401, { error: 'not allowed' });
  try {
    const r = await saveWeekly();
    send(res, 200, { ok: true, saved: r.saved, date: r.date || r.last });
  } catch (e) {
    send(res, 500, { error: 'backup failed' });
  }
}
