/* RESONANT OBJECTS v0.4 — App / interaction layer.
 * 描画 / 音源 / 状態を分離。WebGL描画上の位置とタッチ領域は同一のモデルを参照。
 * Notes use stable IDs within each layout; no timer-driven animation when idle. */
(()=>{
'use strict';
const $=id=>document.getElementById(id), qsa=s=>[...document.querySelectorAll(s)];
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const field=$('stage'),canvas=$('instrument'),overlay=$('overlay'),labels=$('labels'),readout=$('status');
const colors=['#80dfee','#eca7dc','#80e6d3','#f5bd83','#94b2ff','#aadcf4','#80cfdf','#efb1aa','#9bdeda','#f1c5df','#a5c8f5'];
const hexRGB=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
// D minor 9 pitches exactly as v0.3, with two added notes for 11-piece mode.
const pitchBanks={
 minor:[['D3',50],['A3',57],['Bb3',58],['C4',60],['D4',62],['E4',64],['F4',65],['G4',67],['A4',69]],
 penta:[['C3',48],['G3',55],['C4',60],['D4',62],['E4',64],['G4',67],['A4',69],['C5',72],['D5',74]],
 lydian:[['F3',53],['C4',60],['E4',64],['F4',65],['G4',67],['A4',69],['B4',71],['C5',72],['E5',76]]
};
const selects={7:[0,1,2,3,4,6,8],9:[0,1,2,3,4,5,6,7,8],11:[0,1,2,3,4,5,6,7,8,9,10]};
const params={material:36,ring:67,space:0,bond:75,level:84};
const state={count:9,scale:'minor',motion:'still',move:false,scene:'original',drawer:false};
const sets=new Map(),stats={7:{hits:0,empty:0,slides:0,multi:0},9:{hits:0,empty:0,slides:0,multi:0},11:{hits:0,empty:0,slides:0,multi:0}};
const pointerMap=new Map();let notes=[],W=1,H=1,requestId=0,lastTime=0,lastActive=0,viewReady=false;
let lastTrigger=-1;
const engine=new ResonantEngine(msg=>say(msg)),renderer=new VisualRenderer(canvas,overlay,msg=>say(msg));
function say(msg){readout.textContent=msg;}
function pitches(count,scale){const source=pitchBanks[scale];const entries=source.concat([['G3',55],['C5',72]]);
 return selects[count].map(i=>entries[i]);}
function makeSet(count){return Array.from({length:count},(_,id)=>({id,midi:50,name:'',kind:id===0?0:((id-1)%8),big:id===0,
  color:hexRGB(colors[id]),hex:colors[id],u:.5,v:.5,saved:false,r:35,x:0,y:0,energy:0,angle:0,last:0,stageW:1,stageH:1}));}
for(const k of [7,9,11])sets.set(k,makeSet(k));
function setNotes(){notes=sets.get(state.count);const names=pitches(state.count,state.scale);
 for(const [i,n] of notes.entries()){n.name=names[i][0];n.midi=names[i][1];}
 labels.replaceChildren();for(const n of notes){const el=document.createElement('div');el.className='note-label';el.dataset.note=n.id;el.textContent=n.name;labels.appendChild(el);n.label=el;}
 resize();updateButtons();}
function layoutSet(set){
 const N=set.length,rx=Math.min(W*.285,H*1.06,345),ry=Math.min(H*.30,165);
 const r=Math.max(23,Math.min(N===7?42:N===9?39:31,H*(N===7?.126:N===9?.114:.095),W*(N===11?.049:.059)));
 for(const n of set){n.r=r*(n.big?1.18:1);n.stageW=W;n.stageH=H;
  if(!n.saved){if(n.id===0){n.u=.5;n.v=.5;}else{const a=-Math.PI/2+2*Math.PI*(n.id-1)/(N-1);
    n.u=.5+(rx/W)*Math.cos(a);n.v=.5+(ry/H)*Math.sin(a);}}
  n.x=clamp(n.u*W,n.r+5,W-n.r-5);n.y=clamp(n.v*H,n.r+5,H-n.r-5);
  n.u=n.x/W;n.v=n.y/H;
 }
}
function resize(){if(!viewReady)return;
 const rect=field.getBoundingClientRect();W=Math.max(1,rect.width);H=Math.max(1,rect.height);
 renderer.resize(W,H);for(const set of sets.values())layoutSet(set);updateLabels();drawRequest();}
function updateLabels(){for(const n of notes){if(!n.label)continue;n.label.style.left=n.x+'px';const labelY=Math.min(H-10,n.y+n.r+12);
  n.label.style.top=labelY+'px';n.label.classList.toggle('active',n.energy>.13);}}
function drawRequest(){if(!requestId)requestId=requestAnimationFrame(draw);}
function draw(t){requestId=0;
 if(state.motion!=='still' && !notes.some(n=>n.energy>.02) && lastTime && t/1000-lastTime<.031){drawRequest();return;}
 const now=t/1000,dt=lastTime?Math.min(.06,now-lastTime):.016;lastTime=now;
 let any=false;for(const n of notes){n.energy=Math.max(0,n.energy-dt*.64);if(n.energy>.008)any=true;
 // Geometry may subtly rotate, but touch centers NEVER drift during performance.
 if(state.motion==='orbit')n.angle+=dt*.14*(n.id%2===0?1:-1);
 else if(state.motion==='float')n.angle=Math.sin(now*.33+n.id*1.3)*.055;
 }
 updateLabels();renderer.draw(now,notes,state);
 if(any||state.motion!=='still')drawRequest();
}
function hit(x,y){let best=-1,dist=Infinity;
 for(const n of notes){const d=Math.hypot(n.x-x,n.y-y);
  // 11 pieces have a smaller hit area; prevent taps from selecting a far-away object.
  const region=Math.max(25,n.r*1.08);if(d<region&&d<dist){best=n.id;dist=d;}}
 return best;
}
const xy=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
function play(index,velocity=1){if(state.move)return;
 // The resume call happens synchronously in pointerdown to satisfy Safari gesture policy.
 engine.unlock().then(ok=>{
  if(!ok){say('Tap again to enable sound');return;}
  if(engine.strike(index,notes,velocity)){say(`✦ ${notes[index].name}  ·  resonating`);drawRequest();}
 });
}
function pointerDown(e){e.preventDefault();if($('lab').classList.contains('open'))return;
 if(state.drawer){toggleDrawer(false);return;}
 const {x,y}=xy(e),i=hit(x,y);
 if(i<0){if(!state.move)stats[state.count].empty++;return;}
 try{canvas.setPointerCapture(e.pointerId);}catch(_){}
 pointerMap.set(e.pointerId,{id:i,last:i,move:state.move});
 if(state.move){say('MOVE · arrange the resonators');drawRequest();return;}
 stats[state.count].hits++;stats[state.count].multi=Math.max(stats[state.count].multi,pointerMap.size);
 const v=clamp(1.03-.25*Math.hypot(x-notes[i].x,y-notes[i].y)/notes[i].r,.66,1);
 lastTrigger=i;play(i,v);
}
function pointerMove(e){const p=pointerMap.get(e.pointerId);if(!p)return;e.preventDefault();const {x,y}=xy(e);
 if(p.move){const n=notes[p.id];n.x=clamp(x,n.r+4,W-n.r-4);n.y=clamp(y,n.r+4,H-n.r-4);
  n.u=n.x/W;n.v=n.y/H;n.saved=true;updateLabels();drawRequest();return;}
 const i=hit(x,y);if(i===p.last)return;p.last=i;
 if(i>=0){stats[state.count].hits++;stats[state.count].slides++;
  const v=clamp(.86-.18*Math.hypot(x-notes[i].x,y-notes[i].y)/notes[i].r,.55,.86);
  lastTrigger=i;play(i,v);}
}
canvas.addEventListener('pointerdown',pointerDown,{passive:false});
canvas.addEventListener('pointermove',pointerMove,{passive:false});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>pointerMap.delete(e.pointerId));
function updateButtons(){
 qsa('[data-count]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.count)===state.count)));
 qsa('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===(state.move?'move':'play')));
 qsa('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===state.motion)));
 qsa('[data-scale]').forEach(s=>s.value=state.scale);
 $('reset').disabled=!state.move;
 $('touchHint').textContent=state.move?'✦ DRAG · REARRANGE · RESONATE':'✦ TOUCH · SLIDE · LISTEN';
 $('sceneName').textContent=({original:'Glass garden',cloud:'Blue hour',bright:'Little sun'})[state.scene]||'Custom';
}
function setCount(n){if(![7,9,11].includes(n))return;pointerMap.clear();state.count=n;setNotes();say(`${n} resonators ready`);}
function setScale(s){if(!pitchBanks[s])return;state.scale=s;setNotes();say('New tuning · '+({minor:'D minor',penta:'Pentatonic',lydian:'F Lydian'})[s]);}
function setMode(move){state.move=move;pointerMap.clear();updateButtons();say(move?'Drag the shapes to change their relationships':'Tap · slide · listen');drawRequest();}
function setMotion(m){if(!['still','float','orbit'].includes(m))return;
 state.motion=m;updateButtons();drawRequest();}
function setParam(k,v){v=clamp(Number(v),0,100);params[k]=v;
 if(k==='material')engine.setMaterial(v);
 if(k==='ring')engine.setDecay(v);
 if(k==='space')engine.setSpace(v);
 if(k==='bond')engine.setBond(v);
 if(k==='level')engine.setLevel(v);
 const caption={
  material:v<30?'Soft metal':v>70?'Bright glass':'Warm alloy',
  ring:v<30?'Short':v>63?'Long':'Medium',
  space:v<1?'Dry':v<45?'Small room':'Large room',
  bond:v<26?'Quiet':v>65?'Connected':'Gentle',
  level:`${v}%`
 }[k];
 qsa(`[data-param="${k}"]`).forEach(e=>e.value=v);
 qsa(`[data-value="${k}"]`).forEach(e=>e.textContent=caption);
 drawRequest();
}
function scene(s){if(!['original','cloud','bright'].includes(s))return;
 state.scene=s;
 const values={original:{material:36,ring:67,space:0,bond:75},cloud:{material:28,ring:88,space:42,bond:90},bright:{material:67,ring:51,space:22,bond:56}}[s];
 for(const [k,v] of Object.entries(values))setParam(k,v);
 state.scale=s==='cloud'?'penta':s==='bright'?'lydian':'minor';setNotes();updateButtons();
 say(`Scene · ${$('sceneName').textContent}`);
}
function shuffle(){
 // Keep tuning and positions unchanged; randomize only timbre and resonance.
 for(const [k,lo,hi] of [['material',15,83],['ring',35,91],['space',0,43],['bond',30,98]])setParam(k,Math.round(lo+Math.random()*(hi-lo)));
 state.scene='custom';updateButtons();say('A different resonance');
}
function reset(){for(const n of notes)n.saved=false;layoutSet(notes);updateLabels();drawRequest();say('Positions reset');}
function save(){
 try{const result={count:state.count,scale:state.scale,motion:state.motion,scene:state.scene,params,
  positions:Object.fromEntries([...sets].map(([k,set])=>[k,set.map(n=>({u:n.u,v:n.v,saved:n.saved}))]))};
  localStorage.setItem('resonant-objects-v04',JSON.stringify(result));say('Saved on this device');
 }catch(e){say('Storage unavailable');}
}
function restore(){
 try{const raw=localStorage.getItem('resonant-objects-v04');if(!raw)return;
  const v=JSON.parse(raw);if([7,9,11].includes(v.count))state.count=v.count;
  if(pitchBanks[v.scale])state.scale=v.scale;
  if(['still','float','orbit'].includes(v.motion))state.motion=v.motion;
  if(['original','cloud','bright','custom'].includes(v.scene))state.scene=v.scene;
  if(v.positions)for(const [key,ps] of Object.entries(v.positions)){
   const set=sets.get(Number(key));if(!set||!Array.isArray(ps))continue;
   for(let i=0;i<Math.min(set.length,ps.length);i++){
    const p=ps[i];if(!p||!p.saved)continue;
    if(!Number.isFinite(p.u)||!Number.isFinite(p.v))continue;
    set[i].u=clamp(p.u,0,1);set[i].v=clamp(p.v,0,1);set[i].saved=true;
   }
  }
  if(v.params)for(const k of Object.keys(params))if(Number.isFinite(v.params[k]))setParam(k,v.params[k]);
 }catch(e){console.warn('Saved scene ignored:',e);}
}
function toggleDrawer(open){state.drawer=open;$('drawer').classList.toggle('open',open);$('tuneBtn').setAttribute('aria-expanded',String(open));}
function metrics(N){const set=sets.get(N);let minD=Infinity,gap=Infinity;
 for(const a of set){minD=Math.min(minD,a.r*2);for(const b of set){if(a.id>=b.id)continue;
  gap=Math.min(gap,Math.hypot(a.x-b.x,a.y-b.y)-a.r-b.r);}}
 return {diameter:Math.round(minD),gap:Math.round(gap)};
}
function lab(open){$('lab').classList.toggle('open',open);$('shade').classList.toggle('open',open);
 if(open){toggleDrawer(false);const rows=$('labRows');rows.replaceChildren();
  for(const k of [7,9,11]){const m=metrics(k),s=stats[k],tr=document.createElement('tr');
   tr.innerHTML=`<td>${k}${k===state.count?' ●':''}</td><td>${m.diameter}px</td><td>${m.gap}px</td><td>${s.hits}</td><td>${s.empty}</td><td>${s.slides}</td><td>${s.multi}</td>`;
   rows.appendChild(tr);}}
}
qsa('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode==='move')));
qsa('[data-count]').forEach(b=>b.addEventListener('click',()=>setCount(Number(b.dataset.count))));
qsa('[data-motion]').forEach(b=>b.addEventListener('click',()=>setMotion(b.dataset.motion)));
qsa('[data-scale]').forEach(s=>s.addEventListener('change',()=>setScale(s.value)));
qsa('[data-param]').forEach(input=>input.addEventListener('input',()=>{
  setParam(input.dataset.param,input.value);state.scene='custom';updateButtons();
}));
$('reset').addEventListener('click',reset);$('shuffle').addEventListener('click',shuffle);$('save').addEventListener('click',save);
$('miniShuffle').addEventListener('click',shuffle);$('miniSave').addEventListener('click',save);
$('miniScenePrev').addEventListener('click',()=>$('scenePrev').click());$('miniSceneNext').addEventListener('click',()=>$('sceneNext').click());
$('tuneBtn').addEventListener('click',()=>toggleDrawer(!state.drawer));$('closeTune').addEventListener('click',()=>toggleDrawer(false));
$('labButton').addEventListener('click',()=>lab(true));$('labClose').addEventListener('click',()=>lab(false));$('shade').addEventListener('click',()=>lab(false));
$('scenePrev').addEventListener('click',()=>{const order=['original','cloud','bright'];scene(order[(order.indexOf(state.scene)+2)%3]);});
$('sceneNext').addEventListener('click',()=>{const order=['original','cloud','bright'];scene(order[(order.indexOf(state.scene)+1)%3]);});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){lab(false);toggleDrawer(false);return;}
 if(e.repeat||state.move||state.drawer||$('lab').classList.contains('open')||['INPUT','BUTTON','SELECT'].includes(document.activeElement?.tagName))return;
 const idx='1234567890-'.indexOf(e.key);if(idx<0||idx>=notes.length)return;e.preventDefault();play(idx,.90);
});
if('ResizeObserver' in window)new ResizeObserver(resize).observe(field);else window.addEventListener('resize',resize);
window.addEventListener('orientationchange',()=>setTimeout(resize,150));
document.addEventListener('visibilitychange',()=>{if(document.hidden){engine.suspend();}else{lastTime=0;resize();}});
window.addEventListener('pagehide',()=>engine.suspend());
// Deliberately initialize without audio; first gesture must create/resume its context.
viewReady=true;restore();for(const k of Object.keys(params))setParam(k,params[k]);setNotes();say('Tap a shape to wake the instrument');
})();
