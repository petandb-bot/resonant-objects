"""Render CANDY / CERAMIC through the actual independent Web Audio engines."""
from pathlib import Path
import wave, base64
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page();page.set_content(html,wait_until='domcontentloaded')
 samples=page.evaluate('''async () => {
   const encoded={};
   for(const [name,Engine] of [['candy',CandyElasticFMEngine],['ceramic',CeramicWaveguideEngine]]){
     const sr=44100,ctx=new OfflineAudioContext(1,sr*2,sr),voices=[];
     const host={ctx,voices,link:false,tanks:[],material:.36,expression:.46,decay:.67,
      newVoice(t){const bus=ctx.createGain();bus.connect(ctx.destination);
       const voice={bus,oscillators:[],finished:false};voices.push(voice);return voice;}};
     const note={id:0,midi:62,big:false};
     new Engine(host).strike(note,.90,{radial:.30,repeat:0});
     const buffer=await ctx.startRendering(),audio=buffer.getChannelData(0);
     const bytes=new Uint8Array(audio.length*2),v=new DataView(bytes.buffer);
     for(let i=0;i<audio.length;i++)v.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,audio[i]))*32767),true);
     let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));
     encoded[name]=btoa(str);
   }
   return encoded;
 }''')
 b.close()
 for name,b64 in samples.items():
  data=base64.b64decode(b64)
  path=root/f'{name}_D4_v015.wav'
  with wave.open(str(path),'wb') as w:
   w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100);w.writeframes(data)
  print(path,path.stat().st_size)
