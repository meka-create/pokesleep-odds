import test from 'node:test';
import assert from 'node:assert/strict';
import {NATURES, calculateAll} from '../calculator.mjs';
import {NEUTRAL_NATURE_IDS, normalizeNatureSelection, toggleNatureGroup, natureGroupSelection} from '../nature-selection.mjs';
const groups=['おてスピ','食材','スキル','げんき','EXP',''];

test('five stat groups have 4 natures each, neutral contains exactly 5',()=>{
  assert.deepEqual(groups.map(up=>NATURES.filter(n=>n.up===up).length),[4,4,4,4,4,5]);
  assert.equal(NEUTRAL_NATURE_IDS.length,5);
});
test('every positive group bulk-selects all 4, bulk deselects all 4',()=>{
  for(const up of groups.slice(0,-1)){
    const chosen=toggleNatureGroup([],up);
    assert.equal(chosen.length,4);
    assert.ok(chosen.every(id=>NATURES.find(n=>n.id===id).up===up));
    assert.deepEqual(natureGroupSelection(chosen,up),{selected:4,total:4,all:true});
    assert.deepEqual(toggleNatureGroup(chosen,up),[]);
  }
});
test('partial group is completed first; removing a group preserves others',()=>{
  const chosen=toggleNatureGroup(['adamant','modest'],'おてスピ');
  assert.equal(chosen.filter(id=>NATURES.find(n=>n.id===id).up==='おてスピ').length,4);
  assert.ok(chosen.includes('modest'));
  const removed=toggleNatureGroup(chosen,'おてスピ');
  assert.deepEqual(removed,['modest']);
});
test('neutral group always acts on all 5 as an atomic toggle',()=>{
  const all=toggleNatureGroup([],'');
  assert.deepEqual(all,NEUTRAL_NATURE_IDS);
  assert.deepEqual(toggleNatureGroup(all,''),[]);
});
test('legacy partial neutral selections expand to all 5, preserving other picks',()=>{
  const output=normalizeNatureSelection(['adamant','hardy']);
  assert.ok(output.includes('adamant'));
  assert.equal(output.length,6);
  assert.ok(NEUTRAL_NATURE_IDS.every(id=>output.includes(id)));
  assert.deepEqual(normalizeNatureSelection([]),[]);
});
test('bulk natures probability is group count / 25, unchanged per nature',()=>{
  const chosen=toggleNatureGroup([],'おてスピ');
  const input={seeds:true,rules:[],exclusions:[],natures:chosen,ingredients:[],ingredientPool:3};
  assert.deepEqual(calculateAll(input).map(r=>r.p),[.16,.16,.16,.16]);
  const neutral=toggleNatureGroup([],'');
  assert.deepEqual(calculateAll({...input,natures:neutral}).map(r=>r.p),[.2,.2,.2,.2]);
});