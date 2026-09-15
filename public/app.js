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
// word lists, not phrases: any inflection of any word counts (walk|walks|walked|walking)
const W = list => new RegExp('\\b(' + list.join('|') + ')(s|es|ed|ing|d)?\\b', 'gi');
const BAIT = [
  { label: 'humblebrag', w: 6, cap: 30, re: W(['humble','humbled','honou?red','grateful','gratitude','thrilled','blessed','delighted','proud','excited','thankful','overwhelmed','speechless','pinch me']) },
  { label: 'announcement', w: 6, cap: 24, re: W(['announce','announcement','big news','personal news','some news','life update','milestone','chapter','journey','new role','new position','joined','joining','launch','launched','officially','happy to share','excited to share','pleased to share']) },
  { label: 'linkedin words', w: 5, cap: 35, re: W(['hustle','grind','mindset','resilience','resilient','passion','passionate','visionary','rockstar','ninja','guru','superpower','authentic','authenticity','vulnerable','vulnerability','impact','impactful','community','network','networking','growth','scale','scaling','crush','crushing','killing it','game.?changer','synerg(y|ies)','disrupt','disruption','thought leader','thought leadership','playbook','masterclass','lesson','lessons','learnings','takeaway','takeaways','win','wins','reminder','story','stories','secret','secrets','hack','hacks','framework','blueprint','roadmap','north star','purpose','legacy','dream','dreams','believe','manifest','abundance','incredible','amazing','insane','wild','massive','huge','epic','unreal','boom','fire','goosebumps','once again','yet again']) },
  { label: 'AI vocabulary', w: 6, cap: 36, re: W(['delve','tapestry','testament','underscore','vibrant','crucial','pivotal','landscape','meticulous','intricate','intricacies','enduring','garner','bolster','interplay','boast','robust','groundbreaking','renowned','nestled','showcase','foster','cultivate','enhance','harness','seamless','cutting.?edge','ever.?evolving','realm','navigate','navigating','embark','unlock','empower','elevate','profound','invaluable','insight','insights','deep dive','resonate','align','transformative','innovative','innovation','holistic','paradigm','leverage','streamline','optimize','unleash','supercharge','revolutionize','reimagine','redefine','multifaceted','nuanced','comprehensive','dynamic','emphasize','highlight','spotlight','commitment','excellence','exemplify','encompass','fast.?paced','moving forward','at the end of the day','in today','it.?s important to note','let.?s dive in','key takeaway','in conclusion','furthermore','moreover','additionally','ultimately']) },
  { label: 'engagement bait', w: 10, cap: 30, re: /\b(agree|thoughts|am i wrong|who else|who'?s with me|what would you do)\s*\?|let that sink in|read that again|that'?s (it\.? )?that'?s the (post|tweet)|comment\s+["'“]?[\w!]+["'”]?\s+(and|&)\s+i'?ll|dm me|link in (the )?comments|repost|follow (me )?for more|save this|share this|\u{267B}|\u{1F447}/giu },
  { label: 'hot take', w: 8, cap: 16, re: /\b(unpopular opinion|hot take|controversial|nobody talks about|not gonna lie|i'?m not going to lie|here'?s the (thing|truth)|the truth is|plot twist|spoiler)\b/gi },
  { label: 'origin story', w: 8, cap: 16, re: /\b(\d+|two|three|five|ten) (years|months|days) ago\b|\bi (got|was) (rejected|fired|laid off)\b|\bi quit\b|\bfrom .{3,30} to .{3,30}\b/gi },
  { label: 'linkedin about linkedin', w: 12, cap: 12, re: /\blinkedin\b/gi },
  { label: 'mentions AI', w: 3, cap: 9, re: /\b(AI|ChatGPT|LLMs?|agents?|GPT-?\d)\b/g },
  { label: 'emoji', w: 4, cap: 20, re: /\p{Extended_Pictographic}/gu },
  { label: 'bullets', w: 3, cap: 12, re: /^\s*(→|✅|•|▪|-|–|—|\d+[.)])\s+/gmu },
  { label: 'hashtags', w: 2, cap: 10, re: /#\w+/g },
  { label: 'SHOUTING', w: 2, cap: 8, re: /\b[A-Z]{4,}\b/g },
  // structural tells (Wikipedia: Signs of AI writing)
  { label: 'em dashes', w: 4, cap: 12, re: /—|\s-\s/g },
  { label: '"not only… but also"', w: 10, cap: 10, re: /\bnot (only|just)\b[^.!?\n]{0,80}\bbut (also|it|what|the|a)\b/gi },
  { label: '"it\'s not X, it\'s Y"', w: 10, cap: 20, re: /\b(it'?s|this is|that'?s|isn'?t|it was never) (not|never)?\s*(about )?[^.!?\n]{2,60}[.,;:—-]\s*(it'?s|this is|that'?s)\b/gi },
  { label: 'curly quotes', w: 3, cap: 6, re: /[“”‘’]/g },
  { label: 'rule of three', w: 6, cap: 12, re: /\b\w+\.\s+\w+\.\s+\w+\.(\s|$)|\b\w+, \w+,? and \w+\b/g },
];
function scoreBait(text) {
  const hits = []; let total = 0;
  for (const b of BAIT) {
    const n = (text.match(b.re) || []).length; if (!n) continue;
    const pts = Math.min(b.cap, n * b.w); total += pts; hits.push({ label: b.label, n, pts });
  }
  const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length >= 4) {
    const short = lines.filter(l => l.length <= 70).length / lines.length;
    if (short > 0.6) { const pts = Math.round(short * 25); total += pts; hits.push({ label: 'one-sentence paragraphs', n: lines.length, pts }); }
  }
  // density: a short post that is nothing but sugar is still sugar
  const words = Math.max(12, text.split(/\s+/).length);
  total += Math.round(30 * Math.min(1, total / words));
  hits.sort((a, b) => b.pts - a.pts);
  return { score: Math.min(100, total), hits };
}
const rateFor = s => RATES[s < 12 ? 0 : s < 25 ? 1 : s < 40 ? 2 : s < 55 ? 3 : s < 75 ? 4 : 5];
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
    position: [34000, 19000, 3000], projectionScale: 40000, projectionOrientation: Q0,
    showAxisLines: false, showDefaultAnnotations: false, showScaleBar: false, showSlices: false,
    projectionBackgroundColor: '#07070c', layout: '3d',
    // neurons first: the viewer takes its voxel grid (16 nm) from the first layer; the brain mesh is 4096 nm
    layers: [
      { type: 'segmentation', source: SRC_NEURONS, name: 'neurons', segments: [], segmentColors: {}, pick: false, selectedAlpha: 0 },
      { type: 'segmentation', source: SRC_BRAIN, name: 'brain', segments: ['1'], segmentColors: { '1': '#7d8aa6' }, objectAlpha: 0.11, pick: false, selectedAlpha: 0 },
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
  const st = baseState(); if (ng.clientWidth < 600) st.projectionScale = 64000;   // phones: keep the whole brain in frame
  v.state.restoreState(st);
  try {
    const d = ng.contentWindow.document;
    d.addEventListener('pointerdown', () => { orbitPausedUntil = Date.now() + 15000; }, true);
    d.addEventListener('wheel', () => { orbitPausedUntil = Date.now() + 15000; }, true);
  } catch (e) {}
  setInterval(tickOrbit, 40);
}
ng.addEventListener('load', initViewer);
if (location.search.includes('og=1')) {                      // share-image mode
  document.body.classList.add('og');
  const st = document.querySelector('.stage');
  st.insertAdjacentHTML('beforeend', '<div class="ogmark">BRAIN <span>ROT</span></div><div class="ogtag">A real fruit fly brain rates your LinkedIn post.<br><b>The worse the post, the more it loves it.</b></div>');
  setTimeout(() => { document.getElementById('sample').click(); document.getElementById('feedbox').requestSubmit(); }, 4000);
}

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

const SAMPLES = [
  `I got rejected by 47 investors.\n\nThen one said yes.\n\nHere's what I learned about resilience 👇\n\n→ Rejection is redirection.\n→ Your network is your net worth.\n→ Consistency > talent. Every. Single. Time.\n\n3 years ago I was sleeping on a couch. Today we're a team of 12.\n\nNot because I'm special. Because I didn't quit.\n\nLet that sink in.\n\nHumbled to announce we just closed our Series A 🚀\n\nAgree? Repost ♻️ to help someone who needs this today.\n\n#founders #startups #mindset #AI`,
  `Humbled to announce I've updated my LinkedIn profile once again. 🙏\n\nThis journey hasn't been easy. But I couldn't have done it without every single one of you.\n\nHere's to the next chapter 🚀\n\n#grateful #newbeginnings`,
  `Nobody talks about this.\n\nAI won't replace you.\n\nA person using AI will.\n\nHere's the playbook I use every day 👇\n\n1. ChatGPT for drafts\n2. Agents for research\n3. Automation for the rest\n\nComment "AI" and I'll DM you my full stack.\n\n#AI #productivity #futureofwork`,
  `Unpopular opinion: your degree doesn't matter.\n\nI hired 30 people last year.\n\nNot one of them because of their school.\n\nWhat mattered:\n✅ Curiosity\n✅ Ownership\n✅ Speed\n\nSkills > credentials. Let that sink in.\n\nAgree? ♻️ Repost to help a student who needs this.`,
];
let sampleIdx = 0;
$('sample').addEventListener('click', () => {
  post.value = SAMPLES[sampleIdx++ % SAMPLES.length]; softReset(); post.focus();
});
// clear the last verdict when the post changes, so the box is always ready for another one
function softReset() {
  $('stamp').hidden = true; $('verdict').hidden = true;
  fly('idle'); setSegments([]); phase.textContent = '139,255 neurons · idle'; dot.classList.remove('live'); meter.style.transform = 'scaleX(0)';
}
post.addEventListener('input', () => { if (!busy && !$('stamp').hidden) softReset(); });
$('again').addEventListener('click', () => {
  softReset(); post.value = ''; post.focus(); window.scrollTo({ top: 0, behavior: 'smooth' });
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
  // real runs at this sugar level, middle half by MN9 rate: the fly is noisy, the outliers are not the joke
  const sorted = RUNS.filter(r => r.rate === rate).sort((a, b) => a.mn9 - b.mn9);
  const bucket = sorted.slice(Math.floor(sorted.length * .25), Math.ceil(sorted.length * .75));
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

  busy = false; go.disabled = false; go.textContent = 'Feed it another';
  $('feedbox').classList.remove('fed');
}
$('feedbox').addEventListener('submit', feed);
post.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') feed(e); });
})();
