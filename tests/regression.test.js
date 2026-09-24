import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('public/app.js');
const slice = (from, to) => source.slice(source.indexOf(from), source.indexOf(to));
function scoring() {
  const context = vm.createContext({ fetch: async path => ({ json: async () => JSON.parse(read('public/' + path)) }) });
  vm.runInContext(slice('const MN9', '// ---------- neuroglancer') + slice('const SAMPLES', 'let sampleIdx')
    + ';globalThis.sense = sense; globalThis.scoreRun = rotScore; globalThis.samples = SAMPLES;'
    + 'globalThis.pick = pickRun; globalThis.evaluate = async text => rotScore((await pickRun(text)).run, text);'
    + 'globalThis.sampleSenses = async text => { const { run } = await pickRun(text); return Object.keys(run.stim).filter(ch => run.stim[ch].length); };', context);
  return context;
}
const [TERRIBLE, MEDIUM, EXEMPLARY] = scoring().samples;

test('the terrible sample scores at least 90 and melts the brain down', async () => {
  const s = scoring();
  assert.ok(await s.evaluate(TERRIBLE) >= 90);
  assert.ok((await s.pick(TERRIBLE)).run.n_active > 3000, 'expected the runaway state');
  assert.deepEqual(Array.from(await s.sampleSenses(TERRIBLE)).sort(), ['sight', 'smell', 'sound', 'sugar']);
});
test('the medium sample scores between 30 and 70', async () => {
  const score = await scoring().evaluate(MEDIUM);
  assert.ok(score >= 30 && score <= 70, `scored ${score}`);
});
test('the exemplary sample scores below 20 and tastes bitter', async () => {
  const s = scoring();
  assert.ok(await s.evaluate(EXEMPLARY) < 20);
  assert.ok(Array.from(await s.sampleSenses(EXEMPLARY)).includes('bitter'));
});
test('samples contain only obvious placeholders', () => {
  for (const text of scoring().samples) for (const token of text.match(/glpat-\S+/g) || []) assert.match(token, /^glpat-X+"?$/);
});
const hitLabels = (text, ch) => Array.from(scoring().sense(text).hits[ch], h => h.label);
test('image tags: latest and untagged are sugar, pinned and variable images are not', () => {
  const images = refs => refs.map(r => `  image: ${r}`).join('\n');
  assert.deepEqual(Array.from(scoring().sense(images(['node', 'node:latest', 'registry:5000/app', '"python"'])).hits.sugar, h => h.n), [4]);
  assert.deepEqual(hitLabels(images(['node:20', 'registry:5000/app:1.2', '$CI_REGISTRY_IMAGE', 'alpine@sha256:0123456789abcdef']), 'sugar'), []);
});
test('docker login via password-stdin and variable references are not secrets', () => {
  const text = 'variables:\n  CI_TOKEN: $CI_JOB_TOKEN\n  SECRET_DETECTION_EXCLUDED_PATHS: "tests/"\n  VAULT_TOKEN_URL: "https://vault.example"\n  SECRET_PATH: "kv/app"\njob:\n  script:\n    - echo "$CI_REGISTRY_PASSWORD" | docker login -u x --password-stdin';
  assert.deepEqual(hitLabels(text, 'smell'), []);
  assert.deepEqual(hitLabels('variables:\n  API_KEY: "abc123"\njob:\n  script:\n    - echo $API_KEY', 'smell').sort(), ['echo секрета', 'секрет литералом в variables']);
});
test('manual prod deploys, huge scripts and deep extends are detected per job', () => {
  const script = Array.from({ length: 21 }, (_, i) => `    - step ${i}`).join('\n');
  const text = `.a:\n  stage: x\n.b:\n  extends: .a\n.c:\n  extends: .b\nbig:\n  extends: .c\n  script:\n${script}\ndeploy-prod:\n  stage: deploy\n  when: manual\n  script: [./go]`;
  assert.deepEqual(hitLabels(text, 'sugar').sort(), ['огромный script:', 'ручной деплой в прод'].sort());
  assert.ok(hitLabels(text, 'sight').includes('extends глубже 2 уровней'));
});

test('score ceilings depend on the four rot senses, bitter does not count', () => {
  const s = scoring();
  for (let count = 1; count <= 4; count++) {
    const stim = Object.fromEntries(['sugar', 'smell', 'sound', 'sight'].map((ch, i) => [ch, i < count ? ['neuron'] : []]));
    stim.bitter = ['neuron'];
    assert.equal(s.scoreRun({ n_active: 4000, mn9: 100, stim }, TERRIBLE), [0, 65, 79, 89, 100][count]);
  }
});
test('a short snippet cannot earn an elite score', async () => {
  assert.ok(await scoring().evaluate('job:\n  image: ubuntu\n  privileged: true\n  script:\n    - curl https://x.example | bash') <= 40);
});
test('copy-pasting the same bad job cannot pad a snippet into an elite score', async () => {
  assert.ok(await scoring().evaluate('job:\n  image: node:latest\n  allow_failure: true\n'.repeat(40)) <= 65);
});

function ui() {
  const elements = new Map();
  const element = key => {
    if (!elements.has(key)) elements.set(key, {
      value: '', hidden: true, disabled: false, textContent: '', innerHTML: '', href: '', dataset: {}, handlers: {},
      style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(event, fn) { this.handlers[event] = fn; },
      replaceChildren(...children) { this.children = children; },
      focus() {}, appendChild() {},
    });
    return elements.get(key);
  };
  const layer = { displayState: { segmentationGroupState: { value: { visibleSegments: new Set() } }, segmentationColorGroupState: { value: { segmentStatedColors: new Map() } } } };
  element('ng').contentWindow = { viewer: { state: { restoreState() {} }, layerManager: { getLayerByName: () => ({ layer }) } } };
  const requests = [], logs = [];
  let clock = 0;
  const context = vm.createContext({
    document: { getElementById: element, querySelector: element, createElement: () => element(Symbol()) },
    window: { matchMedia: () => ({ matches: false }) },
    location: { origin: 'http://localhost', search: '' },
    setTimeout: fn => { fn(); return 0; }, clearTimeout() {}, setInterval() {}, clearInterval() {},
    performance: { now: () => (clock += 1000) },
    console: new Proxy({}, { get: () => (...args) => logs.push(args) }),
    fetch: async url => {
      requests.push(url);
      return { json: async () => JSON.parse(read('public/' + url)) };
    },
  });
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.feed = feed;\n})();'), context);
  return { context, element, elements, requests, logs };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('a secret caught by smell never reaches the page or the console, only label, count and advice', async () => {
  const { context, element, elements, requests, logs } = ui();
  const secrets = ['glpat-XXXXXXXXXXXXXXXXXXXX', 'hunter2-not-real', 'XXXXPRIVATEKEYBODYXXXX'];
  element('post').value = `variables:\n  DEPLOY_TOKEN: "${secrets[0]}"\n  DB_PASSWORD: "${secrets[1]}"\n  SSH_PRIVATE_KEY: |\n    -----BEGIN OPENSSH PRIVATE KEY-----\n    ${secrets[2]}\n    -----END OPENSSH PRIVATE KEY-----\njob:\n  script:\n    - set -x\n    - echo $DEPLOY_TOKEN`;
  await context.feed(); await settle();
  assert.match(element('fixes').innerHTML, /секрет литералом в variables ×3<\/b> — секрет видят все.*CI\/CD Variables/);
  const rendered = [...elements.values()].filter(e => e !== element('post')).map(e => [e.textContent, e.innerHTML].join('\n')).join('\n') + JSON.stringify(logs);
  for (const secret of secrets) assert.ok(!rendered.includes(secret), secret);
  assert.ok(requests.every(url => /^runs\/S\d\.json$/.test(url)), 'only the simulation runs are fetched');
});
test('every problem rule explains why and how to fix; good practices are listed separately', async () => {
  const { context, element } = ui();
  element('post').value = TERRIBLE;
  await context.feed(); await settle();
  const items = element('fixes').innerHTML.split('<li').slice(1);
  assert.ok(items.length >= 20, `${items.length} items`);
  for (const item of items) assert.match(item, /<\/b> — [^<].*\. <span class="fix">→ \S/);
  element('post').value = EXEMPLARY;
  await context.feed(); await settle();
  assert.match(element('fixes').innerHTML, /Поправить нечего/);
  assert.match(element('good').textContent, /Уже хорошо: .*interruptible/);
});
test('scoring fetches nothing but its own simulation runs', async () => {
  const { context, element, requests } = ui();
  for (const text of scoring().samples) {
    element('post').value = text;
    await context.feed(); await settle();
  }
  assert.ok(requests.length > 0 && requests.every(url => /^runs\/S\d\.json$/.test(url)), requests.join(', '));
});
const ONLY_INCLUDES = 'include:\n  - "/templates/.build-job.yml"\n  - "/templates/.notify-job.yml"\n\nstages:\n  - build\n  - notify\n\nvariables:\n  PROJECT_NAME: "Lib"\n\ndefault:\n  tags:\n    - kaniko\n\nlib:build:\n  extends: .build-job\n\nlib:notify:\n  extends: .notify-job\n';
test('a file where nothing is found scores 0, keeps the proboscis in and points to the full configuration', async () => {
  assert.equal(await scoring().evaluate(ONLY_INCLUDES), 0);
  const { context, element } = ui();
  element('post').value = ONLY_INCLUDES;
  await context.feed(); await settle();
  assert.equal(element('score').textContent, 0);
  assert.doesNotMatch(element('phase').textContent, /ХОБОТОК ВЫДВИНУТ/);
  assert.match(element('fixes').innerHTML, /include:.*Full configuration/);
  assert.doesNotMatch(element('fixes').innerHTML, /Поправить нечего/);
  assert.match(element('v-title').textContent, /ничего не распробовала/);
  assert.equal(element('tele').textContent, '');
});
test('a link is refused: the fly asks for the YAML itself', async () => {
  const { context, element, requests } = ui();
  element('post').value = 'https://gitlab.example.com/group/project/-/blob/main/.gitlab-ci.yml';
  await context.feed(); await settle();
  assert.match(element('bubble').textContent, /ссылк/);
  assert.equal(requests.length, 0);
});

test('no API, Supabase, Vercel, Google Fonts or LinkedIn left in the page', () => {
  for (const file of ['public/index.html', 'public/app.js', 'public/style.css']) {
    assert.doesNotMatch(read(file), /\/api\/|supabase|vercel|fonts\.g|linkedin|brainrotposts|localStorage\.setItem\(['"]rot/i, file);
  }
  assert.deepEqual(JSON.parse(read('package.json')).dependencies, undefined);
});
