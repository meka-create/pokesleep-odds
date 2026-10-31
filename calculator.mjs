/**
 * Probability engine for a 5-slot, ordered, weighted-without-replacement draw.
 * This is an independent implementation based on publicly described Pokémon Sleep
 * mechanics and approximate community-researched rarity weights, not copied code.
 */
export const LEVELS = [10, 25, 50, 70, 80];

export const SKILLS = [
  { id: 'sleep_exp', name: '睡眠EXPボーナス', rarity: 'gold', weight: 0.02 },
  { id: 'help_bonus', name: 'おてつだいボーナス', rarity: 'gold', weight: 0.02 },
  { id: 'energy_bonus', name: 'げんき回復ボーナス', rarity: 'gold', weight: 0.02 },
  { id: 'shard_bonus', name: 'ゆめのかけらボーナス', rarity: 'gold', weight: 0.02 },
  { id: 'research_exp', name: 'リサーチEXPボーナス', rarity: 'gold', weight: 0.02 },
  { id: 'berry_s', name: 'きのみの数S', rarity: 'gold', weight: 0.02 },
  { id: 'skill_level_m', name: 'スキルレベルアップM', rarity: 'gold', weight: 0.02 },
  { id: 'skill_level_s', name: 'スキルレベルアップS', rarity: 'blue', weight: 0.06 },
  { id: 'inventory_l', name: '最大所持数アップL', rarity: 'blue', weight: 0.06 },
  { id: 'inventory_m', name: '最大所持数アップM', rarity: 'blue', weight: 0.06 },
  { id: 'speed_m', name: 'おてつだいスピードM', rarity: 'blue', weight: 0.06 },
  { id: 'ingredient_m', name: '食材確率アップM', rarity: 'blue', weight: 0.06 },
  { id: 'skill_chance_m', name: 'スキル確率アップM', rarity: 'blue', weight: 0.06 },
  { id: 'inventory_s', name: '最大所持数アップS', rarity: 'white', weight: 0.125 },
  { id: 'speed_s', name: 'おてつだいスピードS', rarity: 'white', weight: 0.125 },
  { id: 'ingredient_s', name: '食材確率アップS', rarity: 'white', weight: 0.125 },
  { id: 'skill_chance_s', name: 'スキル確率アップS', rarity: 'white', weight: 0.125 },
];

export const NATURES = [
  {id:'hardy',name:'がんばりや',up:'',down:''},
  {id:'lonely',name:'さみしがり',up:'おてスピ',down:'げんき'},
  {id:'adamant',name:'いじっぱり',up:'おてスピ',down:'食材'},
  {id:'naughty',name:'やんちゃ',up:'おてスピ',down:'スキル'},
  {id:'brave',name:'ゆうかん',up:'おてスピ',down:'EXP'},
  {id:'bold',name:'ずぶとい',up:'げんき',down:'おてスピ'},
  {id:'docile',name:'すなお',up:'',down:''},
  {id:'impish',name:'わんぱく',up:'げんき',down:'食材'},
  {id:'lax',name:'のうてんき',up:'げんき',down:'スキル'},
  {id:'relaxed',name:'のんき',up:'げんき',down:'EXP'},
  {id:'modest',name:'ひかえめ',up:'食材',down:'おてスピ'},
  {id:'mild',name:'おっとり',up:'食材',down:'げんき'},
  {id:'bashful',name:'てれや',up:'',down:''},
  {id:'rash',name:'うっかりや',up:'食材',down:'スキル'},
  {id:'quiet',name:'れいせい',up:'食材',down:'EXP'},
  {id:'calm',name:'おだやか',up:'スキル',down:'おてスピ'},
  {id:'gentle',name:'おとなしい',up:'スキル',down:'げんき'},
  {id:'careful',name:'しんちょう',up:'スキル',down:'食材'},
  {id:'quirky',name:'きまぐれ',up:'',down:''},
  {id:'sassy',name:'なまいき',up:'スキル',down:'EXP'},
  {id:'timid',name:'おくびょう',up:'EXP',down:'おてスピ'},
  {id:'hasty',name:'せっかち',up:'EXP',down:'げんき'},
  {id:'jolly',name:'ようき',up:'EXP',down:'食材'},
  {id:'naive',name:'むじゃき',up:'EXP',down:'スキル'},
  {id:'serious',name:'まじめ',up:'',down:''},
];

export const INGREDIENTS = [
  {id:'AAA',weight:1/9}, {id:'AAB',weight:1/9}, {id:'AAC',weight:1/9},
  {id:'ABA',weight:2/9}, {id:'ABB',weight:2/9}, {id:'ABC',weight:2/9},
];

export const TWO_INGREDIENT_WEIGHTS = Object.freeze({AAA:1/9, AAB:2/9, ABA:2/9, ABB:4/9});

const indexById = new Map(SKILLS.map((s,i) => [s.id, i]));
const families = [
  ['skill_level_s', 'skill_level_m'],
  ['inventory_s', 'inventory_m', 'inventory_l'],
  ['speed_s', 'speed_m'],
  ['ingredient_s', 'ingredient_m'],
  ['skill_chance_s', 'skill_chance_m'],
];
const upgradeIndex = new Map();
for (const family of families) family.forEach((id,i) => upgradeIndex.set(id, {family,i}));

export function normalizedState(raw) {
  // Gold guarantees are simulation scenarios, not user-facing settings.
  const gold = Math.max(0,Math.min(3,Math.trunc(Number(raw.gold)||0)));
  const rules = (raw.rules||[]).filter(r=>indexById.has(r.skill)&&LEVELS.includes(Number(r.level)))
    .map(r=>({skill:r.skill,level:Number(r.level)}));
  const exclusions = (raw.exclusions||[]).filter(r=>indexById.has(r.skill)&&LEVELS.includes(Number(r.level)))
    .map(r=>({skill:r.skill,level:Number(r.level)}));
  const selectedNatures = new Set((raw.natures||[]).filter(id=>NATURES.some(n=>n.id===id)));
  const ingredientPool = Number(raw.ingredientPool) === 2 ? 2 : 3;
  const selectedIngredients = new Set((raw.ingredients||[]).filter(id=>INGREDIENTS.some(n=>n.id===id) && (ingredientPool===3 || id in TWO_INGREDIENT_WEIGHTS)));
  // Duplicate constraints for the same skill are redundant; keep the stricter deadline.
  const uniq = new Map();
  for (const r of rules) uniq.set(r.skill, Math.min(uniq.get(r.skill)??Infinity, r.level));
  const uniqExclusions = new Map();
  for (const r of exclusions) uniqExclusions.set(r.skill, Math.max(uniqExclusions.get(r.skill)??0, r.level));
  return {
    gold, seeds:!!raw.seeds, ingredientPool,
    rules:[...uniq].map(([skill,level])=>({skill,level})),
    exclusions:[...uniqExclusions].map(([skill,level])=>({skill,level})),
    natures:[...selectedNatures], ingredients:[...selectedIngredients]
  };
}

// Memoize all reachable configurations after any number of subskill seeds.
// A promotion can unlock another promotion: with Inventory S + M but no L,
// M -> L first, then S -> M is legal. Checking each slot in isolation
// incorrectly rejects that configuration.
const promotionCache = new Map();
function reachablePromotions(chosenIds) {
  const sorted = [...chosenIds].sort((a,b) => a-b);
  const mask = sorted.reduce((bits,id) => bits | (1 << id),0);
  let outcomes = promotionCache.get(mask);
  if (!outcomes) {
    const visited = new Set();
    const start = sorted.slice();
    const queue = [start];
    visited.add(start.join(','));
    for (let q=0; q<queue.length; q++) {
      const curr = queue[q];
      const owned = new Set(curr);
      for (let i=0; i<curr.length; i++) {
        const entry = upgradeIndex.get(SKILLS[curr[i]].id);
        if (!entry || entry.i === entry.family.length-1) continue;
        const upgraded = indexById.get(entry.family[entry.i+1]);
        if (owned.has(upgraded)) continue;
        const next = curr.slice();
        next[i] = upgraded;
        const key = next.join(',');
        if (!visited.has(key)) { visited.add(key); queue.push(next); }
      }
    }
    outcomes = queue;
    promotionCache.set(mask,outcomes);
  }
  const position = new Map(sorted.map((id,i)=>[id,i]));
  return outcomes.map(outcome=>chosenIds.map(id=>outcome[position.get(id)]));
}

function exactTargetSatisfied(rules, chosenIds) {
  if (!rules.length) return true;
  const options = rules.map(rule=> {
    const skill = indexById.get(rule.skill);
    const result = [];
    for (let i=0; i<chosenIds.length && LEVELS[i]<=rule.level; i++) {
      if (chosenIds[i] === skill) result.push(i);
    }
    return result;
  });
  if (options.some(xs=>xs.length===0)) return false;
  const order = [...rules.keys()].sort((a,b)=>options[a].length-options[b].length);
  function match(i, occupied) {
    if(i===order.length) return true;
    for(const slot of options[order[i]]) {
      if(!(occupied & (1<<slot)) && match(i+1,occupied|(1<<slot))) return true;
    }
    return false;
  }
  return match(0,0);
}

/**
 * A seed only upgrades a subskill which has actually unlocked.  In particular,
 * a slot at Lv.80 cannot be upgraded to free a rank needed at Lv.10.
 * Keep legal states at each requested deadline, then advance time; checking
 * only the final fully upgraded configuration would overestimate early rolls.
 * Unlimited seeds are assumed; seed consumption is not part of catch odds.
 */
function temporalSeedSatisfied(rules, chosenIds) {
  if (exactTargetSatisfied(rules, chosenIds)) return true;
  const deadlines = [...new Set(rules.map(x=>x.level))].sort((a,b)=>a-b);
  let states = [chosenIds];
  for (const level of deadlines) {
    const active = LEVELS.filter(x=>x<=level).length;
    const mandatory = rules.filter(x=>x.level<=level);
    const next = [];
    const visited = new Set();
    for (const starting of states) {
      const queue = [starting];
      for (let j=0;j<queue.length;j++) {
        const curr = queue[j];
        const signature = curr.join(',');
        if(visited.has(signature)) continue;
        visited.add(signature);
        if (exactTargetSatisfied(mandatory,curr)) next.push(curr);
        const owned = new Set(curr);
        for (let i=0;i<active;i++) {
          const skill = upgradeIndex.get(SKILLS[curr[i]].id);
          if(!skill || skill.i===skill.family.length-1) continue;
          const upgraded = indexById.get(skill.family[skill.i+1]);
          if(owned.has(upgraded)) continue;
          const copy=curr.slice();copy[i]=upgraded;
          queue.push(copy);
        }
      }
    }
    if(!next.length) return false;
    states=next;
  }
  return true;
}

function targetSatisfied(rules, chosenIds, seeds) {
  if (!rules.length) return true;
  if (!seeds || exactTargetSatisfied(rules,chosenIds)) return exactTargetSatisfied(rules,chosenIds);
  // Fast final-state filter before the more expensive level-aware proof.
  if (!reachablePromotions(chosenIds).some(outcome=>exactTargetSatisfied(rules,outcome))) return false;
  return temporalSeedSatisfied(rules,chosenIds);
}

/** Exposed for explicit five-slot regression cases in the independent audit. */
export function auditSeedConfiguration(rules, skillIds) {
  if(skillIds.length!==5 || skillIds.some(id=>!indexById.has(id))) throw new Error('Expected 5 valid skill IDs');
  return temporalSeedSatisfied(rules,skillIds.map(id=>indexById.get(id)));
}

function excluded(exclusions, chosen) {
  return exclusions.some(rule=> {
    const index = indexById.get(rule.skill);
    return chosen.some((value,i)=> LEVELS[i] <= rule.level && value === index);
  });
}

export function skillProbability(raw) {
  const state = normalizedState(raw);
  if (!state.rules.length && !state.exclusions.length) return 1;
  if (state.rules.length > 5) return 0;
  // The source contains five skills, but in the absence of seeds, only the
  // latest constrained slot must be sampled (a marginal over later slots).
  const maxLevel = Math.max(10,...state.rules.map(x=>x.level),...state.exclusions.map(x=>x.level));
  // Enumerating all five slots is necessary for seed-upgradable targets: an
  // unopened copy of a higher rank can block a promotion at an early level.
  // For non-upgradable targets, seeds cannot improve the requested outcome,
  // so integrating over later draws is mathematically redundant (and costly).
  const seedRelevant = state.seeds && state.rules.some(rule =>
    (upgradeIndex.get(rule.skill)?.i ?? 0) > 0
  );
  const depth = seedRelevant ? 5 : LEVELS.indexOf(maxLevel)+1;
  const chosen = new Array(depth);
  const weights = SKILLS.map(s=>s.weight);
  const goldIndices = SKILLS.map((s,i)=>s.rarity==='gold'?i:-1).filter(i=>i>=0);
  const used = new Uint8Array(SKILLS.length);
  let probability = 0;

  function walk(pos, totalRemaining, remainingGoldWeight, pathWeight) {
    if (pos===depth) {
      if (!excluded(state.exclusions,chosen) && targetSatisfied(state.rules,chosen,seedRelevant)) probability += pathWeight;
      return;
    }
    if (pos < state.gold) {
      for(const i of goldIndices) {
        if(used[i])continue;
        used[i]=1; chosen[pos]=i;
        walk(pos+1,totalRemaining-weights[i],remainingGoldWeight-weights[i],pathWeight*weights[i]/remainingGoldWeight);
        used[i]=0;
      }
    } else {
      for(let i=0;i<SKILLS.length;i++) {
        if(used[i])continue;
        used[i]=1; chosen[pos]=i;
        walk(pos+1,totalRemaining-weights[i],remainingGoldWeight-(SKILLS[i].rarity==='gold'?weights[i]:0),pathWeight*weights[i]/totalRemaining);
        used[i]=0;
      }
    }
  }
  walk(0,weights.reduce((a,b)=>a+b,0),goldIndices.reduce((a,i)=>a+weights[i],0),1);
  return Math.min(1,Math.max(0,probability));
}

function atLeastOneCount(p, target) {
  if(p<=0) return null;
  if(p>=1) return 1;
  return Math.ceil(Math.log1p(-target)/Math.log1p(-p));
}

export function calculate(raw) {
  const state = normalizedState(raw);
  const subs = skillProbability(state);
  const nature = state.natures.length ? state.natures.length/NATURES.length : 1;
  const foodWeights = state.ingredientPool===2 ? TWO_INGREDIENT_WEIGHTS : Object.fromEntries(INGREDIENTS.map(x=>[x.id,x.weight]));
  const food = state.ingredients.length ? state.ingredients.reduce((sum,id)=>sum+foodWeights[id],0) : 1;
  const p = Math.max(0,Math.min(1,subs*nature*food));
  return {
    state, p, skillProbability:subs, natureProbability:nature, ingredientProbability:food,
    expected: p>0?1/p:null,
    median:atLeastOneCount(p,0.5),
    n90:atLeastOneCount(p,0.9), n95:atLeastOneCount(p,0.95),
    n99:atLeastOneCount(p,0.99)
  };
}


/** Compare the four guarantee scenarios against identical desired conditions. */
export function calculateAll(raw) {
  const conditions = normalizedState(raw);
  return [0, 1, 2, 3].map(gold => {
    const { p, expected } = calculate({ ...conditions, gold });
    return { gold, p, expected };
  });
}
