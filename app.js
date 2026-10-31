import { SKILLS, NATURES, INGREDIENTS, TWO_INGREDIENT_WEIGHTS, LEVELS, normalizedState, calculateAll } from './calculator.mjs';
import { normalizeNatureSelection, toggleNatureGroup, natureGroupSelection } from './nature-selection.mjs';
const KEY='sleep-odds-settings-v2';
const LEGACY_KEY='sleep-odds-settings-v1';
const DEFAULT={seeds:true,rules:[],exclusions:[],natures:[],ingredients:[],ingredientPool:3};
const $=id=>document.getElementById(id);
const skillLookup=new Map(SKILLS.map(s=>[s.id,s]));
let state=restore();
let latestResult=null;
let computedFor=null;
let requestSerial=0;
let worker=null;
let skillPickerTarget=null;
let levelPickerTarget=null;

function restore(){
  try{
    const current=JSON.parse(localStorage.getItem(KEY)||'null');
    if(current && typeof current==='object' && !Array.isArray(current)){
      const {seeds, rules, exclusions, natures, ingredients, ingredientPool}=normalizedState(current);
      return {seeds, rules, exclusions, natures:normalizeNatureSelection(natures), ingredients, ingredientPool};
    }
    // One-time migration: preserve conditions, make the newly requested default ON.
    // Any OFF choice made from v1.1.3 onward is stored in v2 and respected.
    const previous=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null');
    if(previous && typeof previous==='object' && !Array.isArray(previous)){
      const {rules, exclusions, natures, ingredients, ingredientPool}=normalizedState(previous);
      return {seeds:true, rules, exclusions, natures:normalizeNatureSelection(natures), ingredients, ingredientPool};
    }
    return structuredClone(DEFAULT);
  }catch{return structuredClone(DEFAULT);}
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}}
function esc(str){return String(str).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
const fmtExpected=value=>{
  if(value==null || !Number.isFinite(value))return '達成不可';
  if(value>=100000)return new Intl.NumberFormat('ja-JP',{notation:'compact',maximumSignificantDigits:3}).format(value)+' 匹';
  return value.toLocaleString('ja-JP',{maximumFractionDigits:2})+' 匹';
};
const fmtPercent=p=>{
  if(!Number.isFinite(p))return '—';
  if(p===0)return '0%';
  if(p===1)return '100%';
  const percent=p*100;
  if(percent<1e-8)return percent.toExponential(2)+'%';
  const digits=percent>=1?3:percent>=.01?4:percent>=.0001?6:8;
  return percent.toLocaleString('ja-JP',{maximumFractionDigits:digits})+'%';
};
function ruleHTML(rule,index,kind){
  const skill=skillLookup.get(rule.skill) || SKILLS[0];
  return `<div class="rule-row" data-kind="${kind}" data-index="${index}"><button type="button" class="rule-skill-button rarity-${skill.rarity}" data-open-skill-picker="${kind}" aria-label="${kind==='desired'?'希望':'除外'}サブスキル ${index+1}：${esc(skill.name)} を変更"><strong>${esc(skill.name)}</strong></button><div class="rule-select-wrap"><button type="button" class="rule-level-trigger" data-open-level="${kind}" aria-label="対象レベル ${index+1}：Lv.${rule.level}まで" aria-haspopup="listbox" aria-controls="custom-level-listbox" aria-expanded="false"><span>Lv.${rule.level}まで</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></button></div><button type="button" class="rule-delete" title="条件を削除" aria-label="条件${index+1}を削除" data-remove="${kind}">×</button></div>`;
}
function renderRules(kind){
  if(levelPickerTarget?.kind===kind)closeLevelPicker();
  const isDesired=kind==='desired';
  const items=isDesired?state.rules:state.exclusions;
  $(isDesired?'desired-rows':'exclusion-rows').innerHTML=items.map((rule,i)=>ruleHTML(rule,i,kind)).join('');
  $('desired-counter').textContent=state.rules.length+' 条件';
  $('exclude-counter').textContent=String(state.exclusions.length);
}

// Match the compact hierarchy used in the game: standalone gold skills,
// followed by families whose grade choices share a single row.
const FEATURED_GOLD=['berry_s','help_bonus','sleep_exp','research_exp','energy_bonus','shard_bonus'];
const SKILL_FAMILIES=[
  {label:'スキルレベルアップ', grades:[['M','skill_level_m'],['S','skill_level_s']]},
  {label:'スキル確率アップ', grades:[['M','skill_chance_m'],['S','skill_chance_s']]},
  {label:'おてつだいスピード', grades:[['M','speed_m'],['S','speed_s']]},
  {label:'食材確率アップ', grades:[['M','ingredient_m'],['S','ingredient_s']]},
  {label:'最大所持数アップ', grades:[['L','inventory_l'],['M','inventory_m'],['S','inventory_s']]},
];
function nextAvailableSkill(items, preferred){
  const used=new Set(items.map(rule=>rule.skill));
  return [preferred,...SKILLS.map(skill=>skill.id)].find(id=>!used.has(id)) ?? null;
}
function skillPickButton(id,label,selected,compact=false,usedByOtherRow=false){
  const skill=skillLookup.get(id);
  return `<button type="button" class="skill-pick ${skill.rarity}${compact?' skill-pick-grade':''}" data-skill-pick="${id}" aria-label="${esc(skill.name)}" aria-pressed="${id===selected}" ${usedByOtherRow?'disabled title="別の条件で選択済み"':''}>${esc(label)}</button>`;
}
function openSkillPicker(kind,index){
  closeLevelPicker();
  const key=kind==='desired'?'rules':'exclusions';
  const rule=state[key][index];
  if(!rule)return;
  skillPickerTarget={kind,index};
  $('skill-picker-title').textContent='サブスキルを選択';
  const usedByOtherRow=new Set(state[key].filter((_,i)=>i!==index).map(item=>item.skill));
  const featured=FEATURED_GOLD.map(id=>skillPickButton(id,skillLookup.get(id).name,rule.skill,false,usedByOtherRow.has(id))).join('');
  const families=SKILL_FAMILIES.map(family=>`<div class="skill-family-row"><span class="skill-family-label">${family.label}</span><div class="skill-grade-options">${family.grades.map(([grade,id])=>skillPickButton(id,grade,rule.skill,true,usedByOtherRow.has(id))).join('')}</div></div>`).join('');
  $('skill-picker-groups').innerHTML=`<section class="skill-picker-section"><h3>金スキル</h3><div class="skill-picker-grid">${featured}</div></section><section class="skill-picker-section skill-family-section"><div class="skill-family-list">${families}</div></section>`;
  $('skill-picker-dialog').showModal();
}
function closeSkillPicker(){
  skillPickerTarget=null;
  $('skill-picker-dialog').close();
}


// Shared custom drop-down design: no platform native list popup.
// A fixed-position listbox avoids clipping inside cards and details panels.
function closeLevelPicker(restoreFocus=false){
  const target=levelPickerTarget;
  levelPickerTarget=null;
  const menu=$('custom-level-listbox');
  menu.hidden=true;
  menu.replaceChildren();
  if(target?.trigger?.isConnected){
    target.trigger.setAttribute('aria-expanded','false');
    if(restoreFocus)target.trigger.focus({preventScroll:true});
  }
}
function positionLevelPicker(){
  if(!levelPickerTarget)return;
  const menu=$('custom-level-listbox');
  const rect=levelPickerTarget.trigger.getBoundingClientRect();
  const vw=document.documentElement.clientWidth;
  const vh=window.innerHeight;
  const inset=10;
  const gap=6;
  const width=Math.min(220,Math.max(174,rect.width+46),vw-inset*2);
  menu.style.width=`${width}px`;
  menu.style.left=`${Math.max(inset,Math.min(vw-width-inset,rect.right-width))}px`;
  // Measure the full (unclipped) list including padding and borders first.
  // scrollHeight ignores borders; measuring with a previous max-height
  // caused a redundant scrollbar even when all five items were visible.
  menu.style.height='auto';
  menu.style.maxHeight='none';
  menu.style.overflowY='hidden';
  const fullHeight=Math.ceil(menu.getBoundingClientRect().height);
  const below=Math.max(0,vh-rect.bottom-inset-gap);
  const above=Math.max(0,rect.top-inset-gap);
  const openAbove=below<fullHeight && above>below;
  const available=openAbove?above:below;
  const height=Math.max(0,Math.min(fullHeight,available));
  menu.style.height=`${height}px`;
  menu.style.maxHeight=`${height}px`;
  menu.style.overflowY=fullHeight>height+1?'auto':'hidden';
  const top=openAbove?rect.top-gap-height:rect.bottom+gap;
  menu.style.top=`${Math.max(inset,Math.min(top,vh-height-inset))}px`;
}
function openLevelPicker(trigger,kind,index,focusOption=true){
  const key=kind==='desired'?'rules':'exclusions';
  const current=state[key][index];
  if(!current)return;
  closeLevelPicker();
  levelPickerTarget={trigger,kind,index};
  trigger.setAttribute('aria-expanded','true');
  const menu=$('custom-level-listbox');
  menu.innerHTML=LEVELS.map(level=>`<button type="button" class="custom-select-option" role="option" data-level-option="${level}" aria-selected="${current.level===level}" tabindex="-1"><span>Lv.${level}まで</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg></button>`).join('');
  menu.hidden=false;
  menu.scrollTop=0;
  positionLevelPicker();
  if(focusOption){
    const selected=menu.querySelector('[aria-selected="true"]') || menu.querySelector('[role="option"]');
    selected?.focus({preventScroll:true});
    selected?.scrollIntoView({block:'nearest'});
  }
}
function selectLevel(level){
  if(!levelPickerTarget || !LEVELS.includes(level))return;
  const {kind,index}=levelPickerTarget;
  const key=kind==='desired'?'rules':'exclusions';
  const row=state[key][index];
  if(!row){closeLevelPicker();return;}
  const changed=row.level!==level;
  if(changed){row.level=level;renderRules(kind);markChanged();}
  closeLevelPicker();
  const holder=$(kind==='desired'?'desired-rows':'exclusion-rows');
  holder.querySelector(`.rule-row[data-index="${index}"] .rule-level-trigger`)?.focus({preventScroll:true});
}
function initCustomDropdowns(){
  const menu=$('custom-level-listbox');
  menu.addEventListener('click',e=>{
    const item=e.target.closest('[data-level-option]');
    if(item)selectLevel(Number(item.dataset.levelOption));
  });
  menu.addEventListener('keydown',e=>{
    const options=[...menu.querySelectorAll('[role="option"]')];
    let index=options.indexOf(document.activeElement);
    if(e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='Home'||e.key==='End'){
      e.preventDefault();
      if(e.key==='Home')index=0;
      else if(e.key==='End')index=options.length-1;
      else index=(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;
      options[index]?.focus({preventScroll:true});
      options[index]?.scrollIntoView({block:'nearest'});
    }else if(e.key==='Escape'){
      e.preventDefault();closeLevelPicker(true);
    }else if(e.key==='Tab'){
      closeLevelPicker();
    }
  });
  document.addEventListener('pointerdown',e=>{
    if(levelPickerTarget && !menu.contains(e.target) && !levelPickerTarget.trigger.contains(e.target))closeLevelPicker();
  },true);
  document.addEventListener('keydown',e=>{
    if(levelPickerTarget && e.key==='Escape'){
      e.preventDefault();closeLevelPicker(true);
    }
  });
  document.addEventListener('scroll',e=>{
    if(levelPickerTarget && e.target!==menu && !menu.contains(e.target))closeLevelPicker();
  },true);
  window.addEventListener('resize',()=>{if(levelPickerTarget)positionLevelPicker();});
}

// Group by the boosted stat; within each group display the lowered stat.
// This changes presentation only: nature IDs and probability weighting stay intact.
const NATURE_GROUPS=[
  {up:'おてスピ',title:'おてつだいスピード'},
  {up:'食材',title:'食材おてつだい確率'},
  {up:'スキル',title:'メインスキル発生確率'},
  {up:'げんき',title:'げんき回復量'},
  {up:'EXP',title:'EXP獲得量'},
  {up:'',title:'無補正'},
];
const NATURE_DOWN_LABELS={
  'おてスピ':'おてつだい速度',
  '食材':'食材確率',
  'スキル':'スキル確率',
  'げんき':'げんき回復量',
  'EXP':'EXP獲得量'
};
function renderNatures(){
  $('nature-grid').innerHTML=NATURE_GROUPS.map((group,i)=>{
    const items=NATURES.filter(n=>n.up===group.up);
    const selection=natureGroupSelection(state.natures,group.up);
    // Neutral has no meaningful per-nature distinction in this calculator:
    // its five entries are represented by a single atomic choice.
    if(!group.up){
      return `<section class="nature-group nature-neutral-group"><button type="button" class="nature-neutral-choice" data-nature-group="" aria-pressed="${selection.all}" aria-label="無補正の性格5種類を${selection.all?'一括解除':'一括選択'}"><span class="nature-neutral-check" aria-hidden="true">${selection.all?'✓':''}</span><strong>無補正</strong><small>5種類</small></button></section>`;
    }
    const buttons=items.map(n=>{
      const selected=state.natures.includes(n.id);
      const down=n.down ? `<small class="nature-down"><span aria-hidden="true">↓</span> ${esc(NATURE_DOWN_LABELS[n.down])}</small>` : '';
      return `<button type="button" class="nature-chip" data-nature="${n.id}" aria-pressed="${selected}" aria-label="${esc(n.name)}、${esc(NATURE_DOWN_LABELS[n.down])}下降"><strong>${esc(n.name)}</strong>${down}</button>`;
    }).join('');
    const actionText=selection.all?'一括解除':'一括選択';
    return `<section class="nature-group" aria-labelledby="nature-group-${i}"><div class="nature-group-heading"><h3 id="nature-group-${i}"><span class="nature-up" aria-hidden="true">↑</span>${esc(group.title)}</h3><button type="button" class="nature-group-action" data-nature-group="${group.up}" aria-pressed="${selection.all}" aria-label="${esc(group.title)}の性格を${actionText}">${actionText}</button></div><div class="nature-group-grid">${buttons}</div></section>`;
  }).join('');
  const count=state.natures.length;
  $('nature-counter').textContent=count?count+' 種類':'指定なし';
  $('nature-summary').textContent=count?count+'種類の性格を選択中':'性格を選択';
}
function renderIngredients(){
  const pool=state.ingredientPool;
  document.querySelectorAll('[data-ingredient-pool]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.ingredientPool)===pool)));
  const items=INGREDIENTS.filter(item=>pool===3 || item.id in TWO_INGREDIENT_WEIGHTS);
  $('ingredient-grid').innerHTML=items.map(item=>{
    const selected=state.ingredients.includes(item.id);
    const count=pool===2?Math.round(TWO_INGREDIENT_WEIGHTS[item.id]*9):Math.round(item.weight*9);
    return `<button type="button" class="ingredient-option" data-ingredient="${item.id}" aria-pressed="${selected}" aria-label="${item.id} ${count}/9"><span class="ingredient-pattern">${[...item.id].map(c=>`<b class="ingredient-${c.toLowerCase()}">${c}</b>`).join('')}</span><small>${count}/9</small></button>`;
  }).join('');
  $('ingredient-counter').textContent=state.ingredients.length?state.ingredients.length+' 構成':'指定なし';
}
function updateDock(){
  const total=state.rules.length+state.exclusions.length;
  $('dock-info').textContent=total?`サブスキル ${total} 条件 · 金枠0〜3を比較`:'金枠0〜3を比較';
}
function renderPlaceholder(){
  $('comparison-rows').innerHTML=[0,1,2,3].map(gold=>`<div class="comparison-row" role="row"><span class="comparison-label"><span class="label-mark" aria-hidden="true"></span>${gold}枠</span><span class="comparison-value zero">—</span><span class="comparison-value zero">—</span></div>`).join('');
  $('copy-result').hidden=true;
}
function markChanged(){
  ++requestSerial;
  latestResult=null;computedFor=null;
  $('result-error').hidden=true;
  $('run-button').disabled=false;
  $('run-button').querySelector('.run-label').textContent='確率を計算する';
  renderPlaceholder();save();updateDock();
}
function init(){
  initCustomDropdowns();
  renderRules('desired');renderRules('exclusion');renderNatures();renderIngredients();updateDock();renderPlaceholder();
  $('seed-toggle').checked=state.seeds;
  if(state.exclusions.length)$('exclusion-details').open=true;

  $('seed-toggle').addEventListener('change',e=>{state.seeds=e.target.checked;markChanged();});
  $('add-desired').addEventListener('click',()=>{
    if(state.rules.length>=5){showToast('希望条件は最大5件まで設定できます');return;}
    const skill=nextAvailableSkill(state.rules,'berry_s');
    if(!skill)return;
    state.rules.push({skill,level:50});renderRules('desired');markChanged();
  });
  $('add-exclusion').addEventListener('click',()=>{
    if(state.exclusions.length>=17){showToast('除外条件は最大17件まで設定できます');return;}
    const skill=nextAvailableSkill(state.exclusions,'speed_s');
    if(!skill)return;
    state.exclusions.push({skill,level:50});renderRules('exclusion');markChanged();
  });
  for(const kind of ['desired','exclusion']){
    const holder=$(kind==='desired'?'desired-rows':'exclusion-rows');
    const key=kind==='desired'?'rules':'exclusions';
    holder.addEventListener('keydown',e=>{
      const trigger=e.target.closest('[data-open-level]');
      if(trigger && (e.key==='ArrowDown'||e.key==='ArrowUp')){
        e.preventDefault();
        openLevelPicker(trigger,kind,Number(trigger.closest('.rule-row').dataset.index));
      }
    });
    holder.addEventListener('click',e=>{
      const levelButton=e.target.closest('[data-open-level]');
      if(levelButton){
        const row=levelButton.closest('.rule-row');
        if(levelPickerTarget?.trigger===levelButton){closeLevelPicker(true);return;}
        openLevelPicker(levelButton,kind,Number(row.dataset.index));
        return;
      }
      const openButton=e.target.closest('[data-open-skill-picker]');
      if(openButton){
        const row=openButton.closest('.rule-row');
        openSkillPicker(kind, Number(row.dataset.index));
        return;
      }
      const button=e.target.closest('[data-remove]');if(!button)return;
      const row=button.closest('.rule-row');state[key].splice(Number(row.dataset.index),1);
      renderRules(kind);markChanged();
    });
  }
  $('nature-grid').addEventListener('click',e=>{
    const groupButton=e.target.closest('[data-nature-group]');
    if(groupButton){
      state.natures=toggleNatureGroup(state.natures,groupButton.dataset.natureGroup);
      renderNatures();markChanged();
      return;
    }
    const button=e.target.closest('[data-nature]');if(!button)return;
    const id=button.dataset.nature;
    state.natures=state.natures.includes(id)?state.natures.filter(x=>x!==id):[...state.natures,id];
    renderNatures();markChanged();
  });
  $('ingredient-pool').addEventListener('click',e=>{
    const button=e.target.closest('[data-ingredient-pool]');if(!button)return;
    const next=Number(button.dataset.ingredientPool);if(next===state.ingredientPool)return;
    state.ingredientPool=next;
    if(next===2)state.ingredients=state.ingredients.filter(id=>id in TWO_INGREDIENT_WEIGHTS);
    renderIngredients();markChanged();
  });
  $('ingredient-grid').addEventListener('click',e=>{
    const button=e.target.closest('[data-ingredient]');if(!button)return;
    const id=button.dataset.ingredient;state.ingredients=state.ingredients.includes(id)?state.ingredients.filter(x=>x!==id):[...state.ingredients,id];
    renderIngredients();markChanged();
  });
  for(const b of document.querySelectorAll('[data-clear]'))b.addEventListener('click',()=>{
    if(b.dataset.clear==='nature'){state.natures=[];renderNatures();}
    else{state.ingredients=[];renderIngredients();}markChanged();
  });
  $('reset-button').addEventListener('click',()=>{
    closeLevelPicker();
    $('reset-dialog').showModal();
  });
  const closeResetDialog=()=>$('reset-dialog').close();
  $('reset-cancel').addEventListener('click',closeResetDialog);
  $('reset-dialog-close').addEventListener('click',closeResetDialog);
  $('reset-confirm').addEventListener('click',()=>{
    closeResetDialog();
    ++requestSerial;
    state=structuredClone(DEFAULT);latestResult=null;computedFor=null;
    $('seed-toggle').checked=state.seeds;
    renderRules('desired');renderRules('exclusion');renderNatures();renderIngredients();
    $('exclusion-details').open=false;markChanged();
    $('reset-button').focus({preventScroll:true});
  });
  $('reset-dialog').addEventListener('click',e=>{if(e.target===$('reset-dialog'))closeResetDialog();});
  $('reset-dialog').addEventListener('close',()=>{$('reset-button').focus({preventScroll:true});});
  $('run-button').addEventListener('click',runCalculation);
  $('copy-result').addEventListener('click',copyResult);
  $('close-skill-picker').addEventListener('click',closeSkillPicker);
  $('skill-picker-close-bottom').addEventListener('click',closeSkillPicker);
  $('skill-picker-groups').addEventListener('click',e=>{
    const button=e.target.closest('[data-skill-pick]');
    if(!button || !skillPickerTarget)return;
    const key=skillPickerTarget.kind==='desired'?'rules':'exclusions';
    const target=state[key][skillPickerTarget.index];
    if(!target)return;
    const id=button.dataset.skillPick;
    if(!skillLookup.has(id) || button.disabled || state[key].some((rule,i)=>i!==skillPickerTarget.index && rule.skill===id))return;
    if(target.skill!==id){
      target.skill=id;
      renderRules(skillPickerTarget.kind);markChanged();
    }
    closeSkillPicker();
  });
  $('skill-picker-dialog').addEventListener('close',()=>{skillPickerTarget=null;});
  $('skill-picker-dialog').addEventListener('click',e=>{if(e.target===$('skill-picker-dialog'))closeSkillPicker();});
  if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});}
  try {worker=new Worker('./calc-worker.js',{type:'module'});}catch{worker=null;}
}
async function runCalculation(){
  const current=++requestSerial;
  const input=structuredClone(state);
  const button=$('run-button');
  button.disabled=true;button.querySelector('.run-label').textContent='計算中…';
  renderPlaceholder();
  $('result-error').hidden=true;
  try{
    let value;
    if(worker){
      value=await new Promise((resolve,reject)=>{
        const onMessage=e=>{
          if(e.data.id!==current)return;
          cleanup();e.data.ok?resolve(e.data.result):reject(new Error(e.data.error));
        };
        const onError=()=>{cleanup();reject(new Error('計算用Workerを読み込めませんでした'));};
        function cleanup(){worker.removeEventListener('message',onMessage);worker.removeEventListener('error',onError);}
        worker.addEventListener('message',onMessage);worker.addEventListener('error',onError);
        worker.postMessage({id:current,state:input});
      });
    }else{
      value=await new Promise((resolve,reject)=>{setTimeout(()=>{try{resolve(calculateAll(input));}catch(e){reject(e);}},10);});
    }
    if(current!==requestSerial)return;
    latestResult=value;computedFor=input;displayResult(value);
    $('result-panel').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }catch(err){
    if(current!==requestSerial)return;
    $('result-error').hidden=false;$('result-error').textContent=`計算できませんでした: ${err.message}`;
  }finally{
    if(current===requestSerial){button.disabled=false;button.querySelector('.run-label').textContent='もう一度計算する';}
  }
}
function displayResult(results){
  $('copy-result').hidden=false;
  $('comparison-rows').innerHTML=results.map(r=>`<div class="comparison-row" role="row"><span class="comparison-label"><span class="label-mark" aria-hidden="true"></span>${r.gold}枠</span><span class="comparison-value probability ${r.p===0?'zero':''}">${fmtPercent(r.p)}</span><span class="comparison-value expected ${r.expected===null?'zero':''}">${fmtExpected(r.expected)}</span></div>`).join('');
}
async function copyResult(){
  if(!latestResult||!computedFor)return;
  const s=computedFor;
  const desired=s.rules.map(x=>`${skillLookup.get(x.skill)?.name||x.skill}（Lv.${x.level}まで）`).join('、')||'指定なし';
  const exclusions=s.exclusions.map(x=>`${skillLookup.get(x.skill)?.name||x.skill}（Lv.${x.level}まで）`).join('、')||'指定なし';
  const nature=s.natures.map(id=>NATURES.find(n=>n.id===id)?.name||id).join('、')||'指定なし';
  const lines=[
    '厳選期待値｜厳選シミュレーション結果',
    `希望: ${desired}`,`除外: ${exclusions}`,`たね: ${s.seeds?'使用':'未使用'}`,
    `性格: ${nature}`,`食材候補: ${s.ingredientPool}種類`,`食材: ${s.ingredients.join('、')||'指定なし'}`,'',
    '金確定枠 | 出現確率 | 期待捕獲数',
    ...latestResult.map(r=>`${r.gold}枠 | ${fmtPercent(r.p)} | ${fmtExpected(r.expected)}`)
  ];
  try {await navigator.clipboard.writeText(lines.join('\n'));showToast('結果をコピーしました');}
  catch{showToast('コピーできませんでした');}
}
let toastTimeout;
function showToast(message){
  let toast=document.querySelector('.app-toast');
  if(!toast){toast=document.createElement('div');toast.className='app-toast';toast.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:100;background:#e0c18d;color:#1b2532;border-radius:11px;padding:12px 18px;box-shadow:0 8px 35px #0008;font-size:12px;font-weight:700;white-space:nowrap;max-width:calc(100vw - 26px)';document.body.appendChild(toast);}
  toast.textContent=message;toast.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toast.hidden=true,2800);
}
init();
