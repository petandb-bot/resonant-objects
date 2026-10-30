from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
# For proper WebGL playback snapshot, without changing distributed file
with sync_playwright() as p:
 b=p.chromium.launch(headless=False,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 page=b.new_page(viewport={'width':844,'height':390},device_scale_factor=1)
 page.set_content(html,wait_until='domcontentloaded')
 page.wait_for_timeout(250)
 canvas=page.locator('#instrument').bounding_box()
 # center note at x=W/2 and y=H/2, rim on right
 x=canvas['x']+canvas['width']/2+27;y=canvas['y']+canvas['height']/2
 page.mouse.move(x,y)
 page.mouse.down();page.wait_for_timeout(130)
 print('GPU',page.locator('#gpuMode').inner_text())
 page.screenshot(path=str(root/'screen_touch_844.png'))
 page.mouse.up()
 b.close()
