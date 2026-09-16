import { getShare, UUID } from '../lib/result-shares.js';
export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
  if (typeof req.query.id !== 'string' || !UUID.test(req.query.id)) return res.status(404).end();
  try {
    const row = await getShare(req.query.id, true);
    if (!row) return res.status(404).end();
    res.setHeader('content-type', 'image/png');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    return req.method === 'HEAD' ? res.end() : res.send(Buffer.from(row.image_base64, 'base64'));
  } catch { return res.status(503).end(); }
}
