/* RESONANT OBJECTS v0.8.1 — One Playing Field / interaction layer.
 * 描画 / 音源 / 状態を分離。WebGL描画上の位置とタッチ領域は同一のモデルを参照。
 * Notes use stable IDs within each layout; no timer-driven animation when idle. */
(()=>{
'use strict';
const $=id=>document.getElementById(id), qsa=s=>[...document.querySelectorAll(s)];
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const field=$('stage'),canvas=$('instrument'),overlay=$('overlay'),labels=$('labels'),readout=$('status');
const colors=['#4cd7ed','#f48ad0','#4bd9c5','#f6b57e','#839cff','#84c9f4','#65c5eb','#f28faa','#72e2cc','#e6a5f2','#85bafa'];
const hexRGB=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
// D minor 9 pitches exactly as v0.3, with two added notes for 11-piece mode.
const pitchBanks={
 minor:[['D3',50],['A3',57],['Bb3',58],['C4',60],['D4',62],['E4',64],['F4',65],['G4',67],['A4',69]],
 penta:[['C3',48],['G3',55],['C4',60],['D4',62],['E4',64],['G4',67],['A4',69],['C5',72],['D5',74]],
 lydian:[['F3',53],['C4',60],['E4',64],['F4',65],['G4',67],['A4',69],['B4',71],['C5',72],['E5',76]]
};
const selects={7:[0,1,2,3,4,6,8],9:[0,1,2,3,4,5,6,7,8],11:[0,1,2,3,4,5,6,7,8,9,10]};
const params={material:36,ring:67,space:0,bond:75,bloom:0,level:84,aura:48,trace:38,expression:46};
const state={count:9,scale:'minor',motion:'still',locked:false,dragging:false,collision:true,scene:'original',drawer:false,link:true,hold:true,quality:'balanced',feel:true,moveSound:true};
const sets=new Map(),stats={7:{hits:0,empty:0,slides:0,rub:0,moves:0,bumps:0,multi:0},9:{hits:0,empty:0,slides:0,rub:0,moves:0,bumps:0,multi:0},11:{hits:0,empty:0,slides:0,rub:0,moves:0,bumps:0,multi:0}};
const pointerMap=new Map();let notes=[],W=1,H=1,requestId=0,lastTime=0,lastActive=0,viewReady=false;
let lastTrigger=-1,lastLinkRefresh=0;
const engine=new ResonantEngine(msg=>say(msg)),renderer=new VisualRenderer(canvas,overlay,msg=>say(msg));
function say(msg){
 readout.textContent=msg;
 // Renderer status is explicit; the label must never claim WebGL in 2D fallback.
 const badge=$('gpuMode');
 if(badge&&(/WebGL unsupported|compatibility mode|graphics fallback|2D graphics/i.test(msg)))badge.textContent='2D COMPATIBILITY';
 else if(badge&&/WEBGL2.*direct graphics/i.test(msg))badge.textContent='WEBGL2 DIRECT';
 else if(badge&&/WEBGL1.*direct graphics/i.test(msg))badge.textContent='WEBGL1 DIRECT';
 else if(badge&&/WEBGL2.*GPU pipeline/i.test(msg))badge.textContent='WEBGL2 GPU';
 else if(badge&&/WEBGL1.*GPU pipeline/i.test(msg))badge.textContent='WEBGL1 GPU';
}
function pitches(count,scale){const source=pitchBanks[scale];const entries=source.concat([['G3',55],['C5',72]]);
 return selects[count].map(i=>entries[i]);}
function makeSet(count){return Array.from({length:count},(_,id)=>({id,midi:50,name:'',kind:id===0?0:((id-1)%8),big:id===0,
  color:hexRGB(colors[id]),hex:colors[id],u:.5,v:.5,saved:false,r:35,x:0,y:0,energy:0,angle:0,last:0,stageW:1,stageH:1,gesture:0}));}
for(const k of [7,9,11])sets.set(k,makeSet(k));
function setNotes(){clearPointers();notes=sets.get(state.count);const names=pitches(state.count,state.scale);
 for(const [i,n] of notes.entries()){n.name=names[i][0];n.midi=names[i][1];}
 labels.replaceChildren();for(const n of notes){const el=document.createElement('div');el.className='note-label';el.dataset.note=n.id;el.textContent=n.name;labels.appendChild(el);n.label=el;}
 resize();updateButtons();engine.stopAllHolds();if(engine.ctx)engine.syncTanks(notes);}
// Same physical screen size for all note counts: adding notes never shrinks an object.
// A centered note and a fixed-size elliptical ring keep thumb access predictable.
function layoutSet(set){
 const N=set.length;
 const r=clamp(Math.min(32,H*.102,W*.048),22,32);
 const rx=Math.min(W*.335,W*.5-r-12);
 const ry=Math.min(H*.325,H*.5-r-12);
 for(const n of set){
  n.r=r;n.stageW=W;n.stageH=H;
  if(!n.saved){
   if(n.id===0){n.u=.5;n.v=.5;}
   else{const angle=-Math.PI/2+2*Math.PI*(n.id-1)/(N-1)+(N===11?Math.PI/10:0);
    n.u=.5+rx/W*Math.cos(angle);n.v=.5+ry/H*Math.sin(angle);}
  }
  n.x=clamp(n.u*W,r+4,W-r-4);
  n.y=clamp(n.v*H,r+4,H-r-4);
  n.u=n.x/W;n.v=n.y/H;
 }
 // Imported saved positions, or an orientation change, may create overlaps.
 separateObjects(set, null, 38);
 for(const n of set){n.u=n.x/W;n.v=n.y/H;}
}

function resize(){if(!viewReady)return;
 const rect=field.getBoundingClientRect();W=Math.max(1,rect.width);H=Math.max(1,rect.height);
 renderer.resize(W,H);for(const set of sets.values())layoutSet(set);updateLabels();drawRequest();}
function updateLabels(){for(const n of notes){if(!n.label)continue;n.label.style.left=n.x+'px';const labelY=Math.min(H-10,n.y+n.r+12);
  n.label.style.top=labelY+'px';n.label.classList.toggle('active',n.energy>.13);}}
function drawRequest(){if(!requestId)requestId=requestAnimationFrame(draw);}
function draw(t){requestId=0;
 if(state.motion!=='still' && !notes.some(n=>n.energy>.02||(n.gesture||0)>.02) && lastTime && t/1000-lastTime<.031){drawRequest();return;}
 const now=t/1000,dt=lastTime?Math.min(.06,now-lastTime):.016;lastTime=now;
 let any=false;
 // Visual coupling: conservative energy transfer. The underlying acoustic coupling
 // is implemented independently in the Audio engine, not synthesized from frames.
 if(state.link&&notes.length){
  const energies=notes.map(n=>n.energy), transfer=notes.map(()=>0);
  const reach=Math.max(95,Math.min(W,H)*.82);
  for(let i=0;i<notes.length;i++){
   const list=notes.map((n,j)=>({j,d:Math.hypot(n.x-notes[i].x,n.y-notes[i].y)}))
    .filter(v=>v.j!==i&&v.d<reach).sort((a,b)=>a.d-b.d).slice(0,3);
   let total=0;
   for(const v of list){const amount=energies[i]*dt*.28*(1-v.d/reach)*params.bond/100;
    transfer[v.j]+=amount;total+=amount;}
   transfer[i]-=total;
  }
  for(let i=0;i<notes.length;i++)notes[i].energy=clamp(notes[i].energy+transfer[i],0,1);
 }
 for(const n of notes){n.energy=Math.max(0,n.energy-dt*.64);
 n.gesture=Math.max(0,(n.gesture||0)-dt*2.7);
 if(n.energy>.008||n.gesture>.008)any=true;
 // Geometry may subtly rotate, but touch centers NEVER drift during performance.
 if(state.motion==='orbit')n.angle+=dt*.14*(n.id%2===0?1:-1);
 else if(state.motion==='float')n.angle=Math.sin(now*.33+n.id*1.3)*.055;
 }
 updateLabels();renderer.draw(now,notes,state);
 if(any||renderer.needsFrame()||state.motion!=='still')drawRequest();
}
function hit(x,y){let best=-1,dist=Infinity;
 for(const n of notes){const d=Math.hypot(n.x-x,n.y-y);
  // 11 pieces have a smaller hit area; prevent taps from selecting a far-away object.
  const region=Math.max(25,n.r*1.08);if(d<region&&d<dist){best=n.id;dist=d;}}
 return best;
}
const xy=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
function play(index,velocity=1,radial=0){
 // Use a stable snapshot because resuming AudioContext is asynchronous on Safari.
 const current=notes, note=current[index];if(!note)return;
 engine.unlock().then(ok=>{
  if(!ok){say('Tap again to enable sound');return;}
  if(current!==notes)return;
  if(engine.strike(index,current,velocity,state.feel?radial:0)){
   say(`✦ ${note.name} · ${radial>.62&&state.feel?'bright rim':'resonating'}`);drawRequest();
  }
 });
}
function pointerDown(e){
 e.preventDefault();if($('lab').classList.contains('open'))return;
 if(state.drawer){toggleDrawer(false);return;}
 const {x,y}=xy(e),i=hit(x,y);
 if(i<0){stats[state.count].empty++;return;}
 try{canvas.setPointerCapture(e.pointerId);}catch(_){}
 const n=notes[i],radial=clamp(Math.hypot(x-n.x,y-n.y)/n.r,0,1);
 // Center-first drag, edge-first glide. They share the same immediate note onset.
 const alreadyGrabbed=[...pointerMap.values()].some(p=>p.id===i);
 const p={id:i,last:i,intent:'pending',canDrag:radial<.69&&!state.locked&&!alreadyGrabbed,
  holdTimer:0,x,y,startX:x,startY:y,when:performance.now(),moved:false,gesture:false,
  offsetX:x-n.x,offsetY:y-n.y,countedRub:false,countedMove:false,
  contactWith:new Set(),lastSpeed:0};
 pointerMap.set(e.pointerId,p);
 stats[state.count].hits++;stats[state.count].multi=Math.max(stats[state.count].multi,pointerMap.size);
 play(i,clamp(1.03-.25*radial,.66,1),radial);
 scheduleHold(e.pointerId,i);
}
function cancelHold(pointerId){
 const p=pointerMap.get(pointerId);if(p?.holdTimer){clearTimeout(p.holdTimer);p.holdTimer=0;}
 engine.stopHold(pointerId);
}
function scheduleHold(pointerId,index){
 const p=pointerMap.get(pointerId);if(!p||!state.hold||p.moved)return;
 if(p.holdTimer)clearTimeout(p.holdTimer);
 p.holdTimer=setTimeout(()=>{
  p.holdTimer=0;
  if(pointerMap.get(pointerId)===p&&p.last===index&&state.hold&&!p.moved){
   engine.startHold(pointerId,notes[index]);notes[index].energy=Math.max(notes[index].energy,.34);drawRequest();
  }
 },270);
}
// Position-based collisions: contact can push neighbours, including chains.
// Every body is a disc with the same radius across 7/9/11 modes. A soft grab
// correction lets the selected body yield when its neighbours hit a wall.
const COLLISION_GAP=3;
function separateObjects(set, grabbed, rounds=16){
 const held=new Set([...pointerMap.values()]
  .filter(p=>p.intent==='drag').map(p=>p.id));
 for(let k=0;k<rounds;k++){
  let maxPenetration=0;
  for(let i=0;i<set.length;i++)for(let j=i+1;j<set.length;j++){
   const a=set[i],b=set[j],minDist=a.r+b.r+COLLISION_GAP;
   let dx=a.x-b.x,dy=a.y-b.y,dist=Math.hypot(dx,dy);
   if(dist>=minDist-.02)continue;
   if(dist<.001){const angle=(i*2.399+j*1.57);dx=Math.cos(angle);dy=Math.sin(angle);dist=1;}
   const penetration=minDist-dist;
   maxPenetration=Math.max(maxPenetration,penetration);
   let wa=a===grabbed?.25:held.has(a.id)?0:1;
   let wb=b===grabbed?.25:held.has(b.id)?0:1;
   // Do not move another actively held object; make this moving object yield.
   if(wa+wb<.01){wa=a===grabbed?1:0;wb=b===grabbed?1:0;}
   if(wa+wb<.01)continue;
   const nx=dx/dist,ny=dy/dist;
   a.x+=nx*penetration*wa/(wa+wb);a.y+=ny*penetration*wa/(wa+wb);
   b.x-=nx*penetration*wb/(wa+wb);b.y-=ny*penetration*wb/(wa+wb);
  }
  for(const n of set){
   n.x=clamp(n.x,n.r+4,W-n.r-4);
   n.y=clamp(n.y,n.r+4,H-n.r-4);
  }
  if(maxPenetration<.035)break;
 }
}
function dragObject(pointerId,p,x,y,speed,now){
 const n=notes[p.id];
 const targetX=clamp(x-p.offsetX,n.r+4,W-n.r-4);
 const targetY=clamp(y-p.offsetY,n.r+4,H-n.r-4);
 const oldPositions=notes.map(v=>[v.x,v.y]);
 const startX=n.x,startY=n.y;
 const travel=Math.hypot(targetX-startX,targetY-startY);
 const steps=Math.max(1,Math.min(28,Math.ceil(travel/Math.max(8,n.r*.36))));
 const touched=new Set();
 // Swept collision prevents a fast finger from passing through a neighbour.
 // The destination of each short step is corrected by the constraint solver.
 for(let step=1;step<=steps;step++){
  const t=step/steps;
  n.x=clamp(startX+(targetX-startX)*t,n.r+4,W-n.r-4);
  n.y=clamp(startY+(targetY-startY)*t,n.r+4,H-n.r-4);
  for(const other of notes){
   if(other===n)continue;
   if(Math.hypot(n.x-other.x,n.y-other.y)<n.r+other.r+COLLISION_GAP+.2)
    touched.add(other.id);
  }
  separateObjects(notes,n,step===steps?26:9);
 }
 // The final collision distances determine whether a contact is re-armed.
 let nearest=null,nearestDist=Infinity;
 for(const other of notes){
  if(other===n)continue;
  const dist=Math.hypot(n.x-other.x,n.y-other.y);
  if(dist<nearestDist){nearestDist=dist;nearest=other;}
  if(dist<n.r+other.r+COLLISION_GAP+4)touched.add(other.id);
 }
 let chimed=0;
 for(const other of notes){
  if(other===n)continue;
  const dist=Math.hypot(n.x-other.x,n.y-other.y);
  const minD=n.r+other.r+COLLISION_GAP;
  if(touched.has(other.id)){
   if(state.collision&&state.feel&&speed>.10&&!p.contactWith.has(other.id)&&chimed<2){
    engine.contact(n,other,speed,notes);stats[state.count].bumps++;chimed++;
    n.energy=Math.max(n.energy,.58);other.energy=Math.max(other.energy,.48);
    other.gesture=Math.max(other.gesture||0,.70);
   }
   p.contactWith.add(other.id);
  }else if(dist>minD+13)p.contactWith.delete(other.id);
 }
 for(let i=0;i<notes.length;i++){
  const obj=notes[i];
  if(Math.hypot(obj.x-oldPositions[i][0],obj.y-oldPositions[i][1])>.08){
   obj.u=obj.x/W;obj.v=obj.y/H;obj.saved=true;
   if(obj!==n&&speed>.05)obj.gesture=Math.max(obj.gesture||0,.12+speed*.34);
  }
 }
 n.dragged=true;state.dragging=true;
 if(now-lastLinkRefresh>55){engine.refreshLinks(notes);lastLinkRefresh=now;}
 if(state.feel&&state.moveSound&&params.expression>0){
  if(!p.gesture)p.gesture=engine.beginGesture(pointerId,n);
  if(p.gesture){
   const reach=Math.max(75,Math.min(W,H)*.54);
   const proximity=nearest?clamp(1-nearestDist/reach,0,1):0;
   const pitchBend=nearest?clamp((nearest.midi-n.midi)/12,-1,1)*proximity:0;
   engine.updateGesture(pointerId,n,{speed,radial:0,offset:pitchBend,proximity,move:true});
   n.gesture=Math.max(n.gesture||0,.14+speed*.55);
  }
 }
 if(!p.countedMove){stats[state.count].moves++;p.countedMove=true;}
 updateLabels();drawRequest();
}
function pointerMove(e){
 const p=pointerMap.get(e.pointerId);if(!p)return;e.preventDefault();
 const {x,y}=xy(e),now=performance.now(),dt=Math.max(9,Math.min(95,now-p.when));
 const delta=Math.hypot(x-p.x,y-p.y),speed=clamp(delta/dt/.74,0,1);
 p.x=x;p.y=y;p.when=now;p.lastSpeed=speed;
 const travel=Math.hypot(x-p.startX,y-p.startY);
 if(!p.moved&&travel>10){p.moved=true;cancelHold(e.pointerId);}
 if(p.intent==='pending'&&travel>15){p.intent=p.canDrag?'drag':'glide';}
 if(p.intent==='drag'){
  dragObject(e.pointerId,p,x,y,speed,now);return;
 }
 if(p.intent!=='glide')return;
 const i=hit(x,y);
 if(state.feel&&params.expression>0){
  const n=notes[i>=0?i:(p.last>=0?p.last:p.id)];
  if(n){
   if(!p.gesture)p.gesture=engine.beginGesture(e.pointerId,n);
   if(p.gesture){
    const radial=clamp(Math.hypot(x-n.x,y-n.y)/n.r,0,1);
    engine.updateGesture(e.pointerId,n,{speed,radial,offset:clamp((x-n.x)/n.r,-1,1),move:false});
    n.gesture=Math.max(n.gesture||0,.15+speed*.55);
    if(!p.countedRub){stats[state.count].rub++;p.countedRub=true;}
   }
  }
 }
 if(i!==p.last){p.last=i;
  if(i>=0){stats[state.count].hits++;stats[state.count].slides++;
   const radial=clamp(Math.hypot(x-notes[i].x,y-notes[i].y)/notes[i].r,0,1);
   play(i,clamp(.86-.18*radial,.55,.86),radial);
  }
 }
 drawRequest();
}
canvas.addEventListener('rendererrestored',()=>{lastTime=0;drawRequest();});
canvas.addEventListener('pointerdown',pointerDown,{passive:false});
canvas.addEventListener('pointermove',pointerMove,{passive:false});
function pointerEnd(e){
 const p=pointerMap.get(e.pointerId);if(!p)return;
 cancelHold(e.pointerId);engine.endGesture(e.pointerId);pointerMap.delete(e.pointerId);
 if(p.intent==='drag'){
  notes[p.id].dragged=false;
  if(state.feel&&state.moveSound&&p.lastSpeed>.23&&performance.now()-p.when<110){
   engine.releasePluck(notes[p.id],p.lastSpeed);
   notes[p.id].energy=Math.max(notes[p.id].energy,.35);
  }
  state.dragging=[...pointerMap.values()].some(v=>v.intent==='drag');
  engine.refreshLinks(notes);drawRequest();
 }
}
for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,pointerEnd);
function updateButtons(){
 qsa('[data-count]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.count)===state.count)));
 qsa('[data-lock]').forEach(b=>{b.setAttribute('aria-pressed',String(state.locked));b.textContent=state.locked?'LOCKED':'UNLOCKED';});
 qsa('[data-collision]').forEach(b=>{b.setAttribute('aria-pressed',String(state.collision));b.textContent=state.collision?'ON':'OFF';});
 qsa('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===state.motion)));
 qsa('[data-scale]').forEach(s=>s.value=state.scale);
 qsa('[data-link]').forEach(b=>{b.setAttribute('aria-pressed',String(state.link));b.textContent=state.link?'ON':'OFF';});
 qsa('[data-hold]').forEach(b=>{b.setAttribute('aria-pressed',String(state.hold));b.textContent=state.hold?'ON':'OFF';});
 qsa('[data-feel]').forEach(b=>{b.setAttribute('aria-pressed',String(state.feel));b.textContent=state.feel?'ON':'OFF';});
 qsa('[data-move-sound]').forEach(b=>{b.setAttribute('aria-pressed',String(state.moveSound));b.textContent=state.moveSound?'ON':'OFF';});
 qsa('[data-quality]').forEach(s=>s.value=state.quality);
 $('touchHint').textContent=state.locked?'✦ POSITIONS LOCKED · TAP · GLIDE · HOLD':'✦ TAP TO PLAY · CENTER TO PUSH · RIM TO GLIDE';
 $('sceneName').textContent=({original:'Glass garden',cloud:'Blue hour',bright:'Little sun'})[state.scene]||'Custom';
}
function clearPointers(){for(const id of pointerMap.keys()){
  cancelHold(id);engine.endGesture(id);
 }pointerMap.clear();for(const n of notes)n.dragged=false;state.dragging=false;}
function setCount(n){if(![7,9,11].includes(n))return;clearPointers();state.count=n;setNotes();say(`${n} resonators ready`);}
function setScale(s){if(!pitchBanks[s])return;state.scale=s;setNotes();say('New tuning · '+({minor:'D minor',penta:'Pentatonic',lydian:'F Lydian'})[s]);}
function setLock(locked){clearPointers();state.locked=locked;updateButtons();say(locked?'Positions locked · sounds remain playable':'Drag centers to move, glide along edges');drawRequest();}
function setMotion(m){if(!['still','float','orbit'].includes(m))return;
 state.motion=m;updateButtons();drawRequest();}
function setParam(k,v){v=clamp(Number(v),0,100);params[k]=v;
 if(k==='material')engine.setMaterial(v);
 if(k==='ring')engine.setDecay(v);
 if(k==='space')engine.setSpace(v);
 if(k==='bond')engine.setBond(v);
 if(k==='bloom')engine.setBloom(v);
 if(k==='level')engine.setLevel(v);
 if(k==='expression')engine.setExpression(state.feel?v:0);
 if(k==='aura'||k==='trace')renderer.setFX(params.aura,params.trace);
 const caption={
  material:v<30?'Soft metal':v>70?'Bright glass':'Warm alloy',
  ring:v<30?'Short':v>63?'Long':'Medium',
  space:v<1?'Dry':v<45?'Small room':'Large room',
  bond:v<26?'Quiet':v>65?'Connected':'Gentle',
  bloom:v<1?'Off':v<45?'Soft':'Deep',
  aura:v<1?'Off':v<45?'Soft':'Luminous',
  trace:v<1?'Off':v<45?'Gentle':'Long',
  expression:v<1?'Off':v<36?'Subtle':v<71?'Gentle':'Lively',
  level:`${v}%`
 }[k];
 qsa(`[data-param="${k}"]`).forEach(e=>e.value=v);
 qsa(`[data-value="${k}"]`).forEach(e=>e.textContent=caption);
 drawRequest();
}
function scene(s){if(!['original','cloud','bright'].includes(s))return;
 state.scene=s;
 const values={original:{material:36,ring:67,space:0,bond:75,bloom:0},cloud:{material:28,ring:88,space:35,bond:88,bloom:42},bright:{material:67,ring:51,space:17,bond:56,bloom:15}}[s];
 for(const [k,v] of Object.entries(values))setParam(k,v);
 state.scale=s==='cloud'?'penta':s==='bright'?'lydian':'minor';setNotes();updateButtons();
 say(`Scene · ${$('sceneName').textContent}`);
}
function shuffle(){
 // Keep tuning and positions unchanged; randomize only timbre and resonance.
 for(const [k,lo,hi] of [['material',15,83],['ring',35,91],['space',0,43],['bond',30,98],['bloom',0,50]])setParam(k,Math.round(lo+Math.random()*(hi-lo)));
 state.scene='custom';updateButtons();say('A different resonance');
}
function reset(){for(const n of notes)n.saved=false;layoutSet(notes);engine.refreshLinks(notes);updateLabels();drawRequest();say('Positions reset');}
function save(){
 try{const result={count:state.count,scale:state.scale,motion:state.motion,scene:state.scene,params,
  feel:state.feel,moveSound:state.moveSound,collision:state.collision,locked:state.locked,link:state.link,hold:state.hold,quality:state.quality,
  positions:Object.fromEntries([...sets].map(([k,set])=>[k,set.map(n=>({u:n.u,v:n.v,saved:n.saved}))]))};
  localStorage.setItem('resonant-objects-v081',JSON.stringify(result));say('Saved on this device');
 }catch(e){say('Storage unavailable');}
}
function restore(){
 try{const raw=localStorage.getItem('resonant-objects-v081')||localStorage.getItem('resonant-objects-v08')||localStorage.getItem('resonant-objects-v07')||localStorage.getItem('resonant-objects-v06')||localStorage.getItem('resonant-objects-v05')||localStorage.getItem('resonant-objects-v04');if(!raw)return;
  const v=JSON.parse(raw);if([7,9,11].includes(v.count))state.count=v.count;
  if(pitchBanks[v.scale])state.scale=v.scale;
  if(['still','float','orbit'].includes(v.motion))state.motion=v.motion;
  if(['original','cloud','bright','custom'].includes(v.scene))state.scene=v.scene;
  if(['eco','balanced','high'].includes(v.quality))state.quality=v.quality;
  if(typeof v.link==='boolean')state.link=v.link;
  if(typeof v.hold==='boolean')state.hold=v.hold;
  if(typeof v.feel==='boolean')state.feel=v.feel;
  if(typeof v.moveSound==='boolean')state.moveSound=v.moveSound;
  if(typeof v.collision==='boolean')state.collision=v.collision;
  if(typeof v.locked==='boolean')state.locked=v.locked;
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
   tr.innerHTML=`<td>${k}${k===state.count?' ●':''}</td><td>${m.diameter}px</td><td>${m.gap}px</td><td>${s.hits}</td><td>${s.empty}</td><td>${s.slides}</td><td>${s.rub}</td><td>${s.moves}</td><td>${s.bumps}</td><td>${s.multi}</td>`;
   rows.appendChild(tr);}}
}
qsa('[data-lock]').forEach(b=>b.addEventListener('click',()=>setLock(!state.locked)));
qsa('[data-collision]').forEach(b=>b.addEventListener('click',()=>{state.collision=!state.collision;updateButtons();say(state.collision?'Gentle contact notes enabled':'Contact notes muted');}));
qsa('[data-count]').forEach(b=>b.addEventListener('click',()=>setCount(Number(b.dataset.count))));
qsa('[data-motion]').forEach(b=>b.addEventListener('click',()=>setMotion(b.dataset.motion)));
qsa('[data-link]').forEach(b=>b.addEventListener('click',()=>{
 state.link=!state.link;engine.setLink(state.link);updateButtons();say(state.link?'Live resonance connected':'Live resonance bypassed');drawRequest();
}));
qsa('[data-feel]').forEach(b=>b.addEventListener('click',()=>{
 state.feel=!state.feel;engine.setExpression(state.feel?params.expression:0);
 if(!state.feel)engine.stopAllGestures();updateButtons();say(state.feel?'Expressive touch enabled':'Original calm sound');
}));
qsa('[data-move-sound]').forEach(b=>b.addEventListener('click',()=>{
 state.moveSound=!state.moveSound;if(!state.moveSound)engine.stopAllGestures();
 updateButtons();say(state.moveSound?'Move sound enabled':'Silent arrangement');
}));
qsa('[data-hold]').forEach(b=>b.addEventListener('click',()=>{
 state.hold=!state.hold;if(!state.hold){for(const id of pointerMap.keys())cancelHold(id);}
 updateButtons();say(state.hold?'Hold-to-sing enabled':'Hold-to-sing disabled');
}));
qsa('[data-scale]').forEach(s=>s.addEventListener('change',()=>setScale(s.value)));
qsa('[data-quality]').forEach(s=>s.addEventListener('change',()=>{
 state.quality=s.value;renderer.setQuality(state.quality);updateButtons();drawRequest();
 say('GPU quality · '+state.quality);
}));
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
 if(e.repeat||state.drawer||$('lab').classList.contains('open')||['INPUT','BUTTON','SELECT'].includes(document.activeElement?.tagName))return;
 const idx='1234567890-'.indexOf(e.key);if(idx<0||idx>=notes.length)return;e.preventDefault();play(idx,.90);
});
if('ResizeObserver' in window)new ResizeObserver(resize).observe(field);else window.addEventListener('resize',resize);
window.addEventListener('orientationchange',()=>setTimeout(resize,150));
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearPointers();engine.suspend();}else{lastTime=0;resize();}});
window.addEventListener('pagehide',()=>engine.suspend());
// Deliberately initialize without audio; first gesture must create/resume its context.
viewReady=true;restore();renderer.setQuality(state.quality);for(const k of Object.keys(params))setParam(k,params[k]);engine.setExpression(state.feel?params.expression:0);engine.setLink(state.link);setNotes();say('Touch to play · drag the centre · glide at the rim');
})();
