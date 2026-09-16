/* Brain Rot — a fruit fly brain rates your LinkedIn post. The more rotten the post, the more it loves it.
   post → five sensory channels (sugar, bitter, smell, sound, sight) → a real whole-brain simulation run at those
   stimulation levels (precomputed; Shiu et al. 2024 model, FlyWire v783 connectome, 139,255 neurons)
   → MN9 proboscis motor neuron rate → verdict. The 3D view is self-hosted Neuroglancer: real neurons, spike order. */
(() => {
const MN9 = '720575940660219265';
const N_NEURONS = 139255;
const SRC_NEURONS = 'precomputed://gs://flywire_v141_m783';
const SRC_BRAIN = 'precomputed://gs://flywire_neuropil_meshes/whole_neuropil/brain_mesh_v141.surf';
const SUGAR_L = [0, 60, 90, 120, 150, 180, 220], BITTER_L = [0, 60, 120, 200];
const MELTDOWN = 3000;                         // active neurons above this = the model's runaway state
const DIM = '#15151f', WHITE = '#ffffff';
const ATTR = { s: '#ffcc33', b: '#c56bff', m: '#5dff9a', o: '#5ab8ff', v: '#e8f4ff', x: '#ff9a3d', '?': '#ff6a3d' };   // cascade colour by sense that owns the neuron
const ATTR_NAME = { s: 'sugar', b: 'bitter', m: 'smell', o: 'hearing', v: 'sight', x: 'mixed', '?': 'other' };
const CH = {                                   // channel → sensor colour, icon, name, science
  sugar:  { c: '#ffcc33', icon: '🍬', name: 'Taste (sugar)',  what: 'sugar-sensing neurons on the fly\'s tongue and legs', why: 'Engagement bait is sugar. Sugar neurons → brain → MN9, the motor neuron that extends the proboscis. Validated in the paper.' },
  bitter: { c: '#c56bff', icon: '🧪', name: 'Taste (bitter)', what: 'bitter-sensing neurons', why: 'Substance is bitter. Bitter input suppresses sugar-evoked proboscis extension — also validated in the paper. Good posts make the fly recoil.' },
  smell:  { c: '#5dff9a', icon: '👃', name: 'Smell',          what: 'olfactory receptor neurons in the antennae', why: 'AI vocabulary and AI sentence structure go in through the nose. The olfactory pathway in this model is a hair-trigger: a strong whiff can tip the whole brain into a runaway state.' },
  sound:  { c: '#5ab8ff', icon: '👂', name: 'Hearing',        what: 'auditory neurons of the Johnston\'s organ', why: 'SHOUTING and exclamation marks are vibration. The fly hears with its antennae.' },
  sight:  { c: '#e8f4ff', icon: '👁', name: 'Sight',          what: 'photoreceptors', why: 'Emoji, bullets and formatting are light. The fly saw your post. It did not read it.' },
};

// ---------- the post → what the fly senses ----------
const W = list => new RegExp('\\b(' + list.join('|') + ')(s|es|ed|ing|d)?\\b', 'gi');
const BAIT = [
  { ch: 'sugar', label: 'humblebrag', w: 6, cap: 30, re: W(['humble','humbled','honou?red','grateful','gratitude','thrilled','blessed','delighted','proud','excited','thankful','overwhelmed','speechless','pinch me']) },
  { ch: 'sugar', label: 'announcement', w: 6, cap: 24, re: W(['announce','announcement','big news','personal news','some news','life update','milestone','chapter','journey','new role','new position','joined','joining','launch','launched','officially','happy to share','excited to share','pleased to share']) },
  { ch: 'sugar', label: 'linkedin words', w: 5, cap: 35, re: W(['hustle','grind','mindset','resilience','resilient','passion','passionate','visionary','rockstar','ninja','guru','superpower','authentic','authenticity','vulnerable','vulnerability','impact','impactful','community','network','networking','growth','scale','scaling','crush','crushing','killing it','game.?changer','synerg(y|ies)','disrupt','disruption','thought leader','thought leadership','playbook','masterclass','lesson','lessons','learnings','takeaway','takeaways','win','wins','reminder','story','stories','secret','secrets','hack','hacks','framework','blueprint','roadmap','north star','purpose','legacy','dream','dreams','believe','manifest','abundance','incredible','amazing','insane','wild','massive','huge','epic','unreal','boom','fire','goosebumps','once again','yet again']) },
  { ch: 'sugar', label: 'engagement bait', w: 10, cap: 30, re: /\b(agree|thoughts|am i wrong|who else|who'?s with me|what would you do)\s*\?|let that sink in|read that again|that'?s (it\.? )?that'?s the (post|tweet)|comment\s+["'“]?[\w!]+["'”]?\s+(and|&)\s+i'?ll|dm me|link in (the )?comments|repost|follow (me )?for more|save this|share this|\u{267B}|\u{1F447}/giu },
  { ch: 'sugar', label: 'hot take', w: 8, cap: 16, re: /\b(unpopular opinion|hot take|controversial|nobody talks about|not gonna lie|i'?m not going to lie|here'?s the (thing|truth)|the truth is|plot twist|spoiler)\b/gi },
  { ch: 'sugar', label: 'origin story', w: 8, cap: 16, re: /\b(\d+|two|three|five|ten) (years|months|days) ago\b|\bi (got|was) (rejected|fired|laid off)\b|\bi quit\b|\bfrom .{3,30} to .{3,30}\b/gi },
  { ch: 'sugar', label: 'linkedin about linkedin', w: 12, cap: 12, re: /\blinkedin\b/gi },
  { ch: 'sugar', label: 'hashtags', w: 2, cap: 10, re: /#\w+/g },
  { ch: 'smell', label: 'AI vocabulary', w: 6, cap: 36, re: W(['delve','tapestry','testament','underscore','vibrant','crucial','pivotal','landscape','meticulous','intricate','intricacies','enduring','garner','bolster','interplay','boast','robust','groundbreaking','renowned','nestled','showcase','foster','cultivate','enhance','harness','seamless','cutting.?edge','ever.?evolving','realm','navigate','navigating','embark','unlock','empower','elevate','profound','invaluable','insight','insights','deep dive','resonate','align','transformative','innovative','innovation','holistic','paradigm','leverage','streamline','optimize','unleash','supercharge','revolutionize','reimagine','redefine','multifaceted','nuanced','comprehensive','dynamic','emphasize','highlight','spotlight','commitment','excellence','exemplify','encompass','fast.?paced','moving forward','at the end of the day','in today','it.?s important to note','let.?s dive in','key takeaway','in conclusion','furthermore','moreover','additionally','ultimately']) },
  { ch: 'smell', label: 'mentions AI', w: 3, cap: 9, re: /\b(AI|ChatGPT|LLMs?|agents?|GPT-?\d)\b/g },
  { ch: 'smell', label: 'em dashes', w: 4, cap: 12, re: /—|\s-\s/g },
  { ch: 'smell', label: '"not only… but also"', w: 10, cap: 10, re: /\bnot (only|just)\b[^.!?\n]{0,80}\bbut (also|it|what|the|a)\b/gi },
  { ch: 'smell', label: '"it\'s not X, it\'s Y"', w: 10, cap: 20, re: /\b(it'?s|this is|that'?s|isn'?t|it was never) (not|never)?\s*(about )?[^.!?\n]{2,60}[.,;:—-]\s*(it'?s|this is|that'?s)\b/gi },
  { ch: 'smell', label: 'rule of three', w: 3, cap: 6, re: /\b\w+\.\s+\w+\.\s+\w+\.(\s|$)|\b\w+, \w+,? and \w+\b/g },
  { ch: 'sound', label: 'SHOUTING', w: 3, cap: 12, re: /\b[A-Z]{4,}\b/g },
  { ch: 'sound', label: 'exclamation marks', w: 2, cap: 12, re: /!/g },
  { ch: 'sound', label: 'noise words', w: 4, cap: 8, re: /\b(boom|let'?s go+|wow|omg|woah|whoa|yes+)\b/gi },
  { ch: 'sight', label: 'emoji', w: 4, cap: 20, re: /\p{Extended_Pictographic}/gu },
  { ch: 'sight', label: 'bullets', w: 3, cap: 12, re: /^\s*(→|✅|•|▪|-|–|—|\d+[.)])\s+/gmu },
  { ch: 'sight', label: 'arrows & ticks', w: 2, cap: 8, re: /[→↳✓✔︎★☆]/gu },
  { ch: 'bitter', label: 'numbers with units', w: 3, cap: 12, re: /\b\d[\d,.]*\s?(%|k|m|x|days?|weeks?|months?|years?|hours?|customers?|users?|people|deals?|calls?|emails?|€|\$|usd|eur)\b|[$€£]\s?\d/gi },
  { ch: 'bitter', label: 'reasoning', w: 2, cap: 12, re: /\b(because|however|instead|although|whereas|in practice|turns out|the catch|trade.?off|the problem was|what actually)\b/gi },
  { ch: 'bitter', label: 'specifics', w: 3, cap: 12, re: /\b(postgres|sql|api|q[1-4]|churn|arr|mrr|cac|nps|p&l|gross margin|term sheet|clause|termination|rev share|rfp|soc ?2|gdpr|kubernetes|latency|onboarding flow)\b/gi },
];
function sense(text) {
  const pts = { sugar: 0, bitter: 0, smell: 0, sound: 0, sight: 0 }, hits = { sugar: [], bitter: [], smell: [], sound: [], sight: [] };
  for (const b of BAIT) {
    const n = (text.match(b.re) || []).length; if (!n) continue;
    const p = Math.min(b.cap, n * b.w); pts[b.ch] += p; hits[b.ch].push({ label: b.label, n, pts: p });
  }
  const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length >= 4) {
    const short = lines.filter(l => l.length <= 70).length / lines.length;
    if (short > 0.6) { const p = Math.round(short * 25); pts.sugar += p; hits.sugar.push({ label: 'one-sentence paragraphs', n: lines.length, pts: p }); }
  }
  // substance: long sentences and real paragraphs are bitter
  const sentences = text.split(/[.!?]+\s/).map(s => s.trim().split(/\s+/).length).filter(n => n > 2);
  const longS = sentences.filter(n => n >= 18).length;
  if (longS) { const p = Math.min(16, longS * 4); pts.bitter += p; hits.bitter.push({ label: 'long sentences', n: longS, pts: p }); }
  const paras = text.split(/\n\s*\n/).filter(p => (p.match(/[.!?]/g) || []).length >= 3).length;
  if (paras) { const p = Math.min(12, paras * 4); pts.bitter += p; hits.bitter.push({ label: 'actual paragraphs', n: paras, pts: p }); }
  if (pts.sugar === 0 && text.split(/\s+/).length > 30) { pts.bitter += 10; hits.bitter.push({ label: 'no sugar at all', n: 1, pts: 10 }); }
  // density: a short post that is nothing but sugar is still sugar
  const words = Math.max(12, text.split(/\s+/).length);
  pts.sugar += Math.round(30 * Math.min(1, pts.sugar / words));
  for (const k in hits) hits[k].sort((a, b) => b.pts - a.pts);
  const s = pts.sugar, b = pts.bitter;
  const levels = {
    sugar:  s < 1 ? 0 : s < 12 ? 1 : s < 25 ? 2 : s < 40 ? 3 : s < 55 ? 4 : s < 75 ? 5 : 6,
    // bitter is a hard veto in the model, so substance only counts when it outweighs the sugar
    bitter: (b < 24 || b < s) ? 0 : b < 40 ? 1 : b < 60 ? 2 : 3,
    smell:  pts.smell < 6 ? 0 : pts.smell < 22 ? 1 : 2,
    sound:  pts.sound >= 6 ? 1 : 0,
    sight:  pts.sight >= 6 ? 1 : 0,
  };
  if (!Object.values(levels).some(Boolean)) levels.sugar = 1;   // the fly at least licks it
  return { pts, hits, levels };
}
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }

// ---------- runs: one file per sugar level, loaded on demand ----------
const RUNS = {};
async function runsFor(sugarLevel) {
  if (!RUNS[sugarLevel]) RUNS[sugarLevel] = fetch(`runs/S${sugarLevel}.json`).then(r => r.json());
  return RUNS[sugarLevel];
}
async function pickRun(text) {
  const s = sense(text);
  const runs = await runsFor(s.levels.sugar);
  const L = s.levels, wantMelt = L.smell === 2;
  const match = (r, bitter) => r.levels.bitter === bitter && r.levels.smell === L.smell && r.levels.sound === L.sound && r.levels.sight === L.sight;
  let cands = runs.filter(r => match(r, L.bitter) && ((r.n_active > MELTDOWN) === wantMelt));
  if (!cands.length) for (const b of [L.bitter - 1, L.bitter + 1, L.bitter - 2, L.bitter + 2]) {    // nearest bitter level with a sane run
    cands = runs.filter(r => match(r, b) && (r.n_active > MELTDOWN) === wantMelt); if (cands.length) break; }
  if (!cands.length) cands = runs.filter(r => match(r, L.bitter));
  const run = cands[fnv(text.toLowerCase().replace(/\s+/g, ' ')) % cands.length];
  const seq = run.seq.slice().sort((a, b) => a[0] - b[0]);
  const stimAll = Object.values(run.stim).flat();
  const all = [...new Set([...stimAll, ...seq.map(x => x[1]), ...(run.mn9 > 0 ? [MN9] : [])])];
  return { ...s, run, seq, all };
}

// ---------- verdicts: run → [title, fly state, bubble] ----------
// Rot is a game score: the simulated response is capped by sustained, varied slop.
// Repeating a small vocabulary cannot manufacture the length needed for a top score.
function rotScore(run, text) {
  const { hits } = sense(text);
  const words = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) || [];
  const effectiveWords = Math.min(words.length, new Set(words).size * 2.5);
  const lengthCap = effectiveWords < 25 ? 25 : effectiveWords < 60 ? 40 : effectiveWords < 100 ? 65 : effectiveWords < 140 ? 85 : effectiveWords < 180 ? 95 : 100;
  const patterns = new Set([...hits.sugar, ...hits.smell].map(h => h.label)).size;
  const patternCap = Math.min(100, 20 + patterns * 16);
  const response = run.n_active > MELTDOWN ? 100 : Math.min(100, Math.round(run.mn9 * 1.25));
  const sensesCount = Object.keys(CH).filter(ch => run.stim[ch]?.length).length;
  const sensesCap = [0, 65, 79, 89, 95, 100][sensesCount];
  return Math.min(response, lengthCap, patternCap, sensesCap);
}
const tierOf = (run, score) => score === 100 && run.n_active > MELTDOWN ? 6 : score === 0 ? 0 : score < 20 ? 1 : score < 40 ? 2 : score < 65 ? 3 : score < 90 ? 4 : 5;
function verdictFor(run, score) {
  return [
    ['Zero rot. All substance. The fly walked away.', 'dead', 'ew. substance.'],
    ['Barely rotten. The fly sniffed it and left.', 'gone', 'meh. not rotten enough.'],
    ['Mildly rotten. A polite nibble.', 'meh', 'hm. a little sugar.'],
    ['Rotten. Proboscis extended.', 'love', 'ooh. SUGAR.'],
    ['Very rotten. The fly is feasting on this post.', 'love', 'NOM NOM NOM'],
    ['CERTIFIED BRAIN ROT. The fly is licking the screen.', 'love', 'SUGARRRR 🤤'],
    ['BRAIN MELTDOWN. Peak self-indulgent slop.', 'melt', '🤯 what IS this'],
  ][tierOf(run, score)];
}

// ---------- neuroglancer control (same-origin iframe) ----------
const ng = document.getElementById('ng');
const V = () => { try { return ng.contentWindow && ng.contentWindow.viewer; } catch (e) { return null; } };
const Q0 = norm([-0.22, 0.05, 0.02, 0.97]);
function norm(q) { const l = Math.hypot(...q); return q.map(x => x / l); }
function qmul(a, b) { const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx, aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz]; }
function baseState() {
  return {
    dimensions: { x: [1.6e-8, 'm'], y: [1.6e-8, 'm'], z: [4e-8, 'm'] },
    position: [34000, 19000, 3000], projectionScale: 50000, projectionOrientation: Q0,
    showAxisLines: false, showDefaultAnnotations: false, showScaleBar: false, showSlices: false,
    projectionBackgroundColor: '#07070c', layout: '3d',
    // neurons first: the viewer takes its voxel grid (16 nm) from the first layer; the brain mesh is 4096 nm
    layers: [
      { type: 'segmentation', source: SRC_NEURONS, name: 'neurons', segments: [], segmentColors: {}, pick: false, selectedAlpha: 0 },
      { type: 'segmentation', source: SRC_BRAIN, name: 'brain', segments: ['1'], segmentColors: { '1': '#7d8aa6' }, objectAlpha: 0.2, pick: false, selectedAlpha: 0 },
    ],
  };
}
// direct display-state writes: a state round-trip re-interprets position/scale, layer.restoreState restarts streaming
const pack = hex => BigInt(parseInt(hex.slice(1, 3), 16) | (parseInt(hex.slice(3, 5), 16) << 8) | (parseInt(hex.slice(5, 7), 16) << 16));
function neuronsLayer() { const v = V(); const m = v && v.layerManager.getLayerByName('neurons'); return m && m.layer; }
function setSegments(ids) { const L = neuronsLayer(); if (!L) return; const vis = L.displayState.segmentationGroupState.value.visibleSegments; vis.clear(); ids.forEach(id => vis.add(BigInt(id))); }
function setColors(colors) { const L = neuronsLayer(); if (!L) return; const map = L.displayState.segmentationColorGroupState.value.segmentStatedColors; for (const id in colors) { const k = BigInt(id); map.delete(k); map.set(k, pack(colors[id])); } }
let orbitAngle = 0, orbitPausedUntil = 0, orbitSpeed = 0.004;
function tickOrbit() {
  const v = V(); if (!v || Date.now() < orbitPausedUntil || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  orbitAngle += orbitSpeed;
  const sway = Math.sin(orbitAngle) * 0.3;
  const q = qmul([0, Math.sin(sway / 2), 0, Math.cos(sway / 2)], Q0);
  const o = v.perspectiveNavigationState.pose.orientation; o.orientation.set(q); o.changed.dispatch();
}
let initializedViewer = null, orbitTimer;
function initViewer() {
  const v = V(); if (!v || !v.state) { setTimeout(initViewer, 150); return; }
  if (initializedViewer === v) return;
  initializedViewer = v;
  const st = baseState(); if (ng.clientWidth < 600) st.projectionScale = 82000;   // phones: keep the whole brain in frame
  v.state.restoreState(st);
  try { const d = ng.contentWindow.document;
    d.addEventListener('pointerdown', () => { orbitPausedUntil = Date.now() + 15000; }, true);
    d.addEventListener('wheel', () => { orbitPausedUntil = Date.now() + 15000; }, true); } catch (e) {}
  clearInterval(orbitTimer); orbitTimer = setInterval(tickOrbit, 40);
}
ng.addEventListener('load', initViewer);
initViewer(); // The cached iframe may have loaded before this script attached its listener.
if (location.search.includes('og=1')) {                      // share-image mode
  document.body.classList.add('og');
  document.querySelector('.stage').insertAdjacentHTML('beforeend', '<div class="ogmark">BRAIN <span>ROT</span></div><div class="ogtag">A real fruit fly brain rates your LinkedIn post.<br><b>The more rotten the post, the more it loves it.</b></div>');
  setTimeout(() => { document.getElementById('sample').click(); document.getElementById('feedbox').requestSubmit(); }, 4000);
}

// ---------- the fly ----------
const flychar = document.getElementById('flychar'), bubble = document.getElementById('bubble'), fx = document.getElementById('fx');
function fly(state, say) { flychar.dataset.state = state; if (say) { bubble.textContent = say; bubble.hidden = false; } else bubble.hidden = true; }
function burst(chars, n = 10) {
  fx.replaceChildren();
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span'); s.textContent = chars[i % chars.length];
    const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 70;
    s.style.setProperty('--dx', `${Math.cos(a) * r}px`); s.style.setProperty('--dy', `${Math.sin(a) * r - 30}px`);
    s.style.animationDelay = `${Math.random() * .3}s`; fx.appendChild(s);
  }
}

// ---------- fly sounds: synthesized, nothing to download ----------
let AC = null, buzzNodes = null;
function audio() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {} return AC; }
function buzz(on) {
  const ac = audio(); if (!ac) return;
  if (!on) { if (buzzNodes) { const { g } = buzzNodes; g.gain.setTargetAtTime(0, ac.currentTime, .08); const b = buzzNodes; setTimeout(() => b.stop(), 400); buzzNodes = null; } return; }
  if (buzzNodes) return;
  const g = ac.createGain(); g.gain.value = 0; g.connect(ac.destination);
  const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 190;
  const o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = 383;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 2;
  const lfo = ac.createOscillator(); lfo.frequency.value = 7; const lg = ac.createGain(); lg.gain.value = 22; lfo.connect(lg); lg.connect(o1.frequency);
  const lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.6; const lg2 = ac.createGain(); lg2.gain.value = 300; lfo2.connect(lg2); lg2.connect(f.frequency);
  const o2g = ac.createGain(); o2g.gain.value = .25; o2.connect(o2g); o2g.connect(f); o1.connect(f); f.connect(g);
  [o1, o2, lfo, lfo2].forEach(o => o.start()); g.gain.setTargetAtTime(.06, ac.currentTime, .15);
  buzzNodes = { g, stop: () => [o1, o2, lfo, lfo2].forEach(o => { try { o.stop(); } catch (e) {} }) };
}
function blip(freq, dur = .12, type = 'sine', vol = .12) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = 0; o.connect(g); g.connect(ac.destination); o.start();
  g.gain.linearRampToValueAtTime(vol, ac.currentTime + .01); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + dur); o.stop(ac.currentTime + dur + .05);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = {
  spike: () => blip(1200 + Math.random() * 1400, .05, 'square', .025),
  sensor: (i) => blip(440 * Math.pow(1.26, i), .1, 'triangle', .08),
  nom: async () => { for (const f of [330, 392, 440, 523, 659, 784]) { blip(f, .14, 'triangle', .14); await sleep(90); } },
  ew: async () => { for (const f of [392, 349, 311, 262, 196]) { blip(f, .22, 'sawtooth', .07); await sleep(150); } },
  melt: async () => { for (let i = 0; i < 12; i++) { blip(200 + Math.random() * 1800, .12, 'sawtooth', .09); await sleep(70); } },
  stamp: () => { blip(90, .18, 'square', .18); blip(60, .3, 'sine', .25); },
};

// ---------- UI ----------
const $ = id => document.getElementById(id);
const post = $('post'), go = $('go'), phase = $('phase'), dot = document.querySelector('.dot'), meter = $('meterfill');
let busy = false, resultVersion = 0, publication = null;
let lastText = '', savedDraft = null, imageResult = null, imageObjectUrl = null;
fetch('/api/rate').then(r => r.ok ? r.json() : null).then(d => { if (d && d.count) $('count').textContent = `${d.count.toLocaleString()} posts fed to the fly so far`; }).catch(() => {});

const SAMPLES = [
  `Humbled to announce I bought a standing desk. 🙏🚀

I used to sit through my problems. Literally. Then a mentor asked me a question that changed everything: what would happen if you stood up for yourself?

Goosebumps.

Today I am grateful for everyone who believed in me before the assembly instructions made sense. Your support carried me through every missing screw and every confusing diagram.

My biggest lesson? Your comfort zone has lumbar support. Your next chapter does not.

This milestone belongs to my incredible network. Never stop believing in your dreams.

Agree? #grateful #leadership`,
  `ATTENTION EVERYONE!!!

Please appreciate this seamless tapestry of meticulously arranged office stationery.

The pens face north. The stapler sits precisely beside the paper tray.

A single binder clip rests on a folded napkin. It resembles an artifact in a museum.

This is a testament to the transformative potential of everyday objects — a pivotal demonstration of operational excellence.

BEHOLD THE DRAWER!!!

We must delve into the intricate interplay between the mechanical pencil and its surroundings.

Furthermore, the eraser offers a nuanced perspective on the multifaceted nature of mistakes.

The filing cabinet embodies a holistic paradigm. Its labels represent our enduring commitment to alphabetical order.

Ultimately, the desk is an ever-evolving landscape. Please acknowledge the desk.`,
  `Humbled to announce that I finally fixed our office Wi-Fi. ☕🚀

It took 90 days because we kept blaming the network instead of reading the logs. However, the API latency came from a SQL query that scanned every customer record before returning a single row.

We measured 200 calls because the Postgres index looked correct, although the onboarding flow bypassed it entirely. In practice, the termination clause in our vendor contract made switching providers slower than fixing the query ourselves.

Here is my procedure: check the evidence before ordering another router.

This milestone is a testament to the transformative potential of actually opening the documentation. We must delve into the intricate tapestry of database maintenance and leverage every pivotal lesson.

The result was 40 ms instead of 900 ms. Please admire my leadership.`,
];
let sampleIdx = 0;
$('sample').addEventListener('click', () => { if (busy) return; savedDraft = null; $('restore-post').hidden = true; awaitingNew = false; go.textContent = 'Feed the fly'; post.value = SAMPLES[sampleIdx++ % SAMPLES.length]; prepareEdit(); post.focus(); post.setSelectionRange(0, 0); post.scrollTop = 0; post.scrollLeft = 0; preload(); });
function softReset() {
  $('result-context').hidden = true;
  imageResult = null; $('share').disabled = true; $('image-status').textContent = '';
  resultVersion++; publication = null; $('publish').disabled = true;
  $('v-title').hidden = true;
  $('stamp').hidden = true; $('verdict').hidden = true; $('senses').hidden = true;
  fly('idle'); setSegments([]); phase.textContent = '139,255 neurons · idle'; dot.classList.remove('live'); meter.style.transform = 'scaleX(0)'; orbitSpeed = 0.004; $('key').hidden = true;
}
function prepareEdit() {
  awaitingNew = false; go.textContent = 'Feed the fly';
  $('result-context').hidden = $('verdict').hidden || post.value.trim() === lastText;
}
post.addEventListener('input', () => { if (busy) return; prepareEdit(); preload(); });

// preload: while the post is being typed, quietly stream the meshes of the run it will get
let preloadTimer = null;
function preload() {
  clearTimeout(preloadTimer);
  preloadTimer = setTimeout(async () => {
    const text = post.value.trim(); if (!text || busy || !$('verdict').hidden || !neuronsLayer()) return;
    try { const { all } = await pickRun(text); const colors = {}; all.forEach(id => colors[id] = DIM); setColors(colors); setSegments(all); } catch (e) {}
  }, 400);
}
const isLink = t => /https?:\/\/|\blinkedin\.com\//i.test(t) && t.split(/\s+/).length < 25;

async function feed(e) {
  if (e) e.preventDefault();
  if (awaitingNew) { newPost(); return; }
  const text = post.value;
  if (!text.trim()) { post.focus(); return; }
  if (isLink(text)) { fly('idle', "that's a link. the fly can't click. paste the text."); post.focus(); return; }
  if (busy || !neuronsLayer()) return;
  imageResult = null; $('share').disabled = true; $('image-status').textContent = '';
  const version = ++resultVersion; publication = null; lastText = text; $('result-context').hidden = true;
  $('publish').disabled = true; $('publish').textContent = 'Add to Hall of Rot';
  $('publish-status').textContent = 'Hall of Rot makes your post public. Optional, every time.';
  $('sample').disabled = true; post.readOnly = true;
  audio(); busy = true; go.disabled = true; $('verdict').hidden = true; $('v-title').hidden = true; $('stamp').hidden = true; $('senses').hidden = true;
  let picked;
  try { picked = await pickRun(text); }
  catch (err) { busy = false; go.disabled = false; $('sample').disabled = false; post.readOnly = false; fly('idle', 'the brain is loading. try again in a sec.'); return; }
  const { pts, hits, levels, run, seq, all } = picked;
  const melt = run.n_active > MELTDOWN;
  const colors = {}; all.forEach(id => colors[id] = DIM);

  $('feedbox').classList.add('fed'); dot.classList.add('live'); meter.style.transform = 'scaleX(0)';
  phase.textContent = 'landing on your post…'; fly('landing'); buzz(true);
  setColors(colors); setSegments(all);                       // meshes start streaming, nearly invisible
  await sleep(1300);

  // the senses fire one by one, each in its own colour
  const active = Object.keys(CH).filter(ch => levels[ch] > 0 && run.stim[ch] && run.stim[ch].length);
  fly('tasting', '*sniff* *taste*');
  for (const [i, ch] of active.entries()) {
    const lvl = ch === 'sugar' ? `${SUGAR_L[levels.sugar]} Hz` : ch === 'bitter' ? `${BITTER_L[levels.bitter]} Hz` : ch === 'smell' ? ['', 'a whiff', 'a stench'][levels.smell] : 'on';
    phase.textContent = `${CH[ch].icon} ${CH[ch].name.toLowerCase()} · ${lvl}`; sfx.sensor(i);
    for (let k = 0; k < 3; k++) { const c = {}; run.stim[ch].forEach(id => c[id] = k % 2 ? DIM : CH[ch].c); setColors(c); await sleep(170); }
    const c = {}; run.stim[ch].forEach(id => c[id] = CH[ch].c); setColors(c); await sleep(250);
  }

  phase.textContent = melt ? 'signal propagating… uncontrollably' : 'signal propagating through 139,255 neurons…';
  fly('watching'); buzz(false); if (melt) orbitSpeed = 0.02;
  const stimSet = new Set(Object.values(run.stim).flat());
  const used = [...new Set(seq.map(x => x[2]))].filter(k => ATTR[k]);
  $('key').innerHTML = used.map(k => `<span style="--c:${ATTR[k]}">${ATTR_NAME[k]}</span>`).join(''); $('key').hidden = false;
  const DUR = melt ? 4500 : 6000, t0 = performance.now(); let i = 0, lit = new Set();
  while (i < seq.length) {
    const ms = Math.min(1000, (performance.now() - t0) / DUR * 1000); const c = {};
    while (i < seq.length && seq[i][0] <= ms) { const [, id, k] = seq[i]; if (!stimSet.has(id) && id !== MN9) { c[id] = ATTR[k] || ATTR['?']; lit.add(id); } i++; }
    if (Object.keys(c).length) { setColors(c); sfx.spike(); }
    meter.style.transform = `scaleX(${ms / 1000})`;
    phase.textContent = `${melt ? run.n_active.toLocaleString() + ' neurons firing' : lit.size + ' neurons lit'} · ${Math.round(ms)} ms of brain time`;
    await sleep(90);
  }
  meter.style.transform = 'scaleX(1)';
  const rot = rotScore(run, text);
  const [title, state, say] = verdictFor(run, rot);
  if (run.mn9 > 0 && !melt) {
    phase.textContent = `PROBOSCIS EXTENSION · MN9 firing at ${run.mn9} Hz`;
    for (let k = 0; k < 4; k++) { setColors({ [MN9]: k % 2 ? '#ffe9a8' : WHITE }); await sleep(180); } setColors({ [MN9]: WHITE });
  } else phase.textContent = melt ? `RUNAWAY ACTIVITY · ${run.n_active.toLocaleString()} neurons (${(run.n_active / N_NEURONS * 100).toFixed(1)}% of the brain)` : 'no proboscis extension. the fly is unmoved.';
  fly(state, say);
  if (state === 'love') { burst(['🍬', '🍭', '💛', '🍯'], 12); sfx.nom(); }
  else if (state === 'melt') { burst(['🔥', '🤯', '💥'], 14); sfx.melt(); }
  else if (state === 'dead' || state === 'gone') sfx.ew();
  else { buzz(true); setTimeout(() => buzz(false), 900); }

  // ---------- verdict + explainers ----------
  const pct = (run.n_active / N_NEURONS * 100).toFixed(2);
  $('score').textContent = rot; $('stamp').classList.toggle('low', rot < 30); $('stamp').classList.toggle('melt', melt); $('stamp').hidden = false; sfx.stamp();
  $('v-title').textContent = title; $('v-title').hidden = false;
  const regions = (run.regions || []).slice(0, 4).map(([r, n]) => `${n.toLocaleString()} ${r.replace(/_/g, ' ')}`).join(' · ');
  const nm = (run.named || []).slice(0, 6).join(', ');
  $('tele').innerHTML = `MN9 <em>${run.mn9} Hz</em> · <em>${pct}%</em> of the brain lit up · ${run.n_spikes.toLocaleString()} spikes in 1 s<br>${regions}${nm ? `<br>reviewed by neurons ${nm}` : ''}`;
  // one explainer card per sense that fired
  $('senses').innerHTML = Object.keys(CH).map(ch => {
    const on = levels[ch] > 0, c = CH[ch];
    const trig = hits[ch].slice(0, 4).map(h => h.label + (h.n > 1 ? ' ×' + h.n : '')).join(', ');
    const lvl = ch === 'sugar' ? `${SUGAR_L[levels.sugar]} Hz` : ch === 'bitter' ? `${BITTER_L[levels.bitter]} Hz` : ch === 'smell' ? ['off', 'whiff', 'stench'][levels.smell] : on ? 'on' : 'off';
    return `<div class="sense ${on ? 'on' : ''}" style="--c:${c.c}"><div class="s-head"><span class="s-icon">${c.icon}</span><b>${c.name}</b><span class="s-lvl">${lvl}</span></div>
      <div class="s-trig">${on ? `tasted: ${trig}` : 'nothing here'}</div>
      <div class="s-what">${on ? `→ ${({ sugar: '12–20', bitter: 'all 65', smell: ['', '5', '10'][levels.smell], sound: '150', sight: '800' })[ch]} ${c.what} stimulated` : `${c.what}: silent`}</div>
      <div class="s-why">${c.why}</div></div>`;
  }).join('');
  $('senses').hidden = false;
  $('pct').textContent = '';
  const ngState = { layers: [{ type: 'segmentation', source: SRC_NEURONS, segments: all, segmentColors: colors, name: 'neurons that judged your post' },
                             { type: 'segmentation', source: SRC_BRAIN, segments: ['1'], objectAlpha: 0.08, name: 'brain' }],
                    dimensions: { x: [1.6e-8, 'm'], y: [1.6e-8, 'm'], z: [4e-8, 'm'] }, position: [34000, 19000, 3000], projectionScale: 50000, layout: '3d', showSlices: false };
  $('ng-link').href = 'https://neuroglancer-demo.appspot.com/#!' + encodeURIComponent(JSON.stringify(ngState));
  $('verdict').hidden = false;
  showExperiment(run);
  imageResult = { score: rot, title, senses: Object.keys(CH).filter(ch => run.stim[ch]?.length).map(ch => CH[ch].name), brain: null };
  try { imageResult.brain = window.BrainRotImage.capture(V()); } catch { /* Retry capture on click if the viewer is still loading. */ }
  $('share').disabled = false;
  if (window.matchMedia('(max-width: 720px)').matches) $('verdict').scrollIntoView({ block: 'start', behavior: 'smooth' });

  fetch('/api/rate', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ post: text, bait_score: pts.sugar, bait: Object.values(hits).flat().map(h => h.label), rate: SUGAR_L[levels.sugar], run: run.k, mn9: run.mn9, fly_score: rot,
                           levels, n_active: run.n_active }) })
    .then(r => r.ok ? r.json() : null).then(d => {
      if (version !== resultVersion) return;
      if (d?.ok && d.id && d.token) { publication = { id: d.id, token: d.token }; $('publish').disabled = false; }
      else $('publish-status').textContent = 'Could not save this result. Feed the fly again to submit it.';
      if (d && d.count) $('count').textContent = `${d.count.toLocaleString()} posts fed to the fly so far`;
      if (d && d.percentile != null && d.count > 20) $('pct').textContent = rot === 0 ? `Less rotten than ${100 - d.percentile}% of posts fed to the fly.` : `More rotten than ${d.percentile}% of posts fed to the fly.`;
    }).catch(() => { if (version === resultVersion) $('publish-status').textContent = 'Could not save this result. Feed the fly again to submit it.'; });
  busy = false; go.disabled = false; $('sample').disabled = false; post.readOnly = false; awaitingNew = true; go.textContent = 'Feed it another'; $('feedbox').classList.remove('fed'); orbitSpeed = 0.004;
}
let awaitingNew = false;
function newPost() { savedDraft = null; $('restore-post').hidden = true; awaitingNew = false; go.textContent = 'Feed the fly'; softReset(); post.value = ''; post.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
$('feedbox').addEventListener('submit', feed);
$('share').addEventListener('click', async () => {
  if (busy || !imageResult) return;
  const result = imageResult, version = resultVersion;
  $('share').disabled = true; $('share').textContent = 'Preparing image…'; $('image-status').textContent = '';
  try {
    // Editing preserves this exact result and its brain frame until resubmission.
    if (!result.brain) result.brain = window.BrainRotImage.capture(V());
    const blob = await window.BrainRotImage.render(result);
    if (version !== resultVersion) return;
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    imageObjectUrl = URL.createObjectURL(blob);
    $('result-image-preview').src = imageObjectUrl;
    $('download-image').href = imageObjectUrl;
    $('download-image').download = `brain-rot-${result.score}.png`;
    $('result-image-dialog').showModal();
  } catch {
    if (version === resultVersion) $('image-status').textContent = 'Couldn’t prepare the image. Please try again, or take a screenshot of the brain.';
  } finally {
    $('share').textContent = 'Save result image';
    $('share').disabled = busy || !imageResult;
  }
});
$('close-image').addEventListener('click', () => $('result-image-dialog').close());
$('publish').addEventListener('click', async () => {
  if (!publication) return;
  const version = resultVersion, entry = publication;
  $('publish').disabled = true;
  $('publish-status').textContent = 'Adding your post…';
  try {
    const response = await fetch('/api/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
    if (!response.ok || !(await response.json()).ok) throw new Error('Publish failed');
    loadHall();
    if (version !== resultVersion) return;
    publication = null;
    $('publish').textContent = 'Added to Hall of Rot';
    $('publish-status').textContent = 'Your post is now public in the Hall of Rot below.';
  } catch {
    if (version !== resultVersion) return;
    $('publish').disabled = false;
    $('publish-status').textContent = 'Could not add your post. Tap to try again.';
  }
});

const EXPERIMENTS = {
  sight: 'Try two emojis or a few bullet points. These stimulate the fly’s visual inputs.',
  sound: 'Try THREE EXCLAMATION MARKS!!! Shouting stimulates hearing inputs in the antennae.',
  smell: 'Try a word like “delve” or “tapestry”. AI-style language stimulates smell inputs.',
  sugar: 'Try “Humbled to announce” or “Agree?”. Engagement bait stimulates sugar-sensing neurons.',
  bitter: 'Try a factual paragraph with numbers and reasoning. Enough substance activates bitter inputs and can suppress the tongue response.',
};
const SENSE_EXAMPLES = {
  sugar: 'Humbled to announce my new chapter. Grateful for this incredible journey. Agree?',
  sight: 'A tiny update from my desk today. ☕🌻',
  sound: 'THE PRINTER WORKS!!!',
  smell: 'We should delve into this idea.',
  bitter: 'We measured API latency across 200 calls because the SQL query was slow. However, the index reduced execution time from 90 ms to 40 ms. In practice, the onboarding flow still fails because the termination clause requires a second review. Instead of adding servers, we checked the Postgres query plan and removed a redundant join. The problem was a missing index, although we initially suspected the network.',
};
function loadSenseExample(ch) {
  if (busy) return;
  if (savedDraft === null) savedDraft = post.value;
  post.value = SENSE_EXAMPLES[ch]; awaitingNew = false; go.textContent = 'Feed the fly';
  prepareEdit(); $('restore-post').hidden = false; post.focus(); preload();
  $('feedbox').scrollIntoView({ block: 'center', behavior: 'smooth' });
}
$('restore-post').addEventListener('click', () => {
  if (busy || savedDraft === null) return;
  post.value = savedDraft; savedDraft = null; $('restore-post').hidden = true;
  prepareEdit(); post.focus(); preload();
});
let activeSenses = new Set();
let hintQueue = [];
function renderHint() {
  const ch = hintQueue[0];
  $('experiment-hint').textContent = `${CH[ch].icon} ${EXPERIMENTS[ch]}`;
}
function showExperiment(run) {
  activeSenses = new Set(Object.keys(CH).filter(ch => run.stim[ch]?.length));
  $('sense-progress').replaceChildren(...Object.keys(CH).map(ch => {
    const item = document.createElement('button');
    const on = activeSenses.has(ch);
    item.type = 'button';
    item.className = 'sense-chip' + (on ? ' active' : '');
    item.style.setProperty('--c', CH[ch].c);
    item.textContent = `${CH[ch].icon} ${CH[ch].name}${on ? ' ✓' : ''}`;
    const explanation = `${on ? 'Activated in this post. ' : 'Not activated in this post. '}${EXPERIMENTS[ch]}`;
    item.setAttribute('aria-label', `${CH[ch].name}: ${on ? 'activated' : 'not activated'}. Load an example`);
    item.setAttribute('aria-describedby', 'experiment-hint');
    for (const event of ['mouseenter', 'focus']) item.addEventListener(event, () => { $('experiment-hint').textContent = explanation; });
    item.addEventListener('click', () => loadSenseExample(ch));
    return item;
  }));
  $('explore-title').textContent = `You lit up ${activeSenses.size}/5 senses`;
  hintQueue = Object.keys(EXPERIMENTS).sort((a, b) => Number(activeSenses.has(a)) - Number(activeSenses.has(b)));
  renderHint();
}
document.querySelector('.nav-hall').addEventListener('click', () => { $('hall-x').focus({ preventScroll: true }); });
document.querySelector('.nav-about').addEventListener('click', () => {
  $('about-x').open = true; $('about-x').focus({ preventScroll: true });
});

let voted = new Set(); try { voted = new Set(JSON.parse(localStorage.getItem('rot-votes') || '[]')); } catch (e) {}
async function loadHall() {
  try {
    const response = await fetch('/api/top');
    if (response.status === 404 && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
      $('hall').textContent = 'The leaderboard isn’t connected in this local preview.';
      return;
    }
    if (!response.ok) throw new Error('Hall unavailable');
    const d = await response.json();
    const row = x => `<div class="hr"><button class="vote ${voted.has(x.id) ? 'did' : ''}" data-id="${x.id}" title="the fly agrees">🪰 <b>${x.votes}</b></button><span class="hr-s" style="color:${x.melt ? '#ff3b3b' : x.score < 30 ? '#ff5a5a' : '#b6ff3b'}">${x.score}%</span><span class="hr-t">${x.post.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</span></div>`;
    $('hall').innerHTML = (d.top.length ? `<h4>🏆 most rotten · upvote with the fly</h4>` + d.top.map(row).join('') : '<p>nothing yet. be the first.</p>') + (d.bottom.length ? `<h4>🪦 too much substance</h4>` + d.bottom.map(row).join('') : '');
    $('hall').querySelectorAll('.vote').forEach(btn => btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id); if (voted.has(id)) return;
      voted.add(id); try { localStorage.setItem('rot-votes', JSON.stringify([...voted])); } catch (e) {}
      btn.classList.add('did'); btn.querySelector('b').textContent = Number(btn.querySelector('b').textContent) + 1; blip(880, .1, 'triangle', .1);
      fetch('/api/vote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
    }));
  } catch (err) { $('hall').textContent = 'Couldn’t load the leaderboard. Please refresh to try again.'; }
}
loadHall();
})();
