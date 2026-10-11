// GET /api/poema/nonce?address=0x…
// Gives the wallet a one-time message to sign (free — no transaction).
import { redis, K, normAddress, newNonce, signInMessage, send, onlyMethod, rateLimited } from './_lib.js';

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'GET')) return;
  if (await rateLimited(req, 'nonce', 60)) return send(res, 429, { error: 'too many requests — breathe, then try again' });

  const address = normAddress(req.query.address);
  if (!address) return send(res, 400, { error: 'invalid wallet address' });

  const nonce = newNonce();
  const message = signInMessage(req, address, nonce);
  await redis.set(K.nonce(address), message, { ex: 600 }); // remember the exact message we asked them to sign
  send(res, 200, { nonce, message });
}
