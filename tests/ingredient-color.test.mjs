import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
test('ingredient labels get per-letter classes regardless of slot',()=>{
  assert.match(app,/\[\.\.\.item\.id\]\.map\(c=>`<b class="ingredient-\$\{c\.toLowerCase\(\)\}">\$\{c\}<\/b>`\)/);
});
test('A B C colors are keyed to letters, not slot indexes',()=>{
  for(const ch of ['a','b','c']) assert.match(css,new RegExp('\\.ingredient-pattern \\.ingredient-'+ch+'\\{[^}]*background:#[0-9a-f]{6}[^}]*color:#[0-9a-f]{6}'));
  assert.doesNotMatch(css,/\.ingredient-pattern b:nth-child\(/);
});
test('probability and selected state remain separate from color labels',()=>{
  assert.match(app,/const count=pool===2\?Math\.round\(TWO_INGREDIENT_WEIGHTS\[item\.id\]\*9\):Math\.round\(item\.weight\*9\)/);
  assert.match(app,/aria-pressed="\$\{selected\}"/);
});

test('color palette stays refined but green, blue and coral remain distinguishable',()=>{
  assert.match(css,/\.ingredient-pattern \.ingredient-a\{background:#9dd186;color:#1f3522\}/);
  assert.match(css,/\.ingredient-pattern \.ingredient-b\{background:#7fb6e2;color:#18364f\}/);
  assert.match(css,/\.ingredient-pattern \.ingredient-c\{background:#e1ae89;color:#482d20\}/);
});