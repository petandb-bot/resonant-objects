from pathlib import Path
from playwright.sync_api import sync_playwright
import json, math
html=Path('/mnt/data/resonant_objects_v0_20/index.html').read_text()
results={}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required'])
 for width,height in [(844,390),(667,375),(1280,720)]:
  page=browser.new_page(viewport={'width':width,'height':height})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='load')
  page.wait_for_timeout(220)
  page.locator('#tuneBtn').click()
  page.locator('[data-delay-choice="echo"]').click()
  page.locator('[data-param="delayAmount"]').evaluate('(e) => {e.value="42";e.dispatchEvent(new Event("input",{bubbles:true}))}')
  page.locator('[data-delay-choice="drift"]').click()
  page.locator('[data-delay-choice="transfer"]').click()
  page.locator('[data-settings-tab="play"]').click()
  page.locator('[data-settings-tab="visual"]').click()
  page.locator('[data-settings-tab="sound"]').click()
  page.locator('[data-delay-choice="off"]').click()
  page.locator('#closeTune').click()
  page.locator('[data-material-type="1"]').first.click()
  page.locator('[data-material-type="2"]').first.click()
  # force a centre tap in the visual field; exercises delayed unlock and strike.
  point=page.evaluate('''() => { const c=document.querySelector('canvas');const r=c.getBoundingClientRect();return {x:r.left+r.width*.47,y:r.top+r.height*.55} }''')
  page.mouse.click(point['x'],point['y'])
  page.wait_for_timeout(160)
  results[f'ui_{width}x{height}']={'exception_count':len(errors),'errors':errors[:3],'renderer':page.locator('#gpuMode').inner_text(),'echo_buttons':page.locator('[data-delay-choice="off"][aria-pressed="true"]').count()}
  if width==844:
   page.screenshot(path='/mnt/data/resonant_objects_v0_20/preview_844.png')
   page.locator('#tuneBtn').click()
   page.locator('[data-delay-choice="echo"]').click()
   page.screenshot(path='/mnt/data/resonant_objects_v0_20/settings_844.png')
  page.close()

 page=browser.new_page()
 page.set_content(html,wait_until='load')
 page.wait_for_timeout(200)
 # Audio synth measurement, rendered digitally (no microphone/speakers).
 synth=page.evaluate('''async () => {
  const sr=48000;const result={};
  const sample=async (kind)=>{
   const ctx=new OfflineAudioContext(1,sr*3,sr);
   const host={ctx,voices:[],link:false,tanks:[],connections:[],
    material:.36,expression:.46,decay:.67,bond:.75,routeConnectedVoice() {},
    newVoice(t){const bus=ctx.createGain();bus.gain.value=1;bus.connect(ctx.destination);
      const voice={bus,oscillators:[],finished:false};this.voices.push(voice);return voice;}};
   const note={id:0,midi:60,big:false,waveLayer:false};
   new (kind==='candy'?CandyElasticFMEngine:CeramicWaveguideEngine)(host).strike(note,.82);
   const b=await ctx.startRendering(),a=b.getChannelData(0);
   const feature=(from,to)=>{let sum=0,peak=0,z=0;const i0=Math.floor(from*sr),i1=Math.floor(to*sr);
    for(let i=i0;i<i1;i++){const v=a[i];sum+=v*v;peak=Math.max(peak,Math.abs(v));if(i>i0&&((v>=0)!==(a[i-1]>=0)))z++}
    return {rms:Math.sqrt(sum/(i1-i0)),peak,zero_crossing_per_sec:z/(to-from)};};
   const windows=[feature(.012,.09),feature(.10,.30),feature(.35,.65),feature(.8,1.4)];
   let peak=0;for(const v of a)peak=Math.max(peak,Math.abs(v));
   return {peak,windows};
  };
  result.candy=await sample('candy');result.ceramic=await sample('ceramic');return result;
 }''')
 results['audio_synth_offline']=synth
 # Delay note test with actual engine routing, bypass voice state guard by scheduling oscillator directly.
 delay=page.evaluate('''async () => {
   const sr=48000;const result={};
   const render=async (type, amount=24)=>{
    const ctx=new OfflineAudioContext(1,sr*2,sr);
    // Acoustic engine can be connected to an OfflineAudioContext by substituting
    // the constructor; the rendered output is the real WebAudio node graph.
    const original=window.AudioContext,oldWebkit=window.webkitAudioContext;
    window.AudioContext=function(){return ctx};window.webkitAudioContext=undefined;
    const h=new ResonantEngine();h.init();h.setDelayType(type);h.setDelayAmount(amount);
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.value=330;g.gain.setValueAtTime(0,0);g.gain.linearRampToValueAtTime(.28,.01);
    g.gain.setValueAtTime(.28,.048);g.gain.exponentialRampToValueAtTime(.00001,.085);
    o.connect(g).connect(h.voiceBus);o.start(0);o.stop(.09);
    const audio=(await ctx.startRendering()).getChannelData(0);
    window.AudioContext=original;window.webkitAudioContext=oldWebkit;
    const energy=(from,to)=>{let sum=0;for(let i=from*sr|0;i<to*sr;i++)sum+=audio[i]*audio[i];return Math.sqrt(sum/((to-from)*sr));};
    const peak=Math.max(...audio.slice(0,500));
    return {early:energy(.015,.085),echoWindow:energy(.22,.52),late:energy(.55,.85),peak};
   };
   result.off=await render('off');result.echo=await render('echo');result.drift=await render('drift');return result;
 }''')
 results['audio_delay_offline']=delay
 # Connection test: compare same note with and without explicitly linked neighbor
 connect=page.evaluate('''async () => {
  const sr=48000;const result={};
  const run=async(linked,delay)=>{
   const ctx=new OfflineAudioContext(1,sr*2,sr),orig=window.AudioContext,webkit=window.webkitAudioContext;
   window.AudioContext=function(){return ctx};window.webkitAudioContext=undefined;
   const engine=new ResonantEngine();engine.init();engine.setBloom(0);engine.setSpace(0);
   const notes=[{id:0,midi:55,big:false,x:100,y:100,stageW:600,stageH:350},
    {id:1,midi:62,big:false,x:340,y:130,stageW:600,stageH:350}];
   engine.syncTanks(notes);
   engine.setConnections(linked?[{a:0,b:1}]:[]);
   engine.setDelayType(delay);
   engine.setDelayAmount(45);
   engine.synths[0].strike(notes[0],.85);
   const output=(await ctx.startRendering()).getChannelData(0);
   window.AudioContext=orig;window.webkitAudioContext=webkit;
   const energy=(a,b)=>{let sum=0;for(let i=a*sr|0;i<b*sr;i++)sum+=output[i]**2;return Math.sqrt(sum/(sr*(b-a)));};
   return {start:energy(.01,.12),mid:energy(.12,.50),tail:energy(.50,1.0)};
  };
  result.unconnected=await run(false,'off');result.connected=await run(true,'off');result.transfer=await run(true,'transfer');return result;
 }''')
 results['audio_connect_offline']=connect
 page.close();browser.close()
Path('/mnt/data/resonant_objects_v0_20/TEST_RESULTS.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
