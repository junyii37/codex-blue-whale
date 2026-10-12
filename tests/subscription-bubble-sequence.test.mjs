import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/whale-widget.js',import.meta.url),'utf8');
const accountSource=fs.readFileSync(new URL('../desktop/ui/account-view.js',import.meta.url),'utf8');
function productionFunction(name){
  const a=source.indexOf(`    function ${name}(`);assert.ok(a>=0,name);
  return source.slice(a,source.indexOf('\n    }',a)+'\n    }'.length);
}
const defaults=source.slice(source.indexOf('var BUBBLE_DEFAULT_ITEMS ='),source.indexOf('    function bubbleParseDefaultItems'));
const driver=source.slice(source.indexOf('window.WhaleAccountView?.setBubbleDriver({'),source.indexOf('    var dshwCenterX'));
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function harness(){
  const rendered=[],timers=new Map(),reads=[];let clock=1000,id=0;
  const part=()=>({style:{},textContent:'',className:''});
  const parts={root:{},label:part(),amount:part(),hint:part(),gif:part()};
  const h={
    window:{dispatchEvent(){},addEventListener(){}},document:{readyState:'loading',hidden:false,documentElement:{dataset:{}},addEventListener(){},querySelectorAll:()=>[]},
    localStorage:{getItem:()=>null,setItem(){}},CustomEvent:class{},
    fetch:async url=>url==='/api/insights'?new Promise(resolve=>reads.push(resolve)):{ok:true,json:async()=>({mode:'subscription'})},
    Date:{now:()=>clock},Promise,Number,
    setTimeout(fn,ms){timers.set(++id,{fn,ms});return id;},clearTimeout:i=>timers.delete(i),
    BUBBLE_MS:5000,USAGE_ALERT_TTL:6500,bubbleOn:true,turnCostOn:true,turnCostCloseMs:5000,
    bubbleShown:false,bubbleRoundOn:false,bubbleSeqIdx:0,bubbleTapAdvance:false,
    bubbleScene:null,bubbleSceneEpoch:0,bubbleTtlTimer:null,bubbleBuilding:false,
    bubbleRandomActive:false,bubbleRandomLines:null,costBubbleActive:false,
    whaleSysItem:null,whaleSysQueue:[],whaleSysTimer:null,
    bubbleBox:{classList:{add(){},remove(){}}},menuBox:{},
    WhaleMoney:{applyLatestQuote(){},refreshBindings(){}},WhaleRendering:{presentFor(){}},whaleSysTick(){},whaleSysSwapNext:()=>false,whaleSysDone(){},
    bubbleFrames:{front:parts,cancel(){},close(){},open(build,ready){build(parts);ready();return Promise.resolve(true);}},
    bindBubbleParts(p){h.bubbleTarget=p.root;h.labelEl=p.label;h.amountEl=p.amount;h.hintEl=p.hint;h.gifEl=p.gif;},
    bubbleRenderModules(mods){rendered.push({type:mods[0]?.type,modules:mods});},
    pickRandomLines:()=>[null,{t:'随机台词',s:'B'},null],applyBubbleLines:lines=>rendered.push({type:'random',lines}),
    pick:0,bubbleIsChoice:s=>s.kind==='choice',bubbleChoiceOptions:s=>s.options,bubbleChoiceWeight:o=>o.w,
    Math:{random:()=>h.pick,min:Math.min,max:Math.max},
  };
  vm.createContext(h);vm.runInContext(defaults,h);h.bubbleSeq=h.BUBBLE_DEFAULT_ITEMS;
  vm.runInContext(accountSource,h);
  vm.runInContext(['bubbleClearAll','bubbleCloseVisual','sceneOpen','armBubbleDeadline','bubbleAutoClose','bubbleResetTtl',
    'bubbleShowSeqNext','bubblePickChoiceStep','bubbleRenderQuota','bubbleRenderRandom','bubbleRenderSubscriptionCost',
    'whaleClick','bubbleNext','hideBubble','hideCostBubble'].map(productionFunction).join('\n'),h);
  vm.runInContext(driver,h);
  const api=h.window.WhaleAccountView;
  api.renderQuota=()=>rendered.push({type:'quota'});
  return {h,api,rendered,reads,timers,async init(){await api.setMode('subscription');},now(value){clock=value;},async snapshot(){reads.shift()({ok:true,json:async()=>({subscription:{available:true,windows:[]}})});await flush();}};
}

test('DSH manual round is quota → weighted dialogue/image → closed, with no combined page',async()=>{
  const f=harness();await f.init();f.h.whaleClick();await flush();
  assert.equal(f.h.bubbleScene.kind,'subscription');assert.equal(f.h.bubbleSeqIdx,1);assert.deepEqual(f.rendered.map(x=>x.type),['quota']);
  f.h.bubbleNext();await flush();assert.equal(f.rendered.at(-1).type,'random');assert.equal(f.h.bubbleSeqIdx,2);
  await f.snapshot();assert.equal(f.rendered.at(-1).type,'random','late quota read must not replace a dialogue');
  f.h.bubbleNext();assert.equal(f.h.bubbleShown,false);assert.equal(f.h.bubbleSeqIdx,0);
  f.h.whaleClick();await flush();assert.equal(f.rendered.at(-1).type,'quota');
});
test('clicking the character renews the first page instead of closing, and returns later pages to quota',async()=>{
  const f=harness();await f.init();f.h.whaleClick();await flush();const count=f.rendered.length;
  f.now(2500);f.h.whaleClick();assert.equal(f.rendered.length,count);assert.equal(f.h.bubbleScene.deadline,7500);
  f.h.bubbleNext();await flush();assert.equal(f.rendered.at(-1).type,'random');
  f.h.whaleClick();await flush();assert.equal(f.rendered.at(-1).type,'quota');assert.equal(f.h.bubbleSeqIdx,1);
});
test('second page uses DSH choice weights and keeps its animated image branch',async()=>{
  const f=harness();await f.init();assert.deepEqual(Array.from(f.h.bubbleSeq[1].options,o=>o.w),[10,1]);
  f.h.pick=.99;f.h.whaleClick();await flush();f.h.bubbleNext();await flush();
  assert.equal(f.rendered.at(-1).type,'image');assert.equal(f.rendered.at(-1).modules[0].imgId,'bimg_petpet');
  f.h.bubbleNext();assert.equal(f.h.bubbleShown,false);
});
test('quota refresh preserves the original five-second deadline, not a second independent eight-second timer',async()=>{
  const f=harness();await f.init();f.h.whaleClick();await flush();assert.equal(f.h.bubbleScene.deadline,6000);
  f.now(2000);await f.snapshot();assert.equal(f.h.bubbleScene.deadline,6000);assert.equal(f.timers.size,1);
  f.now(6001);f.h.armBubbleDeadline();assert.equal(f.h.bubbleShown,false);assert.equal(f.timers.size,0);
});
test('close cancels a delayed quota update and quick reopen cannot receive an earlier read',async()=>{
  const f=harness();await f.init();f.h.whaleClick();await flush();f.h.hideBubble();f.h.whaleClick();await flush();
  const count=f.rendered.length;await f.snapshot();assert.equal(f.rendered.length,count);
  await f.snapshot();assert.equal(f.rendered.length,count+1);
});
test('token notification is a separate cost scene, not quota plus dialogue; click character ignores it, click bubble dismisses it',async()=>{
  const f=harness();await f.init();f.h.whaleClick();await flush();
  f.api.notice({tokens:12480,completionKind:'cancelled'});await flush();
  assert.equal(f.h.bubbleScene.kind,'cost');assert.equal(f.h.labelEl.textContent,'本轮已观测');
  assert.equal(f.h.bubbleScene.deadline,6000,'notification follows the configured five-second timeout');
  assert.equal(f.h.amountEl.textContent,'12,480');assert.equal(f.h.hintEl.textContent,'token · 取消');
  f.h.whaleClick();assert.equal(f.h.bubbleScene.kind,'cost');
  await f.snapshot();assert.equal(f.h.bubbleScene.kind,'cost','late quota must not replace a notification');
  f.h.bubbleNext();assert.equal(f.h.bubbleShown,false);
});
test('zero notification timeout keeps the separate cost page until manually dismissed',async()=>{
  const f=harness();await f.init();f.h.turnCostCloseMs=0;
  f.api.notice({tokens:42,completionKind:'completed'});await flush();
  assert.equal(f.h.bubbleScene.kind,'cost');assert.equal(f.timers.size,0);
  f.now(100000);f.h.armBubbleDeadline();assert.equal(f.h.bubbleShown,true);
  f.h.bubbleNext();assert.equal(f.h.bubbleShown,false);
});
test('bubble and notification switches remain effective',async()=>{
  const f=harness();await f.init();f.h.bubbleOn=false;f.h.whaleClick();f.api.notice({tokens:1});assert.equal(f.h.bubbleShown,false);
  f.h.bubbleOn=true;f.h.turnCostOn=false;f.api.notice({tokens:1});assert.equal(f.h.bubbleShown,false);
  f.h.turnCostOn=true;f.h.document.hidden=true;f.api.notice({tokens:1});assert.equal(f.h.bubbleShown,false);
});
test('optional character-advance setting follows the same sequence as clicking the bubble',async()=>{
  const f=harness();await f.init();f.h.bubbleTapAdvance=true;
  f.h.whaleClick();await flush();f.h.whaleClick();await flush();assert.equal(f.rendered.at(-1).type,'random');
  f.h.whaleClick();assert.equal(f.h.bubbleShown,false);
});
test('DSH dialogue sizes, colours and rich modules are retained, not flattened or line-clamped',()=>{
  const f=harness(),m=f.h.bubbleSeq[1].options[0].item.modules[0];
  assert.equal(m.type,'random');assert.equal(m.lines.length,49);assert.equal(m.size,8);
  assert.ok(m.lines.some(l=>l.t==='哦鲸鲸...'&&l.rgb==='candy'&&l.size===22));
  assert.ok(m.lines.some(l=>l.t==='token 来!'&&l.rgb==='candy'&&l.size===16));
  assert.doesNotMatch(accountSource,/line-clamp|whale-account-dialogue|setBubbleSurface/);
});
