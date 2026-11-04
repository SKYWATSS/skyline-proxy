const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const S={g:(k,d)=>{try{return JSON.parse(localStorage['sky_'+k])??d}catch{return d}},s:(k,v)=>localStorage['sky_'+k]=JSON.stringify(v)};
const ENGINES={DuckDuckGo:'https://duckduckgo.com/?q=%s',Brave:'https://search.brave.com/search?q=%s',Wikipedia:'https://en.wikipedia.org/w/index.php?search=%s'};
const DEF_TILES=[['Wikipedia','https://en.wikipedia.org'],['DuckDuckGo','https://duckduckgo.com'],['Reddit','https://old.reddit.com'],['News','https://text.npr.org'],['Weather','https://weather.gov'],['Chess','https://www.chess.com'],['GitHub','https://github.com']];
const toast=t=>{$('toast').textContent=t;$('toast').classList.add('on');setTimeout(()=>$('toast').classList.remove('on'),1600)};
// --- proxy plumbing (Ultraviolet + bare-mux + epoxy over wisp) ---
const PROXIES={uv:'Ultraviolet',sj:'Scramjet',ub:'Unblocker',gust:'GUST',ddx:'DaydreamX'};
let engine=S.g('proxy','uv');let CFG={};fetch('/config.json').then(r=>r.json()).then(c=>CFG=c).catch(()=>{});
const {ScramjetController}=$scramjetLoadController();
const sj=new ScramjetController({prefix:'/sj/svc/',files:{wasm:'/sj/scramjet.wasm.wasm',all:'/sj/scramjet.all.js',sync:'/sj/scramjet.sync.js'}});
async function swReg(url,scope){const reg=await navigator.serviceWorker.register(url,{scope});const w=reg.installing||reg.waiting;if(w&&!reg.active)await new Promise(r=>w.addEventListener('statechange',()=>w.state==='activated'&&r()))}
const ready=(async()=>{
  await sj.init();await swReg('/sj/sw.js','/sj/');
  const reg=await navigator.serviceWorker.register('/uv/sw.js',{scope:'/uv/'});const w=reg.installing||reg.waiting;if(w&&!reg.active)await new Promise(r=>w.addEventListener('statechange',()=>w.state==='activated'&&r()));
  const conn=new BareMux.BareMuxConnection('/baremux/worker.js');
  const wisp=(location.protocol==='https:'?'wss':'ws')+'://'+location.host+'/wisp/';
  if(await conn.getTransport()!=='/epoxy/index.mjs')await conn.setTransport('/epoxy/index.mjs',[{wisp}]);
})().catch(e=>{console.error(e);toast('Proxy failed to start: '+e.message)});
function toProxy(u){switch(engine){
  case 'sj':return sj.encodeUrl(u);
  case 'ub':return '/unblocker/'+u;
  case 'gust':localStorage.wisp=(location.protocol==='https:'?'wss':'ws')+'://'+location.host+'/wisp/';return '/gust/index.html';
  case 'ddx':return CFG.daydreamxUrl||'about:blank';
  default:return __uv$config.prefix+__uv$config.encodeUrl(u)}}
function fromProxy(p){try{let i=p.indexOf(__uv$config.prefix);if(i>=0)return __uv$config.decodeUrl(p.slice(i+__uv$config.prefix.length));
  i=p.indexOf('/sj/svc/');if(i>=0)return sj.decodeUrl(p.slice(i));i=p.indexOf('/unblocker/');if(i>=0)return p.slice(i+11)}catch{}return null}
function setEngine(e){engine=e;S.s('proxy',e);$('eng').value=e;if(e==='gust'||e==='ddx')toast(PROXIES[e]+' opens its own app — use its address bar');else if(T().url)nav(T().url)}
function resolve(q){q=q.trim();if(/^https?:\/\//i.test(q))return q;if(/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(q))return 'https://'+q;return (ENGINES[S.g('engine','DuckDuckGo')]).replace('%s',encodeURIComponent(q))}
// --- tabs ---
let tabs=S.g('tabs',[{id:1,url:'',title:'New tab'}]),cur=S.g('cur',tabs[0].id);const frames={};
const save=()=>{S.s('tabs',tabs.map(({id,url,title})=>({id,url,title})));S.s('cur',cur)};
const T=()=>tabs.find(t=>t.id===cur)||tabs[0];
function frame(t){if(!frames[t.id]){const f=document.createElement('iframe');f.allow='fullscreen';$('main').appendChild(f);
  f.addEventListener('load',()=>{let u;try{u=fromProxy(f.contentWindow.location.href);t.title=f.contentDocument.title||u}catch{}if(u){t.url=u;addHist(u,t.title)}save();render()});frames[t.id]=f}return frames[t.id]}
async function nav(q,t=T()){const url=resolve(q);t.url=url;t.title=url;await ready;frame(t).src=toProxy(url);save();render()}
function render(){const t=T();if(!tabs.includes(t))cur=t.id;
  $('tabs').innerHTML=tabs.map(x=>`<div class="tab ${x.id===cur?'on':''}" data-id="${x.id}"><span>${esc(x.title||'New tab')}</span><i data-x="${x.id}">✕</i></div>`).join('')+'<div class="tab" data-new>＋</div>';
  for(const id in frames)frames[id].classList.toggle('on',+id===cur&&!!T().url);$('home').classList.toggle('on',!t.url);
  if(document.activeElement!==$('omni'))$('omni').value=t.url||'';$('star').textContent=S.g('bm',[]).some(b=>b.url===t.url)?'★':'☆'}
function newTab(u){const t={id:Date.now(),url:'',title:'New tab'};tabs.push(t);cur=t.id;save();render();if(u)nav(u,t)}
$('tabs').onclick=e=>{const x=e.target.dataset.x,el=e.target.closest('.tab');if(!el)return;if(el.hasAttribute('data-new'))return newTab();
  if(x){const id=+x;frames[id]?.remove();delete frames[id];tabs=tabs.filter(t=>t.id!==id);if(!tabs.length)tabs=[{id:Date.now(),url:'',title:'New tab'}];if(cur===id)cur=tabs.at(-1).id}else{cur=+el.dataset.id;const t=T();if(t.url&&!frames[t.id])nav(t.url,t)}save();render()};
$('of').onsubmit=e=>{e.preventDefault();$('omni').blur();nav($('omni').value)};$('hf').onsubmit=e=>{e.preventDefault();nav($('hq').value);$('hq').value=''};
$('back').onclick=()=>{try{frames[cur].contentWindow.history.back()}catch{}};$('fwd').onclick=()=>{try{frames[cur].contentWindow.history.forward()}catch{}};
$('reload').onclick=()=>{try{frames[cur].contentWindow.location.reload()}catch{}};
$('star').onclick=()=>{const t=T();if(!t.url)return;let b=S.g('bm',[]);if(b.some(x=>x.url===t.url)){b=b.filter(x=>x.url!==t.url);toast('Removed bookmark')}else{b.unshift({url:t.url,title:t.title});toast('Bookmarked')}S.s('bm',b);render()};
function addHist(url,title){const h=S.g('hist',[]);if(h[0]?.url===url)return;h.unshift({url,title,at:Date.now()});S.s('hist',h.slice(0,400))}
// --- tiles ---
function tiles(){const l=S.g('tiles',DEF_TILES);$('grid').innerHTML=l.map((t,i)=>`<div class="tile" data-u="${esc(t[1])}"><span class="x" data-del="${i}">✕</span><b>${esc(t[0][0])}</b>${esc(t[0])}</div>`).join('')+'<div class="tile" data-add><b>＋</b>Add</div>'}
$('grid').onclick=e=>{const el=e.target.closest('.tile');if(!el)return;const l=S.g('tiles',DEF_TILES);
  if(e.target.dataset.del){l.splice(+e.target.dataset.del,1);S.s('tiles',l);return tiles()}
  if(el.hasAttribute('data-add')){const n=prompt('Name');const u=n&&prompt('Address (e.g. example.com)');if(u){l.push([n,resolve(u)]);S.s('tiles',l);tiles()}return}nav(el.dataset.u)};
// --- panels ---
const P=$('panel');const close=()=>P.classList.remove('on');
function list(key,title){const l=S.g(key,[]);P.innerHTML=`<div class="row"><h3>${title}</h3><span><button class="btn" data-clear>Clear</button> <button class="btn" data-close>Done</button></span></div>`+
  (l.map((x,i)=>`<div class="row"><a href="#" data-open="${esc(x.url)}">${esc(x.title||x.url)}<div class="mut">${esc(x.url)}${x.at?' · '+new Date(x.at).toLocaleString():''}</div></a><button class="btn" data-rm="${i}">✕</button></div>`).join('')||'<p class="mut">Nothing yet.</p>');
  P.onclick=e=>{const d=e.target.closest('[data-open],[data-rm],[data-clear],[data-close]');if(!d)return;e.preventDefault();
    if(d.dataset.open!=null){close();nav(d.dataset.open)}else if(d.dataset.rm!=null){l.splice(+d.dataset.rm,1);S.s(key,l);list(key,title)}else if(d.hasAttribute('data-clear')){if(confirm('Clear all?')){S.s(key,[]);list(key,title)}}else close()};P.classList.add('on')}
function settings(){const dark=document.documentElement.classList.contains('dark');
  P.innerHTML=`<div class="row"><h3>Settings</h3><button class="btn" data-close>Done</button></div>
  <div class="row">Dark mode<input type="checkbox" id="sd" ${dark?'checked':''}></div>
  <div class="row">Search engine<select id="se" class="btn">${Object.keys(ENGINES).map(k=>`<option ${k===S.g('engine','DuckDuckGo')?'selected':''}>${k}</option>`).join('')}</select></div>
  <div class="row">Proxy engine<select id="pe" class="btn">${Object.entries(PROXIES).map(([k,v])=>`<option value="${k}" ${k===engine?'selected':''}>${v}</option>`).join('')}</select></div>
  <div class="row">Fullscreen page<button class="btn" id="fs">Enter</button></div>
  <div class="row">Open current page in Safari<button class="btn" id="ox">Open</button></div>
  <div class="row">Reset all Skyline data<button class="btn" id="rs">Reset</button></div>
  <p class="mut">Engines: Ultraviolet (MIT), Scramjet (AGPL-3.0 per its LICENSE file), node-unblocker (AGPL-3.0), GUST by Nautilus Labs (AGPL-3.0), DaydreamX by Night Network (AGPL-3.0). Source: see /LICENSES. Tip: Share → Add to Home Screen.</p>`;
  $('sd').onchange=e=>{localStorage.sky_dark=e.target.checked?'1':'0';document.documentElement.classList.toggle('dark',e.target.checked)};
  $('se').onchange=e=>S.s('engine',e.target.value);$('pe').onchange=e=>setEngine(e.target.value);
  $('fs').onclick=()=>{const el=frames[cur]||document.documentElement;(el.requestFullscreen||el.webkitRequestFullscreen||(()=>toast('Use Add to Home Screen for fullscreen on iPhone'))).call(el);close()};
  $('ox').onclick=()=>T().url&&window.open(T().url,'_blank');
  $('rs').onclick=()=>{if(confirm('Erase tabs, bookmarks, history?')){Object.keys(localStorage).filter(k=>k.startsWith('sky_')).forEach(k=>localStorage.removeItem(k));location.reload()}};
  P.onclick=e=>{if(e.target.hasAttribute('data-close'))close()};P.classList.add('on')}
$('dHome').onclick=()=>{T().url='';save();render()};$('dNew').onclick=()=>newTab();
$('dBm').onclick=()=>list('bm','Bookmarks');$('dHist').onclick=()=>list('hist','History');$('dSet').onclick=settings;
$('eng').innerHTML=Object.entries(PROXIES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');$('eng').value=engine;$('eng').onchange=e=>setEngine(e.target.value);
tiles();render();if(T().url)nav(T().url);
