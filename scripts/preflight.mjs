import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=path.resolve(import.meta.dirname,'..');
const load=(file)=>fs.readFileSync(path.join(base,file),'utf8');
const required=['index.html','styles.css','app.js','calculator.mjs','nature-selection.mjs','calc-worker.js','sw.js','manifest.webmanifest','assets/icon-192.png','assets/icon-maskable-192.png','assets/icon-512.png','assets/icon-maskable-512.png','assets/apple-touch-icon.png','assets/favicon-32.png','assets/favicon-16.png','assets/favicon-48.png','assets/favicon.ico','assets/icon.svg','assets/icon-maskable.svg','assets/icon-header-96.png','assets/icon-header-192.png'];
for(const f of required)assert.ok(fs.existsSync(path.join(base,f)),`missing file: ${f}`);
const manifest=JSON.parse(load('manifest.webmanifest'));
assert.equal(manifest.name,'厳選期待値');
assert.equal(manifest.start_url,'./');
assert.equal(manifest.scope,'./');
assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons){
  assert.ok(icon.src.startsWith('./'));
  assert.ok(fs.existsSync(path.join(base,icon.src)),`missing icon ${icon.src}`);
}
const sw=load('sw.js');
const pkg=JSON.parse(load('package.json'));
assert.ok(sw.includes(`sleep-odds-shell-v${pkg.version.replaceAll('.', '-')}`));
for (const f of required.filter(f=>!['sw.js','index.html'].includes(f))){
  assert.ok(sw.includes(`'./${f}'`),`offline shell missing ${f}`);
}
const page=load('index.html');
assert.match(page,/<title>厳選期待値<\/title>/);
assert.doesNotMatch(page,/id="install-button"|id="help-button"|class="level-track"/);
assert.match(page, /<script type="module" src="\.\/app\.js"/);
assert.match(load('app.js'), /from '\.\/calculator\.mjs'/);
assert.match(load('calc-worker.js'), /from '\.\/calculator\.mjs'/);
console.log('PASS: static files and icons, relative paths, offline cache and UI contract');