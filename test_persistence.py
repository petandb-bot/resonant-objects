from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path('/mnt/data/resonant_objects_v0_20')
html=(root/'index.html').read_text()
def inject(page,seed=None):
 page.goto('about:blank')
 page.evaluate('''(seed)=>{
   const mem={...seed};window.__memory=mem;
   Object.defineProperty(window,'localStorage',{configurable:true,value:{
     getItem(k){return Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null},
     setItem(k,v){mem[k]=String(v)},removeItem(k){delete mem[k]}
   }});
 }''',seed or {})
 page.set_content(html,wait_until='load')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':844,'height':390});inject(page)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.locator('[data-resonator-layout]').first.click()
 page.locator('#tuneBtn').click()
 page.locator('[data-delay-choice="transfer"]').click()
 page.locator('[data-param="delayAmount"]').evaluate('(e)=>{e.value="61";e.dispatchEvent(new Event("input",{bubbles:true}))}')
 page.locator('[data-settings-tab="manage"]').click()
 page.locator('#miniSave').click()
 data=page.evaluate('window.__memory')
 config=json.loads(data['resonant-objects-v012'])
 assert config['resonatorMode'] and config['delayType']=='transfer' and config['params']['delayAmount']==61
 page2=b.new_page(viewport={'width':844,'height':390});inject(page2,data)
 page2.wait_for_timeout(140)
 result={'saved':True,
 '9plus2_restored':page2.locator('[data-resonator-layout][aria-pressed="true"]').count()>0,
 'transfer_restored':page2.locator('[data-delay-choice="transfer"][aria-pressed="true"]').count()==1,
 'amount_restored':page2.locator('[data-param="delayAmount"]').first.input_value(),
 'errors':errors}
 page2.locator('[data-count="7"]').first.click()
 page2.locator('[data-count="11"]').first.click()
 page2.locator('[data-resonator-layout]').first.click()
 result['mode_cycle']=page2.locator('[data-resonator-layout][aria-pressed="true"]').count()>0
 assert result['9plus2_restored'] and result['transfer_restored'] and result['amount_restored']=='61' and result['mode_cycle'] and not errors,result
 print(json.dumps(result,indent=2))
 (root/'PERSISTENCE_RESULTS.json').write_text(json.dumps(result,indent=2))
 b.close()
