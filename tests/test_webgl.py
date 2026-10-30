import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1];html=(root/'index.html').read_text()
needle='const engine=new ResonantEngine(msg=>say(msg)),renderer=new VisualRenderer(canvas,overlay,msg=>say(msg));'
assert needle in html
html=html.replace(needle,needle+'window.__roTest={engine,state,renderer,getNotes:()=>notes,tie,connected,play,setCount,clearPointers};')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=False,executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
  page=await browser.new_page(viewport={'width':844,'height':390},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
  await page.set_content(html,wait_until='domcontentloaded');await page.wait_for_timeout(500)
  mode=await page.evaluate('window.__roTest.renderer.mode');print('Renderer',mode);assert mode.startswith('webgl'),mode
  await page.evaluate('window.__roTest.engine.unlock()')
  for count in [7,11,9]:
   await page.evaluate('(n)=>window.__roTest.setCount(n)',count)
   await page.wait_for_timeout(90)
   assert (await page.evaluate('window.__roTest.renderer.mode')).startswith('webgl')
  for m in range(5):
   await page.locator(f'.material-strip [data-material-type="{m}"]').click()
   await page.wait_for_timeout(75)
  await page.locator('.material-strip [data-material-type="0"]').click()
  await page.evaluate('''()=>{const t=window.__roTest;t.tie(2,3);t.play(2,.9)}''')
  await page.wait_for_timeout(140)
  print('links',await page.evaluate('window.__roTest.connected().length'))
  await page.screenshot(path=str(root/'screen_webgl_844.png'))
  print('errors',errors);assert not errors
  await browser.close()
asyncio.run(main())
