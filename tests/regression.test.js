import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import rate from '../api/rate.js';
import publish from '../api/publish.js';
import top from '../api/top.js';

const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function scoring() {
  const context = vm.createContext({ fetch: async path => ({ json: async () => JSON.parse(fs.readFileSync(new URL('../public/' + path, import.meta.url), 'utf8')) }) });
  vm.runInContext(source.slice(source.indexOf('const MN9'), source.indexOf('// ---------- neuroglancer')) + source.slice(source.indexOf('const SAMPLES'), source.indexOf('let sampleIdx')) + ';globalThis.sampleSenses = async text => { const { run } = await pickRun(text); return Object.keys(run.stim).filter(ch => run.stim[ch].length); }; globalThis.scoreRun = rotScore; globalThis.samples = SAMPLES; globalThis.evaluate = async text => rotScore((await pickRun(text)).run, text);', context);
  return context;
}
test('every sample scores below 100 with the real simulation data', async () => {
  const s = scoring();
  for (const text of s.samples) {
    const result = await s.evaluate(text);
    assert.ok(result >= 30 && result < 90, `${text.slice(0, 40)} scored ${result}`);
  }
});
const SLOP = `Humbled and grateful to announce a pivotal milestone in my incredible journey. Three years ago I got rejected by every investor in town. Today our visionary community is transforming the landscape through seamless innovation and authentic leadership. Let that sink in.

Here is what nobody talks about: your network is your net worth. Every closed door is simply an invitation to build a bigger house. I woke up before sunrise, wrote my intentions, looked in the mirror, and chose abundance over fear. This is the secret blueprint that separates ordinary people from extraordinary founders.

We are not just building a company but also cultivating a movement. Delve into the tapestry of transformative growth and you will discover a testament to resilience. My team taught me that passion beats perfection, purpose beats profit, and vulnerability unlocks limitless potential. The next chapter belongs to those brave enough to dream without permission.

Hot take: success is never about the destination. It is about showing up when nobody is watching, celebrating every tiny victory, and turning your deepest setbacks into your greatest superpowers. I am thrilled to share this playbook with everyone who believed in our vision from the beginning. We rise by lifting others. Agree? Repost to inspire your network. #mindset #founders #journey 🚀🔥`;
test('long slop cannot reach 100 without all five actual senses', async () => {
  assert.ok(await scoring().evaluate(SLOP) <= 89);
});
test('score ceilings depend on stimulated senses, not just detected vocabulary', () => {
  const s = scoring();
  for (let count = 1; count <= 5; count++) {
    const stim = Object.fromEntries(['sugar', 'bitter', 'smell', 'sound', 'sight'].map((ch, i) => [ch, i < count ? ['neuron'] : []]));
    assert.equal(s.scoreRun({ n_active: 4000, mn9: 100, stim }, SLOP), [0, 65, 79, 89, 95, 100][count]);
  }
});
test('sustained varied slop with five senses can reach 100 using real simulation data', async () => {
  const s = scoring();
  const text = fs.readFileSync(new URL('./fixtures/five-senses.txt', import.meta.url), 'utf8');
  assert.equal((await s.sampleSenses(text)).length, 5);
  assert.equal(await s.evaluate(text), 100);
});
test('short bait and short AI vocabulary cannot earn elite scores', async () => {
  for (const text of ['I got rejected. Then I tried again. Agree?', 'Delve into a seamless tapestry of transformative innovation. Leverage this pivotal paradigm.']) {
    assert.ok(await scoring().evaluate(text) <= 25);
  }
});
test('repetition cannot pad a short post into an elite score', async () => {
  assert.ok(await scoring().evaluate('Humbled to announce my incredible journey. Agree? '.repeat(50)) <= 40);
});
test('length alone does not turn substance into elite slop', async () => {
  assert.ok(await scoring().evaluate(('We measured API latency across 200 calls because the SQL query was slow. However the index reduced execution time from 90 ms to 40 ms. ').repeat(12)) < 40);
});

function response() {
  return { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, end() { return this; } };
}
function setup(t, fetch) {
  t.mock.method(globalThis, 'fetch', fetch);
  for (const [key, value] of Object.entries({ SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_KEY: 'test-only' })) {
    const old = process.env[key]; process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
}
test('scoring ignores caller consent, saves privately, and returns an ownership receipt', async t => {
  let row;
  setup(t, async (url, opts) => {
    if (opts.method === 'POST') { row = JSON.parse(opts.body); return { ok: true, json: async () => [{ id: 42 }] }; }
    return { headers: { get: () => '0-0/2' } };
  });
  const res = response();
  await rate({ method: 'POST', body: { post: 'My post', is_public: true }, headers: {} }, res);
  assert.equal(row.is_public, false);
  assert.equal(res.body.id, 42);
  assert.match(res.body.token, /^[a-f0-9]{64}$/);
  assert.equal(row.publish_token_hash, createHash('sha256').update(res.body.token).digest('hex'));
  assert.equal(row.token, undefined);
});
test('publishing requires both the result ID and its receipt', async t => {
  let requested = false;
  setup(t, async (url, opts) => {
    requested = true;
    assert.ok(url.includes('id=eq.42&publish_token_hash=eq.' + createHash('sha256').update('a'.repeat(64)).digest('hex')));
    assert.deepEqual(JSON.parse(opts.body), { is_public: true });
    return { ok: true, json: async () => [{ id: 42 }] };
  });
  const invalid = response();
  await publish({ method: 'POST', body: { id: 42 } }, invalid);
  assert.equal(invalid.code, 400); assert.equal(requested, false);
  const valid = response();
  await publish({ method: 'POST', body: { id: 42, token: 'a'.repeat(64) } }, valid);
  assert.equal(valid.body.ok, true);
});
test('wrong ownership receipt cannot publish a result', async t => {
  setup(t, async () => ({ ok: true, json: async () => [] }));
  const res = response();
  await publish({ method: 'POST', body: { id: 42, token: 'b'.repeat(64) } }, res);
  assert.equal(res.code, 404); assert.equal(res.body.ok, false);
});
test('hall filters both rankings by explicit consent', async t => {
  let calls = 0;
  setup(t, async url => {
    assert.equal(new URL(url).searchParams.get('is_public'), 'eq.true'); calls++;
    return { ok: true, json: async () => [] };
  });
  const res = response(); await top({}, res);
  assert.equal(calls, 2); assert.equal(res.code, 200);
});
test('hall fails closed if database has not migrated', async t => {
  setup(t, async () => ({ ok: false }));
  const res = response(); await top({}, res);
  assert.equal(res.code, 500); assert.deepEqual(res.body.top, []);
});

function ui() {
  const elements = new Map();
  const element = key => {
    if (!elements.has(key)) elements.set(key, {
      value: '', hidden: true, disabled: false, textContent: '', dataset: {}, handlers: {},
      style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(event, fn) { this.handlers[event] = fn; },
      replaceChildren(...children) { this.children = children; },
      showModal() { this.open = true; }, close() { this.open = false; }, setAttribute() {}, appendChild() {}, querySelectorAll() { return []; }, focus() {}, setSelectionRange() {}, scrollIntoView() {},
    });
    return elements.get(key);
  };
  const layer = { displayState: { segmentationGroupState: { value: { visibleSegments: new Set() } }, segmentationColorGroupState: { value: { segmentStatedColors: new Map() } } } };
  element('ng').contentWindow = { viewer: { state: { restoreState() {} }, layerManager: { getLayerByName: () => ({ layer }) } } };
  const requests = [];
  let clock = 0;
  const context = vm.createContext({
    document: { getElementById: element, querySelector: element, createElement: () => element(Symbol()) },
    window: { matchMedia: () => ({ matches: false }), scrollTo() {} },
    URL: { createObjectURL: () => 'blob:test-image', revokeObjectURL() {} },
    location: { origin: 'http://localhost', search: '' },
    localStorage: { getItem: () => null },
    setTimeout: fn => { fn(); return 0; }, clearTimeout() {}, setInterval() {}, clearInterval() {},
    performance: { now: () => (clock += 1000) },
    fetch: async (url, opts) => {
      if (url.startsWith('runs/')) return { json: async () => JSON.parse(fs.readFileSync(new URL('../public/' + url, import.meta.url))) };
      requests.push({ url, opts });
      return { ok: true, json: async () => url === '/api/top' ? { top: [], bottom: [] } : opts?.method === 'POST' ? { ok: true, id: requests.length, token: 'a'.repeat(64), count: 2 } : { count: 1 } };
    },
  });
  vm.runInContext(source.replace('loadHall();\n})();', 'loadHall(); globalThis.feed = feed;\n})();'), context);
  return { context, element, requests };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('result prompts track actual senses; editing preserves the last result', async () => {
  const { context, element, requests } = ui();
  element('post').value = 'I got rejected. Then I tried again. Agree?';
  await context.feed(); await settle();
  assert.equal(element('score').textContent, 25);
  assert.equal(element('publish').disabled, false);
  assert.equal(requests.filter(r => r.url === '/api/publish').length, 0);
  assert.match(element('experiment-hint').textContent, /two emojis/);
  assert.match(element('explore-title').textContent, /1\/5 senses/);
  element('post').handlers.input();
  assert.equal(element('post').value, 'I got rejected. Then I tried again. Agree?');
  assert.equal(element('publish').disabled, false);
  assert.equal(element('verdict').hidden, false);
  element('post').value += ' 🎉🎉';
  await context.feed(); await settle();
  assert.match(element('explore-title').textContent, /2\/5 senses/);
  assert.match(element('experiment-hint').textContent, /EXCLAMATION/);
  await element('publish').handlers.click();
  assert.equal(requests.filter(r => r.url === '/api/publish').length, 1);
  assert.equal(element('publish').textContent, 'Added to Hall of Rot');
  assert.equal(element('publish').disabled, true);
});
test('a delayed save response cannot enable publishing after starting a new post', async () => {
  const { context, element } = ui();
  element('post').value = 'Today I fixed a bug.';
  await context.feed();
  await context.feed(); // The main form starts a new post after a completed result.
  await settle();
  assert.equal(element('publish').disabled, true);
});

test('sense count belongs to the current post and buttons explain inactive senses', async () => {
  const { context, element } = ui();
  element('post').value = 'I got rejected. Then I tried again. Agree? 🎉🎉';
  await context.feed(); await settle();
  assert.match(element('explore-title').textContent, /2\/5 senses/);
  element('post').handlers.input();
  element('post').value = 'Today I fixed a bug.';
  await context.feed(); await settle();
  assert.match(element('explore-title').textContent, /1\/5 senses/);
  const sight = element('sense-progress').children[4];
  sight.handlers.focus();
  assert.match(element('experiment-hint').textContent, /Not activated.*two emojis/);
});


test('each sense example activates its intended input and the previous draft can be restored', async () => {
  for (const [index, channel] of ['sugar', 'bitter', 'smell', 'sound', 'sight'].entries()) {
    const { context, element } = ui();
    const original = 'I got rejected. Then I tried again. Agree?';
    element('post').value = original;
    await context.feed(); await settle();
    const chip = element('sense-progress').children[index];
    assert.equal(chip.title, undefined, 'No duplicate native tooltip');
    chip.handlers.click();
    assert.notEqual(element('post').value, original);
    assert.equal(element('publish').disabled, false);
    assert.equal(element('verdict').hidden, false);
    assert.equal(element('result-context').hidden, false);
    assert.equal(element('restore-post').hidden, false);
    await context.feed(); await settle();
    assert.match(element('sense-progress').children[index].className, /active/, channel);
    element('restore-post').handlers.click();
    assert.equal(element('post').value, original);
    assert.equal(element('restore-post').hidden, true);
  }
});

test('typing preserves the brain verdict and sharing receipt until resubmission', async () => {
  const { context, element, requests } = ui();
  element('post').value = 'I got rejected. Then I tried again. Agree?';
  await context.feed(); await settle();
  const oldScore = element('score').textContent;
  element('post').value = 'An edited draft';
  element('post').handlers.input();
  element('post').handlers.input();
  assert.equal(element('post').value, 'An edited draft');
  assert.equal(element('stamp').hidden, false);
  assert.equal(element('verdict').hidden, false);
  assert.equal(element('score').textContent, oldScore);
  assert.equal(element('publish').disabled, false);
  assert.equal(element('result-context').hidden, false);
  await element('publish').handlers.click();
  const publication = requests.find(r => r.url === '/api/publish');
  assert.ok(publication);
  assert.equal(requests.filter(r => r.url === '/api/rate' && r.opts?.method === 'POST').length, 1);
  await context.feed(); await settle();
  assert.equal(element('result-context').hidden, true);
});

test('sample progression explores two senses, two different senses, then four including bitter', async () => {
  const s = scoring();
  const expected = [['sugar', 'sight'], ['smell', 'sound'], ['sugar', 'bitter', 'smell', 'sight']];
  for (let i = 0; i < expected.length; i++) {
    assert.deepEqual(Array.from(await s.sampleSenses(s.samples[i])).sort(), expected[i].sort());
  }
});


test('hall returns the complete post including paragraph breaks', async t => {
  const post = 'Humbled to announce.\n\n' + 'My incredible journey. '.repeat(90) + '<the end>';
  setup(t, async () => ({ ok: true, json: async () => [{ id: 7, post, fly_score: 84, votes: 2, n_active: 100 }] }));
  const res = response(); await top({}, res);
  assert.equal(res.body.top[0].post, post);
  assert.equal(res.body.bottom[0].post, post);
});

test('image export preserves the scored brain and rating while the draft is edited', async () => {
  const { context, element } = ui();
  let frame = 'original-frame', exported;
  context.window.BrainRotImage = {
    capture: () => frame,
    render: async result => { exported = result; return {}; },
  };
  element('post').value = 'I got rejected. Then I tried again. Agree?';
  await context.feed(); await settle();
  frame = 'later-frame';
  element('post').value = 'A changed draft'; element('post').handlers.input();
  await element('share').handlers.click();
  assert.equal(exported.brain, 'original-frame');
  assert.equal(exported.score, 25);
  assert.equal(element('result-image-dialog').open, true);
  assert.equal(element('download-image').download, 'brain-rot-25.png');
});

test('a stale image export cannot open after starting a new post', async () => {
  const { context, element } = ui();
  let finish;
  context.window.BrainRotImage = { capture: () => 'frame', render: () => new Promise(resolve => { finish = resolve; }) };
  element('post').value = 'I got rejected. Then I tried again. Agree?';
  await context.feed(); await settle();
  const saving = element('share').handlers.click();
  await context.feed();
  finish({}); await saving;
  assert.notEqual(element('result-image-dialog').open, true);
});

test('brain capture redraws before reading the real canvas', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(new URL('../public/result-image.js', import.meta.url), 'utf8'), context);
  const calls = [];
  const image = context.window.BrainRotImage.capture({ display: {
    draw: () => calls.push('draw'),
    canvas: { width: 800, height: 600, toDataURL: type => { calls.push(type); return 'captured'; } },
  } });
  assert.equal(image, 'captured');
  assert.deepEqual(calls, ['draw', 'image/png']);
  assert.throws(() => context.window.BrainRotImage.capture(null), /not ready/);
});


test('submitting preserves the original post whitespace for the Hall', async () => {
  const { context, element, requests } = ui();
  const original = '  My opening line.\n\n• First point\n    Indented continuation\n\nLast line.  ';
  element('post').value = original;
  await context.feed(); await settle();
  const request = requests.find(r => r.url === '/api/rate' && r.opts?.method === 'POST');
  assert.equal(JSON.parse(request.opts.body).post, original);
});
