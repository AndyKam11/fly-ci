// Dynamic share image (1200x630): the score, the verdict, the fly. Edge runtime, @vercel/og (satori) with plain element objects.
import { ImageResponse } from '@vercel/og';
export const config = { runtime: 'edge' };
const TITLES = ['Zero rot. Not a shitpost. The fly walked away.', 'Barely rotten. The fly sniffed it and left.', 'Mildly rotten. A polite nibble.',
  'Rotten. Proboscis extended.', 'Very rotten. The fly is feasting on this shitpost.', 'CERTIFIED SHITPOST. The fly is licking the screen.', 'BRAIN MELTDOWN. Peak self-indulgent slop.'];
const h = (type, style, children) => ({ type, props: { style, children } });
export default function handler(req) {
  const u = new URL(req.url);
  const r = Math.max(0, Math.min(100, parseInt(u.searchParams.get('r')) || 0)), t = Math.max(0, Math.min(6, parseInt(u.searchParams.get('t')) || 0)), m = parseInt(u.searchParams.get('m')) || 0;
  const color = t === 6 ? '#ff3b3b' : r < 30 ? '#ff5a5a' : '#b6ff3b';
  const face = t === 6 ? '🤯' : r < 30 ? '🪦' : '🪰';
  const tree = h('div', { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#08080d', color: '#f4f1e8', fontFamily: 'sans-serif', padding: '56px 64px', position: 'relative' }, [
    h('div', { display: 'flex', alignItems: 'baseline', fontSize: 34, fontWeight: 900, letterSpacing: 2 }, [h('span', { color: '#f4f1e8' }, 'BRAIN '), h('span', { color: '#b6ff3b' }, 'ROT')]),
    h('div', { display: 'flex', alignItems: 'center', gap: 40, marginTop: 30, flex: 1 }, [
      h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `10px solid ${color}`, color, borderRadius: 26, padding: '10px 40px 22px', transform: 'rotate(-6deg)' }, [
        h('div', { fontSize: 168, fontWeight: 900, lineHeight: 1 }, `${r}%`), h('div', { fontSize: 30, fontWeight: 900, letterSpacing: 6 }, 'BRAIN ROT')]),
      h('div', { display: 'flex', flexDirection: 'column', flex: 1, gap: 18 }, [
        h('div', { fontSize: 46, fontWeight: 900, lineHeight: 1.1 }, TITLES[t]),
        h('div', { fontSize: 26, color: '#9d9db3', lineHeight: 1.35 }, t === 6 ? 'A real fruit fly brain, 139,255 neurons, went into runaway activity reading this post.' : `Rated by a real fruit fly brain: 139,255 neurons. Tongue motor neuron MN9 fired at ${m} Hz.`)]),
      h('div', { fontSize: 150 }, face)]),
    h('div', { display: 'flex', justifyContent: 'space-between', fontSize: 26, color: '#9d9db3' }, [h('span', {}, 'The shittier the post, the more the fly loves it.'), h('span', { color: '#f4f1e8', fontWeight: 700 }, 'brainrotposts.com')]),
  ]);
  return new ImageResponse(tree, { width: 1200, height: 630, emoji: 'twemoji' });
}
