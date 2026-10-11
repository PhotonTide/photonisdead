// POST /api/poema/verify  { address, signature }
// Checks the signed message and returns a session token (valid 30 days).
import { redis, K, normAddress, verifySignature, makeToken, send, onlyMethod, rateLimited } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'POST')) return;
  if (await rateLimited(req, 'verify', 60)) return send(res, 429, { error: 'too many requests — breathe, then try again' });

  const { address: raw, signature } = req.body || {};
  const address = normAddress(raw);
  if (!address || typeof signature !== 'string') return send(res, 400, { error: 'missing wallet or signature' });

  const message = await redis.get(K.nonce(address));
  if (!message) return send(res, 400, { error: 'that request expired — please connect again' });
  await redis.del(K.nonce(address)); // one use only

  const ok = await verifySignature(address, String(message), signature);
  if (!ok) return send(res, 401, { error: "that signature didn't match this wallet" });

  send(res, 200, { token: makeToken(address), address });
}
