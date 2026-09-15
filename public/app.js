/* Brain Rot — a fruit fly brain rates your LinkedIn post. The worse the post, the more it loves it.
   post → engagement-bait score → sugar intensity → a real whole-brain simulation run
   (precomputed; Shiu et al. 2024 model on the FlyWire v783 connectome) → MN9 proboscis rate → verdict.
   The 3D view is self-hosted Neuroglancer showing the neurons that actually fired, in spike order. */
(() => {
const RATES = [60, 90, 120, 150, 180, 220];
const MN9 = '720575940660219265';
const N_NEURONS = 139255;
const SRC_NEURONS = 'precomputed://gs://flywire_v141_m783';
const SRC_BRAIN = 'precomputed://gs://flywire_neuropil_meshes/whole_neuropil/brain_mesh_v141.surf';
const SUGAR = '#ffcc33', LIT_A = [255, 204, 51], LIT_B = [255, 74, 54], DIM = '#15151f', WHITE = '#ffffff';

// ---------- engagement bait = sugar ----------
const BAIT = [
  { label: 'humblebrag',            w: 10, cap: 20, re: /\b(humbled|honou?red|grateful|thrilled|blessed|excited to (announce|share))\b/gi },
  { label: '"let that sink in"',    w: 15, cap: 15, re: /let that sink in/gi },
  { label: 'engagement question',   w: 8,  cap: 16, re: /\b(agree|thoughts|what'?s your take|am i wrong|who else|who'?s with me|what would you do)\s*\?/gi },
  { label: 'new chapter',           w: 8,  cap: 16, re: /\b(next chapter|new chapter|this journey|new role|joined .{0,40}\bas\b|the power of|couldn'?t be more (excited|proud))\b/gi },
  { label: 'emoji',                 w: 4,  cap: 20, re: /[\u{1F680}\u{1F525}\u{1F4A1}\u{2705}\u{1F447}\u{1F64F}\u{1F4AA}\u{1F3AF}\u{26A1}\u{1F48E}\u{1F440}\u{1F9E0}]/gu },
  { label: 'comment-to-unlock',     w: 12, cap: 24, re: /comment\s+["'“]?[\w!]+["'”]?\s+(and|&)\s+i'?ll|dm me|link in (the )?comments/gi },
  { label: 'hot take',              w: 8,  cap: 16, re: /\b(unpopular opinion|hot take|controversial|nobody talks about|not gonna lie|i'?m not going to lie|here'?s the (thing|truth)|the truth is|read that again)\b/gi },
  { label: 'repost bait',           w: 8,  cap: 16, re: /\b(repost|follow (me )?for more|save this|share this)\b|\u{267B}/giu },
  { label: 'origin story',          w: 8,  cap: 16, re: /\b(\d+|two|three|five|ten) (years|months|days) ago\b|\bi (got|was) (rejected|fired|laid off)\b|\bi quit\b/gi },
  { label: 'buzzwords',             w: 4,  cap: 16, re: /\b(game.?changer|10x|masterclass|playbook|lessons? learned|this is the way|mindset|hustle|grind|synerg(y|ies)|thought leader|disrupt|north star|move the needle)\b/gi },
  { label: 'mentions AI',           w: 3,  cap: 9,  re: /\b(AI|ChatGPT|LLMs?|agents?|GPT-?\d)\b/g },
  { label: 'bullets',               w: 3,  cap: 12, re: /^\s*(→|✅|•|▪|-|–|—|\d+[.)])\s+/gmu },
  { label: 'hashtags',              w: 2,  cap: 10, re: /#\w+/g },
  { label: 'SHOUTING',              w: 2,  cap: 8,  re: /\b[A-Z]{4,}\b/g },
  { label: '"that\'s the post"',    w: 10, cap: 10, re: /that'?s (it\.? )?that'?s the (post|tweet)/gi },
];
function scoreBait(text) {
  const hits = []; let total = 0;
  for (const b of BAIT) {
    const n = (text.match(b.re) || []).length; if (!n) continue;
    const pts = Math.min(b.cap, n * b.w); total += pts; hits.push({ label: b.label, n, pts });
  }
  const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length >= 5) {
    const short = lines.filter(l => l.length <= 70).length / lines.length;
    if (short > 0.6) { const pts = Math.round(short * 25); total += pts; hits.push({ label: 'one-sentence paragraphs', n: lines.length, pts }); }
  }
  hits.sort((a, b) => b.pts - a.pts);
  return { score: Math.min(100, total), hits };
}
const rateFor = s => RATES[s < 8 ? 0 : s < 20 ? 1 : s < 35 ? 2 : s < 50 ? 3 : s < 70 ? 4 : 5];
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }

// ---------- verdicts: mn9 Hz → [title, fly state, bubble] ----------
function verdictFor(mn9) {
  if (mn9 === 0)  return ['Zero rot. The fly walked away. Too much substance.',          'dead',  'ew. substance.'];
  if (mn9 < 10)   return ['Barely rotten. The fly sniffed it and left.',                  'gone',  'meh.'];
  if (mn9 < 25)   return ['Mildly rotten. A polite nibble.',                              'meh',   'hm. a little sugar.'];
  if (mn9 < 45)   return ['Rotten. Proboscis extended.',                                  'love',  'ooh. SUGAR.'];
  if (mn9 < 65)   return ['Very rotten. The fly is feasting.',                            'love',  'NOM NOM NOM'];
  return              ['CERTIFIED BRAIN ROT. The fly is licking the screen.',            'love',  'SUGARRRR 🤤'];
}
const rotScore = mn9 => Math.min(100, Math.round(mn9 * 1.25));

// ---------- neuroglancer control (same-origin iframe) ----------
const ng = document.getElementById('ng');
const V = () => { try { return ng.contentWindow && ng.contentWindow.viewer; } catch (e) { return null; } };
const Q0 = norm([-0.22, 0.05, 0.02, 0.97]);
function norm(q) { const l = Math.hypot(...q); return q.map(x => x / l); }
function qmul(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx, aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz];
}
function baseState() {
  return {
    dimensions: { x: [1.6e-8, 'm'], y: [1.6e-8, 'm'], z: [4e-8, 'm'] },
    position: [34000, 19000, 3000], projectionScale: 50000, projectionOrientation: Q0,
    showAxisLines: false, showDefaultAnnotations: false, showScaleBar: false, showSlices: false,
    projectionBackgroundColor: '#07070c', layout: '3d',
    // neurons first: the viewer takes its voxel grid (16 nm) from the first layer; the brain mesh is 4096 nm
    layers: [
      { type: 'segmentation', source: SRC_NEURONS, name: 'neurons', segments: [], segmentColors: {}, pick: false, selectedAlpha: 0 },
      { type: 'segmentation', source: SRC_BRAIN, name: 'brain', segments: ['1'], segmentColors: { '1': '#7d8aa6' }, objectAlpha: 0.07, pick: false, selectedAlpha: 0 },
    ],
  };
}
// direct display-state writes: a state round-trip re-interprets position/scale, layer.restoreState restarts streaming
const pack = hex => BigInt(parseInt(hex.slice(1, 3), 16) | (parseInt(hex.slice(3, 5), 16) << 8) | (parseInt(hex.slice(5, 7), 16) << 16));
function neuronsLayer() { const v = V(); const m = v && v.layerManager.getLayerByName('neurons'); return m && m.layer; }
function setSegments(ids) {
  const L = neuronsLayer(); if (!L) return;
  const vis = L.displayState.segmentationGroupState.value.visibleSegments;
  vis.clear(); ids.forEach(id => vis.add(BigInt(id)));
}
function setColors(colors) {
  const L = neuronsLayer(); if (!L) return;
  const map = L.displayState.segmentationColorGroupState.value.segmentStatedColors;
  for (const id in colors) { const k = BigInt(id); map.delete(k); map.set(k, pack(colors[id])); }
}
let orbitAngle = 0, orbitPausedUntil = 0;
function tickOrbit() {
  const v = V(); if (!v || Date.now() < orbitPausedUntil) return;
  orbitAngle += 0.004;
  const q = qmul([0, Math.sin(orbitAngle / 2), 0, Math.cos(orbitAngle / 2)], Q0);
  const o = v.perspectiveNavigationState.pose.orientation;
  o.orientation.set(q); o.changed.dispatch();
}
function initViewer() {
  const v = V();
  if (!v || !v.state) { setTimeout(initViewer, 150); return; }
  v.state.restoreState(baseState());
  try {
    const d = ng.contentWindow.document;
    d.addEventListener('pointerdown', () => { orbitPausedUntil = Date.now() + 15000; }, true);
    d.addEventListener('wheel', () => { orbitPausedUntil = Date.now() + 15000; }, true);
  } catch (e) {}
  setInterval(tickOrbit, 40);
}
ng.addEventListener('load', initViewer);

// ---------- the fly ----------
const flychar = document.getElementById('flychar'), bubble = document.getElementById('bubble'), fx = document.getElementById('fx');
function fly(state, say) {
  flychar.dataset.state = state;
  if (say) { bubble.textContent = say; bubble.hidden = false; } else bubble.hidden = true;
}
function burst(chars, n = 10) {
  fx.replaceChildren();
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span'); s.textContent = chars[i % chars.length];
    const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 70;
    s.style.setProperty('--dx', `${Math.cos(a) * r}px`); s.style.setProperty('--dy', `${Math.sin(a) * r - 30}px`);
    s.style.animationDelay = `${Math.random() * .3}s`; fx.appendChild(s);
  }
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
const post = $('post'), go = $('go'), phase = $('phase'), dot = document.querySelector('.dot'), meter = $('meterfill');
let RUNS = null, busy = false;
fetch('runs.json').then(r => r.json()).then(r => { RUNS = r; }).catch(() => { phase.textContent = 'could not load the brain'; });
fetch('/api/rate').then(r => r.ok ? r.json() : null).then(d => { if (d && d.count) $('count').textContent = `${d.count.toLocaleString()} posts fed to the fly so far`; }).catch(() => {});

$('sample').addEventListener('click', () => {
  post.value = `I got rejected by 47 investors.\n\nThen one said yes.\n\nHere's what I learned about resilience 👇\n\n→ Rejection is redirection.\n→ Your network is your net worth.\n→ Consistency > talent. Every. Single. Time.\n\n3 years ago I was sleeping on a couch. Today we're a team of 12.\n\nNot because I'm special. Because I didn't quit.\n\nLet that sink in.\n\nHumbled to announce we just closed our Series A 🚀\n\nAgree? Repost ♻️ to help someone who needs this today.\n\n#founders #startups #mindset #AI`;
  post.focus();
});
$('again').addEventListener('click', () => {
  $('feedbox').classList.remove('fed'); $('stamp').hidden = true; $('verdict').hidden = true;
  fly('idle'); setSegments([]); phase.textContent = '139,255 neurons · idle'; dot.classList.remove('live'); meter.style.transform = 'scaleX(0)';
  post.value = ''; post.focus(); window.scrollTo({ top: 0, behavior: 'smooth' });
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const hex = (a, b, t) => '#' + [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0')).join('');

async function feed(e) {
  if (e) e.preventDefault();
  const text = post.value.trim();
  if (!text) { post.focus(); return; }
  if (busy || !RUNS || !neuronsLayer()) return;
  busy = true; go.disabled = true; $('verdict').hidden = true; $('stamp').hidden = true;
  const bait = scoreBait(text);
  const rate = rateFor(bait.score);
  const bucket = RUNS.filter(r => r.rate === rate);
  const run = bucket[fnv(text.toLowerCase().replace(/\s+/g, ' ')) % bucket.length];
  const seq = run.seq.slice().sort((a, b) => a[0] - b[0]);
  const all = [...new Set([...run.stim, ...seq.map(s => s[1]), ...(run.mn9 > 0 ? [MN9] : [])])];
  const colors = {}; all.forEach(id => colors[id] = DIM);

  $('feedbox').classList.add('fed');
  dot.classList.add('live'); meter.style.transform = 'scaleX(0)';
  phase.textContent = 'landing on your post…';
  fly('landing');
  setColors(colors); setSegments(all);                       // meshes start streaming, nearly invisible
  await sleep(1300);

  phase.textContent = `tasting… ${run.stim.length} sugar neurons @ ${rate} Hz`;
  fly('tasting', '*tastes*');
  for (let i = 0; i < 4; i++) {                             // sugar neurons pulse
    const c = {}; run.stim.forEach(id => c[id] = i % 2 ? '#8a6d16' : SUGAR); setColors(c); await sleep(260);
  }
  { const c = {}; run.stim.forEach(id => c[id] = SUGAR); setColors(c); }
  await sleep(300);

  phase.textContent = 'signal propagating through 139,255 neurons…';
  fly('watching');
  const DUR = 6000, t0 = performance.now(); let i = 0, lit = new Set();
  while (i < seq.length) {
    const ms = Math.min(1000, (performance.now() - t0) / DUR * 1000);
    const c = {};
    while (i < seq.length && seq[i][0] <= ms) {
      const id = seq[i][1];
      if (!run.stim.includes(id) && id !== MN9) { c[id] = hex(LIT_A, LIT_B, i / seq.length); lit.add(id); }
      i++;
    }
    if (Object.keys(c).length) setColors(c);
    meter.style.transform = `scaleX(${ms / 1000})`;
    phase.textContent = `${lit.size} neurons lit · ${Math.round(ms)} ms of brain time`;
    await sleep(90);
  }
  meter.style.transform = 'scaleX(1)';
  const [title, state, say] = verdictFor(run.mn9);
  if (run.mn9 > 0) {
    phase.textContent = `PROBOSCIS EXTENSION · MN9 firing at ${run.mn9} Hz`;
    for (let k = 0; k < 4; k++) { setColors({ [MN9]: k % 2 ? '#ffe9a8' : WHITE }); await sleep(180); }
    setColors({ [MN9]: WHITE });
  } else {
    phase.textContent = 'no proboscis extension. the fly is unmoved.';
  }
  fly(state, say);
  if (state === 'love') burst(['🍬', '🍭', '💛', '🍯'], 12);
  if (state === 'dead') burst(['💀'], 3);

  // ---------- verdict ----------
  const rot = rotScore(run.mn9), pct = (run.active / N_NEURONS * 100).toFixed(2);
  $('score').textContent = rot; $('stamp').classList.toggle('low', rot < 30); $('stamp').hidden = false;
  $('v-title').textContent = title;
  const tasted = bait.hits.length ? bait.hits.slice(0, 5).map(h => h.label + (h.n > 1 ? ' ×' + h.n : '')).join(', ') : 'no sugar at all';
  const nm = (run.named || []).slice(0, 6).join(', ');
  $('tele').innerHTML = `MN9 <em>${run.mn9} Hz</em> · <em>${pct}%</em> of the brain lit up · ${run.spikes.toLocaleString()} spikes in 1 s · sugar ${rate} Hz<br>tasted: ${tasted}${nm ? `<br>reviewed by neurons ${nm}` : ''}`;
  const site = location.origin + location.pathname;
  const copyText = `🪰 BRAIN ROT: ${rot}% — ${title}\n\nI fed my LinkedIn post to a simulated fruit fly brain (139,255 real neurons). The tongue motor neuron fired at ${run.mn9} Hz. The worse the post, the more the fly loves it.\n\n${site}`;
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText(copyText); $('copy').textContent = 'Copied!'; setTimeout(() => $('copy').textContent = 'Copy verdict', 1500); } catch (e) { prompt('Copy this:', copyText); } };
  $('share').href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(site);
  const ngState = { layers: [{ type: 'segmentation', source: SRC_NEURONS, segments: all, segmentColors: colors, name: 'neurons that judged your post' },
                             { type: 'segmentation', source: SRC_BRAIN, segments: ['1'], objectAlpha: 0.08, name: 'brain' }],
                    dimensions: { x: [1.6e-8, 'm'], y: [1.6e-8, 'm'], z: [4e-8, 'm'] }, position: [34000, 19000, 3000], projectionScale: 50000, layout: '3d', showSlices: false };
  $('ng-link').href = 'https://neuroglancer-demo.appspot.com/#!' + encodeURIComponent(JSON.stringify(ngState));
  $('verdict').hidden = false;

  fetch('/api/rate', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ post: text, bait_score: bait.score, bait: bait.hits.map(h => h.label), rate, run: run.k, mn9: run.mn9, fly_score: rot }) })
    .then(r => r.ok ? r.json() : null).then(d => { if (d && d.count) $('count').textContent = `${d.count.toLocaleString()} posts fed to the fly so far`; }).catch(() => {});

  busy = false; go.disabled = false;
}
$('feedbox').addEventListener('submit', feed);
post.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') feed(e); });
})();
