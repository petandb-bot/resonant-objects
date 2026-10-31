from pathlib import Path
from playwright.sync_api import sync_playwright
import json
s=Path(__file__).with_name('index.html').read_text().replace('viewReady=true;restore();','window.__audit={get notes(){return notes},get connected(){return connected()},get mode(){return activeMode()}};viewReady=true;restore();')
legacy={'count':11,'resonatorMode':True,'materialType':2,'scale':'minor','positions':{'11':[{'saved':True,'u':.31,'v':.45}]+[{'saved':False,'u':.5,'v':.5} for _ in range(10)]},'connections':{'11':[[0,1]]}}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':844,'height':390});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.evaluate('''(value)=>Object.defineProperty(window,'localStorage',{configurable:true,value:{_items:{'resonant-objects-v012':value},getItem(k){return this._items[k]||null},setItem(k,v){this._items[k]=String(v)}}})''',json.dumps(legacy))
 page.set_content(s);page.wait_for_timeout(120)
 data=page.evaluate('({mode:__audit.mode,links:__audit.connected.length,noteU:__audit.notes[0].u,mat:document.querySelector("#materialTag")?.textContent})')
 print(data,'errors',errors)
 assert data['mode']=='9+2' and data['links']==1 and abs(data['noteU']-.31)<.001 and not errors
 browser.close()
