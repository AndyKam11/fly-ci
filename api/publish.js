// A private result can only be published by the holder of its one-result receipt.
import { createHash } from 'node:crypto';
export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return res.status(503).json({ ok: false });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!Number.isSafeInteger(b.id) || b.id <= 0 || typeof b.token !== 'string' || !/^[a-f0-9]{64}$/.test(b.token)) return res.status(400).json({ ok: false });
    const hash = createHash('sha256').update(b.token).digest('hex');
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ratings?id=eq.${b.id}&publish_token_hash=eq.${hash}&select=id`, {
      method: 'PATCH',
      headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'content-type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ is_public: true }),
    });
    if (!response.ok) return res.status(502).json({ ok: false });
    const rows = await response.json();
    return res.status(rows.length ? 200 : 404).json({ ok: rows.length > 0 });
  } catch { return res.status(400).json({ ok: false }); }
}
