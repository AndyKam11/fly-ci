export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const headers = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'content-type': 'application/json' });
export const endpoint = table => `${process.env.SUPABASE_URL}/rest/v1/${table}`;
export async function getShare(id, image = false) {
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  const response = await fetch(`${endpoint('result_shares')}?id=eq.${id}&select=${image ? 'image_base64' : 'id,score'}&limit=1`, { headers: headers() });
  if (!response.ok) throw new Error('Share unavailable');
  return (await response.json())[0] || null;
}
