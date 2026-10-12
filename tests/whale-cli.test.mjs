import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { manageLaunchAgent } from '../scripts/whale.mjs';
const config = { enabled: true, platform: 'darwin', label: 'com.api-balance-whale.codex', launchAgentPath: '/synthetic/whale.plist' };
function fixture(initial) {
  const calls=[];let loaded=initial;
  return {calls,options:{config,uid:501,exists:()=>true,run(command,args){
    assert.equal(command,'/bin/launchctl');calls.push(args);
    if(args[0]==='print')return {status:loaded?0:1};
    if(args[0]==='bootstrap')loaded=true;
    if(args[0]==='bootout')loaded=false;
    return {status:0};
  }}};
}
test('start loads only the saved whale service without duplicating an existing agent',()=>{
  for(const initial of [false,true]) {
    const f=fixture(initial);assert.equal(manageLaunchAgent('start',f.options),true);
    assert.equal(f.calls.filter(a=>a[0]==='bootstrap').length,initial?0:1);
    assert.deepEqual(f.calls.at(-1),['kickstart','gui/501/'+config.label]);
  }
});
test('stop unloads the whale without disabling next-login startup or removing the plist',()=>{
  const f=fixture(true);manageLaunchAgent('stop',f.options);
  assert.deepEqual(f.calls.at(-1),['bootout','gui/501/'+config.label]);
  assert.ok(!f.calls.some(a=>a[0]==='disable'||a[0]==='remove'));
});
test('disabled following is not silently re-enabled and unrelated labels are refused',()=>{
  const f=fixture(false);assert.equal(manageLaunchAgent('start',{...f.options,config:{...config,enabled:false}}),false);
  assert.equal(f.calls.length,0);
  assert.throws(()=>manageLaunchAgent('stop',{...f.options,config:{...config,label:'com.other.application'}}),/Invalid whale/);
});
test('missing plist and failed bootstrap do not report successful startup',()=>{
  const f=fixture(false);assert.throws(()=>manageLaunchAgent('start',{...f.options,exists:()=>false}),/missing/);
  assert.throws(()=>manageLaunchAgent('start',{...f.options,run:()=>({status:1})}),/Unable to load/);
});
test('npm-link style symlink invokes the CLI rather than silently importing it',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'whale-cli-link-'));
  try {
    const link=path.join(folder,'codex-whale');
    fs.symlinkSync(fileURLToPath(new URL('../scripts/whale.mjs',import.meta.url)),link);
    const result=spawnSync(process.execPath,[link,'invalid-test-command'],{encoding:'utf8'});
    assert.equal(result.status,1);assert.match(result.stderr,/Usage: codex-whale/);assert.equal(result.stdout,'');
  } finally { fs.rmSync(folder,{recursive:true,force:true}); }
});
