// Hall of Rot: most-upvoted / shittiest posts fed to the fly (deduplicated, truncated), plus the most substantive.
const H = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` });
const esc = s => String(s).replace(/\s+/g, ' ').slice(0, 110);
export default async function handler(req, res) {
  res.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=300');
  if (!process.env.SUPABASE_URL) return res.status(200).json({ top: [], bottom: [] });
  try {
    const q = async (order, extra = '', n = 60) => {
      const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ratings?select=id,fly_score,mn9,n_active,post,votes&order=${order}&limit=${n}${extra}`, { headers: H() });
      const seen = new Set(), out = [];
      for (const x of await r.json()) {
        const key = String(x.post).toLowerCase().replace(/\W+/g, '').slice(0, 80);
        if (seen.has(key)) continue; seen.add(key);
        out.push({ id: x.id, score: x.fly_score, mn9: x.mn9, votes: x.votes, melt: x.n_active > 3000, post: esc(x.post) });
      }
      return out;
    };
    const [top, bottom] = await Promise.all([q('votes.desc,fly_score.desc,created_at.desc'), q('votes.desc,created_at.desc', '&fly_score=eq.0', 30)]);
    return res.status(200).json({ top: top.slice(0, 10), bottom: bottom.slice(0, 3) });
  } catch (e) { return res.status(500).json({ top: [], bottom: [] }); }
}
