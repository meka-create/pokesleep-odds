import { NATURES } from './calculator.mjs';

export const NEUTRAL_NATURE_IDS = Object.freeze(NATURES.filter(n=>n.up==='').map(n=>n.id));

// Previously, neutral natures could be selected individually. They now form
// one atomic option: if an old setting selected any, retain the neutral intent
// by selecting all five rather than hiding a partial choice in the new UI.
export function normalizeNatureSelection(saved = []) {
  const selected=new Set(saved);
  if(NEUTRAL_NATURE_IDS.some(id=>selected.has(id))) {
    NEUTRAL_NATURE_IDS.forEach(id=>selected.add(id));
  }
  return NATURES.filter(n=>selected.has(n.id)).map(n=>n.id);
}

export function toggleNatureGroup(current, up) {
  const group=NATURES.filter(n=>n.up===up).map(n=>n.id);
  if(!group.length)return current.slice();
  const allSelected=group.every(id=>current.includes(id));
  if(allSelected) return current.filter(id=>!group.includes(id));
  const selected=new Set([...current,...group]);
  return NATURES.filter(n=>selected.has(n.id)).map(n=>n.id);
}

export function natureGroupSelection(current, up) {
  const ids=NATURES.filter(n=>n.up===up).map(n=>n.id);
  const selected=ids.filter(id=>current.includes(id)).length;
  return {selected,total:ids.length,all:ids.length>0&&selected===ids.length};
}
