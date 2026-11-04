// POST /api/alerts   { email, website, list? }
// Two separate sign-up lists: "tell me when a new piece drops" on the main site, and the shop's
// "notify me" (list: 'shop'). Each is kept only for its own emails and is only readable by
// photontide.eth (download from the poem page's moderation box).
import { redis, rateLimited, send, onlyMethod } from './poema/_lib.js';

const ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'preview';
export const ALERTS_KEY = `alerts:${ENV}:emails`;    // hash: email -> ISO time it was added (art drops)
export const SHOP_ALERTS_KEY = `alerts:${ENV}:shop`; // same shape, for the shop opening and new pieces

const EMAIL = /^[^\s@<>()[\],;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'POST')) return;
  if (await rateLimited(req, 'alerts', 5)) return send(res, 429, { error: 'too many tries — wait a minute' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  // bots fill the hidden field; people never see it
  if (body.website) return send(res, 200, { ok: true });

  const email = String(body.email || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return send(res, 400, { error: 'that email doesn’t look right' });

  const key = body.list === 'shop' ? SHOP_ALERTS_KEY : ALERTS_KEY;
  const added = await redis.hsetnx(key, email, new Date().toISOString());
  send(res, 200, { ok: true, already: !added });
}
