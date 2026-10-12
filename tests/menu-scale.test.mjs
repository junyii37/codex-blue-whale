import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../desktop/ui/ui.css',import.meta.url),'utf8');
const rule=selector=>{
  const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return css.match(new RegExp(escaped+'\\s*\\{([^}]+)\\}'))?.[1]||'';
};
test('companion menu artwork scales with the clamped character base, not a fixed 26px button',()=>{
  const button=rule('.desktop .dshwv-menu-btn');
  assert.match(button,/--whale-menu-size:calc\(var\(--dshw-base\) \* \.09\)/);
  for(const property of ['width','height'])assert.match(button,new RegExp(property+':max\\(var\\(--whale-menu-size\\),24px\\)'));
  assert.match(button,/right:calc\(var\(--dshw-base\) \* \.012\)/);
  assert.match(button,/top:calc\(40\.55% \+ var\(--dshw-base\) \* \.012\)/);
  assert.match(button,/border-radius:calc\(var\(--whale-menu-size\) \* \.23\)/);
  assert.match(button,/gap:calc\(var\(--whale-menu-size\) \* \.15\)/);
  assert.doesNotMatch(button,/\b(?:width|height):\d+px/);
  // Reference viewport uses a 250px base before the existing scale/clamp.
  const base=s=>Math.max(122,Math.min(625,250*s));
  const menu=s=>base(s)*.09;
  assert.equal(menu(.8),18);assert.equal(menu(1.2),27);
  assert.ok(menu(.8)<26);
  for(const scale of [.5,.8,1,1.2,2,2.5])assert.ok(Math.abs(menu(scale)/(base(scale)*.5945)-.09/.5945)<1e-12);
});
test('hamburger strokes and background scale inside the actual transparent minimum input rectangle',()=>{
  const strokes=rule('.desktop .dshwv-menu-btn span'),art=rule('.desktop .dshwv-menu-btn::before');
  assert.match(strokes,/width:calc\(var\(--whale-menu-size\) \* \.54\)/);assert.match(strokes,/height:calc\(var\(--whale-menu-size\) \* \.077\)/);
  assert.match(art,/width:var\(--whale-menu-size\)/);assert.match(art,/height:var\(--whale-menu-size\)/);
  assert.match(art,/pointer-events:none/);
  assert.match(rule('.desktop .dshwv-menu-btn'),/background:transparent/);
  assert.match(rule('.desktop .dshwv-menu-btn:hover'),/background:transparent/);
  assert.match(rule('.desktop .dshwv-menu-btn:hover::before'),/background:#203170/);
});
