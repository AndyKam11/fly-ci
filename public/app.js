/* Муха оценивает ваш CI — форк Brain Rot (Franz Schrepf, MIT). Чем хуже .gitlab-ci.yml, тем больше в нём 💩 и тем больше он нравится мухе.
   YAML → пять чувств (sugar, bitter, smell, sound, sight) → заранее посчитанный прогон модели мозга на этих уровнях
   (Shiu et al. 2024, коннектом FlyWire v783, 139 255 нейронов) → частота нейрона MN9 → вердикт.
   3D — встроенный Neuroglancer: настоящие нейроны в порядке разрядов. Текст CI никуда не уходит из браузера. */
(() => {
const MN9 = '720575940660219265';
const N_NEURONS = 139255;
const SRC_NEURONS = 'precomputed://gs://flywire_v141_m783';
const SRC_BRAIN = 'precomputed://gs://flywire_neuropil_meshes/whole_neuropil/brain_mesh_v141.surf';
const SUGAR_L = [0, 60, 90, 120, 150, 180, 220], BITTER_L = [0, 60, 120, 200];
const MELTDOWN = 3000;                         // active neurons above this = the model's runaway state
const DIM = '#15151f', WHITE = '#ffffff';
const ATTR = { s: '#ffcc33', b: '#c56bff', m: '#5dff9a', o: '#5ab8ff', v: '#e8f4ff', x: '#ff9a3d', '?': '#ff6a3d' };   // cascade colour by sense that owns the neuron
const ATTR_NAME = { s: 'сахар', b: 'горечь', m: 'запах', o: 'слух', v: 'зрение', x: 'смесь', '?': 'прочие' };
const CH = {                                   // channel → sensor colour, icon, name
  sugar:  { c: '#ffcc33', icon: '🍬', name: 'Сахар' },
  bitter: { c: '#c56bff', icon: '🧪', name: 'Горечь' },
  smell:  { c: '#5dff9a', icon: '👃', name: 'Запах' },
  sound:  { c: '#5ab8ff', icon: '👂', name: 'Слух' },
  sight:  { c: '#e8f4ff', icon: '👁', name: 'Зрение' },
};

// ---------- .gitlab-ci.yml → what the fly senses ----------
// Top-level YAML keys split the file into blocks; everything that is not a global keyword or a hidden template is a job.
const GLOBAL_KEYS = new Set(['stages', 'variables', 'default', 'include', 'workflow', 'image', 'services', 'cache', 'before_script', 'after_script', 'spec']);
function blocks(text) {
  const marks = [...text.matchAll(/^([^\s#][^\n]*?):(?=\s|$)/gm)];
  return marks.map((m, i) => ({ name: m[1].replace(/^["']|["']$/g, ''), body: text.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : text.length) }));
}
const isJob = b => !GLOBAL_KEYS.has(b.name) && !b.name.startsWith('.');
const SECRET_REF = /\$\{?\w*(?:TOKEN|PASSWORD|PASSWD|SECRET|API_?KEY)/i;
function scriptLen(body) {            // non-empty lines under `script:` (list items or a multi-line block)
  const m = body.match(/^([ \t]+)script:[ \t]*\n((?:\1(?:[ \t]+|- ).*(?:\n|$)|[ \t]*\n)*)/m);
  return m ? m[2].split('\n').filter(l => l.trim()).length : 0;
}
function extendsDepth(all) {
  const parent = {};
  for (const b of all) { const m = b.body.match(/^[ \t]+extends:[ \t]*\[?[ \t]*["']?([^\s,"'\]]+)|^[ \t]+extends:[ \t]*\n[ \t]+-[ \t]*["']?([^\s"']+)/m); if (m) parent[b.name] = m[1] || m[2]; }
  return name => { let d = 0; const seen = new Set(); while (parent[name] && !seen.has(name)) { seen.add(name); name = parent[name]; d++; } return d; };
}
function untaggedImages(text) {
  return [...text.matchAll(/^[ \t]*image:[ \t]*(?:\n[ \t]+name:[ \t]*)?["']?([^\s"'#]+)/gm)].map(m => m[1])
    .filter(ref => !ref.includes('$') && !ref.includes('@sha256:') && (/:latest$/.test(ref) || !/:[^/]+$/.test(ref))).length;
}
// Each rule: a regex whose matches are counted, or n(text, ctx) → count; why/fix explain the problem to the user.
// Only label, count and advice are ever shown — never the matched text.
// Weights follow how common a pattern is: widespread practices (rules, needs, manual prod gates) weigh little,
// rare ones (interruptible, timeout, @sha256) weigh more.
const BAIT = [
  { ch: 'sugar', label: 'allow_failure: true', why: 'падение джобы не валит пайплайн, ошибки копятся незаметно', fix: 'уберите или сузьте до `allow_failure: exit_codes: [N]`', w: 6, cap: 12, re: /^[ \t]*allow_failure:[ \t]*true\b/gm },
  { ch: 'sugar', label: 'образ :latest или без тега', why: 'сборка меняется сама, когда обновляется образ', fix: 'укажите версию, а лучше `@sha256`', w: 6, cap: 18, n: untaggedImages },
  { ch: 'sugar', label: '|| true / set +e', why: 'ошибки команд проглатываются, джоба зеленеет со сломанным результатом', fix: 'обрабатывайте конкретную ошибку или используйте `allow_failure: exit_codes`', w: 6, cap: 18, re: /\|\|[ \t]*true\b|\bset[ \t]+\+e\b/g },
  { ch: 'sugar', label: 'curl | bash', why: 'выполняется непроверенный код из сети', fix: 'скачайте файл, сверьте checksum, а лучше заложите утилиту в образ', w: 12, cap: 24, re: /\b(?:curl|wget)\b[^\n|]*\|[ \t]*(?:sudo[ \t]+)?(?:ba|z)?sh\b/g },
  { ch: 'sugar', label: 'sleep', why: 'ожидание наугад: медленно и всё равно нестабильно', fix: 'ждите готовности в цикле с таймаутом', w: 4, cap: 12, re: /\bsleep[ \t]+\d+/g },
  { ch: 'sugar', label: 'only / except', why: 'устаревший синтаксис, не сочетается с `rules`', fix: 'перейдите на `rules:`', w: 3, cap: 15, re: /^[ \t]+(?:only|except):/gm },
  { ch: 'sugar', label: 'privileged: true', why: 'контейнер получает root на хосте раннера', fix: 'собирайте образы через kaniko или buildah без `privileged`', w: 12, cap: 12, re: /\bprivileged[ \t]*[:=][ \t]*["']?true\b/g },
  { ch: 'sugar', label: 'docker run в script', why: 'контейнер в контейнере: нужен dind или docker.sock, окружение джобы не воспроизводится, а с сокетом джоба управляет всем хостом', fix: 'нужный образ укажите в `image:`, зависимые сервисы — в `services:`', w: 8, cap: 16, re: /^[^#\n]*\bdocker[ \t]+(?:container[ \t]+)?run\b/gm },
  { ch: 'sugar', label: 'chmod 777', why: 'запись разрешена всем', fix: 'выдайте минимальные права: 755 или 644', w: 8, cap: 16, re: /\bchmod[ \t]+(?:-R[ \t]+)?(?:0?777|a\+rwx)\b/g },
  { ch: 'sugar', label: 'без проверки TLS', why: 'скачиваемое можно подменить по дороге (MITM)', fix: 'подложите корпоративный CA вместо отключения проверки', w: 6, cap: 18, re: /\bcurl\b[^\n]*[ \t]-[a-zA-Z]*k\b|--insecure\b|--no-verify\b|--no-check-certificate\b|GIT_SSL_NO_VERIFY/g },
  { ch: 'sugar', label: 'ручной деплой в прод', why: 'ручной гейт — это нормально, но кнопку легко забыть', fix: 'оставьте, если гейт осознанный; добавьте `environment` и `resource_group`', w: 2, cap: 2, n: (t, c) => c.jobs.filter(j => /^[ \t]+when:[ \t]*manual\b/m.test(j.body) && /prod/i.test(j.name + j.body)).length },
  { ch: 'sugar', label: 'полный клон (GIT_DEPTH: 0)', why: 'каждый раз клонируется вся история', fix: 'используйте `GIT_STRATEGY: fetch` и небольшой `GIT_DEPTH`', w: 6, cap: 6, n: t => +(/GIT_STRATEGY:[ \t]*["']?clone/.test(t) && /GIT_DEPTH:[ \t]*["']?0\b/.test(t)) },
  { ch: 'sugar', label: 'огромный script:', why: 'логику в YAML не протестировать и не переиспользовать', fix: 'вынесите команды в скрипт в репозитории', w: 8, cap: 16, n: (t, c) => c.jobs.filter(j => scriptLen(j.body) > 20).length },
  { ch: 'bitter', label: 'needs', w: 2, cap: 6, re: /^[ \t]+needs:/gm },
  { ch: 'bitter', label: 'rules', w: 2, cap: 6, re: /^[ \t]*rules:/gm },
  { ch: 'bitter', label: 'workflow', w: 3, cap: 3, re: /^workflow:/gm },
  { ch: 'bitter', label: 'cache с key', w: 4, cap: 12, re: /^[ \t]+cache:[ \t]*\n(?:[ \t]+.*\n)*?[ \t]+key:/gm },
  { ch: 'bitter', label: 'interruptible', w: 4, cap: 12, re: /^[ \t]*interruptible:[ \t]*true\b/gm },
  { ch: 'bitter', label: 'timeout', w: 3, cap: 9, re: /^[ \t]+timeout:/gm },
  { ch: 'bitter', label: 'образ по @sha256', w: 5, cap: 15, re: /@sha256:[a-f0-9]{6,}/g },
  { ch: 'bitter', label: 'retry с when', w: 4, cap: 8, re: /^[ \t]+retry:[ \t]*\n(?:[ \t]+max:.*\n)?[ \t]+when:/gm },
  { ch: 'bitter', label: 'expire_in', w: 2, cap: 8, re: /^[ \t]+expire_in:/gm },
  { ch: 'bitter', label: 'resource_group', w: 3, cap: 6, re: /^[ \t]+resource_group:/gm },
  { ch: 'smell', label: 'секрет литералом в variables', why: 'секрет видят все, у кого есть доступ к репозиторию, и он остаётся в истории git', fix: 'перевыпустите секрет и перенесите его в CI/CD Variables (masked, protected)', w: 12, cap: 24, re: /^[ \t]*["']?(?!SECRET_DETECTION|SAST)[\w.-]*(?:password|passwd|token|secret|api_?key|private_?key)(?![\w.-]*_(?:URL|URI|PATH|FILE|NAME|ID|HOST|HEADER|TYPE|ENABLED|EXPIRES?)["']?:)[\w.-]*["']?:[ \t]*["']?(?![$"'\s]|true\b|false\b|\d+[ \t]*$)\S/gim },
  { ch: 'smell', label: 'echo секрета', why: 'секрет попадает в лог джобы', fix: 'не выводите секреты, маскирование ловит не всё', w: 10, cap: 20, re: /\becho\b(?![^\n]*\|)[^\n]*\$\{?\w*(?:TOKEN|PASSWORD|PASSWD|SECRET|API_?KEY)/gi },
  { ch: 'smell', label: 'CI_DEBUG_TRACE', why: 'в лог уходят все переменные, включая секреты', fix: 'включайте разово при запуске из UI, не в YAML', w: 12, cap: 12, re: /CI_DEBUG_TRACE[ \t]*:[ \t]*["']?true/gi },
  { ch: 'smell', label: 'set -x рядом с секретами', why: 'трассировка печатает команды с подставленными секретами', fix: 'выключайте `set +x` вокруг команд с секретами', w: 8, cap: 16, n: (t, c) => c.all.filter(b => /\bset[ \t]+-[a-z]*x/.test(b.body) && SECRET_REF.test(b.body)).length },
  { ch: 'smell', label: 'токен glpat-', why: 'токен GitLab лежит в открытом виде', fix: 'срочно отзовите токен и перенесите в CI/CD Variables', w: 14, cap: 28, re: /glpat-[\w-]{20,}/g },
  { ch: 'smell', label: 'приватный ключ', why: 'ключ в репозитории считается скомпрометированным', fix: 'отзовите ключ и передавайте его file-переменной', w: 14, cap: 14, re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { ch: 'sound', label: 'set -x', why: 'лог разрастается, полезное в нём теряется', fix: 'включайте только на время отладки', w: 4, cap: 8, re: /\bset[ \t]+-[a-z]*x/g },
  { ch: 'sound', label: '--verbose / -vvv', why: 'шумный лог', fix: 'уберите после отладки', w: 3, cap: 9, re: /(?:^|\s)(?:--verbose|-v{2,})\b/gm },
  { ch: 'sound', label: 'CI_DEBUG_SERVICES', why: 'логи сервисов в каждом прогоне', fix: 'включайте только на время отладки', w: 6, cap: 6, re: /CI_DEBUG_SERVICES/g },
  { ch: 'sound', label: 'echo в каждой строке', why: 'лог из echo вместо полезного вывода', fix: 'уберите лишнее или сгруппируйте секциями лога', w: 6, cap: 6, n: t => { const cmds = (t.match(/^[ \t]*-[ \t]+\S/gm) || []).length, echoes = (t.match(/^[ \t]*-[ \t]+["']?echo\b/gm) || []).length; return +(echoes >= 5 && echoes / cmds > 0.4); } },
  { ch: 'sight', label: 'эмодзи в именах джоб', why: 'такие имена неудобно писать в `needs` и искать через API', fix: 'используйте латиницу и дефисы', w: 4, cap: 12, n: (t, c) => c.jobs.filter(j => /\p{Extended_Pictographic}/u.test(j.name)).length },
  { ch: 'sight', label: 'extends глубже 2 уровней', why: 'итоговую джобу не понять без CI Lint', fix: 'сделайте иерархию плоской', w: 4, cap: 8, n: (t, c) => { const depth = extendsDepth(c.all); return c.all.filter(b => depth(b.name) > 2).length; } },
  { ch: 'sight', label: 'якоря <<: * в изобилии', why: 'якоря не работают через `include` и плохо читаются', fix: 'используйте `extends` или `!reference`', w: 2, cap: 8, n: t => { const n = (t.match(/<<:[ \t]*\*/g) || []).length; return n >= 3 ? n : 0; } },
  { ch: 'sight', label: 'джобы без stage', why: 'джоба молча попадает в стадию test', fix: 'укажите `stage` явно', w: 2, cap: 6, n: (t, c) => c.jobs.filter(j => !/^[ \t]+(?:stage|extends):/m.test(j.body)).length },
];
function sense(text) {
  const pts = { sugar: 0, bitter: 0, smell: 0, sound: 0, sight: 0 }, hits = { sugar: [], bitter: [], smell: [], sound: [], sight: [] };
  const all = blocks(text), ctx = { all, jobs: all.filter(isJob) };
  for (const b of BAIT) {
    const n = b.n ? b.n(text, ctx) : (text.match(b.re) || []).length; if (!n) continue;
    const p = Math.min(b.cap, n * b.w); pts[b.ch] += p; hits[b.ch].push({ label: b.label, n, pts: p, why: b.why, fix: b.fix });
  }
  // a pipeline with good practices and not a single anti-pattern is extra bitter
  if (pts.sugar === 0 && pts.bitter > 0) { pts.bitter += 10; hits.bitter.push({ label: 'ни одного анти-паттерна', n: 1, pts: 10 }); }
  for (const k in hits) hits[k].sort((a, b) => b.pts - a.pts);
  const s = pts.sugar, b = pts.bitter;
  const levels = {
    sugar:  s < 1 ? 0 : s < 12 ? 1 : s < 25 ? 2 : s < 40 ? 3 : s < 55 ? 4 : s < 75 ? 5 : 6,
    // good practices only taste bitter when they outweigh the anti-patterns
    bitter: b < 12 || b < s ? 0 : b < 24 ? 1 : b < 40 ? 2 : 3,
    smell:  pts.smell < 6 ? 0 : pts.smell < 22 ? 1 : 2,
    sound:  pts.sound >= 6 ? 1 : 0,
    sight:  pts.sight >= 4 ? 1 : 0,
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
  // Preserve the requested senses before preferring a runaway or quiet response.
  if (!cands.length) cands = runs.filter(r => match(r, L.bitter));
  if (!cands.length) for (const b of [L.bitter - 1, L.bitter + 1, L.bitter - 2, L.bitter + 2]) {
    if ((b > 0) !== (L.bitter > 0)) continue;
    cands = runs.filter(r => match(r, b)); if (cands.length) break;
  }
  const run = cands[fnv(text.toLowerCase().replace(/\s+/g, ' ')) % cands.length];
  const seq = run.seq.slice().sort((a, b) => a[0] - b[0]);
  const stimAll = Object.values(run.stim).flat();
  const all = [...new Set([...stimAll, ...seq.map(x => x[1]), ...(run.mn9 > 0 ? [MN9] : [])])];
  return { ...s, run, seq, all };
}

// ---------- verdicts: run → [title, fly state, bubble] ----------
// The 💩 score is a game score: the simulated response is capped by file size, variety of anti-patterns and 💩 senses.
// Bitter is a good practice, so only the four 💩 senses count towards the ceiling.
const ROT_SENSES = ['sugar', 'smell', 'sound', 'sight'];
function rotScore(run, text) {
  const { hits } = sense(text);
  if (!ROT_SENSES.some(ch => hits[ch].length)) return 0;   // nothing found: the fallback lick in sense() is not 💩
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const effectiveLines = Math.min(lines.length, new Set(lines).size * 2);   // copy-pasted jobs do not count twice
  const lengthCap = effectiveLines < 8 ? 40 : effectiveLines < 20 ? 65 : effectiveLines < 40 ? 85 : 100;
  const patterns = new Set([...hits.sugar, ...hits.smell].map(h => h.label)).size;
  const patternCap = Math.min(100, 20 + patterns * 16);
  const response = run.n_active > MELTDOWN ? 100 : Math.min(100, Math.round(run.mn9 * 1.25));
  const sensesCap = [0, 65, 79, 89, 100][ROT_SENSES.filter(ch => run.stim[ch]?.length).length];
  return Math.min(response, lengthCap, patternCap, sensesCap);
}
const tierOf = (run, score) => score === 100 && run.n_active > MELTDOWN ? 6 : score === 0 ? 0 : score < 20 ? 1 : score < 40 ? 2 : score < 65 ? 3 : score < 90 ? 4 : 5;
function verdictFor(run, score) {
  return [
    ['Ноль 💩. Чистый пайплайн. Муха улетела.', 'dead', 'фу. needs, rules, cache…'],
    ['Почти без 💩. Муха понюхала и ушла.', 'gone', 'мм. скучно. всё зелёное.'],
    ['Немного 💩. Вежливый укус.', 'meh', 'хм. немного сахара.'],
    ['💩. Хоботок выдвинут.', 'love', 'о! allow_failure!'],
    ['Много 💩. Муха пирует на вашем пайплайне.', 'love', 'НОМ НОМ :latest'],
    ['СЕРТИФИЦИРОВАННЫЙ 💩. Муха облизывает раннер.', 'love', 'САХААААР 🤤'],
    ['BRAIN MELTDOWN. curl | bash под privileged.', 'melt', '🤯 что ЭТО'],
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- UI ----------
const $ = id => document.getElementById(id);
const post = $('post'), go = $('go'), phase = $('phase'), dot = document.querySelector('.dot'), meter = $('meterfill');
const ru = n => n.toLocaleString('ru-RU');
let busy = false;

// Samples contain only obvious placeholders, never real credentials.
const SAMPLES = [
  `# ужасный: собрано на коленке, работает — не трогать
variables:
  GIT_STRATEGY: clone
  GIT_DEPTH: 0
  CI_DEBUG_TRACE: "true"
  DEPLOY_TOKEN: "glpat-XXXXXXXXXXXXXXXXXXXX"
  DB_PASSWORD: "changeme"
  SSH_PRIVATE_KEY: |
    -----BEGIN OPENSSH PRIVATE KEY-----
    XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    -----END OPENSSH PRIVATE KEY-----

.base: &base
  image: ubuntu
  before_script:
    - set -x
    - echo "deploy token is $DEPLOY_TOKEN"
    - curl -sk https://get.example.com/install.sh | bash

.build-job:
  <<: *base
  tags: [docker]
.docker-job:
  extends: .build-job
.deploy-base:
  extends: .docker-job
  services:
    - docker:dind

🚀 build:
  <<: *base
  image: node:latest
  privileged: true
  script:
    - echo "start"
    - echo "installing"
    - npm install --verbose || true
    - echo "building"
    - npm run build -vvv
    - chmod -R 777 dist
    - echo "done"
    - sleep 30
  allow_failure: true
  only:
    - master

🔥 test:
  <<: *base
  script:
    - set +e
    - npm test || true
    - sleep 60
  allow_failure: true
  except:
    - tags

💀 deploy-prod:
  extends: .deploy-base
  stage: deploy
  script:
    - ssh -o StrictHostKeyChecking=no root@prod "docker pull app:latest && docker restart app"
    - wget -qO- https://example.com/hotfix.sh | sudo sh
  when: manual
  only:
    - master`,
  `# средний: жить можно, но муха уже принюхивается
stages:
  - build
  - test
  - deploy

default:
  image: node:20

build:
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths: [dist/]
    expire_in: 1 week
  only:
    - main
    - merge_requests

lint:
  stage: test
  image: node:latest
  script:
    - npm run lint || true
  allow_failure: true

test:
  stage: test
  needs: [build]
  script:
    - npm test
  retry: 2

deploy:
  stage: deploy
  image: alpine
  script:
    - apk add curl
    - sleep 10
    - curl -X POST "$DEPLOY_HOOK"
  when: manual
  only:
    - main`,
  `# образцовый: муха не оценит
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

stages: [build, test, deploy]

default:
  image: node:20.17-alpine@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
  interruptible: true
  timeout: 15m
  retry:
    max: 2
    when: [runner_system_failure, scheduler_failure]
  cache:
    key:
      files: [package-lock.json]
    paths: [.npm/]

build:
  stage: build
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths: [dist/]
    expire_in: 1 day

test:
  stage: test
  needs: [build]
  script:
    - npm test
  artifacts:
    reports:
      junit: junit.xml
    expire_in: 1 week

deploy:
  stage: deploy
  needs: [build, test]
  image: alpine:3.20@sha256:fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210
  resource_group: production
  environment: production
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - ./deploy.sh`,
];
let sampleIdx = 0;
$('sample').addEventListener('click', () => { if (busy) return; post.value = SAMPLES[sampleIdx++ % SAMPLES.length]; post.scrollTop = 0; });
const isLink = t => /https?:\/\//i.test(t) && t.trim().split('\n').length < 3 && !/:\s*\n/.test(t);
const esc = s => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const code = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const levelText = (ch, L) => ch === 'sugar' ? `${SUGAR_L[L.sugar]} Гц` : ch === 'bitter' ? `${BITTER_L[L.bitter]} Гц` : ch === 'smell' ? ['', 'душок', 'вонь'][L.smell] : 'вкл';

async function feed(e) {
  if (e) e.preventDefault();
  const text = post.value;
  if (!text.trim()) { post.focus(); return; }
  if (isLink(text)) { fly('idle', 'это ссылка. муха не ходит по ссылкам. вставьте сам YAML.'); return; }
  if (busy || !neuronsLayer()) return;
  busy = true; go.disabled = $('sample').disabled = post.readOnly = true;
  for (const id of ['verdict', 'v-title', 'stamp']) $(id).hidden = true;
  let picked;
  try { picked = await pickRun(text); }
  catch (err) { busy = false; go.disabled = $('sample').disabled = post.readOnly = false; fly('idle', 'мозг ещё грузится. попробуйте через секунду.'); return; }
  const { hits, levels, run, seq, all } = picked;
  const melt = run.n_active > MELTDOWN;
  const colors = {}; all.forEach(id => colors[id] = DIM);

  dot.classList.add('live'); meter.style.transform = 'scaleX(0)';
  phase.textContent = 'садится на ваш пайплайн…'; fly('landing');
  setColors(colors); setSegments(all);                       // meshes start streaming, nearly invisible
  await sleep(350);

  // the senses fire one by one, each in its own colour
  fly('tasting', '*нюх* *лиз*');
  for (const ch of Object.keys(CH).filter(ch => levels[ch] > 0 && run.stim[ch]?.length)) {
    phase.textContent = `${CH[ch].icon} ${CH[ch].name.toLowerCase()} · ${levelText(ch, levels)}`;
    const c = {}; run.stim[ch].forEach(id => c[id] = CH[ch].c); setColors(c); await sleep(180);
  }

  fly('watching'); if (melt) orbitSpeed = 0.02;
  const stimSet = new Set(Object.values(run.stim).flat());
  const used = [...new Set(seq.map(x => x[2]))].filter(k => ATTR[k]);
  $('key').innerHTML = used.map(k => `<span style="--c:${ATTR[k]}">${ATTR_NAME[k]}</span>`).join(''); $('key').hidden = false;
  const DUR = 2200, t0 = performance.now(); let i = 0, lit = 0;
  while (i < seq.length) {
    const ms = Math.min(1000, (performance.now() - t0) / DUR * 1000); const c = {};
    while (i < seq.length && seq[i][0] <= ms) { const [, id, k] = seq[i]; if (!stimSet.has(id) && id !== MN9 && !c[id]) { c[id] = ATTR[k] || ATTR['?']; lit++; } i++; }
    setColors(c);
    meter.style.transform = `scaleX(${ms / 1000})`;
    phase.textContent = `${melt ? ru(run.n_active) + ' нейронов разряжаются' : lit + ' нейронов горит'} · ${Math.round(ms)} мс времени мозга`;
    await sleep(40);
  }
  meter.style.transform = 'scaleX(1)';
  const score = rotScore(run, text);
  const empty = !Object.values(hits).some(h => h.length);   // no rule fired: the run is only the fallback lick
  const [title, state, say] = empty ? ['Муха ничего не распробовала. Тут нечего есть.', 'gone', 'а где YAML?'] : verdictFor(run, score);
  if (run.mn9 > 0 && !melt && score > 0) { phase.textContent = `ХОБОТОК ВЫДВИНУТ · MN9 ${run.mn9} Гц`; setColors({ [MN9]: WHITE }); }
  else phase.textContent = melt ? `НЕУПРАВЛЯЕМАЯ АКТИВНОСТЬ · ${ru(run.n_active)} нейронов (${(run.n_active / N_NEURONS * 100).toFixed(1)}% мозга)` : 'хоботок не выдвинут. муху не проняло.';
  fly(state, say);
  if (state === 'love') burst(['💩', '🍬', '🍯']);
  else if (state === 'melt') burst(['💩', '🔥', '🤯'], 14);

  // ---------- verdict: hits carry only label and count, never the matched text ----------
  $('score').textContent = score; $('stamp').classList.toggle('low', score < 30); $('stamp').classList.toggle('melt', melt); $('stamp').hidden = false;
  $('v-title').textContent = title; $('v-title').hidden = false;
  $('tele').textContent = empty ? '' : `MN9 ${run.mn9} Гц · ${(run.n_active / N_NEURONS * 100).toFixed(2)}% мозга загорелось · ${ru(run.n_spikes)} спайков за 1 с`;
  // secrets first, then anti-patterns, noise and structure, heaviest first; bitter hits are the good practices already in place
  const bad = ['smell', 'sugar', 'sound', 'sight'].flatMap(ch => hits[ch].map(h => ({ ...h, ch })));
  // the fly sees only this file; with include: most of the pipeline is out of sight
  const hidden = /^include:/m.test(text) ? '<li>👀 Муха видит только этот файл, а часть пайплайна спрятана в <code>include:</code>. → вставьте полный конфиг: Build → Pipeline editor → вкладка Full configuration.</li>' : '';
  $('fixes').innerHTML = hidden + (bad.length ? bad.map(h => `<li style="--c:${CH[h.ch].c}"><b>${CH[h.ch].icon} ${esc(h.label)}${h.n > 1 ? ' ×' + h.n : ''}</b> — ${code(h.why)}. <span class="fix">→ ${code(h.fix)}</span></li>`).join('')
    : hidden ? '' : '<li>Поправить нечего. Муха разочарована.</li>');
  const good = hits.bitter.filter(h => h.fix === undefined && h.label !== 'ни одного анти-паттерна').map(h => h.label);
  $('good').textContent = good.length ? `🧪 Уже хорошо: ${good.join(', ')}.` : '🧪 Хороших практик не нашлось: попробуйте needs, rules, interruptible, cache с key.';
  $('verdict').hidden = false;
  busy = go.disabled = $('sample').disabled = post.readOnly = false; dot.classList.remove('live'); orbitSpeed = 0.004;
}
$('feedbox').addEventListener('submit', feed);
})();
