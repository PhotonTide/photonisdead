// GET /api/poema/state
// Returns only what this visitor has earned the right to read:
//   · everyone: the line count and the newest line
//   · a dreamer (signed in, has written): every line up to and including theirs
//   · when all 47 lines are written: the whole poem, for everyone
//   · photontide.eth: everything, with wallets, for moderation
import { redis, K, MAX_LINES, OPENING_LINE, ADMIN, readToken, send, onlyMethod, voteState, hashObject } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'GET')) return;

  const me = readToken(req);
  const [stored, addrs, myN, myProposal] = await Promise.all([
    redis.lrange(K.lines, 0, -1),
    redis.lrange(K.addrs, 0, -1),
    me ? redis.hget(K.idx, me) : null,
    me ? redis.hget(K.proposals, me) : null,
  ]);

  // Before anyone writes, the poem is just the opening line.
  const lines = stored.length ? stored.map(String) : [OPENING_LINE];
  const owners = stored.length ? addrs : [ADMIN];
  const count = lines.length;
  const complete = count >= MAX_LINES;
  const isAdmin = me === ADMIN;
  const mine = myN ? Number(myN) : (isAdmin ? 1 : null);

  let visible;
  if (isAdmin || complete) visible = lines.map((t, i) => ({ n: i + 1, text: t }));
  else if (mine) visible = lines.slice(0, mine).map((t, i) => ({ n: i + 1, text: t }));
  else visible = [];

  if (isAdmin) visible.forEach(l => { l.wallet = owners[l.n - 1] || null; });

  const vote = await voteState({ complete, me, isAdmin });
  let proposals = null;
  if (isAdmin) {
    const all = hashObject(await redis.hgetall(K.proposals));
    const counts = {};
    Object.entries(all).forEach(([w, t]) => { const k = String(t); (counts[k] = counts[k] || []).push(w); });
    proposals = Object.entries(counts).map(([title, wallets]) => ({ title, count: wallets.length, wallets }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }

  send(res, 200, {
    max: MAX_LINES,
    count,
    complete,
    last: { n: count, text: lines[count - 1] },
    signedIn: !!me,
    address: me,
    mine,
    admin: isAdmin,
    lines: visible,
    title: vote.title,
    vote,
    myProposal: myProposal ? String(myProposal) : null,
    proposals,
  });
}
