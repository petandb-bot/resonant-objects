from pathlib import Path
from playwright.sync_api import sync_playwright
import wave,base64
root=Path('/mnt/data/resonant_objects_v0_20');html=(root/'index.html').read_text()
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page();page.set_content(html)
 for instrument in ['candy','ceramic']:
  raw=page.evaluate('''async(kind)=>{
   const sr=44100,ctx=new OfflineAudioContext(1,sr*2,sr);
   const host={ctx,voices:[],link:false,tanks:[],connections:[],material:.36,expression:.46,decay:.67,bond:.75,
     routeConnectedVoice(){},newVoice(t){const bus=ctx.createGain();bus.connect(ctx.destination);
      const v={bus,oscillators:[],finished:false};this.voices.push(v);return v;}};
   (kind==='candy'?new CandyElasticFMEngine(host):new CeramicWaveguideEngine(host)).strike({id:0,midi:60,big:false,waveLayer:false},.82);
   const rendered=(await ctx.startRendering()).getChannelData(0);
   const pcm=new Int16Array(rendered.length);
   for(let i=0;i<rendered.length;i++)pcm[i]=Math.round(Math.max(-1,Math.min(1,rendered[i]))*32767);
   const bytes=new Uint8Array(pcm.buffer);let str='';
   for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));
   return btoa(str);
  }''',instrument)
  pcm=base64.b64decode(raw)
  path=root/f'{instrument}_c4_dry_v020.wav'
  with wave.open(str(path),'wb') as w:
   w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100);w.writeframes(pcm)
  print(path.name,path.stat().st_size)
 b.close()
