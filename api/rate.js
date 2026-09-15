// Vercel serverless function: logs every judged post to Supabase and returns the running count.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY   Table: ratings (see supabase.sql)
const H = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'content-type': 'application/json' });
const T = () => `${process.env.SUPABASE_URL}/rest/v1/ratings`;

async function count() {
  const r = await fetch(`${T()}?select=id`, { headers: { ...H(), Prefer: 'count=exact', Range: '0-0' } });
  const cr = r.headers.get('content-range') || '';
  return Number(cr.split('/')[1]) || 0;
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return res.status(200).json({ ok: false, count: 0 });
  try {
    if (req.method === 'GET') return res.status(200).json({ count: await count() });
    if (req.method !== 'POST') return res.status(405).end();
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const post = String(b.post || '').slice(0, 6000);
    if (!post.trim()) return res.status(400).json({ ok: false });
    const row = {
      post, bait_score: Number(b.bait_score) || 0, bait: Array.isArray(b.bait) ? b.bait.slice(0, 20) : [],
      rate: Number(b.rate) || 0, run: Number(b.run) || 0, mn9: Number(b.mn9) || 0, fly_score: Number(b.fly_score) || 0,
      levels: b.levels && typeof b.levels === 'object' ? b.levels : null, n_active: Number(b.n_active) || 0,
      ua: String(req.headers['user-agent'] || '').slice(0, 300), country: req.headers['x-vercel-ip-country'] || null,
    };
    const r = await fetch(T(), { method: 'POST', headers: { ...H(), Prefer: 'return=minimal' }, body: JSON.stringify(row) });
    if (!r.ok) return res.status(502).json({ ok: false, err: await r.text() });
    return res.status(200).json({ ok: true, count: await count() });
  } catch (e) {
    return res.status(500).json({ ok: false, err: String(e) });
  }
}
