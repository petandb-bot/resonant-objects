from playwright.sync_api import sync_playwright
from pathlib import Path
import os
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
with sync_playwright() as p:
 b=p.chromium.launch(headless=False,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox'])
 for width,height,name in [(844,390,'844'),(667,375,'667')]:
  page=b.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='domcontentloaded')
  page.wait_for_timeout(500)
  print(name,'gpu',page.locator('#gpuMode').inner_text(),errors)
  page.screenshot(path=str(root/f'screen_{name}.png'))
  btn=page.locator('#tuneBtn')
  btn.click()
  page.wait_for_timeout(180)
  selects=page.locator('[data-scale]');print('OPTIONS',selects.count(),[x.is_visible() for x in selects.all()])
  # screenshot full window with open menu
  page.screenshot(path=str(root/f'screen_tune_{name}.png'))
  page.close()
 b.close()
