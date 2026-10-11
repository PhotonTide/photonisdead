// POST /api/poema/remove  { n }   (photontide.eth only)
// Emergency removal. While the poem is being written: deletes line n, frees the spot, and stops
// that wallet writing again. Once all 47 lines exist: blanks the line ("—") so the poem stays whole.
// The opening line (n = 1) can't be removed.
import { redis, K, ADMIN, MAX_LINES, readToken, send, onlyMethod } from './_lib.js';

const REMOVE = `
local len = redis.call('LLEN', KEYS[1])
local n = tonumber(ARGV[1])
if n < 2 or n > len then return 0 end
local addr = redis.call('LINDEX', KEYS[2], n - 1)
if len >= tonumber(ARGV[3]) then
  redis.call('LSET', KEYS[1], n - 1, ARGV[4])
  redis.call('SADD', KEYS[4], addr)
  return 2
end
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
  const ok = Number(await redis.eval(REMOVE, [K.lines, K.addrs, K.idx, K.banned], [String(n), marker, String(MAX_LINES), '—']));
  if (!ok) return send(res, 400, { error: "that line can't be removed" });
  send(res, 200, { removed: n, blanked: ok === 2 });
}
