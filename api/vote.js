// Upvote a hall-of-rot entry. POST {id} → {votes}
const H = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'content-type': 'application/json' });
export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const id = parseInt(b.id); if (!id) return res.status(400).json({ ok: false });
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/increment_votes`, { method: 'POST', headers: H(), body: JSON.stringify({ rid: id }) });
    return res.status(200).json({ ok: r.ok, votes: r.ok ? await r.json() : null });
  } catch (e) { return res.status(500).json({ ok: false }); }
}
