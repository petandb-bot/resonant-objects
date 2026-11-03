from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re
p=Path('/mnt/data/resonant_objects_v0_19/index.html')
s=p.read_text()
needle='viewReady=true;restore();selectReverb(state.reverbType,false);'
assert s.count(needle)==1
s=s.replace(needle,'window.__RO_TEST__={engine,notes:()=>notes,connected,tie,selectDelay,setParam,setScale,setMaterialType,setCount,setResonatorLayout,save,restore,state,params};'+needle)
with sync_playwright() as w:
 b=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':844,'height':390})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(s,wait_until='domcontentloaded')
 results=page.evaluate('''async()=>{
  const x=window.__RO_TEST__,e=x.engine;
  const unlocked=await e.unlock();
  e.syncTanks(x.notes());
  const initial={unlocked,ctx:e.ctx.state,tanks:e.tanks.length,delayTaps:e.delayTaps.length,connections:e.connections.length};
  x.selectDelay('echo');x.setParam('delayAmount',58);
  const echo={send:e.delaySend.gain.value,feedback:e.delayTaps[0].feedback.gain.value};
  x.selectDelay('drift');const drift={type:e.delayType,taps:e.delayTaps.length};
  x.selectDelay('transfer');x.tie(0,1);
  const transfer={paths:e.transferPaths.size,connections:e.connections.length};
  e.strike(0,x.notes(),.8,.3);
  x.selectDelay('off');const off={paths:e.transferPaths.size,type:e.delayType};
  x.setResonatorLayout();x.selectDelay('transfer');x.tie(0,1);
  const resonant={tanks:e.tanks.length,paths:e.transferPaths.size};
  x.setScale('lydian');x.setMaterialType(2);
  const after={tanks:e.tanks.length,paths:e.transferPaths.size,scale:x.state.scale,material:x.state.materialType};
  x.setCount(9);const nine={tanks:e.tanks.length,paths:e.transferPaths.size};
  return {initial,echo,drift,transfer,off,resonant,after,nine};
 }''')
 print(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2))
 assert not errors
 assert results['initial']['unlocked'] and results['initial']['tanks']==9
 assert results['transfer']['paths']==2
 assert results['off']['paths']==0
 assert results['resonant']['tanks']==11
 assert results['after']['tanks']==11
 assert results['nine']['tanks']==9
 b.close()
