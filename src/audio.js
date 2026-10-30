/* RESONANT OBJECTS v0.8 — expression-aware modal synthesis. No external dependencies.
 * 原音を維持しつつ、近接共鳴の「打撃時」と「音声信号経由」の2層を分離する。
 * Audio graph: per-voice modal synth -> dry bus -> compressor
 *                       \-> modal tanks <-> bounded damped coupling -> wet bus
 *                              \-> BLOOM diffused delay -> compressor
 */
class ResonantEngine {
 constructor(onStatus=()=>{}){
  this.onStatus=onStatus;this.ctx=null;this.voices=[];this.holds=new Map();this.gestures=new Map();this.noise=null;
  this.expression=.46;
  this.material=.36;this.decay=.67;this.bond=.75;this.space=0;this.bloom=0;this.level=.84;
  this.link=true;this.tanks=[];this.edges=[];this.tankKey='';this.wetGains=[];
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
  const n=Math.floor(c.sampleRate*.08);this.noise=c.createBuffer(1,n,c.sampleRate);
  const a=this.noise.getChannelData(0);for(let i=0;i<n;i++)a[i]=Math.random()*2-1;
  this.setSpace(this.space*100);this.setBloom(this.bloom*100);
 }
 unlock(){
  this.init();if(!this.ctx)return Promise.resolve(false);
  if(this.ctx.state==='running')return Promise.resolve(true);
  return this.ctx.resume().then(()=>this.ctx.state==='running').catch(()=>false);
 }
 setMaterial(v){this.material=v/100;}
 setExpression(v){this.expression=Math.min(1,Math.max(0,v/100));}
 setDecay(v){this.decay=v/100;}
 setBond(v){this.bond=v/100;this.refreshLinks();}
 setLink(v){this.link=!!v;this.refreshLinks();}
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
  const key=notes.map(n=>n.midi).join(',');
  if(key!==this.tankKey){
   this.clearTanks();const c=this.ctx;
   for(const n of notes){
    const input=c.createGain(),out=c.createGain(),ret=c.createGain();
    const nodes=[input,out,ret];input.gain.value=.8;ret.gain.value=0;
    const hz=440*Math.pow(2,(n.midi-69)/12);
    for(const [ratio,q,mix] of [[1,68,.32],[2.002,50,.22],[3.008,38,.13]]){
     const f=c.createBiquadFilter(),g=c.createGain();f.type='bandpass';f.frequency.value=Math.min(16000,hz*ratio);
     f.Q.value=q;g.gain.value=mix;input.connect(f).connect(g).connect(out);nodes.push(f,g);
    }
    out.connect(ret).connect(this.voiceBus);
    // A short recirculation produces an audible decaying resonator, not an unbounded loop.
    const loopDelay=c.createDelay(.15),loopGain=c.createGain(),damp=c.createBiquadFilter();
    loopDelay.delayTime.value=.038+n.id*.0013;loopGain.gain.value=.18;
    damp.type='lowpass';damp.frequency.value=1750;
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
   t.loopGain.gain.setTargetAtTime(this.link?.30:0,now,.055);
  }
  const reach=Math.max(95,Math.min(n[0].stageW,n[0].stageH)*.82);
  // Each source sends to only the three nearest objects, normalized to avoid a gain explosion.
  const matrix=n.map((src,i)=>n.map((dst,j)=>({j,d:Math.hypot(src.x-dst.x,src.y-dst.y)}))
   .filter(v=>v.j!==i&&v.d<reach).sort((a,b)=>a.d-b.d).slice(0,3));
  for(const edge of this.edges){
   const target=matrix[edge.from].find(v=>v.j===edge.to);
   const coeff=target ? (.065+.11*(1-target.d/reach)) : 0;
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
 // radial: 0 center, 1 rim. Keep the original v0.6 mode ratios and center tone.
 tone(note,velocity,sympathetic=false,delay=0,radial=0){
  if(!this.ctx||this.ctx.state!=='running'||velocity<.012)return;
  const c=this.ctx,time=c.currentTime+delay+.004;
  const voice=this.newVoice(time),m=this.material,d=this.decay;
  const hz=440*Math.pow(2,(note.midi-69)/12);
  const tail=(.65+2.45*d)*(note.big?1.13:1),bright=.40+.80*m;
  const vel=Math.min(1,Math.max(.02,velocity)),strength=vel*(sympathetic?.48:.82);
  const drift=(note.id*17%11-5)*.00023;
  const modes=[[1,.32,1.03],[2+drift,.37,.88],[3-drift,.17,.66],[1.006,.10,1.30],
   [4.06+.18*m,.048*bright,.28],[5.31+.39*m,.026*bright,.17]];
  const peak=strength*.34;
  const edge=sympathetic?0:Math.min(1,Math.max(0,radial))*this.expression;
  let remaining=sympathetic?4:6;
  const cleanup=()=>{
   if(--remaining>0)return;voice.finished=true;
   try{voice.bus.disconnect();}catch(_){}
   const idx=this.voices.indexOf(voice);if(idx>=0)this.voices.splice(idx,1);
  };
  const tank=this.tanks[note.id];
  if(tank&&this.link)voice.bus.connect(tank.input);
  for(const [idx,[ratio,amp,dur]] of (sympathetic?modes.slice(0,4):modes).entries()){
   const osc=c.createOscillator(),g=c.createGain();
   const seconds=Math.max(.09,tail*dur*(sympathetic?.84:1));
   const rise=sympathetic?.046:(idx>=4?.0025:.0065+.002*m);
   // Rim blows excite higher modes, while the center favors the fundamental.
   // Keep gain bounded; do not turn the instrument into a harsher bell by default.
   const positionGain=idx===0?(1-.17*edge):idx===1?(1+.18*edge):idx>=4?(1+.95*edge):(1+.50*edge);
   const target=Math.max(.0001,peak*amp*positionGain*(idx>=4?(.45+vel*.55):1));
   osc.type='sine';osc.frequency.setValueAtTime(hz*ratio,time);
   g.gain.setValueAtTime(.00001,time);g.gain.linearRampToValueAtTime(target,time+rise);
   g.gain.exponentialRampToValueAtTime(.000012,time+rise+seconds);
   osc.connect(g).connect(voice.bus);
   osc.onended=()=>{try{osc.disconnect();g.disconnect();}catch(_){}cleanup();};
   osc.start(time);osc.stop(time+rise+seconds+.012);voice.oscillators.push(osc);
  }
  if(!sympathetic){
   const src=c.createBufferSource();src.buffer=this.noise;
   const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=900+m*1600+edge*1200;
   const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2600+m*3700+edge*1200;
   const g=c.createGain();
   g.gain.setValueAtTime(.00001,time);g.gain.linearRampToValueAtTime(.036*vel*(.55+m*.8),time+.0015);
   g.gain.exponentialRampToValueAtTime(.00001,time+.016);
   src.connect(hp).connect(lp).connect(g).connect(voice.bus);
   src.onended=()=>{try{src.disconnect();hp.disconnect();lp.disconnect();g.disconnect();}catch(_){}};
   src.start(time);src.stop(time+.02);
  }
 }
 strike(index,notes,velocity=1,radial=0){
  if(!this.ctx||this.ctx.state!=='running')return false;
  this.syncTanks(notes);const origin=notes[index];if(!origin)return false;
  this.tone(origin,velocity,false,0,radial);
  origin.last=performance.now();origin.energy=Math.min(1,origin.energy+velocity*.92);
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
  return true;
 }
 // Gentle physical contact; no automatic chains and no timed sequence.
 contact(source,target,speed,notes){
  if(!this.ctx||this.ctx.state!=='running')return;
  const v=Math.max(.08,Math.min(.42,speed*.34));
  this.tone(target,v,false,0,.78);
  this.tone(source,v*.24,true,.011,0);
  target.energy=Math.min(1,target.energy+v*.72);
 }
 // A short release ping gives moving a shape a tangible end, without changing pitch mapping.
 releasePluck(note,speed){
  if(!this.ctx||this.ctx.state!=='running')return;
  this.tone(note,Math.min(.25,speed*.20),true,0,0);
 }
 // Pointer gesture: bounded, speed-sensitive rubbing / glissando.
 // Independent from the six original modal partials. It never starts on an idle touch.
 beginGesture(pointerId,note){
  if(!this.ctx||this.ctx.state!=='running'||this.gestures.has(pointerId)||this.gestures.size>=7)return false;
  const c=this.ctx,t=c.currentTime,hz=440*Math.pow(2,(note.midi-69)/12);
  const bus=c.createGain();bus.gain.setValueAtTime(.00001,t);bus.connect(this.voiceBus);
  const main=c.createOscillator(),upper=c.createOscillator(),upperGain=c.createGain();
  main.type='sine';upper.type='sine';main.frequency.value=hz;upper.frequency.value=hz*2.008;
  upperGain.gain.value=.22;
  main.connect(bus);upper.connect(upperGain).connect(bus);
  // A little filtered noise creates tactile grain, not broadband hiss.
  const grain=c.createBufferSource(),filter=c.createBiquadFilter(),grainGain=c.createGain();
  grain.buffer=this.noise;grain.loop=true;filter.type='bandpass';filter.frequency.value=Math.min(4500,1100+hz*1.5);filter.Q.value=1.5;
  grainGain.gain.value=.12;grain.connect(filter).connect(grainGain).connect(bus);
  main.start(t);upper.start(t);grain.start(t);
  this.gestures.set(pointerId,{bus,main,upper,upperGain,grain,filter,grainGain,baseHz:hz, noteId:note.id});
  return true;
 }
 updateGesture(pointerId,note,{speed=0,radial=0,offset=0,proximity=0,move=false}={}){
  const g=this.gestures.get(pointerId);if(!g||!this.ctx)return;
  const c=this.ctx,t=c.currentTime,expr=this.expression;
  const vel=Math.min(1,Math.max(0,speed)),rim=Math.min(1,Math.max(0,radial));
  const hz=440*Math.pow(2,(note.midi-69)/12),bend=move?Math.min(4,Math.max(-4,offset*4)):Math.min(2,Math.max(-2,offset*2));
  const target=Math.min(4000,hz*Math.pow(2,bend*expr/12));
  g.main.frequency.setTargetAtTime(target,t,.035);
  g.upper.frequency.setTargetAtTime(target*(2.004+.017*rim),t,.055);
  g.filter.frequency.setTargetAtTime(Math.min(5600,Math.max(450,800+target*1.6+vel*1400)),t,.05);
  g.upperGain.gain.setTargetAtTime(.16+rim*.18+vel*.18,t,.035);
  // Effects remain intentionally quiet next to normal struck notes.
  const amount=(move?.014:.019)*expr*Math.pow(vel,.72)*(move?(.54+.46*proximity):(.70+.30*rim));
  g.bus.gain.cancelScheduledValues(t);
  g.bus.gain.setTargetAtTime(Math.max(.00001,amount),t,.023);
  g.bus.gain.setTargetAtTime(.00001,t+.065,.095); // stop naturally if pointer pauses
 }
 endGesture(pointerId){
  const g=this.gestures.get(pointerId);if(!g||!this.ctx)return;
  this.gestures.delete(pointerId);const t=this.ctx.currentTime;
  g.bus.gain.cancelScheduledValues(t);g.bus.gain.setTargetAtTime(.00001,t,.035);
  let remaining=3;
  const cleanup=()=>{if(--remaining!==0)return;for(const n of [g.main,g.upper,g.grain,g.filter,g.grainGain,g.upperGain,g.bus]){
    try{n.disconnect();}catch(_){} }};
  for(const node of [g.main,g.upper,g.grain]){
   node.onended=cleanup;try{node.stop(t+.19);}catch(_){cleanup();}
  }
 }
 stopAllGestures(){for(const id of [...this.gestures.keys()])this.endGesture(id);}
 // A quiet bowed excitation while pressing a shape; release always fades cleanly.
 startHold(pointerId,note){
  if(!this.ctx||this.ctx.state!=='running'||this.holds.has(pointerId)||this.holds.size>=5)return;
  const c=this.ctx,t=c.currentTime,hz=440*Math.pow(2,(note.midi-69)/12);
  const bus=c.createGain();bus.gain.setValueAtTime(.00001,t);
  bus.gain.exponentialRampToValueAtTime(.014,t+.22);
  bus.connect(this.voiceBus);
  const oscillators=[];
  for(const [ratio,amplitude] of [[1,.7],[2.002,.3]]){
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
