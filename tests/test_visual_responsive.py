import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1]
s=(root/'index.html').read_text()
needle='const engine=new ResonantEngine(msg=>say(msg)),renderer=new VisualRenderer(canvas,overlay,msg=>say(msg));'
assert needle in s
s=s.replace(needle,needle+'window.__roTest={engine,state,renderer,getNotes:()=>notes,tie,connected,play,setCount,clearPointers};')
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(headless=False,executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
  for viewport,tag in [({'width':844,'height':390},'844'),({'width':667,'height':375},'667'),({'width':1280,'height':720},'1280')]:
   page=await b.new_page(viewport=viewport,device_scale_factor=1)
   errors=[];page.on('pageerror',lambda x:errors.append(str(x)))
   await page.set_content(s,wait_until='domcontentloaded');await page.wait_for_timeout(350)
   mode=await page.evaluate('window.__roTest.renderer.mode')
   assert mode=='webgl2',mode
   h=await page.evaluate("({stage:document.getElementById('stage').clientHeight,body:document.body.scrollWidth,viewport:innerWidth,toolbar:document.querySelector('.top').clientHeight})")
   print(tag,mode,h)
   assert h['stage']>250 and h['body']<=h['viewport']+1,h
   await page.evaluate('window.__roTest.setCount(11)')
   await page.wait_for_timeout(80)
   assert await page.evaluate('window.__roTest.getNotes().length')==11
   await page.evaluate('window.__roTest.setCount(9)')
   for m in range(5):
    await page.locator(f'.material-strip [data-material-type="{m}"]').click()
    await page.wait_for_timeout(30)
   await page.locator('.material-strip [data-material-type="0"]').click()
   await page.evaluate('''()=>{const t=window.__roTest;t.tie(2,3);t.play(2,.8)}''')
   await page.wait_for_timeout(140)
   await page.screenshot(path=str(root/f'screen_webgl_{tag}_connected.png'))
   await page.locator('#tuneBtn').click()
   assert await page.locator('#drawer').evaluate("el=>getComputedStyle(el).display")=='block'
   await page.screenshot(path=str(root/f'screen_settings_{tag}.png'))
   await page.locator('#closeTune').click()
   assert not errors,errors
   await page.close()
  await b.close()
asyncio.run(main())
