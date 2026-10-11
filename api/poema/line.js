// POST /api/poema/line  { text }   (signed in)
// Seals one line per wallet, in order, up to 47. Atomic, so two dreamers can't take the same spot.
import { redis, K, MAX_LINES, OPENING_LINE, ADMIN, readToken, cleanLine, send, onlyMethod, rateLimited } from './_lib.js';

// Returns: [n] on success · [-1, n] already wrote line n · [-2] poem complete · [-3] wallet's line was removed
const APPEND = `
if redis.call('SISMEMBER', KEYS[4], ARGV[1]) == 1 then return {-3} end
if redis.call('LLEN', KEYS[1]) == 0 then
  redis.call('RPUSH', KEYS[1], ARGV[4])
  redis.call('RPUSH', KEYS[2], ARGV[5])
  redis.call('HSET', KEYS[3], ARGV[5], 1)
end
local have = redis.call('HGET', KEYS[3], ARGV[1])
if have then return {-1, tonumber(have)} end
local n = redis.call('LLEN', KEYS[1])
if n >= tonumber(ARGV[3]) then return {-2} end
redis.call('RPUSH', KEYS[1], ARGV[2])
redis.call('RPUSH', KEYS[2], ARGV[1])
redis.call('HSET', KEYS[3], ARGV[1], n + 1)
return {n + 1}
`;

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'POST')) return;
  if (await rateLimited(req, 'line', 30)) return send(res, 429, { error: 'too many requests — breathe, then try again' });

  const me = readToken(req);
  if (!me) return send(res, 401, { error: 'connect your wallet first' });

  const { text, error } = cleanLine((req.body || {}).text);
  if (error) return send(res, 400, { error });

  const r = await redis.eval(APPEND, [K.lines, K.addrs, K.idx, K.banned], [me, text, String(MAX_LINES), OPENING_LINE, ADMIN]);
  const code = Number(r[0]);
  if (code === -1) return send(res, 409, { error: 'this wallet has already written its line', n: Number(r[1]) });
  if (code === -2) return send(res, 409, { error: 'the dream is complete — all 47 lines are written' });
  if (code === -3) return send(res, 403, { error: "this wallet's line was removed and it can't write again" });

  send(res, 200, { n: code });
}
