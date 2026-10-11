// POST /api/poema/remove  { n }   (photontide.eth only)
// Emergency removal: deletes line n, frees the spot, and stops that wallet writing again.
// The opening line (n = 1) can't be removed.
import { redis, K, ADMIN, readToken, send, onlyMethod } from './_lib.js';

const REMOVE = `
local len = redis.call('LLEN', KEYS[1])
local n = tonumber(ARGV[1])
if n < 2 or n > len then return 0 end
local addr = redis.call('LINDEX', KEYS[2], n - 1)
redis.call('LSET', KEYS[1], n - 1, ARGV[2])
redis.call('LREM', KEYS[1], 1, ARGV[2])
redis.call('LSET', KEYS[2], n - 1, ARGV[2])
redis.call('LREM', KEYS[2], 1, ARGV[2])
redis.call('HDEL', KEYS[3], addr)
redis.call('SADD', KEYS[4], addr)
local later = redis.call('LRANGE', KEYS[2], n - 1, -1)
for i, a in ipairs(later) do redis.call('HSET', KEYS[3], a, n - 1 + i) end
return 1
`;

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'POST')) return;
  if (readToken(req) !== ADMIN) return send(res, 403, { error: 'only photontide.eth can remove lines' });

  const n = Number((req.body || {}).n);
  if (!Number.isInteger(n)) return send(res, 400, { error: 'which line?' });

  const marker = '__removed__' + Math.random().toString(36).slice(2);
  const ok = await redis.eval(REMOVE, [K.lines, K.addrs, K.idx, K.banned], [String(n), marker]);
  if (!Number(ok)) return send(res, 400, { error: "that line can't be removed" });
  send(res, 200, { removed: n });
}
