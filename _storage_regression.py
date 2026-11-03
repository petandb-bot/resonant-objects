from playwright.sync_api import sync_playwright
from pathlib import Path
import json
s=Path('/mnt/data/resonant_objects_v0_19/index.html').read_text()
with sync_playwright() as w:
 b=w.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':844,'height':390})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.evaluate('''()=>{window.__store={};Object.defineProperty(window,'localStorage',{configurable:true,value:{setItem:(k,v)=>window.__store[k]=v,getItem:k=>window.__store[k]||null}});}''')
 page.set_content(s,wait_until='domcontentloaded')
 page.locator('#tuneBtn').click()
 page.locator('[data-delay-choice="transfer"]').click()
 page.locator('[data-param="delayAmount"]').last.fill('73')
 page.locator('[data-settings-tab="manage"]').click()
 page.locator('#miniSave').click()
 data=page.evaluate("JSON.parse(localStorage.getItem('resonant-objects-v012'))")
 assert data['delayType']=='transfer' and data['params']['delayAmount']==73
 # Recreate the document in a new page with the saved localStorage snapshot.
 saved=page.evaluate('window.__store')
 page2=b.new_page(viewport={'width':844,'height':390})
 page2.on('pageerror',lambda e:errors.append(str(e)))
 page2.evaluate('''(stored)=>{window.__store=stored;Object.defineProperty(window,'localStorage',{configurable:true,value:{setItem:(k,v)=>window.__store[k]=v,getItem:k=>window.__store[k]||null}});}''',saved)
 page2.set_content(s,wait_until='domcontentloaded')
 page2.locator('#tuneBtn').click()
 assert page2.locator('[data-delay-choice="transfer"]').get_attribute('aria-pressed')=='true'
 assert page2.locator('[data-param="delayAmount"]').last.input_value()=='73'
 print(json.dumps({'savedDelayType':data['delayType'],'savedAmount':data['params']['delayAmount'],'reinitialize':'PASS','errors':errors},ensure_ascii=False))
 assert not errors
 b.close()
