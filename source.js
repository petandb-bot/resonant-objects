/* RESONANT OBJECTS v0.15.0 — FIVE INDEPENDENT SOUND ENGINES
 * 共通のWeb Audio出力バスは使うが、発音原理とノード・グラフは素材ごとに独立。
 * JEWEL: modal partial synthesis / CANDY: dynamic FM
 * CERAMIC: excited short waveguide / METAL: inharmonic cross-frequency FM
 * Noise generators are NOT used. Every source has a scheduled stop and cleanup.
 */
const soundHz = midi => 440*Math.pow(2,(midi-69)/12);
const bounded = (v,min,max) => Math.min(max,Math.max(min,v));

class MaterialEvent {
 constructor(host,note,delay=0,sendToTank=true){
  this.host=host;this.ctx=host.ctx;this.t=this.ctx.currentTime+.004+delay;
  this.voice=host.newVoice(this.t);this.nodes=[];this.live=0;
  if(sendToTank && host.link && host.tanks[note.id])this.voice.bus.connect(host.tanks[note.id].input);
 }
 node(n){this.nodes.push(n);return n;}
 gain(value=1){const g=this.node(this.ctx.createGain());g.gain.value=value;return g;}
 osc(type,freq,duration){
  const o=this.node(this.ctx.createOscillator());o.type=type;o.frequency.setValueAtTime(Math.max(1,freq),this.t);
  this.voice.oscillators.push(o);this.live++;
  o.onended=()=>{
   if(--this.live!==0)return;
   for(const n of this.nodes){try{n.disconnect();}catch(_){}}
   try{this.voice.bus.disconnect();}catch(_){}
   this.voice.finished=true;
   const i=this.host.voices.indexOf(this.voice);if(i>=0)this.host.voices.splice(i,1);
  };
  o.start(this.t);o.stop(this.t+Math.max(.03,duration));return o;
 }
 envelope(g,peak,attack,decay){
  const p=g.gain,t=this.t;
  p.setValueAtTime(.000001,t);
  p.linearRampToValueAtTime(Math.max(.000002,peak),t+attack);
  p.exponentialRampToValueAtTime(.000001,t+attack+decay);
 }
}
class JewelModalEngine {
 constructor(host){this.host=host;this.name='JEWEL / modal partials';}
 strike(note,velocity,{sympathetic=false,delay=0,radial=0,repeat=0,impact=false}={}){
  const h=this.host,hz=soundHz(note.midi),e=new MaterialEvent(h,note,delay,!impact),v=bounded(velocity,0,1);
  const material=h.material,edge=sympathetic?0:radial*h.expression;
  const ratios=impact?[3.8,5.11,7.20]:[1,2,3,1.006,4.06+.18*material,5.31+.39*material];
  const amps=impact?[.61,.27,.12]:[.32,.37,.17,.10,.048,.026];
  const durations=impact?[.27,.18,.12]:[1.03,.88,.66,1.3,.28,.17];
  const tail=impact?.29:(.65+2.45*h.decay)*(note.big?1.13:1);
  for(let i=0;i<ratios.length;i++){
   const dur=Math.max(.07,tail*durations[i]*(sympathetic?.82:1));
   const attack=impact?.0025:(i>3?.003:.0065+.002*material);
   const osc=e.osc('sine',Math.min(12000,hz*ratios[i]),attack+dur+.018),amp=e.gain();
   const brightness=i===0?1-.16*edge:i>3?1+.9*edge:1+.35*edge;
   let volume=v*(sympathetic?.46:.83)*.34*amps[i]*brightness*(impact?.38:1);
   if(!impact&&i>3)volume*=.45+v*.55;
   if(!impact&&repeat>1&&i>2)volume*=1+Math.min(.22,repeat*.05);
   e.envelope(amp,volume,attack,dur);osc.connect(amp).connect(e.voice.bus);
  }
 }
}
class CandyElasticFMEngine {
 constructor(host){this.host=host;this.name='CANDY / elastic FM';}
 strike(note,velocity,{sympathetic=false,delay=0,radial=0,repeat=0,impact=false}={}){
  const h=this.host,hz=soundHz(note.midi)*(impact?1.75:1),v=bounded(velocity,0,1),e=new MaterialEvent(h,note,delay,!impact);
  // A compact, buoyant FM voice: bright but rounded and intentionally short.
  // Smooth envelopes remove click-like transients; small pitch recovery conveys elasticity.
  const edge=radial*h.expression;
  const tail=(impact?.22:.23+.48*h.decay)*(sympathetic?.76:1);
  const carrier=e.osc('sine',hz,tail+.11),out=e.gain();
  const mod=e.osc('sine',hz*1.5,tail+.11),depth=e.gain();
  const fmIndex=(impact?.06:.34+.12*edge)*(1+.055*Math.min(repeat,4));
  depth.gain.setValueAtTime(hz*fmIndex,e.t);
  depth.gain.exponentialRampToValueAtTime(hz*.0008,e.t+Math.min(.19,tail*.55));
  mod.connect(depth).connect(carrier.frequency);
  const bend=impact?1.018:(1+.030*v+.005*Math.min(repeat,4));
  carrier.frequency.setValueAtTime(hz*bend,e.t);
  carrier.frequency.exponentialRampToValueAtTime(hz,e.t+Math.min(.17,tail*.65));
  e.envelope(out,(impact?.038:.265)*v*(sympathetic?.43:1)*(1-.12*edge),.014,tail);
  carrier.connect(out).connect(e.voice.bus);
  if(!impact){const sub=e.osc('sine',hz*.50,tail*.83+.09),subGain=e.gain();
   e.envelope(subGain,.062*v*(sympathetic?.35:1),.018,tail*.80);
   sub.connect(subGain).connect(e.voice.bus);}
 }
}
class CeramicWaveguideEngine {
 constructor(host){this.host=host;this.name='CERAMIC / excited delay line';}
 strike(note,velocity,{sympathetic=false,delay=0,radial=0,repeat=0,impact=false}={}){
  const h=this.host,e=new MaterialEvent(h,note,delay,!impact),v=bounded(velocity,0,1),hz=soundHz(note.midi)*(impact?2.05:1);
  const tail=(impact?.24:.82+1.34*h.decay)*(sympathetic?.68:1)*(1-.028*Math.min(repeat,4));
  // A short pitched pulse excites a closed damped delay-line resonator.
  // It is purposefully NOT a noise burst, to avoid the former snare-like attack.
  const excitation=e.osc('sine',Math.min(3500,hz*(1.12+.14*radial)),.085),exGain=e.gain();
  e.envelope(exGain,impact?.042*v:.145*v,.013,.063);
  const exciteBus=e.gain(1);excitation.connect(exGain).connect(exciteBus);
  for(let i=0;i<(impact?1:2);i++){
   const ratio=i?1.47:1;
   const delayNode=e.node(h.ctx.createDelay(.12));delayNode.delayTime.value=Math.max(.001,1/(hz*ratio));
   const toneFilter=e.node(h.ctx.createBiquadFilter());toneFilter.type='lowpass';toneFilter.frequency.value=impact?1650:1250+radial*400;toneFilter.Q.value=.3;
   const feedback=e.gain(impact?.48:.70+.025*h.decay);
   const voiceFilter=e.node(h.ctx.createBiquadFilter());voiceFilter.type='bandpass';voiceFilter.frequency.value=hz*(i?1.47:1.0);voiceFilter.Q.value=i?1.8:2.5;
   const level=e.gain();e.envelope(level,(impact?.036:.46)*v*(i?.18:1)*(sympathetic?.48:1),.012,tail);
   exciteBus.connect(delayNode);
   delayNode.connect(toneFilter).connect(feedback).connect(delayNode);
   toneFilter.connect(voiceFilter).connect(level).connect(e.voice.bus);
  }
  // Delay lines are disconnected when the scheduled excitation oscillator ends;
  // give them a separate silent clock oscillator for the tail lifetime.
  const clock=e.osc('sine',1,tail+.20),silent=e.gain(0);clock.connect(silent).connect(e.voice.bus);
  // A shallow, pitched mallet-body transient remains separate from the delay-line sound.
  const body=e.osc('sine',hz*(impact?1.07:1.001),Math.min(tail*.8,.85)+.07),bodyGain=e.gain();
  e.envelope(bodyGain,(impact?.031:.23)*v*(sympathetic?.56:1),.014,Math.min(tail*.8,.85));body.connect(bodyGain).connect(e.voice.bus);
 }
}
class MetalInharmonicFMEngine {
 constructor(host){this.host=host;this.name='METAL / inharmonic FM';}
 strike(note,velocity,{sympathetic=false,delay=0,radial=0,repeat=0,impact=false}={}){
  const h=this.host,e=new MaterialEvent(h,note,delay,!impact),v=bounded(velocity,0,1),hz=soundHz(note.midi);
  const ratios=impact?[4.2,6.73]:[1,2.17,3.79];
  const strength=impact?.35:1;
  const tail=(impact?.18:.45+2.40*h.decay)*(sympathetic?.72:1);
  ratios.forEach((ratio,i)=>{
   const dur=tail*[1,.68,.34][i],freq=Math.min(10000,hz*ratio);
   const carrier=e.osc('sine',freq,dur+.06),fm=e.osc('sine',Math.min(14000,freq*[1.419,1.733,2.067][i]),dur+.06);
   const index=e.gain();index.gain.setValueAtTime(freq*(impact?.12:.42)*(1+.18*radial+.06*Math.min(repeat,4)),e.t);
   index.gain.exponentialRampToValueAtTime(freq*.0005,e.t+Math.min(dur*.87,.33));
   fm.connect(index).connect(carrier.frequency);
   const amp=e.gain();e.envelope(amp,v*(sympathetic?.38:1)*strength*[.15,.080,.038][i]*(impact?.5:1),.003+(.003*i),dur);
   carrier.connect(amp).connect(e.voice.bus);
  });
 }
}

// WAVE: a dedicated slowly breathing oscillator bank, not a re-skinned strike.
// It deliberately has a gentle, immediately audible fundamental and evolving upper voices.
// All oscillators have finite lifetimes. No noise excitation and no recursive DSP feedback.
class WaveBreathingEngine {
 constructor(host){this.host=host;this.name='WAVE / slow beating harmonic field';}
 strike(note,velocity,{sympathetic=false,delay=0,radial=0,repeat=0,impact=false}={}){
  const h=this.host,ctx=h.ctx,hz=soundHz(note.midi),v=bounded(velocity,0,1);
  const e=new MaterialEvent(h,note,delay,!impact);
  if(impact){
   // A collision remains brief and quiet: a harmonic ping rather than a snare.
   for(const [ratio,amp,dur] of [[2.012,.025,.17],[3.006,.014,.12]]){
    const o=e.osc('sine',Math.min(9000,hz*ratio),dur+.028),g=e.gain();
    e.envelope(g,amp*v,.004,dur);o.connect(g).connect(e.voice.bus);
   }
   return;
  }
  const tail=(2.4+3.9*h.decay)*(sympathetic?.58:1);
  const level=(sympathetic?.35:1)*(note.waveLayer?.74:1)*v;
  // Fine detuning creates a natural rolling wave, perceptible on phone speakers.
  const components=[
   [1, .128, .035, 1.00],
   [1.0051,.061, .25, .91],
   [2.003,.047, .40, .63],
   [3.002,.017, .58, .49]
  ];
  const lfo=e.osc('sine',.23+(note.id%4)*.045,tail+.2);
  const vibrato=e.gain(hz*.0015*(.65+.35*h.expression));
  const breathing=e.gain(.095); // ±9.5% slow amplitude movement, never self-oscillating feedback
  lfo.connect(vibrato);lfo.connect(breathing).connect(e.voice.bus.gain);
  components.forEach(([ratio,amp,attack,factor],i)=>{
   const duration=tail*factor,osc=e.osc('sine',Math.min(11500,hz*ratio),duration+attack+.04),gain=e.gain();
   if(i<2)vibrato.connect(osc.frequency);
   const brightness=i>=2?(.80+.38*radial*h.expression):1;
   // Plateau + gentle multi-second release. The shared percussive exponential
   // envelope would decay to near silence after just one second.
   const peak=amp*level*brightness,p=gain.gain,t=e.t;
   p.setValueAtTime(.000001,t);
   p.linearRampToValueAtTime(peak,t+attack);
   p.linearRampToValueAtTime(peak*.87,t+attack+Math.min(.48,duration*.22));
   p.linearRampToValueAtTime(peak*.36,t+attack+duration*.70);
   p.exponentialRampToValueAtTime(.000001,t+attack+duration);
   osc.connect(gain).connect(e.voice.bus);
  });
 }
}
/* RESONANT OBJECTS v0.15.0 — five independent acoustic engines. No external dependencies.
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
  this.reverbType='nest';this.reverbSlots=[];this.reverbCurrent=0;this.reverbBuffers=new Map();
  this.link=true;this.connections=[];this.tanks=[];this.edges=[];this.tankKey='';this.wetGains=[];
  this.lastContact=new Map();this.waveLayerTime=new Map();this.threadWaveTime=new Map();
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
  // Two convolution paths permit a click-free change of acoustic character.
  // Precomputed synthetic stereo impulse responses avoid network/sample dependencies.
  this.initReverb();
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
  this.stopAllGestures();this.stopAllHolds();this.materialType=selected;this.waveLayerTime?.clear();this.threadWaveTime?.clear();
  // Changing body construction changes its sympathetic resonator as well.
  this.tankKey='';this.clearTanks();
 }
 setExpression(v){this.expression=Math.min(1,Math.max(0,v/100));}
 setDecay(v){this.decay=v/100;}
 setBond(v){this.bond=v/100;this.refreshLinks();}
 setLink(v){this.link=!!v;this.refreshLinks();}
 setConnections(connections){this.connections=connections.map(e=>({a:e.a,b:e.b}));this.refreshLinks();}
 /* Four genuinely different acoustic spaces: no pitch shift, no surprise percussion.
  * An early-reflection cluster and filtered diffuse late field are generated once
  * per AudioContext. The impulse is high-pass corrected and energy-normalized.
  * Reverb is a parallel wet-only path: dry instruments and existing Bloom persist.
  */
 reverbProfile(name){
  return ({
   nest:    {duration:.65, pre:.009, lp:3900, hp:220, color:.39, early:.68, tail:.42, attack:.005, level:.86},
   velvet:  {duration:1.40,pre:.022, lp:2300, hp:175, color:.79, early:.34, tail:.83, attack:.020, level:1.0},
   prism:   {duration:1.78,pre:.028, lp:6200, hp:290, color:.27, early:.54, tail:.67, attack:.014, level:.93},
   horizon: {duration:2.75,pre:.051, lp:3650, hp:180, color:.60, early:.20, tail:1.0, attack:.034, level:1.02}
  })[name]||null;
 }
 makeReverbImpulse(name){
  if(this.reverbBuffers.has(name))return this.reverbBuffers.get(name);
  const c=this.ctx,p=this.reverbProfile(name);
  if(!c||!p)return null;
  const rate=c.sampleRate,len=Math.ceil(rate*(p.duration+.060));
  const buffer=c.createBuffer(2,len,rate);
  let totalEnergy=0;
  for(let ch=0;ch<2;ch++){
   const out=buffer.getChannelData(ch);
   let seed=(0xCAFE173 ^ (['nest','velvet','prism','horizon'].indexOf(name)*14489) ^ (ch*2654435761))>>>0;
   const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
   let prev=0,dc=0;
   const noiseStart=.010+(ch*.004),f=rate;
   for(let i=0;i<len;i++){
    const t=i/f;
    const envelope=Math.exp(-5.4*t/p.duration);
    const rise=Math.min(1,Math.pow(t/Math.max(.004,p.attack),1.5));
    const white=rand()*2-1;
    prev += (white-prev)*(1-p.color*.87);
    dc += (prev-dc)*.003;
    // Smooth, signed noise field prevents periodic metallic ringing.
    const diffuse=(prev-dc)*rise*envelope*p.tail;
    // Small, broad early reflections with a muted attack.
    const earlyTimes=[.019,.033,.052,.081,.113,.158];
    let early=0;
    for(let j=0;j<earlyTimes.length;j++){
     const dt=t-(earlyTimes[j]+(ch?-.003:.003)*(j%2?1:-1));
     const width=.0027+.0011*(j%3);
     if(Math.abs(dt)<width){
      const z=dt/width;
      early+=Math.cos(z*Math.PI/2)*Math.cos(z*Math.PI/2)*
       ([.26,-.20,.17,-.12,.09,-.065][j])*p.early;
     }
    }
    out[i]=(diffuse+early);
    totalEnergy+=out[i]*out[i];
   }
  }
  // Normalize all types to similar energy, not their sample peak.
  const gain=1.45/Math.sqrt(Math.max(.001,totalEnergy/2));
  for(let ch=0;ch<2;ch++){
   const samples=buffer.getChannelData(ch);
   for(let i=0;i<samples.length;i++)samples[i]*=gain;
  }
  this.reverbBuffers.set(name,buffer);return buffer;
 }
 initReverb(){
  const c=this.ctx;
  this.reverbSlots=[];
  for(let i=0;i<2;i++){
   const send=c.createGain(),pre=c.createDelay(.15),high=c.createBiquadFilter(),
    convolution=c.createConvolver(),low=c.createBiquadFilter(),wet=c.createGain();
   high.type='highpass';low.type='lowpass';
   send.gain.value=i===0?1:0;wet.gain.value=0;convolution.normalize=false;
   this.effectInsert.connect(send).connect(pre).connect(high).connect(convolution).connect(low).connect(wet).connect(this.compressor);
   this.reverbSlots.push({send,pre,high,convolution,low,wet,type:null});
  }
  this.configureReverbSlot(0,this.reverbType);
  this.reverbCurrent=0;
 }
 configureReverbSlot(i,type){
  const slot=this.reverbSlots[i],p=this.reverbProfile(type);
  if(!slot||!p)return;
  // Set buffers only while the inactive slot is muted.
  slot.convolution.buffer=this.makeReverbImpulse(type);
  slot.pre.delayTime.value=p.pre;
  slot.high.frequency.value=p.hp;
  slot.low.frequency.value=p.lp;
  slot.type=type;
 }
 setReverbType(type){
  if(!this.reverbProfile(type)||type===this.reverbType)return;
  this.reverbType=type;
  if(!this.ctx||!this.reverbSlots.length)return;
  const c=this.ctx,now=c.currentTime;
  const next=1-this.reverbCurrent,old=this.reverbSlots[this.reverbCurrent],slot=this.reverbSlots[next];
  // Protect against quick repeat selection: mute slot before replacing its IR.
  slot.wet.gain.cancelScheduledValues(now);
  slot.wet.gain.setValueAtTime(0,now);
  slot.send.gain.cancelScheduledValues(now);
  slot.send.gain.setValueAtTime(0,now);
  this.configureReverbSlot(next,type);
  slot.send.gain.setTargetAtTime(1,now,.016);
  this.reverbCurrent=next;
  this.updateReverbMix(.15);
  old.send.gain.cancelScheduledValues(now);old.send.gain.setTargetAtTime(0,now,.05);
 }
 updateReverbMix(fade=.045){
  if(!this.ctx||!this.reverbSlots.length)return;
  const now=this.ctx.currentTime,wet=.43*Math.pow(this.space,1.38);
  this.reverbSlots.forEach((s,i)=>{
   const p=this.reverbProfile(s.type);
   s.wet.gain.setTargetAtTime(i===this.reverbCurrent?wet*(p?p.level:1):0,now,fade);
  });
 }
 setBloom(v){this.bloom=v/100;if(this.ctx&&this.bloomWet)
  this.bloomWet.gain.setTargetAtTime(.22*Math.pow(this.bloom,1.45),this.ctx.currentTime,.045);}
 setSpace(v){this.space=Math.max(0,Math.min(1,v/100));if(!this.ctx)return;
  // Keep a small part of the previous early-reflection character.
  for(const {gain,amount} of this.wetGains)
   gain.gain.setTargetAtTime(Math.pow(this.space,1.35)*amount*.24,this.ctx.currentTime,.035);
  this.updateReverbMix();
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
 soundType(note){return this.materialType;}
 // WAVE is an additive resonant veil: no primary voice is replaced.
 // Kept quiet and rate-limited so repeated notes never become a drone pile-up.
 waveVeil(note,velocity,{sympathetic=false,delay=0,radial=0}={}){
  if(!note?.waveLayer || this.materialType===4 || velocity<.055)return;
  const now=performance.now(),last=this.waveLayerTime?.get(note.id)||-10000;
  if(now-last<(sympathetic?480:180))return;
  if(!this.waveLayerTime)this.waveLayerTime=new Map();
  this.waveLayerTime.set(note.id,now);
  this.synths[4].strike(note,velocity*(sympathetic?.38:.64),{sympathetic,delay:delay+.022,radial});
 }
 tone(note,velocity,sympathetic=false,delay=0,radial=0,repeat=0){
  if(!this.ctx||this.ctx.state!=='running'||velocity<.012)return;
  this.synths[this.soundType(note)].strike(note,velocity,{sympathetic,delay,radial,repeat});
  this.waveVeil(note,velocity,{sympathetic,delay,radial});
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
   // Connected WAVE layers bloom into a quiet harmonic field. No new transient.
   // A source that carries a veil can also excite a linked neighbour gently.
   if(origin.waveLayer && !other.waveLayer && this.materialType!==4){
    const now=performance.now();
    if(!this.threadWaveTime)this.threadWaveTime=new Map();
    const key=index+':'+other.id;
    if(now-(this.threadWaveTime.get(key)||-10000)>850){
     this.threadWaveTime.set(key,now);
     this.synths[4].strike(other,velocity*.13,{sympathetic:true,delay:.07+k*.018});
    }
   }
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


/* RESONANT OBJECTS v0.15.0 — GPU field renderer
 * WebGL2 > WebGL1. Audio remains Web Audio (WebGL is graphics only).
 * Pass 1: native-resolution color field, geometry and GPU connection ribbons.
 * Pass 2: half-resolution double-buffered temporal resonance (GPU ping-pong).
 * Pass 3: composite with optical glow and resonance diffusion.
 * The 2D path is only a compatibility fallback, not the normal renderer.
 */
const FIELD_GLSL = {
 quadVS:`attribute vec2 aCorner; varying vec2 vUV;
 void main(){vUV=aCorner*.5+.5;gl_Position=vec4(aCorner,0.,1.);}`,
 objectVS:`attribute vec2 aCorner;varying vec2 vP;
 uniform vec2 uCenter,uScreen;uniform float uRadius,uAngle;
 void main(){vec2 p=aCorner*1.65;vP=p;
 float c=cos(uAngle),s=sin(uAngle);vec2 q=vec2(p.x*c-p.y*s,p.x*s+p.y*c);
 vec2 xy=uCenter+q*uRadius;vec2 uv=xy/uScreen;
 gl_Position=vec4(uv.x*2.-1.,1.-uv.y*2.,0.,1.);}`,
 bgFS:`precision mediump float;varying vec2 vUV;uniform float uTime,uWorld;
 void main(){
  vec2 p=vUV;
  float vignette=1.-.22*length(p-vec2(.5));
  vec3 base=vec3(.023,.026,.038)*vignette;
  float haze=exp(-pow(length((p-vec2(.51,.48))*vec2(1.,1.4))/.65,2.));
  vec3 ink=vec3(.022,.030,.048)*(haze*.12);
  gl_FragColor=vec4(base+ink,1.);
 }`,
 objectFS:`precision highp float;varying vec2 vP;
 uniform float uKind,uSeed,uEnergy,uGesture,uImpact,uRepeat,uTime,uMove,uAura,uWorld,uWaveLayer,uVisualScale;
 uniform vec3 uColor;
 const float PI=3.141592653589793;
 float sdPoly(vec2 p,float n,float radius){float a=atan(p.y,p.x)+PI/2.;float stepA=2.*PI/n;
  return length(p)*cos(mod(a+stepA*.5,stepA)-stepA*.5)-radius*cos(PI/n);}
 float sdBox(vec2 p,vec2 b,float rad){vec2 q=abs(p)-b+rad;return length(max(q,0.))+min(max(q.x,q.y),0.)-rad;}
 float sdCapsule(vec2 p,vec2 a,vec2 b,float radius){vec2 pa=p-a,ba=b-a;
  return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.))-radius;}
 float band(float d,float w){return 1.-smoothstep(w*.35,w*1.4,abs(d));}
 float ring(float r,float radius,float w){return band(r-radius,w);}
 void main(){
  vec2 pos=vP/max(.65,uVisualScale);
  float t=uTime,impact=uImpact,energy=clamp(uEnergy+uGesture*.25+impact*.70,0.,1.);
  float k=mod(floor(uKind+.5),11.);
  float a=atan(pos.y,pos.x),r=length(pos);
  // Small, material-specific movement without changing the silhouette language.
  if(uWorld>0.5&&uWorld<1.5){pos*=1.-impact*.053;r=length(pos);}
  if(uWorld>2.5&&uWorld<3.5)pos.x+=impact*.009*sin(pos.y*24.+t*26.);
  float d=r-.75,detail=0.,cut=0.,solid=.0;
  if(k<.5){ // 0 — double disc, anchor / soft white
   d=r-.735;detail=ring(r,.40,.022)*.80;cut=ring(r,.13,.026)*.92;solid=.15;
  }else if(k<1.5){ // 1 — sharp triangular stone
   d=sdPoly(pos,3.,.84);detail=band(sdPoly(pos,3.,.46),.023)*.88;solid=.06;
  }else if(k<2.5){ // 2 — round-corner square with diagonal incision
   d=sdBox(pos,vec2(.64,.62),.22);
   detail=band(pos.x*.67+pos.y*.72,.025)*(1.-smoothstep(.25,.85,r))*.77;
   solid=.47;
  }else if(k<3.5){ // 3 — slender upright pill
   d=sdCapsule(pos,vec2(0.,-.40),vec2(0.,.40),.31);
   detail=band(pos.y,.020)*(1.-smoothstep(.12,.58,r))*.75;solid=.38;
  }else if(k<4.5){ // 4 — open diamond / rhombus
   d=sdPoly(pos,4.,.78);detail=band(abs(pos.x)-.15,.016)*(1.-smoothstep(.34,.68,r))*.60;solid=.08;
  }else if(k<5.5){ // 5 — rounded cross
   d=min(sdBox(pos,vec2(.27,.74),.12),sdBox(pos,vec2(.74,.27),.12));
   cut=ring(r,.18,.025)*.85;solid=.32;
  }else if(k<6.5){ // 6 — pentagon with offset point
   d=sdPoly(pos,5.,.80);detail=band(pos.y+.15,.020)*smoothstep(.15,.32,abs(pos.x))*.63;solid=.18;
  }else if(k<7.5){ // 7 — wide horizontal capsule
   d=sdCapsule(pos,vec2(-.37,0.),vec2(.37,0.),.33);
   detail=ring(r,.27,.018)*.85;solid=.45;
  }else if(k<8.5){ // 8 — octagon with slashed interior
   d=sdPoly(pos,8.,.78);
   detail=band(pos.y-pos.x*.65,.025)*.71*(1.-smoothstep(.4,.75,r));solid=.08;
  }else if(k<9.5){ // 9 — segmented hollow circle
   d=r-.75;
   float arc=abs(sin(a*2.4+.7));
   detail=ring(r,.49,.022)*(.24+.76*step(.27,arc));
   cut=ring(r,.19,.022)*.72;solid=.08;
  }else{ // 10 — kite with a central notch
   vec2 p=pos;p.y*=1.13;
   d=sdPoly(p,4.,.76);
   detail=band(p.x-p.y*.32,.022)*(1.-smoothstep(.32,.67,r))*.62;solid=.35;
  }
  // Material remains audible first; visually it's expressed through the response envelope.
  float strokeWidth=(uWorld<.5?.027:uWorld<1.5?.036:uWorld<2.5?.041:uWorld<3.5?.024:.026);
  float boundary=band(d,strokeWidth);
  float inside=1.-smoothstep(-.006,.025,d);
  float inner=inside*(solid+detail*.72+cut*.44);
  float bright=.76+.25*energy+.14*impact;
  vec3 ink=uColor;
  // Layered pigment, not transparent plastic. High-contrast strokes and subtle solid areas.
  float mask=boundary+inner;
  vec3 col=ink*(boundary*bright+inner*(.63+.28*energy));
  // Silent at rest. During playing, the glyph breathes with the sound energy.
  float beat=ring(r,.87+.12*energy,.018)*(.52*uEnergy+.23*impact);
  float touch=ring(r,1.02,.014)*uGesture*.38;
  col+=ink*(beat+touch)*.58;
  float wave=(ring(r,1.10+.016*energy,.016)+ring(r,1.17,.012)*.46)*uWaveLayer;
  col+=vec3(.62,.86,.99)*wave*(.26+.24*energy);
  float alpha=clamp(mask*.95+beat*.7+touch*.6+wave*.75,0.,.96);
  if(alpha<.008)discard;
  gl_FragColor=vec4(clamp(col/max(alpha,.05),0.,1.),alpha);
 }`,
 ribbonVS:`attribute vec2 aPos;attribute vec2 aRibbon;attribute float aPower;
 uniform vec2 uScreen;varying vec2 vRibbon;varying float vPower;
 void main(){vRibbon=aRibbon;vPower=aPower;vec2 uv=aPos/uScreen;
 gl_Position=vec4(uv.x*2.-1.,1.-uv.y*2.,0.,1.);}`,
 ribbonFS:`precision mediump float;varying vec2 vRibbon;varying float vPower;
 uniform float uTime;
 void main(){float y=abs(vRibbon.y-.5);float core=1.-smoothstep(.11,.32,y);
 float a=core*clamp(vPower*.52,0.,.38);
 gl_FragColor=vec4(.32,.47,.62,a);}`,
 temporalFS:`precision highp float;varying vec2 vUV;
 uniform sampler2D uPrev;uniform vec2 uSize;uniform vec4 uNodes[11];
 uniform float uCount,uTime,uTrace;
 void main(){vec3 fresh=vec3(0.);
 for(int i=0;i<11;i++){
  if(float(i)>=uCount)break;
  vec4 n=uNodes[i];float en=n.w;
  float d=length((vUV-n.xy)*uSize);
  float rr=n.z*(1.25+mod(uTime*.52+float(i)*.31,1.1));
  float wave=exp(-pow((d-rr)/max(2.5,n.z*.12),2.))*en;
  vec3 hue=mix(vec3(.04,.46,.67),vec3(.57,.23,.67),mod(float(i)*.27,1.));
  fresh+=hue*wave*.026;
 }
 vec3 old=texture2D(uPrev,vUV).rgb;
 gl_FragColor=vec4(min(old*.86+fresh*uTrace,vec3(.30)),1.);
 }`,
 compositeFS:`precision mediump float;varying vec2 vUV;
 uniform sampler2D uScene,uHistory;uniform vec2 uPixel;
 uniform float uAura,uTrace;
 void main(){vec3 scene=texture2D(uScene,vUV).rgb;
 vec3 blur=vec3(0.);
 blur+=texture2D(uScene,vUV+vec2(3.,0.)*uPixel).rgb;
 blur+=texture2D(uScene,vUV-vec2(3.,0.)*uPixel).rgb;
 blur+=texture2D(uScene,vUV+vec2(0.,3.)*uPixel).rgb;
 blur+=texture2D(uScene,vUV-vec2(0.,3.)*uPixel).rgb;
 blur*=.25;
 vec3 highlights=max(blur-vec3(.055),vec3(0.));
 vec3 trail=texture2D(uHistory,vUV).rgb;
 vec3 color=scene+highlights*uAura*.14+trail*uTrace*.58;
 gl_FragColor=vec4(clamp(color,0.,1.),1.);
 }`
};
class VisualRenderer{
 constructor(canvas,overlay,onStatus=()=>{}){
  this.canvas=canvas;this.overlay=overlay;this.overlayCtx=overlay.getContext('2d');
  this.onStatus=onStatus;this.W=1;this.H=1;this.dpr=1;
  this.gl=null;this.ready=false;this.mode='none';this.lost=false;
  this.aura=.20;this.trace=.22;this.quality='balanced';this.post=true;
  this.trailFrames=0;this.fallbackCanvas=null;this.frame=0;this.validateGPU=true;this.renderFailures=0;
  this.init();
  canvas.addEventListener('webglcontextlost',e=>{
   e.preventDefault();
   // Keep the instrument visible while Safari/Chrome recovers the GPU context.
   this.enableFallback('2D graphics · GPU context lost');
   this.lost=false;
   this.canvas.dispatchEvent(new Event('rendererrestored'));
  });
  canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.init();this.resize(this.W,this.H);this.onStatus(this.mode.toUpperCase()+' · GPU pipeline restored');this.canvas.dispatchEvent(new Event('rendererrestored'));});
 }
 setFX(aura,trace){this.aura=Math.max(0,Math.min(1,aura/100));this.trace=Math.max(0,Math.min(1,trace/100));
  if(!this.trace){this.trailFrames=0;this.clearHistory();}}
 setQuality(q){if(!['eco','balanced','high'].includes(q))return;this.quality=q;this.resize(this.W,this.H);}
 needsFrame(){return this.trailFrames>0;}
 shader(type,source){const g=this.gl,s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);
  if(!g.getShaderParameter(s,g.COMPILE_STATUS)){const msg=g.getShaderInfoLog(s);g.deleteShader(s);throw Error(msg);}return s;}
 program(vs,fs){const g=this.gl,p=g.createProgram();const a=this.shader(g.VERTEX_SHADER,vs),b=this.shader(g.FRAGMENT_SHADER,fs);
  g.attachShader(p,a);g.attachShader(p,b);g.linkProgram(p);g.deleteShader(a);g.deleteShader(b);
  if(!g.getProgramParameter(p,g.LINK_STATUS)){const msg=g.getProgramInfoLog(p);g.deleteProgram(p);throw Error(msg);}return p;}
 locate(p,attrs,uniforms){const g=this.gl,result={};for(const a of attrs)result[a]=g.getAttribLocation(p,a);
  for(const u of uniforms)result[u]=g.getUniformLocation(p,u);return result;}
 init(){const c=this.canvas;
  const config={alpha:false,depth:false,stencil:false,antialias:false,preserveDrawingBuffer:false,powerPreference:'low-power'};
  const g=this.gl=c.getContext('webgl2',config)||c.getContext('webgl',config);
  if(!g){this.enableFallback('WebGL unsupported');return;}
  this.mode=(typeof WebGL2RenderingContext!=='undefined'&&g instanceof WebGL2RenderingContext)?'webgl2':'webgl1';
  try{
   this.programs={
    bg:this.program(FIELD_GLSL.quadVS,FIELD_GLSL.bgFS),
    obj:this.program(FIELD_GLSL.objectVS,FIELD_GLSL.objectFS),
    line:this.program(FIELD_GLSL.ribbonVS,FIELD_GLSL.ribbonFS),
    trail:this.program(FIELD_GLSL.quadVS,FIELD_GLSL.temporalFS),
    compose:this.program(FIELD_GLSL.quadVS,FIELD_GLSL.compositeFS)
   };
   this.bg=this.locate(this.programs.bg,['aCorner'],['uTime','uWorld']);
   this.obj=this.locate(this.programs.obj,['aCorner'],['uCenter','uScreen','uRadius','uAngle','uKind','uSeed','uEnergy','uGesture','uImpact','uRepeat','uTime','uMove','uAura','uColor','uWorld','uWaveLayer','uVisualScale']);
   this.line=this.locate(this.programs.line,['aPos','aRibbon','aPower'],['uScreen','uTime']);
   this.trail=this.locate(this.programs.trail,['aCorner'],['uPrev','uNodes[0]','uCount','uTime','uSize','uTrace']);
   this.compose=this.locate(this.programs.compose,['aCorner'],['uScene','uHistory','uPixel','uAura','uTrace']);
   this.quadBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.quadBuffer);
   g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);
   this.lineBuffer=g.createBuffer();this.target=null;this.history=[];this.historyIndex=0;
   g.disable(g.DEPTH_TEST);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);
   this.ready=true;this.post=true;this.overlay.style.display='block';
   if(this.fallbackCanvas){this.fallbackCanvas.remove();this.fallbackCanvas=null;}
   this.canvas.style.opacity='1';this.validateGPU=true;this.onStatus(this.mode.toUpperCase()+' · GPU pipeline');
  }catch(e){console.warn('WebGL pipeline:',e);this.enableFallback('Graphics compatibility mode');}
 }
 enableFallback(message){
  // A WebGL canvas cannot acquire 2D after context creation. Fallback lives in another canvas.
  if(!this.gl){this.c2d=this.canvas.getContext('2d');this.canvas.style.opacity='1';}
  else{
   if(!this.fallbackCanvas){this.fallbackCanvas=document.createElement('canvas');
    this.fallbackCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    this.canvas.before(this.fallbackCanvas);}
   this.c2d=this.fallbackCanvas.getContext('2d');this.canvas.style.opacity='0';
  }
  this.mode='canvas2d';this.ready=!!this.c2d;this.overlay.style.display='block';this.onStatus(message);
 }
 makeTarget(w,h){const g=this.gl,tex=g.createTexture();g.bindTexture(g.TEXTURE_2D,tex);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
  g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);
  const fbo=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,fbo);
  g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,tex,0);
  if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE){g.deleteTexture(tex);g.deleteFramebuffer(fbo);throw Error('FBO incomplete');}
  return {tex,fbo,w,h};
 }
 clearHistory(){if(!this.gl||!this.ready||!this.history?.length)return;const g=this.gl;
  for(const t of this.history){g.bindFramebuffer(g.FRAMEBUFFER,t.fbo);g.viewport(0,0,t.w,t.h);g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);}
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,this.canvas.width,this.canvas.height);}
 freeTargets(){if(!this.gl)return;for(const t of [this.target,...(this.history||[])])if(t){this.gl.deleteTexture(t.tex);this.gl.deleteFramebuffer(t.fbo);}
  this.target=null;this.history=[];}
 resize(w,h){this.W=w;this.H=h;
  const cap=this.quality==='eco'?1:this.quality==='high'?1.7:1.3;
  let dpi=Math.min(window.devicePixelRatio||1,cap);
  const maxPixels=this.quality==='eco'?440000:this.quality==='high'?1900000:950000;
  dpi=Math.min(dpi,Math.sqrt(maxPixels/Math.max(1,w*h)));
  this.dpr=dpi;
  const pw=Math.max(1,Math.round(w*dpi)),ph=Math.max(1,Math.round(h*dpi));
  this.canvas.width=pw;this.canvas.height=ph;this.overlay.width=pw;this.overlay.height=ph;
  if(this.fallbackCanvas){this.fallbackCanvas.width=pw;this.fallbackCanvas.height=ph;}
  if(this.mode==='canvas2d'||!this.ready)return;
  const g=this.gl;
  this.freeTargets();
  try{
   this.target=this.makeTarget(pw,ph);
   const tw=Math.max(2,Math.ceil(pw*.50)),th=Math.max(2,Math.ceil(ph*.50));
   this.history=[this.makeTarget(tw,th),this.makeTarget(tw,th)];
   this.historyIndex=0;
   for(const t of this.history){g.bindFramebuffer(g.FRAMEBUFFER,t.fbo);g.viewport(0,0,t.w,t.h);g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);}
   this.post=true;this.validateGPU=true;
  }catch(e){console.warn('Post-processing unavailable, using direct WebGL',e);
   this.freeTargets();this.post=false;this.onStatus(this.mode.toUpperCase()+' · direct graphics');}
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,pw,ph);
 }
 quad(info){const g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,this.quadBuffer);
  g.enableVertexAttribArray(info.aCorner);g.vertexAttribPointer(info.aCorner,2,g.FLOAT,false,0,0);
  g.drawArrays(g.TRIANGLES,0,6);g.disableVertexAttribArray(info.aCorner);}
 draw(time,notes,state){if(!this.ready||this.lost)return;
  if(this.mode==='canvas2d'){this.drawFallback(time,notes,state);this.drawFallbackLines(time,notes,state);this.drawThreads(time,notes,state);return;}
  try{
   this.drawGPU(time,notes,state);this.drawThreads(time,notes,state);
   // On the first frame after (re)initialization, verify that the GPU wrote pixels.
   // A successful context acquisition alone does not guarantee a visible frame.
   if(this.validateGPU){
    this.validateGPU=false;
    const g=this.gl,pixel=new Uint8Array(4);
    g.readPixels(Math.floor(this.canvas.width*.5),Math.floor(this.canvas.height*.5),1,1,g.RGBA,g.UNSIGNED_BYTE,pixel);
    const error=g.getError();
    if(error!==g.NO_ERROR || pixel[0]+pixel[1]+pixel[2]<3)
     throw Error('GPU frame validation failed (error '+error+', pixel '+Array.from(pixel).join(',')+')');
   }
  }catch(error){
   console.error('GPU render failed; switching to Canvas 2D:',error);
   this.renderFailures++;
   this.enableFallback('2D graphics · automatic GPU recovery');
   if(this.ready){this.drawFallback(time,notes,state);this.drawFallbackLines(time,notes,state);this.drawThreads(time,notes,state);}
  }
 }
 drawScene(time,notes,state){const g=this.gl;
  g.disable(g.BLEND);g.useProgram(this.programs.bg);g.uniform1f(this.bg.uTime,time);g.uniform1f(this.bg.uWorld,state.materialType||0);this.quad(this.bg);
  g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);
  this.drawLinks(time,notes,state);
  g.useProgram(this.programs.obj);g.uniform2f(this.obj.uScreen,this.W,this.H);
  g.uniform1f(this.obj.uTime,time);
  g.uniform1f(this.obj.uAura,this.aura);
  for(const n of notes){g.uniform1f(this.obj.uWorld,(state.materialType||0));g.uniform2f(this.obj.uCenter,n.x,n.y);g.uniform1f(this.obj.uRadius,n.r);
   g.uniform3f(this.obj.uColor,...n.color);g.uniform1f(this.obj.uKind,n.id);g.uniform1f(this.obj.uVisualScale,n.visualScale||1);
   g.uniform1f(this.obj.uSeed,n.id*1.131+.7);g.uniform1f(this.obj.uEnergy,n.energy);
   g.uniform1f(this.obj.uGesture,n.gesture||0);
   g.uniform1f(this.obj.uImpact,n.impact||0);g.uniform1f(this.obj.uRepeat,n.streak||0);
   g.uniform1f(this.obj.uMove,n.dragged?1:0);g.uniform1f(this.obj.uWaveLayer,n.waveLayer?1:0);
   g.uniform1f(this.obj.uAngle,n.angle);this.quad(this.obj);}
 }
 drawLinks(time,notes,state){const g=this.gl,verts=[];
  const reach=Math.max(95,Math.min(this.W,this.H)*.86);
  for(let i=0;i<notes.length;i++){
   const a=notes[i];const nearest=notes.map((n,j)=>({n,j,d:Math.hypot(n.x-a.x,n.y-a.y)}))
    .filter(v=>v.j!==i&&v.d<reach).sort((x,y)=>x.d-y.d).slice(0,3);
   for(const {n:b,j,d} of nearest){if(j<i)continue;
    const energy=Math.max(a.energy,b.energy),power=.01+energy*.52;
    if(power<.035)continue;
    const dx=b.x-a.x,dy=b.y-a.y,nx=-dy/d,ny=dx/d,width=(1.3+energy*2.6+(state.dragging?1.6:0));
    const positions=[[0,0],[1,0],[0,1],[0,1],[1,0],[1,1]];
    for(const [t,v] of positions)verts.push(a.x+dx*t+nx*(v-.5)*width,a.y+dy*t+ny*(v-.5)*width,t,v,power);
   }
  }
  if(!verts.length)return;
  g.useProgram(this.programs.line);g.uniform2f(this.line.uScreen,this.W,this.H);g.uniform1f(this.line.uTime,time);
  g.bindBuffer(g.ARRAY_BUFFER,this.lineBuffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(verts),g.DYNAMIC_DRAW);
  for(const [name,size,offset] of [['aPos',2,0],['aRibbon',2,8],['aPower',1,16]]){
   const id=this.line[name];g.enableVertexAttribArray(id);g.vertexAttribPointer(id,size,g.FLOAT,false,20,offset);}
  g.drawArrays(g.TRIANGLES,0,verts.length/5);
  for(const name of ['aPos','aRibbon','aPower'])g.disableVertexAttribArray(this.line[name]);
 }
 drawGPU(time,notes,state){const g=this.gl,pw=this.canvas.width,ph=this.canvas.height;
  const surface=this.post?this.target:null;
  g.bindFramebuffer(g.FRAMEBUFFER,surface?.fbo||null);g.viewport(0,0,pw,ph);
  this.drawScene(time,notes,state);
  if(!this.post)return;
  // Feedback: only the trail texture carries previous frames. Scene never feeds itself.
  const next=1-this.historyIndex,src=this.history[this.historyIndex],dst=this.history[next];
  g.disable(g.BLEND);g.bindFramebuffer(g.FRAMEBUFFER,dst.fbo);g.viewport(0,0,dst.w,dst.h);
  g.useProgram(this.programs.trail);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,src.tex);
  g.uniform1i(this.trail.uPrev,0);g.uniform2f(this.trail.uSize,this.W,this.H);
  g.uniform1f(this.trail.uCount,notes.length);g.uniform1f(this.trail.uTime,time);
  g.uniform1f(this.trail.uTrace,this.trace);
  const nvec=new Float32Array(44);
  for(let i=0;i<notes.length;i++){const n=notes[i];nvec.set([n.x/this.W,1-n.y/this.H,n.r,n.energy],i*4);}
  g.uniform4fv(this.trail['uNodes[0]'],nvec);this.quad(this.trail);
  this.historyIndex=next;
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,pw,ph);
  g.useProgram(this.programs.compose);
  g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.target.tex);g.uniform1i(this.compose.uScene,0);
  g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,dst.tex);g.uniform1i(this.compose.uHistory,1);
  g.uniform2f(this.compose.uPixel,1/pw,1/ph);g.uniform1f(this.compose.uAura,this.aura);
  g.uniform1f(this.compose.uTrace,this.trace);this.quad(this.compose);
  const active=notes.some(n=>n.energy>.03||(n.gesture||0)>.03);
  if(active&&this.trace>0)this.trailFrames=95;
  else if(this.trailFrames>0)this.trailFrames--;
  this.frame++;
 }
 // Connected forms share a visible, instrument-like optical fibre.
 // The path stays still at rest: travelling light occurs ONLY on acoustic excitation.
 // This lightweight 2D foreground is composited over the WebGL field.
 drawThreads(time,notes,state){
  const c=this.overlayCtx,d=this.dpr;if(!c)return;
  c.setTransform(d,0,0,d,0,0);
  if(this.mode!=='canvas2d')c.clearRect(0,0,this.W,this.H);
  const now=performance.now();
  const palette=['#59dfec','#ff78ac','#e5c092','#9eafff','#72b9fc'];
  const color=palette[state.materialType||0];
  for(const edge of state.connections||[]){
   const a=notes[edge.a],b=notes[edge.b];if(!a||!b)continue;
   const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,nx=dx/L,ny=dy/L;
   const px=-ny,py=nx,bend=Math.min(13,L*.075)*((edge.a+edge.b)%2?1:-1);
   const sx=a.x+nx*a.r*.86,sy=a.y+ny*a.r*.86;
   const ex=b.x-nx*b.r*.86,ey=b.y-ny*b.r*.86;
   const mx=(sx+ex)*.5+px*bend,my=(sy+ey)*.5+py*bend;
   const energy=Math.min(1,Math.max(a.energy,b.energy)*.5+(edge.flash||0)*.7);
   const path=()=>{c.beginPath();c.moveTo(sx,sy);c.quadraticCurveTo(mx,my,ex,ey);};
   c.save();c.lineCap='round';
   // Thin colored core remains legible against black without full-width blooming.
   path();c.lineWidth=4.8;c.strokeStyle='rgba(8,11,18,.96)';c.stroke();
   path();c.lineWidth=2.05+.45*energy;
   const gradient=c.createLinearGradient(sx,sy,ex,ey);
   gradient.addColorStop(0,a.hex);gradient.addColorStop(1,b.hex);
   c.strokeStyle=gradient;c.globalAlpha=.66+.29*energy;c.stroke();
   c.globalAlpha=1;
   for(const [x,y] of [[sx,sy],[ex,ey]]){
    c.beginPath();c.arc(x,y,3.1,0,Math.PI*2);c.fillStyle='#070a10';c.fill();
    c.lineWidth=1.45;c.strokeStyle=(x===sx&&y===sy)?a.hex:b.hex;c.stroke();
   }
   const curve=t=>({x:(1-t)*(1-t)*sx+2*(1-t)*t*mx+t*t*ex,y:(1-t)*(1-t)*sy+2*(1-t)*t*my+t*t*ey});
   for(const pulse of edge.pulses||[]){
    const age=(now-pulse.at)/pulse.duration;if(age<0||age>=1)continue;
    const tt=Math.min(1,age/.85),t=pulse.from===edge.a?tt:1-tt;
    const loc=curve(t),amp=Math.min(1,age/.11,(1-age)/.25)*pulse.strength;
    c.beginPath();c.arc(loc.x,loc.y,3.2+1.9*amp,0,Math.PI*2);
    c.fillStyle='#dffaff';c.globalAlpha=amp;c.fill();c.globalAlpha=1;
   }
   c.restore();
  }
  // Short, note-colored confirmation of an actual strike. No ambient particles.
  for(const n of notes){
   const p=n.pulse||0;
   if(p<=.008)continue;
   const amount=1-p;
   c.save();c.strokeStyle=n.hex;c.globalAlpha=.36*p;
   c.lineWidth=1.3+.7*p;
   c.beginPath();c.arc(n.x,n.y,n.r*(.91+amount*.53),0,Math.PI*2);c.stroke();c.restore();
  }
  // Quiet WAVE overlay, not an extra object.
  for(const n of notes){if(!n.waveLayer)continue;
   c.save();c.strokeStyle='#78b9f9';c.globalAlpha=.49+.27*n.energy;c.lineWidth=1.15;
   c.setLineDash([1.7,5.2]);c.beginPath();c.arc(n.x,n.y,n.r*1.18,0,Math.PI*2);c.stroke();c.restore();
  }
  const candidate=state.threadPreview;
  if(candidate){const a=notes[candidate.a],b=notes[candidate.b];if(a&&b){
   const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,prog=candidate.progress||0;
   const sx=a.x+dx/L*a.r*.82,sy=a.y+dy/L*a.r*.82;
   const ex=b.x-dx/L*b.r*.82,ey=b.y-dy/L*b.r*.82;
   c.save();c.strokeStyle=color;c.globalAlpha=.26+.60*prog;c.lineWidth=1.4;
   c.setLineDash([2,5]);c.beginPath();c.moveTo(sx,sy);c.lineTo(ex,ey);c.stroke();c.restore();
  }}
 }

 // Compatibility only. It is *not* composited into the WebGL path.
 drawFallback(time,notes,state){
  const c=this.c2d,W=this.W,H=this.H,d=this.dpr;
  c.setTransform(d,0,0,d,0,0);c.fillStyle='#07090d';c.fillRect(0,0,W,H);
  for(const n of notes){
   const x=n.x,y=n.y,r=n.r*.77*(n.visualScale||1),e=n.energy||0,imp=n.impact||0;
   const k=n.id%11;c.save();c.translate(x,y);c.rotate(n.angle||0);
   c.lineJoin='round';c.lineCap='round';c.strokeStyle=n.hex;c.fillStyle=n.hex;
   c.lineWidth=2.25+e*.8;c.globalAlpha=.85+.13*Math.min(1,e+imp);
   c.beginPath();
   const polygon=(N,angle=0)=>{for(let j=0;j<=N;j++){
    const a=angle+j*2*Math.PI/N-Math.PI/2;
    if(j===0)c.moveTo(Math.cos(a)*r,Math.sin(a)*r);else c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}};
   if(k===0||k===9)c.arc(0,0,r,0,Math.PI*2);
   else if(k===1)polygon(3);
   else if(k===2)c.roundRect(-r*.78,-r*.78,r*1.56,r*1.56,r*.29);
   else if(k===3)c.roundRect(-r*.48,-r,r*.96,r*2,r*.45);
   else if(k===4||k===10)polygon(4,k===10?.10:0);
   else if(k===5){c.moveTo(-r*.35,-r);c.lineTo(r*.35,-r);c.lineTo(r*.35,-r*.35);c.lineTo(r,-r*.35);c.lineTo(r,r*.35);c.lineTo(r*.35,r*.35);c.lineTo(r*.35,r);c.lineTo(-r*.35,r);c.lineTo(-r*.35,r*.35);c.lineTo(-r,r*.35);c.lineTo(-r,-r*.35);c.lineTo(-r*.35,-r*.35);}
   else if(k===6)polygon(5);
   else if(k===7)c.roundRect(-r,-r*.49,r*2,r*.98,r*.46);
   else polygon(8);
   c.closePath();c.save();c.globalAlpha=.13+.08*e;c.fill();c.restore();c.stroke();
   c.globalAlpha=.42+.4*e;c.lineWidth=1.15;c.beginPath();
   if(k===0||k===7||k===9)c.arc(0,0,r*.51,0,Math.PI*2);
   else if(k===1||k===6)polygon(k===1?3:5);
   else if(k===3){c.moveTo(-r*.35,0);c.lineTo(r*.35,0);}
   else if(k===5)c.arc(0,0,r*.18,0,Math.PI*2);
   else {c.moveTo(-r*.37,r*.32);c.lineTo(r*.35,-r*.31);}
   c.stroke();
   if(e>.045){c.beginPath();c.arc(0,0,r*1.18,0,Math.PI*2);c.globalAlpha=e*.44;c.stroke();}
   c.restore();
  }
 }

 drawFallbackLines(time,notes,state){
  const c=this.overlayCtx,d=this.dpr;c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,this.W,this.H);
  for(const n of notes)if(n.dragged){c.beginPath();c.arc(n.x,n.y,n.r*1.15,0,Math.PI*2);c.strokeStyle='rgba(184,201,223,.38)';c.lineWidth=1;c.stroke();}
 }
}


/* RESONANT OBJECTS v0.15.0 — One Playing Field / interaction layer.
 * 描画 / 音源 / 状態を分離。WebGL描画上の位置とタッチ領域は同一のモデルを参照。
 * Notes use stable IDs within each layout; no timer-driven animation when idle. */
(()=>{
'use strict';
const $=id=>document.getElementById(id), qsa=s=>[...document.querySelectorAll(s)];
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const field=$('stage'),canvas=$('instrument'),overlay=$('overlay'),labels=$('labels'),readout=$('status');
// Every sound object has a stable hue/identity across materials.
// Changing engines changes timbre and animation, never the player's learned note identity.
const colors=['#F3ECDD','#5BE2F1','#FF7397','#D8EE60','#BDA1FF','#FFAE66','#70DAB4','#EAF4FC','#638FFF','#FFD36D','#F27ADC'];
const MATERIALS=[
 {name:'JEWEL',colors},
 {name:'CANDY',colors},
 {name:'CERAMIC',colors},
 {name:'METAL',colors},
 {name:'WAVE',colors}
];
const hexRGB=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
// D minor 9 pitches exactly as v0.3, with two added notes for 11-piece mode.
// Tuning maps are explicit 11-note collections. The first nine note identities
// stay in their familiar positions; 7/9/11 do not change the instrument's layout.
// Values are MIDI notes, with labels matching the sounding pitch.
const scaleDefinitions={
 minor:{name:'D minor', pitches:[50,57,58,60,62,64,65,67,69,74,72]},
 penta:{name:'C pentatonic',pitches:[48,55,60,62,64,67,69,72,74,79,81]},
 lydian:{name:'F Lydian',pitches:[53,60,64,65,67,69,71,72,76,79,81]},
 eminor:{name:'E minor',pitches:[52,59,62,64,66,67,69,71,74,76,79]},
 adorian:{name:'A Dorian',pitches:[45,52,55,57,60,62,64,66,67,69,71]},
 gmajor:{name:'G major',pitches:[43,50,55,57,59,60,62,67,69,71,74]},
 aminorpent:{name:'A minor pentatonic',pitches:[45,52,55,57,60,64,67,69,72,76,79]},
 dkurd:{name:'D Kurd',pitches:[50,57,58,60,62,64,65,67,69,70,74]},
 dceltic:{name:'D Celtic',pitches:[50,57,60,62,65,67,69,72,74,77,79]},
 hirajoshi:{name:'C Hirajoshi',pitches:[48,55,56,60,62,63,67,68,72,74,75]},
 insen:{name:'D In Sen',pitches:[50,51,55,57,60,62,63,67,69,72,74]},
 whole:{name:'C whole tone',pitches:[48,50,52,54,56,58,60,62,64,66,68]}
};
const noteLabels=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const noteLabelsSharp=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const midiName=(m,key)=>((['eminor','adorian','gmajor'].includes(key)?noteLabelsSharp:noteLabels)[m%12])+Math.floor(m/12-1);
const pitchBanks=Object.fromEntries(Object.entries(scaleDefinitions).map(([key,bank])=>
 [key,bank.pitches.map(m=>[midiName(m,key),m])]));
const selects={7:[0,1,2,3,4,6,8],9:[0,1,2,3,4,5,6,7,8],11:[0,1,2,3,4,5,6,7,8,9,10]};
const params={material:36,ring:67,space:0,bond:75,bloom:0,level:84,aura:48,trace:38,expression:46};
const state={reverbType:'nest',waveAccents:true,materialType:0,count:9,scale:'minor',motion:'still',locked:false,dragging:false,connect:true,showNotes:false,collision:true,scene:'original',drawer:false,link:true,hold:true,quality:'balanced',feel:true,moveSound:false};
const sets=new Map(),stats={7:{hits:0,empty:0,slides:0,rub:0,moves:0,bumps:0,multi:0},9:{hits:0,empty:0,slides:0,rub:0,moves:0,bumps:0,multi:0},11:{hits:0,empty:0,slides:0,rub:0,moves:0,bumps:0,multi:0}};
// The inner core is a handle. The wider annulus is a playable strike surface.
// No speculative audio timers: there is no reliable way to predict a drag at touch-down.
const GRAB_CORE=0.50, MOVE_THRESHOLD=13, TOUCH_HIT_MARGIN=1.13;
const pointerMap=new Map();const connectionsByCount=new Map([[7,new Map()],[9,new Map()],[11,new Map()]]);
const connected=()=>[...connectionsByCount.get(state.count).values()];
const pairKey=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);
let notes=[],W=1,H=1,requestId=0,lastTime=0,lastActive=0,viewReady=false;
// Deliberately unequal printed glyphs; physical hit/collision radii remain equal.
const VISUAL_SCALES=[1.03,.89,1.07,.95,1.00,.88,1.08,.93,1.01,.91,1.07];
let lastTrigger=-1,lastLinkRefresh=0,lastConnectionBeat=0;
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
function pitches(count,scale){
 const source=pitchBanks[scale]||pitchBanks.minor;
 return selects[count].map(i=>source[i]);
}
function makeSet(count){return Array.from({length:count},(_,id)=>({id,midi:50,name:'',kind:id,visualScale:VISUAL_SCALES[id%VISUAL_SCALES.length],big:id===0,
  color:hexRGB(colors[id]),hex:colors[id],u:.5,v:.5,saved:false,r:35,x:0,y:0,energy:0,angle:0,last:0,stageW:1,stageH:1,gesture:0,impact:0,pulse:0,streak:0,waveLayer:false}));}
for(const k of [7,9,11])sets.set(k,makeSet(k));
function setNotes(){clearPointers();notes=sets.get(state.count);engine.setConnections(connected());const names=pitches(state.count,state.scale);
 for(const [i,n] of notes.entries()){n.name=names[i][0];n.midi=names[i][1];}
 updateWaveVoices();labels.replaceChildren();for(const n of notes){const el=document.createElement('div');el.className='note-label';el.dataset.note=n.id;el.textContent=n.name;labels.appendChild(el);n.label=el;}
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
 for(const e of connected()){
  e.flash=Math.max(0,(e.flash||0)-dt*1.2);
  if(e.pulses?.length)e.pulses=e.pulses.filter(p=>performance.now()-p.at<p.duration);
 }
 state.connections=connected();
 const previewPointer=[...pointerMap.values()].find(p=>p.connectTarget>=0);
 if(previewPointer&&state.threadPreview)state.threadPreview.progress=clamp((performance.now()-previewPointer.previewStart)/490,0,1);
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
 for(const n of notes){n.energy=Math.max(0,n.energy-dt*(n.waveLayer||state.materialType===4?.28:.64));
 n.gesture=Math.max(0,(n.gesture||0)-dt*2.7);
 n.impact=Math.max(0,(n.impact||0)-dt*[2.8,3.5,6.5,4.5,1.4][state.materialType]);
 n.pulse=Math.max(0,(n.pulse||0)-dt*2.25);
 if(n.energy>.008||n.gesture>.008||n.impact>.008||n.pulse>.008)any=true;
 // Geometry may subtly rotate, but touch centers NEVER drift during performance.
 if(state.motion==='orbit')n.angle+=dt*.14*(n.id%2===0?1:-1);
 else if(state.motion==='float')n.angle=Math.sin(now*.33+n.id*1.3)*.055;
 }
 updateLabels();renderer.draw(now,notes,state);
 if(any||renderer.needsFrame()||state.motion!=='still'||connected().some(e=>e.flash>.01)||state.threadPreview)drawRequest();
}
function hit(x,y){let best=-1,dist=Infinity;
 for(const n of notes){const d=Math.hypot(n.x-x,n.y-y);
  // 11 pieces have a smaller hit area; prevent taps from selecting a far-away object.
  const region=Math.max(25,n.r*TOUCH_HIT_MARGIN);
  if(d<region&&d<dist){best=n.id;dist=d;}}
 return best;
}
const xy=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
// Subtle playing memory and harmonic neighborhood: modify existing excitation,
// never spawn unsolicited voices or click-like secondary events.
const playingMemory=new Map();
function play(index,velocity=1,radial=0){
 // Use a stable snapshot because resuming AudioContext is asynchronous on Safari.
 const current=notes, note=current[index];if(!note)return;
 const perform=()=>{
  if(current!==notes)return;
  const now=performance.now(), prior=playingMemory.get(note.id);
  const elapsed=prior?now-prior.at:Infinity;
  const memory=elapsed<950?Math.min(3,prior.level+1):0;
  playingMemory.set(note.id,{at:now,level:memory});
  // Nearby resonators subtly color the existing note, without triggering others.
  const neighbors=current.filter(n=>n!==note).reduce((acc,n)=>{
   const distance=Math.hypot(n.x-note.x,n.y-note.y);
   return acc+(distance<note.r*4?Math.max(0,1-distance/(note.r*4)):0);
  },0);
  const expressiveVelocity=Math.min(1.08,velocity*(1+memory*.028));
  const expressiveRadial=Math.min(1,radial+Math.min(.11,neighbors*.025));
  if(engine.strike(index,current,expressiveVelocity,state.feel?expressiveRadial:0)){
   note.pulse=1;note.pulseX=radial;note.energy=Math.max(note.energy,.74);
   for(const e of connected())if(e.a===index||e.b===index){
    e.flash=Math.max(e.flash||0,.85);
    if(!e.pulses)e.pulses=[];
    e.pulses.push({at:performance.now(),from:index,strength:Math.min(1,velocity),duration:730});
    if(e.pulses.length>4)e.pulses.shift();
   }
   say(`✦ ${note.name} · ${radial>.62&&state.feel?'bright rim':'resonating'}`);drawRequest();
  }
 };
 // Already-running contexts strike synchronously. On the first touch Safari must
 // unlock the context from the user gesture; only that first strike is asynchronous.
 if(engine.ctx?.state==='running'){perform();return;}
 engine.unlock().then(ok=>{if(ok)perform();else say('Tap again to enable sound');});
}
function pointerDown(e){
 e.preventDefault();if($('lab').classList.contains('open'))return;
 if(state.drawer){toggleDrawer(false);return;}
 // Reject synthetic/duplicate down events for an already-tracked pointer.
 if(pointerMap.has(e.pointerId))return;
 const {x,y}=xy(e),i=hit(x,y);
 if(i<0){stats[state.count].empty++;return;}
 try{canvas.setPointerCapture(e.pointerId);}catch(_){}
 const n=notes[i],radial=clamp(Math.hypot(x-n.x,y-n.y)/n.r,0,1);
 // Touching the outer 73% of the pad area strikes immediately, even while LOCK is off.
 // Its small inner core is a quiet grab handle: a short core-tap strikes on release.
 // This explicit spatial distinction avoids click-like pickup sounds during slow drags.
 const alreadyGrabbed=[...pointerMap.values()].some(p=>p.id===i);
 const p={id:i,last:i,intent:'pending',canDrag:radial<GRAB_CORE&&!state.locked&&!alreadyGrabbed,
  holdTimer:0,pointerType:e.pointerType||'mouse',x,y,startX:x,startY:y,when:performance.now(),moved:false,gesture:false,
  offsetX:x-n.x,offsetY:y-n.y,countedRub:false,countedMove:false,
  contactWith:new Set(),lastSpeed:0,connectTimer:0,connectTarget:-1,previewStart:0,
  played:false,held:false,initialRadial:radial};
 pointerMap.set(e.pointerId,p);
 stats[state.count].hits++;stats[state.count].multi=Math.max(stats[state.count].multi,pointerMap.size);
 // Unlock audio on the first gesture even when the player only moves a body.
 // This prepares the collision resonator without producing an unwanted pickup note.
 if(p.canDrag){
  // Only unlock the Web Audio context on grab; do not generate any sound yet.
  // Touch-down can be a tap, hold or drag. Play the core tap only on pointer-up.
  engine.unlock();
 }else{
  p.played=true;
  play(i,clamp(1.03-.25*radial,.66,1),radial);
 }
 scheduleHold(e.pointerId,i);
}
function cancelThread(p){if(p?.connectTimer){clearTimeout(p.connectTimer);p.connectTimer=0;}if(p){p.connectTarget=-1;p.previewStart=0;}state.threadPreview=null;}
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
   p.held=true;
   engine.startHold(pointerId,notes[index]);notes[index].energy=Math.max(notes[index].energy,.34);drawRequest();
  }
 },270);
}

// Explicit physical threads are separate from ambient proximity coupling.
// Dwell while actively dragging near another body; release and ordinary taps do not tie.
function countDegree(id){return connected().filter(e=>e.a===id||e.b===id).length;}
function syncThreads(){engine.setConnections(connected());drawRequest();}
function tie(a,b){
 if(a===b||!state.connect||countDegree(a)>=2||countDegree(b)>=2)return false;
 const k=pairKey(a,b),map=connectionsByCount.get(state.count);
 if(map.has(k))return false;
 map.set(k,{a:Math.min(a,b),b:Math.max(a,b),flash:.65,pulses:[],created:performance.now()});
 notes[a].energy=Math.max(notes[a].energy,.28);notes[b].energy=Math.max(notes[b].energy,.28);
 syncThreads();say('Two shapes are resonating together');return true;
}
function removeThread(a,b,show=true){
 if(!connectionsByCount.get(state.count).delete(pairKey(a,b)))return false;
 syncThreads();if(show)say('The thread dissolved');return true;
}
function evaluateThread(pointerId,p){
 if(!state.connect||state.locked||p.intent!=='drag')return cancelThread(p);
 const n=notes[p.id],near=notes.filter(v=>v!==n)
  .map(v=>({v,d:Math.hypot(v.x-n.x,v.y-n.y)}))
  .filter(v=>v.d<=n.r+v.v.r+22 && v.d>=n.r+v.v.r-2)
  .sort((a,b)=>a.d-b.d)[0];
 const candidate=near?.v;
 if(!candidate||connectionsByCount.get(state.count).has(pairKey(n.id,candidate.id))||countDegree(n.id)>=2||countDegree(candidate.id)>=2){
  return cancelThread(p);
 }
 if(p.connectTarget===candidate.id){
  state.threadPreview={a:n.id,b:candidate.id,progress:Math.min(1,(performance.now()-p.previewStart)/490)};
  return;
 }
 cancelThread(p);p.connectTarget=candidate.id;p.previewStart=performance.now();
 state.threadPreview={a:n.id,b:candidate.id,progress:0};
 p.connectTimer=setTimeout(()=>{
  p.connectTimer=0;
  if(pointerMap.get(pointerId)!==p||p.intent!=='drag'||!state.connect)return;
  const other=notes[p.connectTarget];
  if(other&&Math.hypot(n.x-other.x, n.y-other.y)<n.r+other.r+23)tie(n.id,other.id);
  cancelThread(p);
 },490);
 drawRequest();
}
function breakDistantThreads(){
 const maxDist=Math.max(145,Math.min(W,H)*.52);
 let changed=false;
 for(const e of connected()){
  const a=notes[e.a],b=notes[e.b];
  if(!a||!b||Math.hypot(a.x-b.x,a.y-b.y)>maxDist){
   connectionsByCount.get(state.count).delete(pairKey(e.a,e.b));changed=true;
  }
 }
 if(changed){syncThreads();say('The thread stretched and disappeared');}
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
   if(state.collision&&speed>.25&&!p.contactWith.has(other.id)&&chimed<1){
    if(engine.contact(n,other,speed,notes)){
     stats[state.count].bumps++;chimed++;
     n.energy=Math.max(n.energy,.42);other.energy=Math.max(other.energy,.39);
     other.gesture=Math.max(other.gesture||0,[.38,.62,.24,.42,.35][state.materialType]);
    }
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
 breakDistantThreads();evaluateThread(pointerId,p);
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
 if(!p.moved&&travel>MOVE_THRESHOLD){
  p.moved=true;
  cancelHold(e.pointerId);
 }
 if(p.intent==='pending'&&travel>MOVE_THRESHOLD){p.intent=p.canDrag?'drag':'glide';}
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
 // Require the finger to enter well inside the next pad before changing voices;
 // small boundary jitter no longer makes the sound hop between neighbours.
 const confirmed=i>=0&&Math.hypot(x-notes[i].x,y-notes[i].y)<notes[i].r*.90;
 if(confirmed&&i!==p.last){p.last=i;
  stats[state.count].hits++;stats[state.count].slides++;
  const radial=clamp(Math.hypot(x-notes[i].x,y-notes[i].y)/notes[i].r,0,1);
  play(i,clamp(.86-.18*radial,.55,.86),radial);
 }
 drawRequest();
}
canvas.addEventListener('rendererrestored',()=>{lastTime=0;drawRequest();});
canvas.addEventListener('pointerdown',pointerDown,{passive:false});
canvas.addEventListener('pointermove',pointerMove,{passive:false});
function pointerEnd(e){
 const p=pointerMap.get(e.pointerId);if(!p)return;
 // A stationary central tap gets one pitched strike on finger release.
 // Dragging / cancel / long hold must NOT add an accidental pickup or release hit.
 const tap=e.type==='pointerup'&&p.intent==='pending'&&!p.moved&&!p.held&&!p.played;
 const noteId=p.id,radial=p.initialRadial;
 cancelHold(e.pointerId);cancelThread(p);engine.endGesture(e.pointerId);pointerMap.delete(e.pointerId);
 if(tap)play(noteId,clamp(1.03-.25*radial,.66,1),radial);
 if(p.intent==='drag'){
  notes[p.id].dragged=false;
  // Release is silent unless it physically contacts another object.
  state.dragging=[...pointerMap.values()].some(v=>v.intent==='drag');
  engine.refreshLinks(notes);drawRequest();
 }
}
for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,pointerEnd,{passive:false});
function updateButtons(){
 qsa('[data-count]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.count)===state.count)));
 qsa('[data-connect]').forEach(b=>{b.setAttribute('aria-pressed',String(state.connect));b.textContent=state.connect?'ON':'OFF';});
 qsa('[data-show-notes]').forEach(b=>{b.setAttribute('aria-pressed',String(state.showNotes));b.textContent=state.showNotes?'ON':'OFF';});
 $('app').classList.toggle('show-notes',state.showNotes);

 qsa('[data-lock]').forEach(b=>{b.setAttribute('aria-pressed',String(state.locked));
  b.setAttribute('aria-label',state.locked?'Unlock object positions':'Lock object positions');
  if(b.classList.contains('icon-control'))b.innerHTML=state.locked?`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 13V9a7 7 0 0 1 14 0v4M6 13h20v16H6zM16 19v5"/></svg>`:`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 13V9a7 7 0 0 1 13-4M6 13h20v16H6zM16 19v5"/></svg>`;
  else b.textContent=state.locked?'LOCKED':'UNLOCKED';});
 qsa('[data-collision]').forEach(b=>{b.setAttribute('aria-pressed',String(state.collision));b.textContent=state.collision?'ON':'OFF';});
 qsa('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===state.motion)));
 qsa('[data-scale]').forEach(s=>s.value=state.scale);
 qsa('[data-link]').forEach(b=>{b.setAttribute('aria-pressed',String(state.link));b.textContent=state.link?'ON':'OFF';});
 qsa('[data-hold]').forEach(b=>{b.setAttribute('aria-pressed',String(state.hold));b.textContent=state.hold?'ON':'OFF';});
 qsa('[data-wave-accents]').forEach(b=>{b.setAttribute('aria-pressed',String(state.waveAccents));b.textContent=state.waveAccents?'ON':'OFF';});
 qsa('[data-feel]').forEach(b=>{b.setAttribute('aria-pressed',String(state.feel));b.textContent=state.feel?'ON':'OFF';});
 qsa('[data-move-sound]').forEach(b=>{b.setAttribute('aria-pressed',String(state.moveSound));b.textContent=state.moveSound?'ON':'OFF';});
 qsa('[data-quality]').forEach(s=>s.value=state.quality);
 $('touchHint').textContent=state.locked?'✦ POSITIONS LOCKED · TAP · GLIDE · HOLD':'';
 $('sceneName').textContent=({original:'Glass garden',cloud:'Blue hour',bright:'Little sun'})[state.scene]||'Custom';
}
function clearPointers(){for(const [id,p] of pointerMap){
  cancelHold(id);cancelThread(p);engine.endGesture(id);
  try{if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}catch(_){}
 }pointerMap.clear();for(const n of notes)n.dragged=false;state.dragging=false;}
function setCount(n){if(![7,9,11].includes(n))return;clearPointers();state.count=n;state.threadPreview=null;setNotes();say(`${n} resonators ready`);}
function setScale(s){if(!pitchBanks[s]||s===state.scale)return;state.scale=s;playingMemory.clear();engine.stopAllHolds();setNotes();state.scene='custom';updateButtons();say('Tuning · '+scaleDefinitions[s].name);}
function setLock(locked){clearPointers();state.locked=locked;updateButtons();say(locked?'Positions locked · sounds remain playable':'Drag centers to move, glide along edges');drawRequest();}
function setMotion(m){if(!['still','float','orbit'].includes(m))return;
 state.motion=m;updateButtons();drawRequest();}
// Every body retains its own material. Two notes also carry a quiet sustained WAVE veil.
function updateWaveVoices(){
 for(const set of sets.values()){
  const last=set.length-2;
  for(const n of set)n.waveLayer=state.waveAccents&&state.materialType!==4&&(n.id===2||n.id===last);
 }
 for(const set of sets.values())for(const n of set){
  const palette=MATERIALS[state.materialType].colors;
  n.hex=palette[n.id%palette.length];n.color=hexRGB(n.hex);
 }
 if(engine.ctx)engine.syncTanks(notes);
 drawRequest();
}
function setMaterialType(k,announce=true){
 k=Number(k);if(!Number.isInteger(k)||k<0||k>4)return;
 state.materialType=k;engine.setMaterialType(k);
 updateWaveVoices();
 document.documentElement.dataset.material=MATERIALS[k].name.toLowerCase();
 qsa('[data-material-type]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.materialType)===k)));
 if($('materialTag'))$('materialTag').textContent=MATERIALS[k].name;
 renderer.clearHistory();drawRequest();
 if(announce)say(MATERIALS[k].name+' · material changed');
}
function selectReverb(type,announce=true){
 if(!['nest','velvet','prism','horizon'].includes(type))return;
 state.reverbType=type;engine.setReverbType(type);
 qsa('[data-reverb]').forEach(el=>{
  el.value=type;
 });
 qsa('[data-reverb-choice]').forEach(button=>
  button.setAttribute('aria-pressed',String(button.dataset.reverbChoice===type)));
 if(announce){state.scene='custom';updateButtons();say('Space · '+({nest:'Nest',velvet:'Velvet',prism:'Prism',horizon:'Horizon'})[type]);}
}
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
  material:v<30?'Soft':v>70?'Bright':'Balanced',
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
 selectReverb(({original:'nest',cloud:'velvet',bright:'prism'})[s],false);
 state.scale=s==='cloud'?'penta':s==='bright'?'lydian':'minor';setNotes();setMaterialType(s==='bright'?1:s==='cloud'?0:0,false);updateButtons();
 say(`Scene · ${$('sceneName').textContent}`);
}
function shuffle(){
 // Keep tuning and positions unchanged; randomize acoustic material and resonance.
 setMaterialType(Math.floor(Math.random()*5),false);
 for(const [k,lo,hi] of [['material',15,83],['ring',35,91],['space',0,43],['bond',30,98],['bloom',0,50]])setParam(k,Math.round(lo+Math.random()*(hi-lo)));
 selectReverb(['nest','velvet','prism','horizon'][Math.floor(Math.random()*4)],false);
 state.scene='custom';updateButtons();say('A different resonance');
}
function reset(){connectionsByCount.get(state.count).clear();syncThreads();for(const n of notes)n.saved=false;layoutSet(notes);engine.refreshLinks(notes);updateLabels();drawRequest();say('Positions reset');}
function save(){
 try{const result={count:state.count,scale:state.scale,motion:state.motion,scene:state.scene,params,
  materialType:state.materialType,reverbType:state.reverbType,waveAccents:state.waveAccents,feel:state.feel,moveSound:state.moveSound,connect:state.connect,showNotes:state.showNotes,collision:state.collision,locked:state.locked,link:state.link,hold:state.hold,quality:state.quality,
  connections:Object.fromEntries([...connectionsByCount].map(([k,map])=>[k,[...map.values()].map(e=>[e.a,e.b])])),
  positions:Object.fromEntries([...sets].map(([k,set])=>[k,set.map(n=>({u:n.u,v:n.v,saved:n.saved}))]))};
  localStorage.setItem('resonant-objects-v012',JSON.stringify(result));say('Saved on this device');
 }catch(e){say('Storage unavailable');}
}
function restore(){
 try{const ownSave=localStorage.getItem('resonant-objects-v012');const raw=ownSave||localStorage.getItem('resonant-objects-v0113')||localStorage.getItem('resonant-objects-v0112')||localStorage.getItem('resonant-objects-v0111')||localStorage.getItem('resonant-objects-v011')||localStorage.getItem('resonant-objects-v010')||localStorage.getItem('resonant-objects-v09')||localStorage.getItem('resonant-objects-v081')||localStorage.getItem('resonant-objects-v08')||localStorage.getItem('resonant-objects-v07')||localStorage.getItem('resonant-objects-v06')||localStorage.getItem('resonant-objects-v05')||localStorage.getItem('resonant-objects-v04');if(!raw)return;
  const v=JSON.parse(raw);if([7,9,11].includes(v.count))state.count=v.count;
  if(Number.isInteger(v.materialType)&&v.materialType>=0&&v.materialType<=4)state.materialType=v.materialType;
  if(typeof v.waveAccents==='boolean')state.waveAccents=v.waveAccents;
  if(['nest','velvet','prism','horizon'].includes(v.reverbType))state.reverbType=v.reverbType;
  if(pitchBanks[v.scale])state.scale=v.scale;
  if(['still','float','orbit'].includes(v.motion))state.motion=v.motion;
  if(['original','cloud','bright','custom'].includes(v.scene))state.scene=v.scene;
  if(['eco','balanced','high'].includes(v.quality))state.quality=v.quality;
  if(typeof v.link==='boolean')state.link=v.link;
  if(typeof v.hold==='boolean')state.hold=v.hold;
  if(typeof v.feel==='boolean')state.feel=v.feel;
  // Old versions enabled a sharp continuous move oscillator by default.
  // Migrate old scenes to quiet dragging; honor only new explicit choices.
  if(ownSave&&typeof v.moveSound==='boolean')state.moveSound=v.moveSound;
  if(typeof v.collision==='boolean')state.collision=v.collision;
  if(typeof v.connect==='boolean')state.connect=v.connect;
  if(typeof v.showNotes==='boolean')state.showNotes=v.showNotes;
  if(v.connections)for(const [k,list] of Object.entries(v.connections)){
   const N=Number(k),map=connectionsByCount.get(N);if(!map||!Array.isArray(list))continue;
   for(const pair of list){if(!Array.isArray(pair)||pair.length!==2)continue;const [a,b]=pair;
    if(!Number.isInteger(a)||!Number.isInteger(b)||a===b||a<0||b<0||a>=N||b>=N)continue;
    const degree=id=>[...map.values()].filter(e=>e.a===id||e.b===id).length;
    if(degree(a)<2&&degree(b)<2)map.set(pairKey(a,b),{a:Math.min(a,b),b:Math.max(a,b),flash:0,created:0});}
  }
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
qsa('[data-connect]').forEach(b=>b.addEventListener('click',()=>{state.connect=!state.connect;
 for(const p of pointerMap.values())cancelThread(p);updateButtons();say(state.connect?'Connection gestures on':'Connection gestures off');}));
qsa('[data-show-notes]').forEach(b=>b.addEventListener('click',()=>{state.showNotes=!state.showNotes;updateButtons();drawRequest();}));
$('clearConnections').addEventListener('click',()=>{connectionsByCount.get(state.count).clear();syncThreads();say('Threads cleared');});
$('miniReset').addEventListener('click',()=>{reset();toggleDrawer(false);});
$('miniLab').addEventListener('click',()=>lab(true));
qsa('[data-material-type]').forEach(b=>b.addEventListener('click',()=>setMaterialType(Number(b.dataset.materialType))));
 qsa('[data-wave-accents]').forEach(b=>b.addEventListener('click',()=>{clearPointers();state.waveAccents=!state.waveAccents;updateWaveVoices();updateButtons();say(state.waveAccents?'WAVE rests gently on two voices':'All voices have their original sound');}));
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
 updateButtons();say(state.moveSound?'Soft motion tone enabled':'Quiet movement');
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
qsa('[data-reverb]').forEach(el=>el.addEventListener('change',()=>selectReverb(el.value)));
qsa('[data-reverb-choice]').forEach(el=>el.addEventListener('click',()=>selectReverb(el.dataset.reverbChoice)));
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
viewReady=true;restore();selectReverb(state.reverbType,false);setMaterialType(state.materialType,false);renderer.setQuality(state.quality);for(const k of Object.keys(params))setParam(k,params[k]);engine.setExpression(state.feel?params.expression:0);engine.setLink(state.link);setNotes();say('Touch, move, and keep two pieces close to make a thread');
})();

