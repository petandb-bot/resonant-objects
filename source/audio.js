/* RESONANT OBJECTS v0.11.2 — four distinct acoustic engines. No external dependencies.
 * 原音を維持しつつ、近接共鳴の「打撃時」と「音声信号経由」の2層を分離する。
 * Audio graph: per-voice modal synth -> dry bus -> compressor
 *                       \-> modal tanks <-> bounded damped coupling -> wet bus
 *                              \-> BLOOM diffused delay -> compressor
 */
class ResonantEngine {
 constructor(onStatus=()=>{}){
  this.onStatus=onStatus;this.ctx=null;this.voices=[];this.holds=new Map();this.gestures=new Map();
  this.expression=.46;
  this.material=.36;this.materialType=0;this.decay=.67;this.bond=.75;this.space=0;this.bloom=0;this.level=.84;
  this.link=true;this.connections=[];this.tanks=[];this.edges=[];this.tankKey='';this.wetGains=[];
  this.lastContact=new Map();
  this.synths=[new JewelModalEngine(this),new CandyElasticFMEngine(this),
   new CeramicWaveguideEngine(this),new MetalInharmonicFMEngine(this),new WaveBreathingEngine(this)];
 }
 init(){
  if(this.ctx)return;
  const A=window.AudioContext||window.webkitAudioContext;
  if(!A){this.onStatus('Web Audio unavailable');return;}
  const c=this.ctx=new A({latencyHint:'interactive'});
  this.voiceBus=c.createGain();this.voiceBus.gain.value=.84;
  this.effectInsert=c.createGain();this.compressor=c.createDynamicsCompressor();
  this.compressor.threshold.value=-16;this.compressor.knee.value=12;
  this.compressor.ratio.value=3.6;this.compressor.attack.value=.004;this.compressor.release.value=.20;
  this.master=c.createGain();this.master.gain.value=this.level;
  this.voiceBus.connect(this.effectInsert).connect(this.compressor).connect(this.master).connect(c.destination);
  this.wetGains=[];
  for(const [seconds,cutoff,amount] of [[.063,3200,.21],[.142,2400,.16],[.282,1700,.11]]){
   const del=c.createDelay(.5);del.delayTime.value=seconds;
   const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=cutoff;
   const gain=c.createGain();gain.gain.value=0;
   this.effectInsert.connect(del).connect(filter).connect(gain).connect(this.compressor);
   this.wetGains.push({gain,amount});
  }
  // Bounded two-tap diffusion; feedback below unity and low-pass filtered.
  // BLOOM=0 keeps the v0.4 output unchanged.
  const input=this.bloomInput=c.createGain();input.gain.value=1;
  const delayA=c.createDelay(.9),delayB=c.createDelay(.9);
  delayA.delayTime.value=.317;delayB.delayTime.value=.463;
  const filterA=c.createBiquadFilter(),filterB=c.createBiquadFilter();
  filterA.type=filterB.type='lowpass';filterA.frequency.value=1830;filterB.frequency.value=1330;
  const feedbackA=c.createGain(),feedbackB=c.createGain();feedbackA.gain.value=.23;feedbackB.gain.value=.19;
  const wet=this.bloomWet=c.createGain();wet.gain.value=0;
  input.connect(delayA);delayA.connect(filterA);filterA.connect(wet);filterA.connect(feedbackA).connect(delayB);
  delayB.connect(filterB);filterB.connect(wet);filterB.connect(feedbackB).connect(delayA);
  wet.connect(this.compressor);
  // Audio input dry source, not recirculated from the compressed output.
  this.voiceBus.connect(input);
  this.setSpace(this.space*100);this.setBloom(this.bloom*100);
 }
 unlock(){
  this.init();if(!this.ctx)return Promise.resolve(false);
  if(this.ctx.state==='running')return Promise.resolve(true);
  return this.ctx.resume().then(()=>this.ctx.state==='running').catch(()=>false);
 }
 setMaterial(v){this.material=v/100;}
 setMaterialType(type){
  const selected=Math.max(0,Math.min(4,type|0));
  if(this.materialType===selected)return;
  this.stopAllGestures();this.stopAllHolds();this.materialType=selected;
  // Changing body construction changes its sympathetic resonator as well.
  this.tankKey='';this.clearTanks();
 }
 setExpression(v){this.expression=Math.min(1,Math.max(0,v/100));}
 setDecay(v){this.decay=v/100;}
 setBond(v){this.bond=v/100;this.refreshLinks();}
 setLink(v){this.link=!!v;this.refreshLinks();}
 setConnections(connections){this.connections=connections.map(e=>({a:e.a,b:e.b}));this.refreshLinks();}
 setBloom(v){this.bloom=v/100;if(this.ctx&&this.bloomWet)
  this.bloomWet.gain.setTargetAtTime(.22*Math.pow(this.bloom,1.45),this.ctx.currentTime,.045);}
 setSpace(v){this.space=v/100;if(!this.ctx)return;
  for(const {gain,amount} of this.wetGains)
   gain.gain.setTargetAtTime(Math.pow(this.space,1.35)*amount,this.ctx.currentTime,.025);
 }
 setLevel(v){this.level=v/100;if(this.master&&this.ctx)this.master.gain.setTargetAtTime(this.level,this.ctx.currentTime,.02);}
 clearTanks(){
  for(const e of this.edges){try{e.gain.disconnect();}catch(_){}}
  for(const t of this.tanks)for(const node of t.nodes){try{node.disconnect();}catch(_){}}
  this.tanks=[];this.edges=[];this.tankKey='';
 }
 syncTanks(notes){
  if(!this.ctx||!notes?.length)return;
  const key=this.materialType+':'+notes.map(n=>n.midi+'/'+this.soundType(n)).join(',');
  if(key!==this.tankKey){
   this.clearTanks();const c=this.ctx;
   for(const n of notes){
    const input=c.createGain(),out=c.createGain(),ret=c.createGain();
    const nodes=[input,out,ret];input.gain.value=.8;ret.gain.value=0;
    const hz=440*Math.pow(2,(n.midi-69)/12);
    const resonatorShapes=[
      [[1,68,.32],[2.002,50,.22],[3.008,38,.13]],
      [[1,24,.29],[1.991,17,.18],[3.03,14,.075]],
      [[1,39,.35],[1.51,21,.12],[2.48,15,.08]],
      [[1,48,.27],[2.17,33,.16],[3.79,26,.09]],
      [[1,31,.24],[2.006,23,.13],[3.005,13,.045]]
    ];
    const type=this.soundType(n);
    for(const [ratio,q,mix] of resonatorShapes[type]){
     const f=c.createBiquadFilter(),g=c.createGain();f.type='bandpass';f.frequency.value=Math.min(16000,hz*ratio);
     f.Q.value=q;g.gain.value=mix;input.connect(f).connect(g).connect(out);nodes.push(f,g);
    }
    out.connect(ret).connect(this.voiceBus);
    // A short recirculation produces an audible decaying resonator, not an unbounded loop.
    const loopDelay=c.createDelay(.15),loopGain=c.createGain(),damp=c.createBiquadFilter();
    loopDelay.delayTime.value=.038+n.id*.0013;loopGain.gain.value=.18;
    damp.type='lowpass';damp.frequency.value=[1750,1250,1900,2600,2000][type];
    out.connect(loopDelay).connect(damp).connect(loopGain).connect(input);
    nodes.push(loopDelay,loopGain,damp);
    this.tanks.push({id:n.id,input,out,ret,loopGain,nodes});
   }
   // Shared output delay per source; individual gains define the coupling matrix.
   for(let i=0;i<this.tanks.length;i++){
    const t=this.tanks[i],delay=c.createDelay(.12),damp=c.createBiquadFilter();
    delay.delayTime.value=.025+(i%3)*.006;
    damp.type='lowpass';damp.frequency.value=2400;
    t.out.connect(delay).connect(damp);t.nodes.push(delay,damp);
    for(let j=0;j<this.tanks.length;j++)if(i!==j){
     const gain=c.createGain();gain.gain.value=0;
     damp.connect(gain).connect(this.tanks[j].input);
     this.edges.push({from:i,to:j,gain});
    }
   }
   this.tankKey=key;
  }
  this.refreshLinks(notes);
 }
 refreshLinks(notes){
  if(notes)this.layout=notes;
  if(!this.ctx||!this.tanks.length)return;
  const c=this.ctx,now=c.currentTime,n=this.layout;
  if(!n||n.length!==this.tanks.length)return;
  for(const t of this.tanks){
   t.ret.gain.setTargetAtTime(this.link?.23:0,now,.045);
   t.loopGain.gain.setTargetAtTime(this.link?[.30,.22,.27,.24,.17][this.soundType(n[t.id])]:0,now,.055);
  }
  const reach=Math.max(95,Math.min(n[0].stageW,n[0].stageH)*.82);
  // Each source sends to only the three nearest objects, normalized to avoid a gain explosion.
  const matrix=n.map((src,i)=>n.map((dst,j)=>({j,d:Math.hypot(src.x-dst.x,src.y-dst.y)}))
   .filter(v=>v.j!==i&&v.d<reach).sort((a,b)=>a.d-b.d).slice(0,3));
  for(const edge of this.edges){
   const target=matrix[edge.from].find(v=>v.j===edge.to);
   const attached=this.connections.some(v=>(v.a===edge.from&&v.b===edge.to)||(v.a===edge.to&&v.b===edge.from));
   // Bounded total matrix gains; explicit links are audible but never runaway.
   const materialMatrix=[1,.75,.90,1.05,.65][this.soundType(n[edge.from])];
   const coeff=(attached?.145:(target ? (.042+.06*(1-target.d/reach)) : 0))*materialMatrix;
   const amount=this.link?coeff*Math.pow(this.bond,1.15):0;
   edge.gain.gain.setTargetAtTime(amount,now,.045);
  }
 }
 newVoice(time){
  if(this.voices.length>=28)this.releaseVoice(this.voices[0],time);
  const bus=this.ctx.createGain();bus.gain.setValueAtTime(1,time);bus.connect(this.voiceBus);
  const voice={bus,oscillators:[],finished:false};this.voices.push(voice);return voice;
 }
 releaseVoice(v,time){
  if(!v||v.finished)return;v.finished=true;
  const now=Math.max(time,this.ctx.currentTime);
  v.bus.gain.cancelScheduledValues(now);v.bus.gain.setValueAtTime(Math.max(.0001,v.bus.gain.value),now);
  v.bus.gain.exponentialRampToValueAtTime(.0001,now+.055);
  for(const osc of v.oscillators){try{osc.stop(now+.065);}catch(_){}}
  const i=this.voices.indexOf(v);if(i>=0)this.voices.splice(i,1);
 }
 // The sound source is selected per object; wave accents can coexist with struck materials.
 soundType(note){return note?.waveAccent?4:this.materialType;}
 tone(note,velocity,sympathetic=false,delay=0,radial=0,repeat=0){
  if(!this.ctx||this.ctx.state!=='running'||velocity<.012)return;
  this.synths[this.soundType(note)].strike(note,velocity,{sympathetic,delay,radial,repeat});
 }
 strike(index,notes,velocity=1,radial=0){
  if(!this.ctx||this.ctx.state!=='running')return false;
  this.syncTanks(notes);const origin=notes[index];if(!origin)return false;
  const now=performance.now();
  origin.streak=now-(origin.last||0)<380?Math.min(5,(origin.streak||0)+1):0;
  this.tone(origin,velocity,false,0,radial,origin.streak);
  origin.last=now;origin.energy=Math.min(1,origin.energy+velocity*.92);
  const distances=notes.filter(n=>n.id!==index)
   .map(n=>({n,dist:Math.hypot(n.x-origin.x,n.y-origin.y)})).sort((a,b)=>a.dist-b.dist);
  const reach=Math.max(85,Math.min(origin.stageW,origin.stageH)*.61);
  let sent=0;
  for(const {n,dist} of distances){
   if(sent>=2||dist>reach)break;
   const v=velocity*(.09+.19*(1-dist/reach))*(.25+this.bond);
   if(v<.045)continue;
   this.tone(n,v,true,.014+sent*.009);n.energy=Math.min(1,n.energy+v*.55);sent++;
  }
  const outgoing=this.connections.filter(e=>e.a===index||e.b===index).slice(0,2);
  for(const [k,edge] of outgoing.entries()){
   const other=notes[edge.a===index?edge.b:edge.a];
   if(!other)continue;
   const v=velocity*(.075+.11*this.bond);
   this.tone(other,v,true,.025+k*.010);
   other.energy=Math.min(1,other.energy+.23*v);
  }
  return true;
 }
 // Collision = a short, gently excited resonator, not an electronic trigger.
 // The chosen material affects harmonic intervals and decay, while pitch stays
 // tied to the contacted body. Avoid waveform discontinuities and broadband noise.
 contact(source,target,speed,notes){
  if(!this.ctx||this.ctx.state!=='running'||!source||!target)return false;
  const strength=bounded((speed-.25)/.70,0,1);
  if(strength<=0)return false;
  const key=Math.min(source.id,target.id)+':'+Math.max(source.id,target.id);
  const now=performance.now();
  if(now-(this.lastContact.get(key)||-10000)<330)return false;
  this.lastContact.set(key,now);
  // Keep only bounded timestamps; no ever-growing contact history.
  if(this.lastContact.size>90)for(const [k,t] of this.lastContact)
   if(now-t>1800)this.lastContact.delete(k);
  const type=this.soundType(target);
  const profiles=[
   {ratios:[1,1.502,2.004],amps:[.069,.025,.011],tail:.53,attack:.014,mult:2.0}, // JEWEL glass
   {ratios:[1,2.005],amps:[.065,.015],tail:.28,attack:.013,mult:1.25},         // CANDY soft bead
   {ratios:[1,1.996],amps:[.062,.012],tail:.22,attack:.010,mult:1.5},         // CERAMIC
   {ratios:[1,1.48,2.18],amps:[.053,.018,.007],tail:.44,attack:.012,mult:2.0},// METAL
   {ratios:[1,2.002],amps:[.044,.010],tail:.65,attack:.026,mult:1.45}        // WAVE
  ];
  const p=profiles[type],hz=Math.min(1750,Math.max(260,soundHz(target.midi)*p.mult));
  const e=new MaterialEvent(this,target,0,false);
  const amplitude=.24+.48*strength; // A collision stays quieter than a normal strike.
  for(let i=0;i<p.ratios.length;i++){
   const freq=Math.min(5600,hz*p.ratios[i]);
   const decay=p.tail*(1-i*.16);
   const osc=e.osc('sine',freq,p.attack+decay+.045),gain=e.gain();
   e.envelope(gain,p.amps[i]*amplitude,p.attack+i*.003,decay);
   osc.connect(gain).connect(e.voice.bus);
  }
  // A small amount of collision energy enters the existing sympathetic field.
  if(this.link&&this.tanks[target.id]){
   const coupling=e.gain(.035);e.voice.bus.connect(coupling).connect(this.tanks[target.id].input);
   e.nodes.push(coupling);
  }
  target.energy=Math.min(1,target.energy+.13+.22*strength);
  target.impact=Math.max(target.impact||0,.24+.52*strength);
  source.impact=Math.max(source.impact||0,.16+.36*strength);
  return true;
 }
 // Pointer gesture: bounded, speed-sensitive rubbing / glissando.
 // Independent from the six original modal partials. It never starts on an idle touch.
 beginGesture(pointerId,note){
  if(!this.ctx||this.ctx.state!=='running'||this.gestures.has(pointerId)||this.gestures.size>=7)return false;
  const c=this.ctx,t=c.currentTime,hz=440*Math.pow(2,(note.midi-69)/12),type=this.soundType(note);
  const bus=c.createGain();bus.gain.setValueAtTime(.00001,t);bus.connect(this.voiceBus);
  const main=c.createOscillator(),upper=c.createOscillator(),upperGain=c.createGain();
  main.type=['sine','triangle','triangle','sine','sine'][type];
  upper.type=['sine','sine','sine','triangle','sine'][type];
  main.frequency.value=hz;upper.frequency.value=hz*[2.008,2.41,1.50,2.17,2.003][type];
  upperGain.gain.value=.22;
  main.connect(bus);upper.connect(upperGain).connect(bus);
  main.start(t);upper.start(t);
  this.gestures.set(pointerId,{bus,main,upper,upperGain,baseHz:hz,noteId:note.id,type});
  return true;
 }
 updateGesture(pointerId,note,{speed=0,radial=0,offset=0,proximity=0,move=false}={}){
  const g=this.gestures.get(pointerId);if(!g||!this.ctx)return;
  const c=this.ctx,t=c.currentTime,expr=this.expression;
  const vel=Math.min(1,Math.max(0,speed)),rim=Math.min(1,Math.max(0,radial));
  const hz=440*Math.pow(2,(note.midi-69)/12),bend=move?Math.min(4,Math.max(-4,offset*4)):Math.min(2,Math.max(-2,offset*2));
  const target=Math.min(4000,hz*Math.pow(2,bend*expr/12));
  g.main.frequency.setTargetAtTime(target,t,.035);
  g.upper.frequency.setTargetAtTime(target*([2.004,2.41,1.51,2.17,2.003][g.type]+.017*rim),t,.055);
  g.upperGain.gain.setTargetAtTime([.16,.11,.08,.23,.09][g.type]+rim*.18+vel*.18,t,.035);
  // Effects remain intentionally quiet next to normal struck notes.
  const materialDrag=[1,1.30,.72,1.10,.75][g.type];
  const amount=(move?.006:.014)*materialDrag*expr*Math.pow(vel,.72)*(move?(.54+.46*proximity):(.70+.30*rim));
  g.bus.gain.cancelScheduledValues(t);
  g.bus.gain.setTargetAtTime(Math.max(.00001,amount),t,.065);
  g.bus.gain.setTargetAtTime(.00001,t+.085,.14); // stop naturally if pointer pauses
 }
 endGesture(pointerId){
  const g=this.gestures.get(pointerId);if(!g||!this.ctx)return;
  this.gestures.delete(pointerId);const t=this.ctx.currentTime;
  g.bus.gain.cancelScheduledValues(t);g.bus.gain.setTargetAtTime(.00001,t,.035);
  let remaining=2;
  const cleanup=()=>{if(--remaining!==0)return;for(const n of [g.main,g.upper,g.upperGain,g.bus]){
    try{n.disconnect();}catch(_){} }};
  for(const node of [g.main,g.upper]){
   node.onended=cleanup;try{node.stop(t+.19);}catch(_){cleanup();}
  }
 }
 stopAllGestures(){for(const id of [...this.gestures.keys()])this.endGesture(id);}
 // A quiet bowed excitation while pressing a shape; release always fades cleanly.
 startHold(pointerId,note){
  if(!this.ctx||this.ctx.state!=='running'||this.holds.has(pointerId)||this.holds.size>=5)return;
  const c=this.ctx,t=c.currentTime,hz=440*Math.pow(2,(note.midi-69)/12);
  const bus=c.createGain();bus.gain.setValueAtTime(.00001,t);
  bus.gain.exponentialRampToValueAtTime(this.soundType(note)===4?.021:.014,t+(this.soundType(note)===4?.44:.22));
  bus.connect(this.voiceBus);
  const oscillators=[];
  const holdModes=[[[1,.7],[2.002,.3]],[[1,.85],[2.42,.15]],[[1,.88],[1.5,.12]],[[1,.66],[2.17,.34]],[[1,.55],[1.005,.26],[2.003,.19]]][this.soundType(note)];
  for(const [ratio,amplitude] of holdModes){
   const osc=c.createOscillator(),gain=c.createGain();osc.type='sine';osc.frequency.value=hz*ratio;gain.gain.value=amplitude;
   osc.connect(gain).connect(bus);osc.start(t);oscillators.push({osc,gain});
  }
  const tank=this.tanks[note.id];if(tank&&this.link)bus.connect(tank.input);
  this.holds.set(pointerId,{bus,oscillators});
 }
 stopHold(pointerId){
  const h=this.holds.get(pointerId);if(!h||!this.ctx)return;
  this.holds.delete(pointerId);const t=this.ctx.currentTime;
  h.bus.gain.cancelScheduledValues(t);h.bus.gain.setValueAtTime(Math.max(.00001,h.bus.gain.value),t);
  h.bus.gain.exponentialRampToValueAtTime(.00001,t+.13);
  let left=h.oscillators.length;
  for(const {osc,gain} of h.oscillators){osc.onended=()=>{osc.disconnect();gain.disconnect();if(!--left)h.bus.disconnect();};
   try{osc.stop(t+.14);}catch(_){}
  }
 }
 stopAllHolds(){for(const id of [...this.holds.keys()])this.stopHold(id);}
 suspend(){this.stopAllGestures();this.stopAllHolds();if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{});}
}


