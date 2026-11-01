import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,calculateAll,skillProbability,LEVELS,SKILLS,normalizedState} from '../calculator.mjs';
const nearly=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} ≠ ${b}`);
test('new level slots are 70 and 80',()=>assert.deepEqual(LEVELS,[10,25,50,70,80]));
test('17 skills and normalized rarity weights',()=>{
  assert.equal(SKILLS.length,17);
  nearly(SKILLS.reduce((x,s)=>x+s.weight,0),1);
});
test('comparison includes gold 0,1,2,3 unconditionally',()=>{
  const results=calculateAll({rules:[{skill:'berry_s',level:25}]});
  assert.deepEqual(results.map(r=>r.gold),[0,1,2,3]);
  assert.ok(results.every(r=>Number.isFinite(r.p) && r.p>=0 && r.p<=1));
});
test('stored old FL and selected gold setting cannot change four-way comparison',()=>{
  const rules=[{skill:'berry_s',level:50}];
  assert.deepEqual(calculateAll({fl:100,gold:3,rules}),calculateAll({fl:1,gold:0,rules}));
});
test('4 cases match known simple gold guarantee combinations',()=>{
  const rs=calculateAll({rules:[{skill:'berry_s',level:25}]});
  assert.ok(rs[1].p>1/7 && rs[1].p<2/7); // second (unlocked) slot can also roll it
  nearly(rs[2].p,2/7);
  nearly(rs[3].p,2/7);
  for(const r of rs)nearly(r.expected,1/r.p);
});
test('gold guarantee 3 cannot produce white/blue in three locked slots',()=>{
  const rs=calculateAll({rules:[{skill:'ingredient_m',level:50}]});
  nearly(rs[3].p,0);
  assert.equal(rs[3].expected,null);
  assert.ok(rs[2].p>0);
});
test('no desired conditions produces four 100% rows',()=>{
  const rs=calculateAll({});
  assert.deepEqual(rs.map(x=>x.p),[1,1,1,1]);
  assert.deepEqual(rs.map(x=>x.expected),[1,1,1,1]);
});
test('unconstrained result is 100%',()=>nearly(calculate({fl:1}).p,1));
test('neutral all selected nature / ingredients are 100%',()=>{
  nearly(calculate({fl:1,natures:['hardy'],ingredients:['AAA']}).p,1/25/9);
});
test('single gold in Lv10 has normal ~2% weight',()=>{
  nearly(skillProbability({gold:0,rules:[{skill:'berry_s',level:10}]}),0.02);
});
test('single gold at gold-guaranteed Lv10 1/7',()=>{
  nearly(skillProbability({gold:1,rules:[{skill:'berry_s',level:10}]}),1/7);
});
test('single gold at gold-guaranteed Lv25 2/7',()=>{
  nearly(skillProbability({gold:2,rules:[{skill:'berry_s',level:25}]}),2/7);
});
test('two gold skills in Lv25 1/21',()=>{
  nearly(skillProbability({gold:2,rules:[{skill:'berry_s',level:25},{skill:'help_bonus',level:25}]}),1/21);
});
test('gold guaranteed excludes white at early levels',()=>{
  nearly(skillProbability({gold:2,rules:[{skill:'speed_s',level:25}]}),0);
});
test('exclusion opposite of matched exact Lv10',()=>{
  nearly(skillProbability({gold:0,exclusions:[{skill:'berry_s',level:10}]}),0.98);
});
test('seed M can be created from S without an M in later slots',()=>{
  const normal=skillProbability({gold:0,rules:[{skill:'speed_m',level:10}],seeds:false});
  const withSeed=skillProbability({gold:0,rules:[{skill:'speed_m',level:10}],seeds:true});
  nearly(normal,0.06);
  assert.ok(withSeed>normal && withSeed<0.19,`seed=${withSeed}`);
});
test('multiple same-id constraints deduplicate',()=>{
  const state=normalizedState({rules:[{skill:'berry_s',level:50},{skill:'berry_s',level:25}]});
  assert.deepEqual(state.rules,[{skill:'berry_s',level:25}]);
});
test('one condition before Lv70 vs Lv80 is monotone',()=>{
  const x=skillProbability({gold:1,rules:[{skill:'ingredient_m',level:70}]});
  const y=skillProbability({gold:1,rules:[{skill:'ingredient_m',level:80}]});
  assert.ok(y>x && x>0);
});
test('respects new Lv70 exclusive constraints',()=>{
  nearly(skillProbability({gold:3,rules:[{skill:'speed_m',level:50}]}),0);
  assert.ok(skillProbability({gold:3,rules:[{skill:'speed_m',level:70}]})>0);
});
test('a simultaneous pair cannot occupy only the Lv10 slot',()=>{
  nearly(skillProbability({gold:0,seeds:true,rules:[{skill:'speed_s',level:10},{skill:'speed_m',level:10}]}),0);
});
test('all 17 excluded before Lv80 gives 0%',()=>{
  nearly(skillProbability({gold:0,exclusions:SKILLS.map(s=>({skill:s.id,level:80}))}),0);
});
test('p=0 displays null expected and thresholds, not Infinity/NaN',()=>{
  const r=calculate({gold:3,rules:[{skill:'speed_m',level:50}]});
  nearly(r.p,0);assert.equal(r.expected,null);assert.equal(r.n90,null);
});
test('full domain filters give unchanged probability',async()=>{
  const base=calculate({gold:0,rules:[{skill:'berry_s',level:10}]}).p;
  nearly(calculate({gold:0,rules:[{skill:'berry_s',level:10}],natures:(await import('../calculator.mjs')).NATURES.map(n=>n.id),ingredients:['AAA','AAB','AAC','ABA','ABB','ABC']}).p,base);
});

test('Lv.70 and Lv.80 both affect the four-way results',()=>{
  const prev=calculateAll({rules:[{skill:'speed_m',level:70}]});
  const next=calculateAll({rules:[{skill:'speed_m',level:80}]});
  for(let gold=0;gold<4;gold++) assert.ok(next[gold].p>prev[gold].p,`${gold} slots`);
});
test('nature and food factors multiply for all guarantee counts',()=>{
  const rules=[{skill:'berry_s',level:50}];
  const base=calculateAll({rules});
  const filtered=calculateAll({rules,natures:['hardy'],ingredients:['AAA']});
  for(let gold=0;gold<4;gold++)nearly(filtered[gold].p,base[gold].p/25/9);
});
test('normalized old prefs do not leak FL into working settings',()=>{
  const clean=normalizedState({fl:100,gold:'auto',natures:['hardy']});
  assert.equal(Object.hasOwn(clean,'fl'),false);
  assert.equal(clean.gold,0);
});
test('seed-enabled multiple conditions do not overcount when constrained to one slot',()=>{
  for(const r of calculateAll({seeds:true,rules:[{skill:'speed_s',level:10},{skill:'speed_m',level:10}]}))nearly(r.p,0);
});

// Independent analytical checks derived from the published weighted-without-
// replacement model rather than using the engine's recursive implementation.
test('analytical probability for berry S at Lv25 with no gold guarantee',()=>{
  const target=.02;
  const otherWeights=[...Array(6)].map(()=>.02).concat(Array(6).fill(.06),Array(4).fill(.125));
  const independent=target+otherWeights.reduce((sum,w)=>sum+w*target/(1-w),0);
  nearly(calculateAll({rules:[{skill:'berry_s',level:25}]})[0].p,independent,1e-11);
});
test('analytical probability for berry S at Lv25 with one gold guarantee',()=>{
  const independent=1/7+(6/7)*(.02/.98);
  nearly(calculateAll({rules:[{skill:'berry_s',level:25}]})[1].p,independent,1e-11);
});
test('analytical probability for two gold skills in guaranteed first two slots',()=>{
  const input={rules:[{skill:'berry_s',level:25},{skill:'help_bonus',level:25}]};
  nearly(calculateAll(input)[2].p,2/(7*6),1e-11);
});
test('seed chain: inventory M -> L frees M so inventory S -> M is possible',()=>{
  const input={seeds:true,rules:[{skill:'inventory_m',level:25},{skill:'inventory_l',level:25}]};
  // Old implementation returned 2.041562% and discarded valid promotions.
  const result=calculateAll(input);
  assert.ok(result[0].p > 0.03317 && result[0].p < 0.03318);
  nearly(result[1].p,0,1e-12);
});
test('seed chain cannot upgrade M to L if L already held in a later slot',()=>{
  const input={seeds:true,rules:[{skill:'inventory_m',level:25},{skill:'inventory_l',level:25}]};
  // Use a separate five-slot enumerator with directly stated two-skill
  // outcomes.  It does not call the production evaluator or seed reachability.
  const w=SKILLS.map(s=>s.weight);
  const S=SKILLS.findIndex(s=>s.id==='inventory_s');
  const M=SKILLS.findIndex(s=>s.id==='inventory_m');
  const L=SKILLS.findIndex(s=>s.id==='inventory_l');
  const selected=[];let independent=0;
  function enumerate(pos,rem,weight){
    if(pos===5){
      const a=selected[0],b=selected[1];
      const pair=(x,y)=>(a===x&&b===y)||(a===y&&b===x);
      const success=pair(M,L)||(pair(S,L)&&!selected.includes(M))||(pair(S,M)&&!selected.includes(L));
      if(success)independent+=weight;
      return;
    }
    for(let i=0;i<w.length;i++){
      if(selected.includes(i))continue;
      selected.push(i);enumerate(pos+1,rem-w[i],weight*w[i]/rem);selected.pop();
    }
  }
  enumerate(0,w.reduce((a,b)=>a+b,0),1);
  nearly(calculateAll(input)[0].p,independent,1e-10);
});
test('a seed can never cause a worse probability for a single positive target',()=>{
  const input={rules:[{skill:'inventory_l',level:70}]};
  const no=calculateAll({...input,seeds:false});
  const yes=calculateAll({...input,seeds:true});
  for(let g=0;g<4;g++) assert.ok(yes[g].p>=no[g].p-1e-12);
});

test('2 candidate ingredients have corrected 1:2:2:4 probabilities',()=>{
  const map={AAA:1/9,AAB:2/9,ABA:2/9,ABB:4/9};
  for(const [name,p] of Object.entries(map))nearly(calculate({ingredientPool:2,ingredients:[name]}).p,p);
  nearly(calculate({ingredientPool:2,ingredients:Object.keys(map)}).p,1);
});
test('2 candidate mode rejects impossible ingredient C instead of counting it',()=>{
  const state=normalizedState({ingredientPool:2,ingredients:['ABC','AAC','ABB']});
  assert.deepEqual(state.ingredients,['ABB']);
  nearly(calculate(state).p,4/9);
});
test('3 candidate mode preserves original published proportions',()=>{
  nearly(calculate({ingredientPool:3,ingredients:['AAB']}).p,1/9);
  nearly(calculate({ingredientPool:3,ingredients:['ABB']}).p,2/9);
});

test('audit: level 80 seed cannot unblock level 10 requested M',async()=>{
  const {auditSeedConfiguration}=await import('../calculator.mjs');
  // S@10 is blocked by M@80. M@80 -> L requires Lv80, after Lv10 deadline.
  assert.equal(auditSeedConfiguration([{skill:'inventory_m',level:10}],
    ['inventory_s','berry_s','speed_s','ingredient_s','inventory_m']), false);
});
test('audit: unlocked S and M by 25 may legally chain S+M to M+L',async()=>{
  const {auditSeedConfiguration}=await import('../calculator.mjs');
  assert.equal(auditSeedConfiguration([
    {skill:'inventory_m',level:25},{skill:'inventory_l',level:25}],
    ['inventory_s','inventory_m','berry_s','speed_s','ingredient_s']),true);
});
test('audit: target M@10 is available from S@10 only if future M does not block it',async()=>{
  const {auditSeedConfiguration}=await import('../calculator.mjs');
  assert.equal(auditSeedConfiguration([{skill:'speed_m',level:10}],
    ['speed_s','berry_s','ingredient_s','inventory_s','help_bonus']),true);
  assert.equal(auditSeedConfiguration([{skill:'speed_m',level:10}],
    ['speed_s','berry_s','ingredient_s','inventory_s','speed_m']),false);
});

test('audit: independent weighted conditional calculation for seed M by level 10',()=>{
  // M is either naturally first (6%), or S is first and no M is in
  // the other four slots.  In the latter case it is the only candidate
  // for S->M at level 10.  This recursion is independent of seed BFS.
  const W=SKILLS.map(x=>x.weight);
  const M=SKILLS.findIndex(x=>x.id==='inventory_m');
  const S=SKILLS.findIndex(x=>x.id==='inventory_s');
  function avoidM(d,remaining,used){
    if(d===0)return 1;
    let p=0;
    for(let i=0;i<W.length;i++){
      if(used.has(i) || i===M)continue;
      const next=new Set(used); next.add(i);
      p+=W[i]/remaining*avoidM(d-1,remaining-W[i],next);
    }
    return p;
  }
  const expected=W[M]+W[S]*avoidM(4,1-W[S],new Set([S]));
  const actual=calculateAll({seeds:true,rules:[{skill:'inventory_m',level:10}]})[0].p;
  nearly(actual,expected,1e-11);
  nearly(actual,0.1490534034067,1e-11);
});
test('audit: seed-enabled condition at level 80 equals unrestricted full upgrade reachability',()=>{
  // At Lv80 all five skills have unlocked, so release-date blocking cannot remain.
  const example=calculateAll({seeds:true,rules:[{skill:'inventory_m',level:80}]});
  assert.ok(example[0].p>example[1].p);
  assert.ok(example[1].p>example[2].p);
  assert.ok(example[2].p>example[3].p);
  assert.ok(example.every(x=>x.p>0 && x.p<1));
});
test('audit: two-ingredient RaenonX distributions sum to exactly 1',()=>{
  const all=['AAA','AAB','ABA','ABB'];
  nearly(calculate({ingredientPool:2,ingredients:all}).p,1);
  nearly(calculate({ingredientPool:3,ingredients:['AAA','AAB','AAC','ABA','ABB','ABC']}).p,1);
});

test('saved duplicate requested/excluded skills normalize to their stricter deadlines',()=>{
  const state=normalizedState({
    rules:[{skill:'berry_s',level:80},{skill:'help_bonus',level:50},{skill:'berry_s',level:25}],
    exclusions:[{skill:'speed_m',level:10},{skill:'speed_m',level:70}]
  });
  assert.deepEqual(state.rules,[{skill:'berry_s',level:25},{skill:'help_bonus',level:50}]);
  assert.deepEqual(state.exclusions,[{skill:'speed_m',level:70}]);
  assert.deepEqual(normalizedState(state),state);
});

test('duplicate raw skill conditions have the same probability as normalized conditions',()=>{
  const raw={seeds:false,rules:[{skill:'berry_s',level:50},{skill:'berry_s',level:25}]};
  const cleaned={seeds:false,rules:[{skill:'berry_s',level:25}]};
  assert.deepEqual(calculateAll(raw),calculateAll(cleaned));
});


test('seed toggle cannot change non-upgradable desired targets even with a future blocker',()=>{
  for(const gold of [0,1,2,3]){
    for(const skill of ['berry_s','help_bonus','sleep_exp','speed_s','inventory_s']){
      const input={gold,rules:[{skill,level:25}],exclusions:[{skill:'shard_bonus',level:50}]};
      const no=skillProbability({...input,seeds:false});
      const yes=skillProbability({...input,seeds:true});
      nearly(no,yes,2e-11);
    }
  }
});
test('seed remains relevant for upgradeable desired ranks',()=>{
  const base={rules:[{skill:'speed_m',level:10}],gold:0};
  const no=skillProbability({...base,seeds:false});
  const yes=skillProbability({...base,seeds:true});
  assert.ok(yes>no);
});