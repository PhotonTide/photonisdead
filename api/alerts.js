// POST /api/alerts   { email, website }
// "Tell me when a new piece drops" sign-ups. Emails are kept only for drop alerts and are only
// readable by photontide.eth (download from the poem page's moderation box).
import { redis, rateLimited, send, onlyMethod } from './poema/_lib.js';

const ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'preview';
export const ALERTS_KEY = `alerts:${ENV}:emails`; // hash: email -> ISO time it was added

const EMAIL = /^[^\s@<>()[\],;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

export default async function handler(req, res) {
  if (!onlyMethod(req, res, 'POST')) return;
  if (await rateLimited(req, 'alerts', 5)) return send(res, 429, { error: 'too many tries — wait a minute' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  // bots fill the hidden field; people never see it
  if (body.website) return send(res, 200, { ok: true });

  const email = String(body.email || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return send(res, 400, { error: 'that email doesn’t look right' });

  const added = await redis.hsetnx(ALERTS_KEY, email, new Date().toISOString());
  send(res, 200, { ok: true, already: !added });
}
