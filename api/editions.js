// GET /api/editions
// Live mint counts (and whether the mint has ended) for the editions that are still minting, read from the chain (or, for a
// Transient drop, from its mint page). Cached at the edge for a few minutes so the site never
// waits on a slow node, and so visitors never hammer one.
import { createPublicClient, http, fallback, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';

const EDITIONS = {
  // Theres A Void Within Me — w/ Rich Caldwell (Transient "Pho Editions Collabs", token 1)
  // public sale opened Oct 15 2026 for 30 days
  void: { transient: 'https://www.transient.xyz/mint/theres-a-void-within-me', max: 10, ends: '2026-11-15T00:00:00Z' },
  // Me and My Shadow — Manifold "Glitch Mania", token 7
  shadow: { contract: '0xc7e25480d8dad4dd5be9ee4e47d0ac9c6d6f2483', id: 7n, max: 15 },
  // When All I Had Was Stars — 8NAP
  'event-horizon': { contract: '0x7eF98feA6FB32e612dd4E5ad6af8b56d23468978', id: 0n, max: 42 },
  youniverse: { contract: '0x7eF98feA6FB32e612dd4E5ad6af8b56d23468978', id: 1n, max: 22 },
};

const client = createPublicClient({
  chain: mainnet,
  transport: fallback([http('https://ethereum-rpc.publicnode.com', { timeout: 6000 }), http(undefined, { timeout: 6000 })]),
});
const abi = parseAbi(['function totalSupply(uint256 id) view returns (uint256)']);

async function onChain({ contract, id }) {
  return Number(await client.readContract({ address: contract, abi, functionName: 'totalSupply', args: [id] }));
}

// Transient publishes the drop's starting supply and what is left; minted is the difference.
async function fromTransient({ transient }) {
  const r = await fetch(transient, { headers: { 'User-Agent': 'Mozilla/5.0 (photontide.art edition counter)' }, signal: AbortSignal.timeout(8000) });
  const html = (await r.text()).replace(/\\"/g, '"');
  const start = html.match(/"initialSupply":"(\d+)"/), left = html.match(/"supply":"(\d+)"/);
  if (!start || !left) throw new Error('supply not found');
  const state = (html.match(/"saleState":"([A-Z_]+)"/) || [])[1];
  return { minted: Number(start[1]) - Number(left[1]), ended: !!state && !['SALE', 'PRESALE', 'UPCOMING', 'NOT_STARTED', 'PENDING'].includes(state) };
}

export default async function handler(req, res) {
  const out = {};
  await Promise.all(Object.entries(EDITIONS).map(async ([key, ed]) => {
    try {
      const got = ed.transient ? await fromTransient(ed) : { minted: await onChain(ed), ended: false };
      const ended = got.ended || (ed.ends ? Date.now() > Date.parse(ed.ends) : false);
      if (Number.isFinite(got.minted) && got.minted >= 0) out[key] = { minted: Math.min(got.minted, ed.max), max: ed.max, ended };
    } catch (e) { /* leave it out: the page keeps showing its last known count */ }
  }));
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  res.status(200).json(out);
}
