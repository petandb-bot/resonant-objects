import asyncio, json, re
from pathlib import Path
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'index.html').read_text()
needle='const engine=new ResonantEngine(msg=>say(msg)),renderer=new VisualRenderer(canvas,overlay,msg=>say(msg));'
assert needle in source
source=source.replace(needle,needle+'''window.__roTest={engine,state,renderer,getNotes:()=>notes,tie,connected,play,pointerMap,setCount,clearPointers};
window.__strikeEvents=[];let originalStrike=engine.strike.bind(engine);engine.strike=(...args)=>{window.__strikeEvents.push({id:args[0],at:performance.now(),len:args[1].length});return originalStrike(...args);};
window.__holdEvents=[];let origStart=engine.startHold.bind(engine);engine.startHold=(...args)=>{window.__holdEvents.push({action:'start',id:args[0]});return origStart(...args);};
let origStop=engine.stopHold.bind(engine);engine.stopHold=(...args)=>{window.__holdEvents.push({action:'stop',id:args[0]});return origStop(...args);};
''')
async def run():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
  page=await browser.new_page(viewport={'width':844,'height':390},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(source,wait_until='domcontentloaded')
  await page.wait_for_timeout(500)
  print('Renderer',await page.evaluate('window.__roTest.renderer.mode'))
  print('Audio',await page.evaluate('window.__roTest.engine.ctx?.state || "not created"'))
  # start up audio in realistic user-gesture simulation
  await page.evaluate('window.__roTest.engine.unlock()')
  async def note_center(index=4):
   return await page.evaluate('''(i)=>{const n=window.__roTest.getNotes()[i],r=document.querySelector('#instrument').getBoundingClientRect();return {x:r.left+n.x,y:r.top+n.y,r:n.r}}''',index)
  async def pointer(event,x,y,pid=71):
   await page.evaluate('''({event,x,y,pid})=>{const can=document.querySelector('#instrument');const e=new PointerEvent(event,{bubbles:true,cancelable:true,pointerId:pid,isPrimary:true,pointerType:'touch',clientX:x,clientY:y,button:0,buttons:event==='pointerup'?0:1});can.dispatchEvent(e)}''',{'event':event,'x':x,'y':y,'pid':pid})
  async def clearLog():
   await page.evaluate('window.__strikeEvents.length=0;window.__holdEvents.length=0')
  async def log():
   return await page.evaluate('''()=>({hits:window.__strikeEvents.length,ids:window.__strikeEvents.map(x=>x.id),held:window.__holdEvents,activePointers:window.__roTest.pointerMap.size})''')
  n=await note_center();print('Target',n)
  # 1: rim is immediate
  await clearLog()
  await pointer('pointerdown',n['x']+n['r']*.72,n['y'],1)
  await page.wait_for_timeout(60)
  d=await log();print('rim down',d);assert d['hits']==1,d
  await pointer('pointerup',n['x']+n['r']*.72,n['y'],1)
  d=await log();assert d['hits']==1 and d['activePointers']==0,d
  # 2: core short tap: no sound on down; one on release, not 85ms after down
  await clearLog()
  await pointer('pointerdown',n['x'],n['y'],2)
  await page.wait_for_timeout(130)
  d=await log();print('core holding pre-threshold',d);assert d['hits']==0,d
  await pointer('pointerup',n['x'],n['y'],2)
  await page.wait_for_timeout(30)
  d=await log();print('core tap',d);assert d['hits']==1 and d['activePointers']==0,d
  # 3: slow grab (>85ms), then move: NO grab strike
  await clearLog()
  await pointer('pointerdown',n['x'],n['y'],3)
  await page.wait_for_timeout(155)
  await pointer('pointermove',n['x']+34,n['y']+3,3)
  await pointer('pointermove',n['x']+46,n['y']+4,3)
  await pointer('pointerup',n['x']+46,n['y']+4,3)
  d=await log();print('slow drag',d);assert d['hits']==0 and d['activePointers']==0,d
  # 4: long hold from core: sustained sound but NO plucked strike
  await clearLog();n=await note_center()
  await pointer('pointerdown',n['x'],n['y'],4)
  await page.wait_for_timeout(350)
  d=await log();print('hold',d);assert d['hits']==0 and any(x['action']=='start' for x in d['held']),d
  await pointer('pointerup',n['x'],n['y'],4)
  d=await log();assert d['hits']==0 and d['activePointers']==0,d
  # 5: rim glides to other notes while never dragging objects
  await clearLog();n=await note_center(1)
  await pointer('pointerdown',n['x']+n['r']*.75,n['y'],5)
  await pointer('pointermove',n['x']+n['r']*.75,n['y']+23,5)
  await pointer('pointerup',n['x']+n['r']*.75,n['y']+23,5)
  d=await log();print('rim glide',d);assert d['hits']>=1 and d['activePointers']==0,d
  # 6: LOCK center must strike immediately (cannot drag)
  await page.evaluate('window.__roTest.state.locked=true')
  await clearLog();n=await note_center()
  await pointer('pointerdown',n['x'],n['y'],6)
  d=await log();print('locked center',d);assert d['hits']==1,d
  await pointer('pointerup',n['x'],n['y'],6)
  await page.evaluate('window.__roTest.state.locked=false')
  # 7: 7,9,11 same diameter, 5 material engines and WAVE overlay behavior preserved
  radii={}
  for count in [7,9,11]:
   await page.evaluate('(n)=>window.__roTest.setCount(n)',count)
   radii[count]=await page.evaluate('''()=>[...new Set(window.__roTest.getNotes().map(n=>n.r))]''')
   assert len(radii[count])==1
  print('radii',radii);assert radii[7]==radii[9]==radii[11],radii
  await page.evaluate('window.__roTest.setCount(9)')
  for m in range(5):
   await page.locator(f'.material-strip [data-material-type="{m}"]').click()
   await page.wait_for_timeout(45)
   z=await page.evaluate('''()=>({type:window.__roTest.state.materialType,engines:window.__roTest.getNotes().map(n=>window.__roTest.engine.soundType(n)),veil:window.__roTest.getNotes().filter(n=>n.waveLayer).length})''')
   assert z['type']==m and set(z['engines'])=={m} and z['veil']==(0 if m==4 else 2),z
  await page.locator('.material-strip [data-material-type="0"]').click()
  await page.wait_for_timeout(150)
  await page.screenshot(path=str(root/'screen_844.png'))
  assert not errors,errors
  print('errors',errors)
  await browser.close()
asyncio.run(run())
