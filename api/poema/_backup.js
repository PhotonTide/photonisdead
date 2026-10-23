// Weekly copies of everything the poem keeps (and the drop-alert list), stored beside it in the database.
//   snapshot()       — the whole state, exactly as stored
//   saveWeekly()     — keep a dated copy (at most one every 6 days, the newest 12 kept: about three months)
//   GET /api/poema/admin?action=backup   (photontide.eth only) — download today's state plus every weekly copy
import { redis, K, ADMIN, readToken, send, onlyMethod, hashObject } from './_lib.js';
import { ALERTS_KEY } from '../alerts.js';

const ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'preview';
const B = `poema:${ENV}:backup:`;
const KEEP = 12;

export async function snapshot() {
  const [lines, addrs, idx, banned, title, proposals, shortlist, voteStart, votes, alerts] = await Promise.all([
    redis.lrange(K.lines, 0, -1), redis.lrange(K.addrs, 0, -1), redis.hgetall(K.idx), redis.smembers(K.banned),
    redis.get(K.title), redis.hgetall(K.proposals), redis.get(K.shortlist), redis.get(K.voteStart), redis.hgetall(K.votes),
    redis.hgetall(ALERTS_KEY),
  ]);
  return {
    taken: new Date().toISOString(),
    poem: {
      lines: (lines || []).map(String), addrs: (addrs || []).map(String), idx: hashObject(idx), banned: (banned || []).map(String),
      title: title == null ? null : String(title), proposals: hashObject(proposals),
      shortlist: shortlist == null ? null : String(shortlist), voteStart: voteStart == null ? null : String(voteStart), votes: hashObject(votes),
    },
    alerts: hashObject(alerts),
  };
}

export async function saveWeekly() {
  const dates = (await redis.lrange(B + 'index', 0, -1)).map(String);
  if (dates[0] && Date.now() - Date.parse(dates[0]) < 6 * 86400e3) return { saved: false, last: dates[0] };
  const snap = await snapshot();
  const date = snap.taken.slice(0, 10);
  await redis.set(B + date, JSON.stringify(snap));
  await redis.lpush(B + 'index', date);
  const old = (await redis.lrange(B + 'index', KEEP, -1)).map(String);
  await redis.ltrim(B + 'index', 0, KEEP - 1);
  if (old.length) await redis.del(...old.map(d => B + d));
  return { saved: true, date, lines: snap.poem.lines.length };
}

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'GET')) return;
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'only photontide.eth can download the backups' });
  const dates = (await redis.lrange(B + 'index', 0, -1)).map(String);
  const weekly = await Promise.all(dates.map(async d => { const v = await redis.get(B + d); return v ? JSON.parse(String(v)) : null; }));
  send(res, 200, { current: await snapshot(), weekly: weekly.filter(Boolean) });
}
