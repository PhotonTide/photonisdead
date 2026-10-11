// Shared helpers for the Collective Unconscious poem (photonisdead.com/poema).
// Files starting with "_" inside /api are not exposed as endpoints by Vercel.
import { Redis } from '@upstash/redis';
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createPublicClient, http, getAddress, isAddress } from 'viem';
import { mainnet } from 'viem/chains';

export const MAX_LINES = 47;
export const MAX_CHARS = 60;
export const OPENING_LINE = 'i had a dream that';
export const ADMIN = '0xa90dc6d356b622b9783f5020722e6f92b663438f'; // photontide.eth — the only wallet that can remove lines

// Links and wallet addresses are never part of the dream (scam protection).
export const BLOCKED = /(https?:\/\/|www\.|0x[a-f0-9]{6,}|[a-z0-9-]+\.(com|xyz|io|net|org|eth|app|gg|art|co|me|ly|link)\b)/i;

export const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
  automaticDeserialization: false, // keep every line exactly as written
});

// Preview deployments and the live site share one database, so keep their data apart.
const ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'preview';
const P = `poema:${ENV}:`;
export const K = {
  lines: P + 'lines',     // list of line texts, in order (line 1 = opening line)
  addrs: P + 'addrs',     // list of wallet addresses, parallel to lines
  idx: P + 'idx',         // hash: wallet -> its line number (1-based)
  banned: P + 'banned',   // set: wallets whose line was removed (can't write again)
  nonce: a => P + 'nonce:' + a,
  rate: (bucket, ip) => P + 'rate:' + bucket + ':' + ip,
};

// ── sign-in message (the browser builds exactly the same text) ──
export const signInMessage = (address, nonce) =>
  `photonisdead.com/poema\n\nI am entering the collective unconscious.\n\nwallet: ${address}\nnonce: ${nonce}`;

export const normAddress = a => (typeof a === 'string' && isAddress(a) ? a.toLowerCase() : null);
export const newNonce = () => randomBytes(12).toString('hex');

// ── session tokens: "<address>.<expiry>.<hmac>" signed with a key derived from the DB secret ──
const sessionKey = () => createHash('sha256').update('poema-session:' + (process.env.KV_REST_API_TOKEN || '')).digest();
const TOKEN_DAYS = 30;

export function makeToken(address) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400;
  const body = `${address}.${exp}`;
  const mac = createHmac('sha256', sessionKey()).update(body).digest('hex');
  return `${body}.${mac}`;
}

export function readToken(req) {
  const h = req.headers['authorization'] || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  const parts = tok.split('.');
  if (parts.length !== 3) return null;
  const [address, exp, mac] = parts;
  if (!normAddress(address) || !/^\d+$/.test(exp) || +exp < Date.now() / 1000) return null;
  const want = createHmac('sha256', sessionKey()).update(`${address}.${exp}`).digest();
  const got = Buffer.from(mac, 'hex');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  return address;
}

// Works for normal wallets and smart-contract wallets (ERC-1271 / ERC-6492).
const client = createPublicClient({ chain: mainnet, transport: http() });
export async function verifySignature(address, message, signature) {
  try {
    return await client.verifyMessage({ address: getAddress(address), message, signature });
  } catch {
    return false;
  }
}

// ── small helpers ──
export function cleanLine(raw) {
  if (typeof raw !== 'string') return { error: 'write a line first' };
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 1) return { error: 'write a line first' };
  if ([...text].length > MAX_CHARS) return { error: `keep it to ${MAX_CHARS} characters` };
  if (BLOCKED.test(text)) return { error: "links and wallet addresses can't be part of the dream" };
  return { text };
}

// Per-connection limit, per action, per minute. Generous enough for a room of people on one Wi-Fi.
export async function rateLimited(req, bucket, limit) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const key = K.rate(bucket, ip);
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, 60);
  return n > limit;
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.status(status).json(body);
}

export function onlyMethod(req, res, method) {
  if (req.method !== method) { send(res, 405, { error: 'method not allowed' }); return false; }
  return true;
}
