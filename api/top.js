// Hall of Rot: the shittiest posts fed to the fly (truncated), plus the most substantive.
const H = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` });
export default async function handler(req, res) {
  res.setHeader('cache-control', 'public, s-maxage=120, stale-while-revalidate=600');
  if (!process.env.SUPABASE_URL) return res.status(200).json({ top: [], bottom: [] });
  try {
    const q = async (order, extra = '') => {
      const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ratings?select=fly_score,mn9,n_active,post,created_at&order=${order}&limit=8${extra}`, { headers: H() });
      return (await r.json()).map(x => ({ score: x.fly_score, mn9: x.mn9, melt: x.n_active > 3000, post: String(x.post).replace(/\s+/g, ' ').slice(0, 110) }));
    };
    const [top, bottom] = await Promise.all([q('fly_score.desc,created_at.desc'), q('created_at.desc', '&fly_score=eq.0')]);
    return res.status(200).json({ top, bottom: bottom.slice(0, 3) });
  } catch (e) { return res.status(500).json({ top: [], bottom: [] }); }
}
