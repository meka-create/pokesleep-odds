import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('browser title and app name are 厳選期待値',()=>{
  assert.match(html,/<title>厳選期待値<\/title>/);
  assert.equal(manifest.name,'厳選期待値');
  assert.equal(manifest.short_name,'厳選期待値');
});
test('header retains white title / gold highlight design',()=>{
  assert.match(html,/class="brand-title">厳選<span>期待値<\/span><\/h1>/);
  assert.match(css,/\.brand-title>span\{color:#e6c184/);
});
test('top header is no longer sticky',()=>{
  const match=css.match(/\.topbar\{([^}]*)\}/);
  assert.ok(match);
  assert.match(match[1],/position:relative/);
  assert.doesNotMatch(match[1],/position:sticky|position:fixed/);
});
test('help button and explanation dialog are removed, not merely hidden',()=>{
  assert.doesNotMatch(html,/id="help-button"|id="help-dialog"|id="close-help"/);
  assert.doesNotMatch(app,/\$\('help-button'\)|\$\('help-dialog'\)|\$\('close-help'\)/);
});
test('green status dot and related online/offline text are removed',()=>{
  assert.doesNotMatch(html,/status-dot|offline-status|端末内で計算/);
  assert.doesNotMatch(app,/\$\('offline-status'\)/);
});
test('seed switch, calculator and existing saved settings remain',()=>{
  assert.match(html,/id="seed-toggle"[^>]*checked/);
  assert.match(html,/id="run-button"/);
  assert.match(app,/const KEY='sleep-odds-settings-v2'/);
});
test('PWA SW cache revision ensures existing installs load new UI',()=>{
  assert.match(sw,/sleep-odds-shell-v\d+-\d+-\d+/);
  assert.match(app,/厳選期待値｜厳選シミュレーション結果/);
});

test('masthead alone carries a single main title, without old catchphrase or hero',()=>{
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.match(html,/<h1 class="brand-title">厳選<span>期待値<\/span><\/h1>/);
  assert.doesNotMatch(html,/理想の1匹に|どれくらい|CAPTURE PROBABILITY LAB|class="hero"|class="hero-mark"/);
});
test('masthead emphasizes title in responsive layout without sticky positioning',()=>{
  assert.match(css,/compact original-style header/);
  assert.match(css,/\.brand-title\{[^}]*font-size:25px/);
  assert.match(css,/@media\(max-width:480px\)/);
  assert.doesNotMatch(html,/id="help-button"|status-dot/);
});

test('subtitle uses exact typography of the other tool, without forced uppercase or decorative line',()=>{
  assert.match(html,/<span class="brand-subtitle">for Pokémon Sleep<\/span>/);
  assert.match(css,/\.brand-subtitle\{[^}]*text-transform:none/);
  assert.match(css,/\.brand-subtitle::before\{content:none\}/);
  assert.match(css,/\.brand-title::after\{content:none\}/);
  assert.match(css,/\.topbar::before,\.topbar::after\{content:none\}/);
});

// v1.1.8: remove decorative level strip without affecting actual condition levels.
test('decorative level strip is fully removed, and condition controls remain',()=>{
  assert.doesNotMatch(html,/class="level-track"|aria-label="サブスキルの解放レベル"/);
  assert.doesNotMatch(css,/\.level-track/);
  assert.match(html,/id="desired-rows"/);
  assert.match(html,/id="add-desired"/);
  assert.match(html,/id="seed-toggle"/);
  assert.match(html,/id="exclusion-details"/);
});


test('sub-skill selection uses modal picker with game-like rarity colors',()=>{
  assert.match(html,/id="skill-picker-dialog"/);
  assert.match(html,/id="skill-picker-groups"/);
  assert.match(app,/data-open-skill-picker/);
  assert.match(app,/function openSkillPicker\(/);
  assert.match(css,/\.skill-pick\.gold\{/);
  assert.match(css,/\.skill-pick\.blue\{/);
  assert.match(css,/\.skill-pick\.white\{/);
  assert.match(css,/\.skill-picker-grid\{/);
  assert.doesNotMatch(app,/class=\"rule-skill\"/);
});

test('compact mobile picker has two gold columns and grade rows',()=>{
  assert.match(app,/const FEATURED_GOLD=/);
  assert.match(app,/const SKILL_FAMILIES=/);
  assert.match(app,/class="skill-family-row"/);
  assert.match(app,/skillPickButton\(id,grade,rule.skill,true,usedByOtherRow.has\(id\)\)/);
  assert.match(css,/@media\(max-width:480px\)\{[\s\S]*?\.skill-picker-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.skill-pick-grade\{/);
});
test('picker title is level-independent; selected skill shows only the skill name',()=>{
  assert.match(app,/\$\('skill-picker-title'\)\.textContent='サブスキルを選択'/);
  assert.doesNotMatch(app,/rarityLabel|rule-skill-meta|レベル \$\{rule.level\} までのサブスキル/);
  assert.doesNotMatch(html,/SUB SKILL PICKER/);
});


test('same-list duplicate subskills are blocked at picker, including a defensive mutation guard',()=>{
  assert.match(app,/function nextAvailableSkill\(/);
  assert.match(app,/usedByOtherRow=new Set\(state\[key\]/);
  assert.match(app,/skillPickButton\(id,grade,rule.skill,true,usedByOtherRow.has\(id\)\)/);
  assert.match(app,/button.disabled \|\| state\[key\].some/);
  assert.match(css,/\.skill-pick:disabled/);
});

test('all native select elements are replaced with a shared custom dropdown',()=>{
  assert.doesNotMatch(html,/<select\b/i);
  assert.doesNotMatch(app,/<select\b/i);
  assert.match(app,/class="rule-level-trigger"/);
  assert.match(html,/id="custom-level-listbox"/);
  assert.match(app,/function initCustomDropdowns\(/);
  assert.match(css,/\.custom-select-menu\{/);
  assert.match(css,/\.custom-select-option\{/);
});
test('custom listbox uses only valid levels and supports keyboard / dismissal',()=>{
  assert.match(app,/LEVELS\.map\(level=>/);
  assert.match(app,/LEVELS\.includes\(level\)/);
  assert.match(app,/e\.key==='ArrowDown'/);
  assert.match(app,/e\.key==='Escape'/);
  assert.match(app,/document\.addEventListener\('pointerdown'/);
  assert.match(app,/document\.addEventListener\('scroll'/);
  assert.match(app,/aria-expanded="false"/);
});

test('browser-native confirmation is replaced by an in-app reset modal',()=>{
  assert.doesNotMatch(app,/(^|[^.\w$])(?:window\.)?(?:confirm|alert|prompt)\s*\(/m);
  assert.match(html,/<dialog id="reset-dialog"/);
  assert.match(html,/id="reset-confirm"/);
  assert.match(html,/id="reset-cancel"/);
  assert.match(app,/\$\('reset-dialog'\)\.showModal\(\)/);
  assert.match(app,/\$\('reset-confirm'\)\.addEventListener/);
  assert.match(app,/\$\('reset-cancel'\)\.addEventListener/);
});
test('custom dropdown measures natural height before enabling scrolling',()=>{
  assert.match(app,/const fullHeight=Math\.ceil\(menu\.getBoundingClientRect\(\)\.height\)/);
  assert.match(app,/menu\.style\.overflowY=fullHeight>height\+1\?'auto':'hidden'/);
  assert.match(css,/\.custom-select-menu\{[^}]*overflow-y:hidden/);
});

// v1.1.14: logo is decorative masthead, not a home navigation element.
test('title and header icon are not tappable or focusable navigation',()=>{
  assert.match(html,/<div class="brand">/);
  assert.doesNotMatch(html,/<a[^>]*class="brand"/);
  assert.doesNotMatch(html,/<button[^>]*class="brand"/);
  assert.doesNotMatch(html,/aria-label="厳選期待値 ホーム"/);
  const block=html.match(/<div class="brand">([\s\S]*?)<\/div>\s*<\/div>\s*<\/header>/);
  assert.ok(block,'masthead must remain display-only');
  assert.doesNotMatch(block[1],/href=|tabindex=|onclick=|role="button"/);
  assert.match(block[1],/<h1 class="brand-title">厳選<span>期待値<\/span><\/h1>/);
  assert.match(block[1],/for Pokémon Sleep/);
  assert.match(block[1],/<img src="\.\/assets\/icon-header-96\.png"/);
});


test('nature choices are grouped by raised stat without changing the 25 IDs',()=>{
  assert.match(html,/class="nature-groups" id="nature-grid"/);
  assert.match(html,/class="select-tools nature-select-tools"/);
  assert.doesNotMatch(html,/すべての性格（25種類）/);
  assert.match(app,/const NATURE_GROUPS=/);
  assert.match(app,/NATURES\.filter\(n=>n\.up===group\.up\)/);
  assert.match(app,/data-nature="\$\{n\.id\}" aria-pressed/);
  assert.match(app,/class="nature-down"/);
  assert.match(css,/\.nature-group-grid\{/);
  assert.match(css,/\.nature-neutral-choice\{/);
  assert.match(css,/@media\(max-width:480px\)/);
  assert.doesNotMatch(app,/state\.natures\.sort\(/);
});


test('nature groups support one-tap bulk selection; neutral uses one atomic control',()=>{
  assert.match(app,/data-nature-group="\$\{group.up\}"/);
  assert.match(app,/data-nature-group="" aria-pressed/);
  assert.match(app,/toggleNatureGroup\(state.natures,groupButton.dataset.natureGroup\)/);
  assert.match(app,/一括選択/);
  assert.match(app,/一括解除/);
  assert.doesNotMatch(app,/nature-neutral-grid/);
  assert.match(css,/\.nature-group-action\{/);
  assert.match(css,/\.nature-neutral-choice\{/);
  assert.match(sw,/nature-selection.mjs/);
});

// v1.1.18: the same ingredient letter must look identical across all slots,
// and A/B/C must be bright, perceptually well-separated colors.
test('ingredient tiles use clearly distinct letter-specific solid colors',()=>{
  for(const [letter,bg,fg] of [
    ['a','#9dd186','#1f3522'],
    ['b','#7fb6e2','#18364f'],
    ['c','#e1ae89','#482d20']
  ]){
    assert.match(css,new RegExp(`\\.ingredient-pattern \\.ingredient-${letter}\\{background:${bg};color:${fg}\\}`));
  }
  assert.doesNotMatch(css,/\.ingredient-pattern b:nth-child\(/);
  assert.doesNotMatch(css,/\.ingredient-option\[aria-pressed="true"\] \.ingredient-pattern b\{filter:brightness/);
  assert.match(app,/class="ingredient-\$\{c\.toLowerCase\(\)\}"/);
});


test('ingredient clear button is top-right, adjacent to pool selection and not below the grid',()=>{
  assert.match(html,/<div class="ingredient-toolbar"><div class="ingredient-pool"[\s\S]*?<button type="button" class="ingredient-clear" data-clear="ingredient">選択解除<\/button><\/div>/);
  assert.doesNotMatch(html,/class="ingredient-foot"/);
  assert.match(css,/\.ingredient-toolbar\{/);
  assert.match(css,/\.ingredient-clear\{/);
  assert.match(app,/if\(b\.dataset\.clear==='nature'\)/);
});




test('PWA and header icons are replaced with the uploaded icon set',()=>{
  assert.match(html,/rel="icon" href="\.\/assets\/favicon-32\.png"/);
  assert.match(html,/rel="apple-touch-icon" href="\.\/assets\/apple-touch-icon\.png"/);
  assert.match(html,/class="brand-icon"[^>]*><img src="\.\/assets\/icon-header-96\.png"/);
  assert.equal(manifest.icons.length,4);
  assert.deepEqual(manifest.icons.map(x=>x.src),['./assets/icon-192.png','./assets/icon-maskable-192.png','./assets/icon-512.png','./assets/icon-maskable-512.png']);
  assert.match(sw,/assets\/favicon-32\.png/);
  assert.match(sw,/assets\/apple-touch-icon\.png/);
});

test('install button, help dialog, and footer have been fully removed, PWA remains installable',()=>{
  assert.doesNotMatch(html,/id="install-button"|id="install-note"|id="install-dialog"|id="close-install"/);
  assert.doesNotMatch(html,/<footer\b|class="footer"|Pokémon Sleep 非公式ツール|厳選期待値 <span class="footer-mark"/);
  assert.doesNotMatch(app,/installAction|deferredInstall|install-button|install-note|install-dialog|beforeinstallprompt|appinstalled/);
  assert.doesNotMatch(css,/\.install-card|\.install-icon|\.footer(?:\{|>)/);
  assert.match(html,/id="skill-picker-dialog"/);
  assert.match(html,/id="reset-dialog"/);
  assert.match(app,/navigator\.serviceWorker\.register/);
  assert.match(html,/rel="manifest"/);
  assert.equal(manifest.display,'standalone');
});