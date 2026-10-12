import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

test('long-lived macOS probe pumps workspace events between samples instead of sleeping its main thread',()=>{
  const source=fs.readFileSync(new URL('../desktop/macos/window-probe.swift',import.meta.url),'utf8');
  assert.match(source,/if options\.once \{ break \}\s*\/\/[\s\S]*RunLoop\.current\.run\(until: Date\(timeIntervalSinceNow: Double\(options\.intervalMilliseconds\) \/ 1000\.0\)\)/);
  assert.doesNotMatch(source,/Thread\.sleep\(/);
});

test('native overview policy recognizes macOS 27 and freezes until stable, without changing normal dragging', {skip:process.platform!=='darwin'}, t=>{
  const source=fs.readFileSync(new URL('../desktop/macos/window-probe.swift',import.meta.url),'utf8');
  const marked=source.split('// BEGIN overview policy')[1].split('// END overview policy')[0];
  const policy=marked.slice(marked.indexOf('\n')+1);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'whale-overview-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const input=path.join(dir,'main.swift'),binary=path.join(dir,'test');
  fs.writeFileSync(input,'import CoreGraphics\nimport Foundation\n'+policy+`
func row(_ owner:String,_ layer:Int,_ alpha:Double=1)->[String:Any] {
 return [kCGWindowOwnerName as String:owner,kCGWindowLayer as String:layer,kCGWindowAlpha as String:alpha,
 kCGWindowBounds as String:["Width":CGFloat(1408),"Height":CGFloat(881)]]
}
assert(!overviewIsActive([row("WindowManager",-2147483624)]))
assert(overviewIsActive([row("WindowManager",19)]))
assert(!overviewIsActive([row("WindowManager",19,0)]))
assert(!overviewIsActive([row("Dock",20)]))
assert(overviewIsActive([row("Dock",18),row("Dock",20)]))
var guardState=OverviewGuard()
assert(!guardState.update(active:false,geometry:"normal",now:0))
assert(!guardState.update(active:false,geometry:"dragged",now:0.01))
assert(guardState.update(active:true,geometry:"thumbnail",now:1))
assert(guardState.update(active:true,geometry:"other-thumbnail",now:2))
assert(guardState.update(active:false,geometry:"restoring",now:3))
assert(guardState.update(active:false,geometry:"normal",now:3.2))
assert(guardState.update(active:false,geometry:"normal",now:3.5))
assert(!guardState.update(active:false,geometry:"normal",now:3.6))
assert(guardState.update(active:true,geometry:nil,now:4))
assert(guardState.update(active:false,geometry:nil,now:5))
assert(companionMayShow(hostFrontmost:true,companionFrontmost:false,overviewSuspended:false))
assert(companionMayShow(hostFrontmost:false,companionFrontmost:true,overviewSuspended:false))
assert(!companionMayShow(hostFrontmost:false,companionFrontmost:false,overviewSuspended:false))
assert(!companionMayShow(hostFrontmost:true,companionFrontmost:true,overviewSuspended:true))
print("overview policy passed")
`);
  const compilation=spawnSync('/usr/bin/xcrun',['swiftc','-framework','CoreGraphics','-o',binary,input],{encoding:'utf8'});
  assert.equal(compilation.status,0,compilation.stderr);const result=spawnSync(binary,[],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/overview policy passed/);
});

test('overview blocks Electron geometry feedback even when a stale sample still claims visible',async()=>{
  const source=fs.readFileSync(new URL('../desktop/main.cjs',import.meta.url),'utf8');
  const handler=source.slice(source.indexOf('async function setHost(host)'),source.indexOf('async function importLegacyStorage()'));
  let hidden=0;const context={Number,Date,hostSequence:0,hostHeartbeat:0,lastHost:null,usesWindowShape:false,
    modePending:false,desktopMode:'follow-codex',isMac:true,window:{},sendCursor(){},visibility(){hidden++;},
    syncNativeViewport(){throw Error('must not resize during overview');},app:{quit(){throw Error('must preserve process');}}};
  vm.createContext(context);vm.runInContext(handler,context);
  await context.setHost({hostAlive:true,visible:true,attached:true,overviewSuspended:true,bounds:{x:20,y:20,width:450,height:280}});
  assert.equal(hidden,1);
  assert.match(source,/setHiddenInMissionControl\(true\)/);
});
