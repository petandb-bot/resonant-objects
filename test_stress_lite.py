from pathlib import Path
from playwright.sync_api import sync_playwright
import json
html=Path('/mnt/data/resonant_objects_v0_20/index.html').read_text()
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 p=b.new_page();p.set_content(html)
 result=p.evaluate('''async () => {
  const sr=44100;
  async function run(material,links,mode){
   const ctx=new OfflineAudioContext(1,sr*1.8,sr),A=window.AudioContext,W=window.webkitAudioContext;
   window.AudioContext=function(){return ctx};window.webkitAudioContext=undefined;
   const e=new ResonantEngine();e.init();e.setMaterialType(material);e.setBond(100);e.setSpace(0);e.setReverbType('prism');e.setDelayType(mode);e.setDelayAmount(100);
   const midi=[48,55,60];
   const notes=midi.map((n,i)=>({id:i,midi:n,big:i===0,x:90+(i%3)*145,y:80+Math.floor(i/3)*110,stageW:640,stageH:370}));
   e.syncTanks(notes);e.setConnections(links?[[0,1],[1,2]].map(([a,b])=>({a,b})):[]);
   for(let i=0;i<6;i++)e.synths[material].strike(notes[i%notes.length],.95,{delay:i*.080,radial:.4});
   const a=(await ctx.startRendering()).getChannelData(0);
   window.AudioContext=A;window.webkitAudioContext=W;
   let peak=0,sumsq=0,nonfinite=0,large=0,maxDelta=0,prev=0;
   for(let i=0;i<a.length;i++){const v=a[i];if(!Number.isFinite(v)){nonfinite++;continue;}peak=Math.max(peak,Math.abs(v));sumsq+=v*v;if(Math.abs(v)>=1)large++;maxDelta=Math.max(maxDelta,Math.abs(v-prev));prev=v;}
   return {peak,rms:Math.sqrt(sumsq/a.length),nonfinite,samples_ge_1:large,max_adjacent_delta:maxDelta};
  }
  return {candy_transfer:await run(1,true,'transfer'),ceramic_transfer:await run(2,true,'transfer')};
 }''')
 print(json.dumps(result,indent=2))
 Path('/mnt/data/resonant_objects_v0_20/STRESS_RESULTS.json').write_text(json.dumps(result,indent=2))
 p.close();b.close()
