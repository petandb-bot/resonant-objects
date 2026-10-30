/* RESONANT OBJECTS v0.11 — FOUR INDEPENDENT SOUND ENGINES
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
  const soft=1-.23*radial*h.expression;
  const tail=(impact?.11:.22+.87*h.decay)*(sympathetic?.7:1);
  const carrier=e.osc('sine',hz,tail+.08),out=e.gain(),mod=e.osc('sine',hz*(impact?3.1:2.41),tail+.08);
  const depth=e.gain();depth.gain.setValueAtTime(hz*(impact?.35:1.08)*(1+.07*repeat),e.t);
  depth.gain.exponentialRampToValueAtTime(hz*.004,e.t+Math.min(.23,tail*.80));
  mod.connect(depth).connect(carrier.frequency);
  const bend=impact?1.10:(1+.012*v+.006*Math.min(repeat,4));
  carrier.frequency.setValueAtTime(hz*bend,e.t);carrier.frequency.exponentialRampToValueAtTime(hz,e.t+Math.min(.12,tail*.60));
  e.envelope(out,(impact?.024:.20)*v*(sympathetic?.42:1)*soft,.004,tail);carrier.connect(out).connect(e.voice.bus);
  // A rounded, subharmonic-like second voice is a separate signal path.
  if(!impact){const sub=e.osc('sine',hz*.502,tail*.65+.04),subGain=e.gain();
   e.envelope(subGain,.071*v*(sympathetic?.33:1),.005,tail*.65);sub.connect(subGain).connect(e.voice.bus);}
 }
}
class CeramicWaveguideEngine {
 constructor(host){this.host=host;this.name='CERAMIC / excited delay line';}
 strike(note,velocity,{sympathetic=false,delay=0,radial=0,repeat=0,impact=false}={}){
  const h=this.host,e=new MaterialEvent(h,note,delay,!impact),v=bounded(velocity,0,1),hz=soundHz(note.midi)*(impact?2.05:1);
  const tail=(impact?.11:.31+1.30*h.decay)*(sympathetic?.64:1)*(1-.055*Math.min(repeat,4));
  // A short pitched pulse excites a closed damped delay-line resonator.
  // It is purposefully NOT a noise burst, to avoid the former snare-like attack.
  const excitation=e.osc('triangle',Math.min(4500,hz*(1.6+.6*radial)),.033),exGain=e.gain();
  e.envelope(exGain,impact?.085*v:.27*v,.0018,.021);
  const exciteBus=e.gain(1);excitation.connect(exGain).connect(exciteBus);
  for(let i=0;i<(impact?1:2);i++){
   const ratio=i?1.51:1;
   const delayNode=e.node(h.ctx.createDelay(.12));delayNode.delayTime.value=Math.max(.001,1/(hz*ratio));
   const toneFilter=e.node(h.ctx.createBiquadFilter());toneFilter.type='lowpass';toneFilter.frequency.value=impact?2600:2600+radial*900;toneFilter.Q.value=.3;
   const feedback=e.gain(impact?.60:.76+.04*h.decay);
   const voiceFilter=e.node(h.ctx.createBiquadFilter());voiceFilter.type='bandpass';voiceFilter.frequency.value=hz*(i?2.48:1.12);voiceFilter.Q.value=i?.8:.55;
   const level=e.gain();e.envelope(level,(impact?.048:.75)*v*(i?.35:1)*(sympathetic?.43:1),.003,tail);
   exciteBus.connect(delayNode);
   delayNode.connect(toneFilter).connect(feedback).connect(delayNode);
   toneFilter.connect(voiceFilter).connect(level).connect(e.voice.bus);
  }
  // Delay lines are disconnected when the scheduled excitation oscillator ends;
  // give them a separate silent clock oscillator for the tail lifetime.
  const clock=e.osc('sine',1,tail+.055),silent=e.gain(0);clock.connect(silent).connect(e.voice.bus);
  // A shallow, pitched mallet-body transient remains separate from the delay-line sound.
  const body=e.osc('sine',hz*(impact?1.13:1.004),Math.min(tail*.35,.18)+.04),bodyGain=e.gain();
  e.envelope(bodyGain,(impact?.025:.18)*v,.003,Math.min(tail*.35,.18));body.connect(bodyGain).connect(e.voice.bus);
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
