from playwright.sync_api import sync_playwright
from pathlib import Path
import json
path=Path('/mnt/data/resonant_objects_v0_19/index.html')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
 for width,height in [(844,390),(667,375),(1280,720)]:
  page=b.new_page(viewport={'width':width,'height':height})
  errs=[]; logs=[]
  page.on('pageerror',lambda e:errs.append(str(e)))
  page.on('console',lambda msg:logs.append(msg.text) if msg.type=='error' else None)
  page.set_content(path.read_text(),wait_until='domcontentloaded')
  page.wait_for_timeout(450)
  page.screenshot(path=f'/mnt/data/resonant_objects_v0_19/preview_{width}.png')
  page.locator('#tuneBtn').click()
  page.wait_for_timeout(80)
  page.screenshot(path=f'/mnt/data/resonant_objects_v0_19/settings_{width}.png')
  for mode in ['echo','drift','transfer','off']:
   page.locator(f'[data-delay-choice="{mode}"]').click()
   assert page.locator(f'[data-delay-choice="{mode}"]').get_attribute('aria-pressed')=='true'
  page.locator('[data-param="delayAmount"]').last.fill('63')
  page.locator('[data-delay-choice="transfer"]').click()
  page.locator('[data-settings-tab="play"]').click()
  page.locator('[data-settings-tab="visual"]').click()
  page.locator('[data-settings-tab="manage"]').click()
  page.locator('[data-settings-tab="sound"]').click()
  page.locator('[data-resonator-layout]').last.click()
  page.locator('#closeTune').click()
  # Simulate pointer play and drag (audio context may be suspended in headless)
  rect=page.locator('#instrument').bounding_box()
  if rect:
   page.mouse.click(rect['x']+rect['width']*.5+26,rect['y']+rect['height']*.5)
  page.wait_for_timeout(120)
  print(json.dumps({'viewport':f'{width}x{height}','errors':errs,'console_errors':logs[:5],'gpu':page.locator('#gpuMode').inner_text() if page.locator('#gpuMode').count() else None,'status':page.locator('#status').inner_text()},ensure_ascii=False))
  page.close()
 b.close()
