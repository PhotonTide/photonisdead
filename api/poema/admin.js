// /api/poema/admin?action=…   (photontide.eth only — each action checks the signed-in wallet itself)
// One function for every moderator action, to stay well under Vercel's per-site function limit.
//   POST remove · POST shortlist · POST decide · GET export · GET description
import { send } from './_lib.js';
import remove from './_remove.js';
import shortlist from './_shortlist.js';
import decide from './_decide.js';
import exportPoem from './_export.js';
import description from './_description.js';

const ACTIONS = { remove, shortlist, decide, export: exportPoem, description };

export default async function handler(req, res) {
  const action = ACTIONS[String(req.query.action || '')];
  if (!action) return send(res, 404, { error: 'unknown action' });
  return action(req, res);
}
