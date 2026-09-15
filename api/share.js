// Share landing page: OG tags with the person's result, then straight into the app.
// /s?r=94&t=2&m=75   (r: rot %, t: verdict tier 0-6, m: MN9 Hz)
const TITLES = ['Zero rot. Not a shitpost. The fly walked away.', 'Barely rotten. The fly sniffed it and left.', 'Mildly rotten. A polite nibble.',
  'Rotten. Proboscis extended.', 'Very rotten. The fly is feasting on this shitpost.', 'CERTIFIED SHITPOST. The fly is licking the screen.', 'BRAIN MELTDOWN. This smells like ChatGPT.'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export default function handler(req, res) {
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
