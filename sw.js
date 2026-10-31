const CACHE_NAME='sleep-odds-shell-v1-1-26';
const APP_FILES=[
  './','./index.html','./styles.css','./app.js','./calculator.mjs',
  './calc-worker.js','./nature-selection.mjs','./manifest.webmanifest','./assets/favicon-32.png','./assets/apple-touch-icon.png',
  './assets/icon-192.png','./assets/icon-maskable-192.png','./assets/icon-512.png','./assets/icon-maskable-512.png','./assets/icon-header-96.png','./assets/favicon-48.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))),self.clients.claim()]));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET' || new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));}return response;}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
    return response;
  })));
});
