from pathlib import Path
from playwright.sync_api import sync_playwright
s=Path('/mnt/data/resonant_objects_v0_19/index.html').read_text()
with sync_playwright() as w:
 b=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width,height in [(844,390),(667,375)]:
  page=b.new_page(viewport={'width':width,'height':height})
  page.set_content(s)
  page.locator('#tuneBtn').click()
  target=page.locator('[data-delay-choice="transfer"]')
  target.scroll_into_view_if_needed()
  target.click()
  page.wait_for_timeout(120)
  page.screenshot(path=f'/mnt/data/resonant_objects_v0_19/settings_delay_{width}.png')
  page.close()
 b.close()
