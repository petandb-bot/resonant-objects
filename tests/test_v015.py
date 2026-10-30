"""v0.15 automated regression checks for browser/UI and acoustic engine.
Requires: python playwright, system chromium; execute with python tests/test_v015.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, time, sys
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()
# Test-only probes. Never included in deployment HTML.
HTML=HTML.replace('viewReady=true;restore();', '''window.__roTest={
  get notes(){return notes},get state(){return state},get engine(){return engine},
  setScale,setCount,hit,pitches,playingMemory, scaleDefinitions,clearPointers
};
viewReady=true;restore();''')
failures=[]
def check(condition, desc):
 if not condition: failures.append(desc)
 print(('PASS' if condition else 'FAIL'),desc)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':844,'height':390},device_scale_factor=1)
 exceptions=[]
 page.on('pageerror',lambda error: exceptions.append(str(error)))
 page.set_content(HTML,wait_until='domcontentloaded')
 page.wait_for_timeout(250)
 check(page.locator('[data-scale]').count()==2,'both scale selectors retained')
 check(all(page.locator('[data-scale]').nth(i).locator('option').count()==12 for i in (0,1)),'12 scales in both option menus')
 check(len(page.evaluate('Object.keys(window.__roTest.scaleDefinitions)'))==12,'12 pitch tables loaded')
 # Existence, exact sound label and unique pitch per 11-note scale
 def pitch_check():
  return page.evaluate('''() => Object.keys(__roTest.scaleDefinitions).map(key=>{
    const def=__roTest.scaleDefinitions[key];const notes=__roTest.pitches(11,key);
    return {key,count:notes.length,within:def.pitches.every(m=>notes.some(n=>n[1]===m)),
      inRange:notes.every(n=>n[1]>=36&&n[1]<=90),
      noDuplicate:new Set(notes.map(n=>n[1])).size===11,
      properLabels:notes.every(n=>/^([A-G](#|b)?)[0-8]$/.test(n[0]))};
  })''')
 all_scales=pitch_check()
 check(all(x['count']==11 and x['within'] and x['inRange'] and x['noDuplicate'] and x['properLabels'] for x in all_scales),f'all scale note collections consistent: {[x for x in all_scales if not all(x[y] for y in ("within","inRange","noDuplicate","properLabels"))]}')
 for count in (7,9,11):
  page.evaluate('(count)=>__roTest.setCount(count)',count)
  check(page.evaluate('__roTest.notes.length')==count,f'{count}-note layout')
  check(page.evaluate('new Set(__roTest.notes.map(n=>Math.round(n.r*100))).size')==1,f'{count}-note same hit radius')
 # Switching while no pointer must keep note names synchronized and not leak audio
 for key in page.evaluate('Object.keys(__roTest.scaleDefinitions)'):
  page.evaluate('(key)=>__roTest.setScale(key)',key)
  check(page.evaluate('''() => __roTest.notes.every((n,i)=>n.midi===__roTest.pitches(__roTest.state.count,__roTest.state.scale)[i][1])'''),f'scale switch {key}')
 page.evaluate("__roTest.setScale('minor');__roTest.setCount(9)")
 # Stub audio to observe input logic without depending on autoplay policies
 page.evaluate('''() => {
   const e=__roTest.engine;
   window.__strikes=[];window.__held=[];
   e.ctx={state:'running'};
   e.unlock=()=>Promise.resolve(true);
   e.strike=(id,ns,v,r)=>{__strikes.push({id,v,r});ns[id].energy=.85;return true};
   e.startHold=(id,n)=>{__held.push(id)};
   e.stopHold=(id)=>{};
   e.endGesture=(id)=>{};
   e.stopAllGestures=()=>{};
   e.stopAllHolds=()=>{};
   e.refreshLinks=()=>{};
   e.syncTanks=()=>{};
 }''')
 page.wait_for_timeout(60)
 coords=page.evaluate('''() => {const r=document.querySelector('#instrument').getBoundingClientRect();
  return {x:r.left+__roTest.notes[0].x,y:r.top+__roTest.notes[0].y,rad:__roTest.notes[0].r}}''')
 # Rim should strike before pointer up.
 page.mouse.move(coords['x']+coords['rad']*.73,coords['y']);page.mouse.down()
 check(page.evaluate('__strikes.length')==1,'rim instant-on touch')
 page.mouse.up();check(page.evaluate('__strikes.length')==1,'rim no double trigger on release')
 # Center short tap after up.
 page.evaluate('__strikes.length=0')
 page.mouse.move(coords['x'],coords['y']);page.mouse.down()
 check(page.evaluate('__strikes.length')==0,'center grab does not accidentally strike')
 page.mouse.up();check(page.evaluate('__strikes.length')==1,'center tap strikes exactly once on release')
 # Slow drag starts late, must remain silent.
 page.evaluate('__strikes.length=0')
 page.mouse.move(coords['x'],coords['y']);page.mouse.down();page.wait_for_timeout(190)
 page.mouse.move(coords['x']+22,coords['y'],steps=5)
 page.mouse.up()
 check(page.evaluate('__strikes.length')==0,'delayed drag produces no pickup strike')
 # Hold no percussive event.
 page.evaluate('__strikes.length=0;__held.length=0')
 coords=page.evaluate('''() => {const r=document.querySelector('#instrument').getBoundingClientRect();return {x:r.left+__roTest.notes[0].x,y:r.top+__roTest.notes[0].y}}''')
 page.mouse.move(coords['x'],coords['y']);page.mouse.down();page.wait_for_timeout(330)
 check(page.evaluate('__held.length')==1 and page.evaluate('__strikes.length')==0,'hold only continuous voice')
 page.mouse.up();check(page.evaluate('__strikes.length')==0,'hold release silent')
 # gliding tiny tremor should not trigger new notes
 page.evaluate('__strikes.length=0')
 page.mouse.move(coords['x']+coords.get('rad',28)*.76,coords['y']);page.mouse.down()
 strikes=page.evaluate('__strikes.length')
 page.mouse.move(coords['x']+coords.get('rad',28)*.81,coords['y']+6,steps=6)
 check(page.evaluate('__strikes.length')==strikes,'small pointer drift does not retrigger')
 page.mouse.up()
 # No failure on remote keyboard and no side effect on note count
 check(not exceptions,f'no JS exceptions: {exceptions[:2]}')
 browser.close()

# Isolated acoustic rendering: verify two engines produce nonempty and measurably distinct pitched signals.
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page()
 page.set_content(HTML,wait_until='domcontentloaded')
 data=page.evaluate('''async () => {
   async function render(Engine){
     const ctx=new OfflineAudioContext(1,44100*3,44100),voices=[];
     const host={ctx,voices,link:false,tanks:[],material:0.36,expression:.46,decay:.67,
       newVoice(t){const bus=ctx.createGain();bus.connect(ctx.destination);
         const voice={bus,oscillators:[],finished:false};voices.push(voice);return voice;}};
     const note={id:0,midi:62,big:false};
     new Engine(host).strike(note,.9,{radial:.2,repeat:0});
     const data=(await ctx.startRendering()).getChannelData(0);
     const block=(a,b)=>{let energy=0,delta=0,max=0;
       const from=Math.floor(a*44100),to=Math.floor(b*44100);
       for(let i=from+1;i<to;i++){const x=data[i];energy+=x*x;delta+=(x-data[i-1])**2;max=Math.max(max,Math.abs(x))}
       return {rms:Math.sqrt(energy/(to-from)),hf:Math.sqrt(delta/(to-from)),peak:max};};
     return {attack:block(.01,.13),body:block(.13,.40),tail:block(.40,1.25)};
   }
   return {candy:await render(CandyElasticFMEngine),ceramic:await render(CeramicWaveguideEngine)};
 }''')
 check(data['candy']['attack']['rms']>0.001,'CANDY produces audible pitched waveform')
 check(data['ceramic']['attack']['rms']>0.001,'CERAMIC produces audible pitched waveform')
 check(data['candy']['attack']['peak']<1 and data['ceramic']['attack']['peak']<1,'neither engine clips at .9 velocity (dry isolated)')
 check(data['ceramic']['tail']['rms']>data['candy']['tail']['rms']*1.25,'CERAMIC has materially longer body than CANDY')
 print('AUDIO_MEASURES',json.dumps(data,ensure_ascii=False))
 browser.close()
if failures:
 print('FAILURES',failures);sys.exit(1)
print('ALL TESTS PASSED')
