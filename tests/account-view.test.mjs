import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = await fs.readFile(new URL('../desktop/ui/account-view.js', import.meta.url), 'utf8');
const exported = { module: { exports: {} } }; vm.runInNewContext(source, exported);
const { windowText, tokenText, noticeText, quotaLabel, remainingPercent, dialogueText } = exported.module.exports;

test('quota periods remain distinct regardless of incoming label',()=>{
  assert.equal(quotaLabel({windowDurationMins:300,label:'primary'}),'5 小时额度');
  assert.equal(quotaLabel({windowDurationMins:10080,label:'secondary'}),'每周额度');
  assert.equal(quotaLabel({windowDurationMins:60,label:'独立窗口'}),'独立窗口');
});

test('missing snapshot values never become zero quota or tokens', () => {
  for (const value of [null, undefined, NaN, Infinity, -1, '50']) {
    assert.equal(windowText({ usedPercent: value }), '额度比例未知');
    assert.equal(tokenText(value), '暂无记录');
  }
  assert.match(windowText({ usedPercent: 25.5, stale: true }), /剩余 74.5% · 已用 25.5%（快照已过期）/);
  assert.equal(tokenText(0), '0 token');
});
test('subscription failure consumption displays tokens without API money or fun failure text', () => {
  assert.equal(noticeText({ completionKind: 'failed', tokens: 10, amount: 5 }), '本轮本机已观测：10 token');
  assert.equal(noticeText({ completionKind: 'failed', failureKind: 'high-demand' }), '挤不进去...');
  assert.equal(noticeText({ completionKind: 'completed', tokens: 10, amount: 5 }), '本轮本机已观测：10 token');
});
function runtime(fetch) {
  const storage = new Map(); const events = [];
  const context = { document: { documentElement: {dataset:{}}, readyState: 'loading', addEventListener() {}, querySelectorAll(){return []} }, window: { dispatchEvent(e) { events.push(e); } }, localStorage: { getItem(k) { return storage.get(k); }, setItem(k,v) { storage.set(k,v); } }, fetch, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } };
  vm.runInNewContext(source, context);
  return { api: context.window.WhaleAccountView, storage, events, window:context.window };
}
test('subscription completion and cancellation report tokens without an open card or API money',async()=>{
  const r=runtime(async()=>({ok:true,json:async()=>({mode:'subscription'})}));
  const messages=[];r.window.whaleToast=message=>messages.push(message);
  r.api.notice({completionKind:'success',tokens:12,amount:100});assert.equal(messages.length,0);
  await r.api.setMode('subscription');
  r.api.notice({completionKind:'success',tokens:12480,amount:100,currency:'USD'});
  r.api.notice({completionKind:'cancelled',tokens:12,amount:10});
  r.api.notice({completionKind:'success',tokens:12,notify:false});
  assert.equal(messages.length,2);assert.match(messages[0],/12,480 token/);assert.match(messages[1],/12 token/);
  assert.ok(messages.every(m=>!/[\$¥]|USD|API/.test(m)));
});
test('a rejected save preserves mode and does not emit false switch events', async () => {
  for (const fetch of [async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({ mode: 'api' }) }), async () => { throw Error('offline'); }]) {
    const { api, storage, events } = runtime(fetch);
    assert.equal(await api.setMode('subscription'), false);
    assert.equal(api.mode, 'api'); assert.equal(storage.size, 0); assert.equal(events.length, 0);
  }
});
test('successful switches persist display mode only after server acknowledgement', async () => {
  let resolve; let request;
  const { api, storage, events } = runtime((url, options) => { request = { url, options }; return new Promise(r => { resolve = r; }); });
  const pending = api.setMode('subscription');
  assert.equal(api.mode, 'api'); assert.equal(storage.size, 0);
  assert.equal(await api.setMode('api'), false);
  resolve({ ok: true, json: async () => ({ mode: 'subscription' }) });
  assert.equal(await pending, true); assert.equal(api.mode, 'subscription');
  assert.equal(storage.get('dshw-account-view'), 'subscription');
  assert.equal(request.url, '/api/display-mode'); assert.equal(request.options.body, '{"mode":"subscription"}');
  assert.equal(events[0].type, 'whale-account-view'); assert.equal(events[0].detail.mode, 'subscription');
});

test('remaining battery starts full, drains with consumption, and does not invent unknown quota', () => {
  for (const [used, left] of [[0,100],[25.5,74.5],[100,0],[120,0]]) assert.equal(remainingPercent(used),left);
  for (const value of [null,undefined,NaN,Infinity,-1,'50']) assert.equal(remainingPercent(value),null);
  assert.equal(dialogueText([null,{t:'哦鲸鲸...'},{t:'好模型...↓'}]),'哦鲸鲸...\n好模型...↓');
  assert.equal(dialogueText({gif:true}),'');
});

test('subscription notices remain separate from the manual dialogue page', async () => {
  const r=runtime(async()=>({ok:true,json:async()=>({mode:'subscription'})}));
  const messages=[]; r.window.whaleToast=m=>messages.push(m);
  await r.api.setMode('subscription'); r.api.notice({tokens:123});
  assert.equal(messages[0],'本轮本机已观测：123 token');
});

function thoughtBubbleFixture(windows = [{windowDurationMins:300,usedPercent:20},{windowDurationMins:10080,usedPercent:100}]) {
  const frames=[],timers=new Map();let timerID=0;
  class Element {
    children=[];style={};attrs={};dataset={};offsetWidth=280;offsetHeight=350;
    classList={names:new Set(),add(...names){names.forEach(n=>this.names.add(n));},remove(...names){names.forEach(n=>this.names.delete(n));},contains(n){return this.names.has(n);}};
    constructor(tag){this.tagName=tag;}
    append(...items){items.forEach(e=>e.parent=this);this.children.push(...items);}
    replaceChildren(...items){this.children=items;}
    setAttribute(k,v){this.attrs[k]=v;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}
    querySelector(){return null;}
  }
  const body=new Element('body'),surface=new Element('div'),events=[];body.append(surface);
  const context={document:{body,documentElement:{dataset:{}},readyState:'loading',addEventListener(){},createElement:t=>new Element(t),querySelector:()=>null,querySelectorAll:()=>[]},
    window:{requestAnimationFrame:fn=>frames.push(fn),dispatchEvent:e=>events.push(e)},
    setTimeout(fn){timers.set(++timerID,fn);return timerID;},clearTimeout:id=>timers.delete(id),
    localStorage:{getItem:()=>null,setItem(){}},CustomEvent:class{},Event:class{constructor(type){this.type=type;}},
    fetch:async(url)=>({ok:true,json:async()=>url==='/api/insights'?{subscription:{available:true,windows,tokens:{total:12345,last5Hours:100}}}:{mode:'subscription'}})};
  vm.runInNewContext(source,context);const api=context.window.WhaleAccountView;
  let updates=0,closed=0;const notices=[];
  api.setBubbleDriver({updateQuota(){updates++;},close(){closed++;},notice(value){notices.push(value);}});
  const flatten=el=>[el,...el.children.flatMap(flatten)];
  return {api,body,surface,events,timers,context,notices,get updates(){return updates;},get closed(){return closed;},all:()=>flatten(body),render(){
    surface.replaceChildren();const parts={root:surface};for(const k of ['label','amount','hint','gif']){parts[k]=new Element('div');surface.append(parts[k]);}api.renderQuota(parts);
  }};
}

test('subscription first page contains only readable quota rows, no dialogue, details button or token clutter', async () => {
  const f=thoughtBubbleFixture(),{api}=f;
  await api.setMode('subscription');await api.refresh();f.render();
  const elements=f.all();
  assert.deepEqual(elements.filter(e=>e.tagName==='progress').map(e=>e.value),[80,0]);
  assert.ok(elements.filter(e=>e.tagName==='progress').every(e=>e.attrs['aria-label'].includes('剩余额度')));
  assert.equal(f.body.children.length,1);assert.equal(f.updates,1);
  assert.ok(!elements.some(e=>e.className==='whale-account-dialogue'||e.className==='whale-sub-details'||e.tagName==='button'));
  assert.ok(!elements.some(e=>/本机近|滚动|重置：|12345/.test(e.textContent||'')));
  assert.equal(f.timers.size,0,'the adapter must not add its own TTL or animation timers');
});

test('quota heading and both meters move as one group without changing their relative layout', async () => {
  const f=thoughtBubbleFixture();
  await f.api.setMode('subscription');await f.api.refresh();f.render();
  const group=f.all().find(e=>e.className==='whale-sub-quotas');
  assert.equal(group.children.length,3);
  assert.equal(group.children[0].textContent,'剩余额度');
  assert.ok(group.children.slice(1).every(e=>e.className==='whale-sub-quota'));
  const css=source.match(/\.whale-sub-quotas\{([^}]+)\}/)[1];
  assert.match(css,/transform:translateY\(-12%\)/,'the offset scales with the quota stack itself');
  assert.doesNotMatch(css,/position:|margin-top:|padding-top:/,'do not affect frame fitting or row spacing');
  assert.match(source,/\.whale-sub-heading\{font-size:calc\(var\(--dshw-u\)\*56\)\}/);
  assert.match(source,/height:calc\(var\(--dshw-u\)\*20\)/);
});

test('closing invalidates a pending read without repainting or reopening any bubble',async()=>{
  const f=thoughtBubbleFixture();await f.api.setMode('subscription');
  let resolve;f.context.fetch=()=>new Promise(r=>resolve=r);const pending=f.api.refresh();f.api.close();
  resolve({ok:true,json:async()=>({subscription:{available:true,windows:[{windowDurationMins:300,usedPercent:10}]}})});await pending;
  assert.equal(f.updates,0);assert.equal(f.closed,2);f.render();assert.equal(f.all().filter(e=>e.tagName==='progress').length,0);
});

test('missing windows are unknown, stale snapshots are marked, and unrelated quotas never fill the two bars',async()=>{
  const f=thoughtBubbleFixture([{windowDurationMins:300,usedPercent:25,stale:true},{windowDurationMins:60,usedPercent:0}]);
  await f.api.setMode('subscription');await f.api.refresh();f.render();
  assert.deepEqual(f.all().filter(e=>e.tagName==='progress').map(e=>e.value),[75]);
  assert.equal(f.all().find(e=>e.className==='whale-sub-quota').dataset.stale,'true');
  assert.ok(f.all().some(e=>e.tagName==='strong'&&e.textContent==='75%*'));
  assert.ok(f.all().some(e=>e.className==='whale-sub-unknown'));
});

test('subscription completion is delegated to the original scene driver without fetching quota or drawing dialogue',async()=>{
  const f=thoughtBubbleFixture();let toast=0;f.context.window.whaleToast=()=>toast++;
  await f.api.setMode('subscription');f.api.notice({tokens:123});
  f.api.notice({tokens:456,notify:false});
  assert.equal(toast,0);assert.equal(f.timers.size,0);assert.equal(f.updates,0);
  assert.equal(f.notices.length,1);assert.equal(f.notices[0].tokens,123);
});

test('switching account modes prevents late quota snapshots from entering the new mode',async()=>{
  const f=thoughtBubbleFixture();await f.api.setMode('subscription');let resolve;
  f.context.fetch=(url)=>url==='/api/insights'?new Promise(r=>resolve=r):Promise.resolve({ok:true,json:async()=>({mode:'api'})});
  const pending=f.api.refresh();await f.api.setMode('api');resolve({ok:true,json:async()=>({subscription:{available:true,windows:[]}})});await pending;
  assert.equal(f.api.mode,'api');assert.equal(f.updates,0);
});
