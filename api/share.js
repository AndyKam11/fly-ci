import { getShare, UUID } from '../lib/result-shares.js';
// Share landing page: OG tags with the person's result, then straight into the app.
// /s?r=94&t=2&m=75   (r: rot %, t: verdict tier 0-6, m: MN9 Hz)
const TITLES = ['Zero rot. All substance. The fly walked away.', 'Barely rotten. The fly sniffed it and left.', 'Mildly rotten. A polite nibble.',
  'Rotten. Proboscis extended.', 'Very rotten. The fly is feasting on this post.', 'CERTIFIED BRAIN ROT. The fly is licking the screen.', 'BRAIN MELTDOWN. Peak self-indulgent slop.'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export default async function handler(req, res) {
  if (req.query.id !== undefined) {
    res.setHeader('cache-control', 'no-store');
    if (typeof req.query.id !== 'string' || !UUID.test(req.query.id)) return res.status(404).end();
    try {
      const row = await getShare(req.query.id);
      if (!row) return res.status(404).end();
      const url = `https://brainrotposts.com/s?id=${row.id}`;
      const image = `https://brainrotposts.com/api/result-image?id=${row.id}`;
      const title = `${row.score}% brain rot. Can you beat it?`;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.setHeader('cache-control', 'public, max-age=3600, s-maxage=86400');
      return res.status(200).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="A fruit fly brain rated my LinkedIn post. Feed it yours."><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="The actual brain, fly and rating for this result"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${image}">
<style>body{margin:0;padding:24px;background:#08080d;color:#f4f1e8;font:18px system-ui;text-align:center}main{max-width:1000px;margin:32px auto}img{display:block;width:100%;height:auto;border-radius:16px}a{display:inline-block;margin:24px;padding:16px 24px;background:#b6ff3b;color:#08080d;border-radius:12px;font-weight:800;text-decoration:none}</style></head><body><main><h1>${esc(title)}</h1><img src="${image}" width="1200" height="630" alt="Shared brain rot result"><a href="/">Feed the fly your post →</a></main></body></html>`);
    } catch { return res.status(503).end(); }
  }
  const r = Math.max(0, Math.min(100, parseInt(req.query.r) || 0)), t = Math.max(0, Math.min(6, parseInt(req.query.t) || 0)), m = Math.max(0, parseInt(req.query.m) || 0);
  const title = `${r}% brain rot — ${TITLES[t]}`;
  const desc = `A real fruit fly brain (139,255 neurons) rated this LinkedIn post. ${t === 6 ? 'It triggered a brain-wide meltdown.' : `The tongue motor neuron fired at ${m} Hz.`} Feed it yours.`;
  const img = `https://brainrotposts.com/api/og?r=${r}&t=${t}&m=${m}`;
  res.setHeader('content-type', 'text/html; charset=utf-8'); res.setHeader('cache-control', 'public, s-maxage=86400');
  res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="https://brainrotposts.com/s?r=${r}&t=${t}&m=${m}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${img}">
<meta http-equiv="refresh" content="0;url=/"><script>location.replace('/')</script></head><body><a href="/">Brain Rot</a></body></html>`);
}
