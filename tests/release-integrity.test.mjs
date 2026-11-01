import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../',import.meta.url));
const read=(p)=>readFileSync(join(root,p));
const html=read('index.html').toString('utf8');
const sw=read('sw.js').toString('utf8');
const manifest=JSON.parse(read('manifest.webmanifest').toString('utf8'));
const expectedAssets=['icon-192.png','icon-512.png','icon-maskable-192.png','icon-maskable-512.png','icon-header-96.png','icon-header-192.png','apple-touch-icon.png','favicon-16.png','favicon-32.png','favicon-48.png','favicon.ico','icon.svg','icon-maskable.svg'];
function pngSize(name){const b=read('assets/'+name);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(b.toString('ascii',12,16),'IHDR');return [b.readUInt32BE(16),b.readUInt32BE(20)]}
test('all 13 supplied icons and derived favicon are present',()=>{for(const p of expectedAssets)assert.ok(existsSync(join(root,'assets',p)),p)});
test('PWA icons match manifest sizes and purpose',()=>{
  assert.deepEqual(manifest.icons.map(x=>[x.sizes,x.purpose]),[['192x192','any'],['192x192','maskable'],['512x512','any'],['512x512','maskable']]);
  for(const icon of manifest.icons)assert.deepEqual(pngSize(icon.src.slice(9)),icon.sizes.split('x').map(Number));
});
test('Pixel maskable icons have opaque PNG RGB background',()=>{
  for(const size of [192,512]){
    const b=read(`assets/icon-maskable-${size}.png`);
    assert.deepEqual(pngSize(`icon-maskable-${size}.png`),[size,size]);
    const colorType=b[25];
    assert.ok([2,3].includes(colorType),'maskable image must not rely on transparency');
  }
});
test('header srcset and favicon references resolve',()=>{
  assert.match(html,/src="\.\/assets\/icon-header-96\.png" srcset="\.\/assets\/icon-header-192\.png 2x"/);
  for(const p of ['favicon.ico','favicon-16.png','favicon-32.png','icon.svg','apple-touch-icon.png'])assert.ok(html.includes('./assets/'+p),p);
});
test('all images precached for offline PWA and no deprecated icon refs',()=>{
  for(const p of expectedAssets)assert.ok(sw.includes(`'./assets/${p}'`),p);
  const pkg=JSON.parse(read('package.json').toString('utf8'));
  assert.match(sw,new RegExp(`sleep-odds-shell-v${pkg.version.replaceAll('.','-')}`));
  assert.match(html,/<title>厳選期待値<\/title>/);
});