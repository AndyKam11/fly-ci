/* Brain Rot — a fruit fly brain rates your LinkedIn post. The shittier the post, the more it loves it.
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
  { ch: 'bitter', label: 'numbers with units', w: 4, cap: 20, re: /\b\d[\d,.]*\s?(%|k|m|x|days?|weeks?|months?|years?|hours?|customers?|users?|people|deals?|calls?|emails?|€|\$|usd|eur)\b|[$€£]\s?\d/gi },
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
    bitter: b < 8 ? 0 : b < 22 ? 1 : b < 40 ? 2 : 3,
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
function verdictFor(run) {
  const m = run.mn9;
  if (run.n_active > MELTDOWN) return ['BRAIN MELTDOWN. ' + run.n_active.toLocaleString() + ' neurons on fire. This smells like ChatGPT.', 'melt', '🤯 what IS this'];
  if (m === 0)  return ['Zero rot. Not a shitpost. The fly walked away.',    'dead', 'ew. substance.'];
  if (m < 10)   return ['Barely rotten. The fly sniffed it and left.',        'gone', 'meh. not shitty enough.'];
  if (m < 25)   return ['Mildly rotten. A polite nibble.',                    'meh',  'hm. a little sugar.'];
  if (m < 45)   return ['Rotten. Proboscis extended.',                        'love', 'ooh. SUGAR.'];
  if (m < 65)   return ['Very rotten. The fly is feasting on this shitpost.', 'love', 'NOM NOM NOM'];
  return            ['CERTIFIED SHITPOST. The fly is licking the screen.',    'love', 'SUGARRRR 🤤'];
}
const rotScore = run => run.n_active > MELTDOWN ? 100 : Math.min(100, Math.round(run.mn9 * 1.25));

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
function setSegments(ids) { const L = neuronsLayer(); if (!L) return; const vis = L.displayState.segmentationGroupState.value.visibleSegments; vis.clear(); ids.forEach(id => vis.add(BigInt(id))); }
function setColors(colors) { const L = neuronsLayer(); if (!L) return; const map = L.displayState.segmentationColorGroupState.value.segmentStatedColors; for (const id in colors) { const k = BigInt(id); map.delete(k); map.set(k, pack(colors[id])); } }
let orbitAngle = 0, orbitPausedUntil = 0, orbitSpeed = 0.004;
function tickOrbit() {
  const v = V(); if (!v || Date.now() < orbitPausedUntil) return;
  orbitAngle += orbitSpeed;
  const q = qmul([0, Math.sin(orbitAngle / 2), 0, Math.cos(orbitAngle / 2)], Q0);
  const o = v.perspectiveNavigationState.pose.orientation; o.orientation.set(q); o.changed.dispatch();
}
function initViewer() {
  const v = V(); if (!v || !v.state) { setTimeout(initViewer, 150); return; }
  const st = baseState(); if (ng.clientWidth < 600) st.projectionScale = 64000;   // phones: keep the whole brain in frame
  v.state.restoreState(st);
  try { const d = ng.contentWindow.document;
    d.addEventListener('pointerdown', () => { orbitPausedUntil = Date.now() + 15000; }, true);
    d.addEventListener('wheel', () => { orbitPausedUntil = Date.now() + 15000; }, true); } catch (e) {}
  setInterval(tickOrbit, 40);
}
ng.addEventListener('load', initViewer);
if (location.search.includes('og=1')) {                      // share-image mode
  document.body.classList.add('og');
  document.querySelector('.stage').insertAdjacentHTML('beforeend', '<div class="ogmark">BRAIN <span>ROT</span></div><div class="ogtag">A real fruit fly brain rates your LinkedIn post.<br><b>The shittier the post, the more it loves it.</b></div>');
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
let busy = false;
fetch('/api/rate').then(r => r.ok ? r.json() : null).then(d => { if (d && d.count) $('count').textContent = `${d.count.toLocaleString()} shitposts fed to the fly so far`; }).catch(() => {});

const SAMPLES = [
  `I got rejected by 47 investors.\n\nThen one said yes.\n\nHere's what I learned about resilience 👇\n\n→ Rejection is redirection.\n→ Your network is your net worth.\n→ Consistency > talent. Every. Single. Time.\n\n3 years ago I was sleeping on a couch. Today we're a team of 12.\n\nNot because I'm special. Because I didn't quit.\n\nLet that sink in.\n\nHumbled to announce we just closed our Series A 🚀\n\nAgree? Repost ♻️ to help someone who needs this today.\n\n#founders #startups #mindset #AI`,
  `Humbled to announce I've updated my LinkedIn profile once again. 🙏\n\nThis journey hasn't been easy. But I couldn't have done it without every single one of you.\n\nHere's to the next chapter 🚀\n\n#grateful #newbeginnings`,
  `In today's fast-paced landscape, partnerships are not just a channel — they're a testament to a company's commitment to excellence. By leveraging cutting-edge tools and fostering meaningful relationships, teams can navigate the complexities of go-to-market and unlock transformative growth.\n\nIt's not about the deal. It's about the journey.\n\nKey takeaways:\n• Embrace innovation\n• Cultivate synergy\n• Elevate your mindset`,
  `WE DID IT!!! 🎉🎉🎉\n\n1 MILLION USERS!!!\n\nTo everyone who said it couldn't be done: LOOK AT US NOW!!! 🚀🔥💪\n\nLET'S GOOOO!!!`,
  `We spent six months trying to sell our analytics product to mid-market retailers and closed nothing. The pattern in the lost deals was consistent: the person who wanted the product wasn't the person who owned the budget, and we never got a meeting with the second person.\n\nWhat changed things was boring. We rewrote the first call to end with one question: who else needs to be in the next conversation? Half the time the answer was the CFO. We stopped pitching until they were in the room. Cycle time went from 90 days to 40, and we closed four of the next nine.`,
];
let sampleIdx = 0;
$('sample').addEventListener('click', () => { post.value = SAMPLES[sampleIdx++ % SAMPLES.length]; softReset(); post.focus(); preload(); });
function softReset() {
  $('stamp').hidden = true; $('verdict').hidden = true; $('senses').hidden = true;
  fly('idle'); setSegments([]); phase.textContent = '139,255 neurons · idle'; dot.classList.remove('live'); meter.style.transform = 'scaleX(0)'; orbitSpeed = 0.004;
}
post.addEventListener('input', () => { if (!busy && !$('stamp').hidden) softReset(); preload(); });
$('again').addEventListener('click', () => { softReset(); post.value = ''; post.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

// preload: while the post is being typed, quietly stream the meshes of the run it will get
let preloadTimer = null;
function preload() {
  clearTimeout(preloadTimer);
  preloadTimer = setTimeout(async () => {
    const text = post.value.trim(); if (!text || busy || !neuronsLayer()) return;
    try { const { all } = await pickRun(text); const colors = {}; all.forEach(id => colors[id] = DIM); setColors(colors); setSegments(all); } catch (e) {}
  }, 400);
}
const isLink = t => /https?:\/\/|\blinkedin\.com\//i.test(t) && t.split(/\s+/).length < 25;
const hex = (a, b, t) => '#' + [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0')).join('');
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

async function feed(e) {
  if (e) e.preventDefault();
  const text = post.value.trim();
  if (!text) { post.focus(); return; }
  if (isLink(text)) { fly('idle', "that's a link. the fly can't click. paste the text."); post.focus(); return; }
  if (busy || !neuronsLayer()) return;
  audio(); busy = true; go.disabled = true; $('verdict').hidden = true; $('stamp').hidden = true; $('senses').hidden = true;
  let picked;
  try { picked = await pickRun(text); }
  catch (err) { busy = false; go.disabled = false; fly('idle', 'the brain is loading. try again in a sec.'); return; }
  const { pts, hits, levels, run, seq, all } = picked;
  const melt = run.n_active > MELTDOWN;
  const colors = {}; all.forEach(id => colors[id] = DIM);

  $('feedbox').classList.add('fed'); dot.classList.add('live'); meter.style.transform = 'scaleX(0)';
  phase.textContent = 'landing on your shitpost…'; fly('landing'); buzz(true);
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
  const A = melt ? rgb('#ff3b3b') : rgb('#ffcc33'), B = melt ? rgb('#ff2bd6') : rgb('#ff4a36');
  const stimSet = new Set(Object.values(run.stim).flat());
  const DUR = melt ? 4500 : 6000, t0 = performance.now(); let i = 0, lit = new Set();
  while (i < seq.length) {
    const ms = Math.min(1000, (performance.now() - t0) / DUR * 1000); const c = {};
    while (i < seq.length && seq[i][0] <= ms) { const id = seq[i][1]; if (!stimSet.has(id) && id !== MN9) { c[id] = hex(A, B, i / seq.length); lit.add(id); } i++; }
    if (Object.keys(c).length) { setColors(c); sfx.spike(); }
    meter.style.transform = `scaleX(${ms / 1000})`;
    phase.textContent = `${melt ? run.n_active.toLocaleString() + ' neurons firing' : lit.size + ' neurons lit'} · ${Math.round(ms)} ms of brain time`;
    await sleep(90);
  }
  meter.style.transform = 'scaleX(1)';
  const [title, state, say] = verdictFor(run);
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
  const rot = rotScore(run), pct = (run.n_active / N_NEURONS * 100).toFixed(2);
  $('score').textContent = rot; $('stamp').classList.toggle('low', rot < 30); $('stamp').classList.toggle('melt', melt); $('stamp').hidden = false; sfx.stamp();
  $('v-title').textContent = title;
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
  const site = location.origin + location.pathname;
  const copyText = `🪰 BRAIN ROT: ${rot}% — ${title}\n\nI fed my LinkedIn post to a simulated fruit fly brain (139,255 real neurons). ${melt ? `It triggered a runaway state in ${run.n_active.toLocaleString()} neurons.` : `The tongue motor neuron fired at ${run.mn9} Hz.`} Flies know a shitpost when they taste one.\n\n${site}`;
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText(copyText); $('copy').textContent = 'Copied!'; setTimeout(() => $('copy').textContent = 'Copy verdict', 1500); } catch (e) { prompt('Copy this:', copyText); } };
  $('share').href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(site);
  const ngState = { layers: [{ type: 'segmentation', source: SRC_NEURONS, segments: all, segmentColors: colors, name: 'neurons that judged your post' },
                             { type: 'segmentation', source: SRC_BRAIN, segments: ['1'], objectAlpha: 0.08, name: 'brain' }],
                    dimensions: { x: [1.6e-8, 'm'], y: [1.6e-8, 'm'], z: [4e-8, 'm'] }, position: [34000, 19000, 3000], projectionScale: 50000, layout: '3d', showSlices: false };
  $('ng-link').href = 'https://neuroglancer-demo.appspot.com/#!' + encodeURIComponent(JSON.stringify(ngState));
  $('verdict').hidden = false;

  fetch('/api/rate', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ post: text, bait_score: pts.sugar, bait: Object.values(hits).flat().map(h => h.label), rate: SUGAR_L[levels.sugar], run: run.k, mn9: run.mn9, fly_score: rot,
                           levels, n_active: run.n_active }) })
    .then(r => r.ok ? r.json() : null).then(d => { if (d && d.count) $('count').textContent = `${d.count.toLocaleString()} shitposts fed to the fly so far`; }).catch(() => {});
  busy = false; go.disabled = false; go.textContent = 'Feed it another shitpost'; $('feedbox').classList.remove('fed'); orbitSpeed = 0.004;
}
$('feedbox').addEventListener('submit', feed);
post.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') feed(e); });
})();
