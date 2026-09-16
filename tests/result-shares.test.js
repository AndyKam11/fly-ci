import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import save from '../api/result-share.js';
import image from '../api/result-image.js';
import share from '../api/share.js';
const ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'a'.repeat(64);
function res() { return { code: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(c) { this.code=c;return this; }, json(body) { this.body=body;return this; }, send(body) { this.body=body;return this; }, end() { return this; } }; }
function setup(t, fetch) {
  t.mock.method(globalThis, 'fetch', fetch);
  for (const [key, value] of Object.entries({ SUPABASE_URL:'https://database.example', SUPABASE_SERVICE_KEY:'test-only' })) {
    const old=process.env[key];process.env[key]=value;
    t.after(()=>{if(old===undefined) delete process.env[key];else process.env[key]=old;});
  }
}
const reply = rows => ({ok:true,json:async()=>rows});
// Header-sized fixture exercises the upload envelope; browser rendering produces the real PNG.
function png() {
  const b=Buffer.alloc(45);Buffer.from('89504e470d0a1a0a','hex').copy(b);
  b.write('IHDR',12);b.writeUInt32BE(1200,16);b.writeUInt32BE(630,20);
  Buffer.from('0000000049454e44ae426082','hex').copy(b,33);return b.toString('base64');
}
test('image upload requires the private result receipt',async t=>{
  setup(t,async url=>{assert.ok(url.includes(createHash('sha256').update(TOKEN).digest('hex')));return reply([]);});
  const r=res();await save({method:'POST',body:{id:42,token:TOKEN,image:png()}},r);assert.equal(r.code,404);
});
test('sharing stores only the result image and authoritative score, without publishing the post',async t=>{
  let stored;
  setup(t,async(url,opts)=>{
    if(url.includes('/ratings?')) { assert.equal(opts.method,undefined);return reply([{id:42,fly_score:36}]); }
    if(opts.method==='POST') { stored=JSON.parse(opts.body);return reply([{id:stored.id}]); }
    return reply([]);
  });
  const r=res();await save({method:'POST',body:{id:42,token:TOKEN,image:png(),score:100,post:'private text'}},r);
  assert.equal(r.code,200);assert.equal(stored.score,36);assert.equal(stored.post,undefined);assert.equal(stored.is_public,undefined);
  assert.equal(r.body.url,`https://brainrotposts.com/s?id=${stored.id}`);
});
test('repeated sharing reuses the immutable screenshot',async t=>{
  setup(t,async(url,opts)=>{assert.notEqual(opts.method,'POST');return reply(url.includes('/ratings?')?[{id:42,fly_score:36}]:[{id:ID}]);});
  const r=res();await save({method:'POST',body:{id:42,token:TOKEN}},r);assert.equal(r.body.url,`https://brainrotposts.com/s?id=${ID}`);
});
test('invalid and oversized images are rejected before storage',async t=>{
  setup(t,async(url,opts)=>{assert.notEqual(opts.method,'POST');return reply(url.includes('/ratings?')?[{id:42,fly_score:36}]:[]);});
  for(const payload of ['not a png','A'.repeat(2000001),Buffer.from('<svg/>').toString('base64')]) {
    const r=res();await save({method:'POST',body:{id:42,token:TOKEN,image:payload}},r);assert.equal(r.code,400);
  }
});
test('share page exposes a stable screenshot to crawlers without redirecting or exposing original text',async t=>{
  setup(t,async url=>{assert.ok(url.includes('select=id,score'));return reply([{id:ID,score:36}]);});
  const r=res();await share({query:{id:ID}},r);
  assert.equal(r.code,200);assert.match(r.body,/og:image.*api\/result-image/);assert.match(r.body,/36% brain rot/);
  assert.ok(!r.body.includes('location.replace'));assert.ok(!r.body.includes('http-equiv="refresh"'));
  assert.ok(r.body.includes('Feed the fly your post'));
});
test('public screenshot is served as immutable PNG, and unknown ids fail closed',async t=>{
  setup(t,async()=>reply([{image_base64:png()}]));
  const r=res();await image({method:'GET',query:{id:ID}},r);
  assert.equal(r.headers['content-type'],'image/png');assert.match(r.headers['cache-control'],/immutable/);assert.equal(r.body.toString('base64'),png());
  const invalid=res();await image({method:'GET',query:{id:'invalid'}},invalid);assert.equal(invalid.code,404);
});
