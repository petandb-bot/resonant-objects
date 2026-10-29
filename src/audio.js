/* RESONANT OBJECTS — Audio engine.
   v0.3のモーダル合成（周波数比・音量・減衰・ノイズ）を意図的に継承する。
   見た目の更新が音色に影響しないよう、WebGLとは完全に独立させている。 */
class ResonantEngine {
  constructor(onStatus=()=>{}) {
    this.onStatus=onStatus; this.ctx=null; this.voices=[]; this.noise=null;
    this.material=.36; this.decay=.67; this.bond=.75; this.space=0;
    this.level=.84; this.master=null;
  }
  init() {
    if(this.ctx) return;
    const A=window.AudioContext||window.webkitAudioContext;
    if(!A){this.onStatus('Web Audio unavailable'); return;}
    const c=this.ctx=new A({latencyHint:'interactive'});
    // Dry -> insert -> limiter -> output. Space is a dry-parallel effect.
    this.voiceBus=c.createGain(); this.voiceBus.gain.value=.84;
    this.effectInsert=c.createGain();
    this.compressor=c.createDynamicsCompressor();
    this.compressor.threshold.value=-16; this.compressor.knee.value=12;
    this.compressor.ratio.value=3.6; this.compressor.attack.value=.004;
    this.compressor.release.value=.20;
    this.master=c.createGain(); this.master.gain.value=this.level;
    this.voiceBus.connect(this.effectInsert).connect(this.compressor).connect(this.master).connect(c.destination);
    this.wetGains=[];
    for(const [seconds,cutoff,amount] of [[.063,3200,.21],[.142,2400,.16],[.282,1700,.11]]){
      const del=c.createDelay(.5);del.delayTime.value=seconds;
      const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=cutoff;
      const gain=c.createGain();gain.gain.value=0;
      this.effectInsert.connect(del).connect(filter).connect(gain).connect(this.compressor);
      this.wetGains.push({gain,amount});
    }
    // 音源の打撃ノイズは生成後に再利用する（各タップの割当てを抑制）。
    const n=Math.floor(c.sampleRate*.08);this.noise=c.createBuffer(1,n,c.sampleRate);
    const a=this.noise.getChannelData(0);
    for(let i=0;i<n;i++)a[i]=Math.random()*2-1;
    this.setSpace(this.space*100);
  }
  unlock(){
    this.init();if(!this.ctx)return Promise.resolve(false);
    if(this.ctx.state==='running')return Promise.resolve(true);
    // iOSでは直接のユーザー操作でresume()を呼ぶ。
    return this.ctx.resume().then(()=>this.ctx.state==='running').catch(()=>false);
  }
  setMaterial(v){this.material=v/100;}
  setDecay(v){this.decay=v/100;}
  setBond(v){this.bond=v/100;}
  setSpace(v){this.space=v/100;if(!this.ctx)return;
    for(const {gain,amount} of this.wetGains)
      gain.gain.setTargetAtTime(Math.pow(this.space,1.35)*amount,this.ctx.currentTime,.025);
  }
  setLevel(v){this.level=v/100;if(this.master&&this.ctx)this.master.gain.setTargetAtTime(this.level,this.ctx.currentTime,.02);}
  newVoice(time){
    // 過剰な部分音バンクを防止。実際の同時発音数はタップ速度による。
    if(this.voices.length>=30)this.releaseVoice(this.voices[0],time);
    const bus=this.ctx.createGain();bus.gain.setValueAtTime(1,time);bus.connect(this.voiceBus);
    const voice={bus,oscillators:[],finished:false,cleanup:null};this.voices.push(voice);return voice;
  }
  releaseVoice(v,time){
    if(!v||v.finished)return;
    v.finished=true;
    v.bus.gain.cancelScheduledValues(time);
    v.bus.gain.setValueAtTime(Math.max(.0001,v.bus.gain.value),time);
    v.bus.gain.exponentialRampToValueAtTime(.0001,time+.055);
    for(const osc of v.oscillators){try{osc.stop(time+.065);}catch(_){}}
    // Voiceはonendedでも破棄する。ボイス数を厳密に保つためここでも配列から削除。
    const idx=this.voices.indexOf(v);if(idx>=0)this.voices.splice(idx,1);
  }
  tone(note,velocity,sympathetic=false,delay=0){
    if(!this.ctx||this.ctx.state!=='running'||velocity<.012)return;
    const c=this.ctx,now=c.currentTime,time=now+delay+.004;
    const voice=this.newVoice(time),m=this.material,d=this.decay;
    const hz=440*Math.pow(2,(note.midi-69)/12);
    const tail=(.65+2.45*d)*(note.big?1.13:1),bright=.40+.80*m;
    const vel=Math.min(1,Math.max(.02,velocity));
    const strength=vel*(sympathetic?.48:.82);
    const drift=(note.id*17%11-5)*.00023;
    const modes=[[1,.32,1.03],[2+drift,.37,.88],[3-drift,.17,.66],
      [1.006,.10,1.30],[4.06+.18*m,.048*bright,.28],[5.31+.39*m,.026*bright,.17]];
    const peak=strength*.34;
    let remaining=sympathetic?4:6;
    const cleanup=()=>{
      if(--remaining>0)return;
      voice.finished=true;
      try{voice.bus.disconnect();}catch(_){}
      const idx=this.voices.indexOf(voice);if(idx>=0)this.voices.splice(idx,1);
    };
    for(const [idx,[ratio,amp,dur]] of (sympathetic?modes.slice(0,4):modes).entries()){
      const osc=c.createOscillator(),g=c.createGain();
      const seconds=Math.max(.09,tail*dur*(sympathetic?.84:1));
      const rise=sympathetic?.046:(idx>=4?.0025:.0065+.002*m);
      const target=Math.max(.0001,peak*amp*(idx>=4?(.45+vel*.55):1));
      osc.type='sine';osc.frequency.setValueAtTime(hz*ratio,time);
      g.gain.setValueAtTime(.00001,time);
      g.gain.linearRampToValueAtTime(target,time+rise);
      g.gain.exponentialRampToValueAtTime(.000012,time+rise+seconds);
      osc.connect(g).connect(voice.bus);
      osc.onended=()=>{try{osc.disconnect();g.disconnect();}catch(_){}cleanup();};
      osc.start(time);osc.stop(time+rise+seconds+.012);
      voice.oscillators.push(osc);
    }
    if(!sympathetic){
      const src=c.createBufferSource();src.buffer=this.noise;
      const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=900+m*1600;
      const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2600+m*3700;
      const g=c.createGain();
      g.gain.setValueAtTime(.00001,time);g.gain.linearRampToValueAtTime(.036*vel*(.55+m*.8),time+.0015);
      g.gain.exponentialRampToValueAtTime(.00001,time+.016);
      src.connect(hp).connect(lp).connect(g).connect(voice.bus);
      src.onended=()=>{src.disconnect();hp.disconnect();lp.disconnect();g.disconnect();};
      src.start(time);src.stop(time+.02);
    }
  }
  strike(index,notes,velocity=1){
    if(!this.ctx||this.ctx.state!=='running')return false;
    const origin=notes[index];if(!origin)return false;
    this.tone(origin,velocity);
    const now=performance.now();origin.last=now;
    origin.energy=Math.min(1,origin.energy+velocity*.92);
    // 既存のBond: 距離に基づいて最大2個を打撃時に励起。
    const distances=notes.filter(n=>n.id!==index)
      .map(n=>({n,dist:Math.hypot(n.x-origin.x,n.y-origin.y)}))
      .sort((a,b)=>a.dist-b.dist);
    const reach=Math.max(85,Math.min(origin.stageW,origin.stageH)*.61);
    let sent=0;
    for(const {n,dist} of distances){
      if(sent>=2||dist>reach)break;
      const relation=1-dist/reach;
      const v=velocity*(.09+.19*relation)*(.25+this.bond);
      if(v<.045)continue;
      this.tone(n,v,true,.014+sent*.009);
      n.energy=Math.min(1,n.energy+v*.55);sent++;
    }
    return true;
  }
  suspend(){if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{});}
}
