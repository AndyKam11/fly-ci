import { createHash, randomUUID } from 'node:crypto';
import { headers, endpoint } from '../lib/result-shares.js';
const MAX_BYTES = 1500000;
export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return res.status(503).json({ ok: false });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!Number.isSafeInteger(b.id) || b.id < 1 || typeof b.token !== 'string' || !/^[a-f0-9]{64}$/.test(b.token)) return res.status(400).json({ ok: false });
    const hash = createHash('sha256').update(b.token).digest('hex');
    const owner = await fetch(`${endpoint('ratings')}?id=eq.${b.id}&publish_token_hash=eq.${hash}&select=id,fly_score`, { headers: headers() });
    if (!owner.ok) throw new Error('Lookup failed');
    const rating = (await owner.json())[0];
    if (!rating) return res.status(404).json({ ok: false });
    const existing = await fetch(`${endpoint('result_shares')}?rating_id=eq.${b.id}&select=id`, { headers: headers() });
    if (!existing.ok) throw new Error('Lookup failed');
    const previous = (await existing.json())[0];
    if (previous) return res.json({ ok: true, url: `https://brainrotposts.com/s?id=${previous.id}` });
    if (typeof b.image !== 'string' || b.image.length > 2000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b.image)) return res.status(400).json({ ok: false });
    const png = Buffer.from(b.image, 'base64');
    if (png.length < 45 || png.length > MAX_BYTES || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.toString('ascii', 12, 16) !== 'IHDR' || png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630 || png.subarray(-12).toString('hex') !== '0000000049454e44ae426082') return res.status(400).json({ ok: false });
    const id = randomUUID();
    // One immutable image per owned result; sharing never changes Hall consent.
    const saved = await fetch(`${endpoint('result_shares')}?on_conflict=rating_id`, {
      method: 'POST', headers: { ...headers(), Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ id, rating_id: rating.id, score: rating.fly_score, image_base64: b.image }),
    });
    if (!saved.ok) throw new Error('Save failed');
    const rows = await saved.json();
    let shareId = rows[0]?.id;
    if (!shareId) {
      const winner = await fetch(`${endpoint('result_shares')}?rating_id=eq.${rating.id}&select=id`, { headers: headers() });
      if (!winner.ok) throw new Error('Lookup failed');
      shareId = (await winner.json())[0]?.id;
    }
    if (!shareId) throw new Error('Save failed');
    return res.json({ ok: true, url: `https://brainrotposts.com/s?id=${shareId}` });
  } catch { return res.status(502).json({ ok: false }); }
}
