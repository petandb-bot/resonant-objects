import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1];s=(root/'index.html').read_text()
needle='const engine=new ResonantEngine(msg=>say(msg)),renderer=new VisualRenderer(canvas,overlay,msg=>say(msg));'
assert needle in s
s=s.replace(needle,needle+'''window.__t={engine,state,renderer,getNotes:()=>notes,setCount,clearPointers,pointerMap};window.__hits=[];const original=engine.strike.bind(engine);engine.strike=(...a)=>{window.__hits.push(a[0]);return original(...a)};''')
async def run():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
  page=await b.new_page(viewport={'width':667,'height':375},is_mobile=True,has_touch=True)
  errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  await page.set_content(s);await page.wait_for_timeout(350)
  await page.evaluate('window.__t.engine.unlock()')
  async def coords(i=3):return await page.evaluate('''i=>{let n=window.__t.getNotes()[i],r=document.querySelector('#instrument').getBoundingClientRect();return {x:n.x+r.left,y:n.y+r.top,r:n.r}}''',i)
  async def ptr(ev,c,id):
   return await page.evaluate('''({ev,c,id})=>document.querySelector('#instrument').dispatchEvent(new PointerEvent(ev,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:id,clientX:c.x,clientY:c.y,buttons:ev==='pointerup'||ev==='pointercancel'?0:1}))''',{'ev':ev,'c':c,'id':id})
  c=await coords(3)
  # canceled center tap never plays
  await ptr('pointerdown',c,70);await ptr('pointercancel',c,70)
  assert await page.evaluate('window.__hits.length')==0
  # two distinct rim taps play twice; no phantom long hold after release
  await page.evaluate('window.__hits.length=0')
  c1=await coords(1);c2=await coords(4)
  c1['x']+=c1['r']*.8;c2['x']+=c2['r']*.8
  await ptr('pointerdown',c1,80);await ptr('pointerdown',c2,81)
  await ptr('pointerup',c1,80);await ptr('pointerup',c2,81)
  await page.wait_for_timeout(340)
  data=await page.evaluate('''()=>({hits:window.__hits.length,pointers:window.__t.pointerMap.size,holds:window.__t.engine.holds.size})''')
  print('multitouch',data);assert data['hits']==2 and data['pointers']==0 and data['holds']==0,data
  # moving scene while a center tap is down must never produce stale sound
  await page.evaluate('window.__hits.length=0')
  c=await coords(3);await ptr('pointerdown',c,90)
  await page.evaluate('window.__t.setCount(11)')
  await ptr('pointerup',c,90)
  await page.wait_for_timeout(150)
  z=await page.evaluate('''()=>({hits:window.__hits.length,pointers:window.__t.pointerMap.size,count:window.__t.getNotes().length})''')
  print('cancel scene',z);assert z['hits']==0 and z['pointers']==0 and z['count']==11,z
  await page.screenshot(path=str(root/'screen_compact_667.png'))
  print('errors',errs);assert not errs
  await b.close()
asyncio.run(run())
