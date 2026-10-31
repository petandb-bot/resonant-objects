"""Chrome/Safari-like DOM/WebAudio smoke tests. This is not iPhone performance testing."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
S=Path(__file__).with_name('index.html').read_text()
S=S.replace('viewReady=true;restore();', '''window.__audit={get state(){return state},get notes(){return notes},get engine(){return engine},get mode(){return activeMode()},get connected(){return connected()},get sets(){return sets},get maps(){return connectionsByCount},get stats(){return stats},tie,setNotes,save};viewReady=true;restore();''')
URL='about:blank'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
   args=['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox'])
 context=browser.new_context(viewport={'width':844,'height':390})
 page=context.new_page()
 page.evaluate("Object.defineProperty(window,'localStorage',{configurable:true,value:{_items:{},getItem(k){return this._items[k]||null},setItem(k,v){this._items[k]=String(v)},removeItem(k){delete this._items[k]}}})")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(S)
 page.wait_for_timeout(300)
 report={}
 report['initial']=page.evaluate('({mode:__audit.mode,n:__audit.notes.length,gpu:document.querySelector("#gpuMode")?.textContent})')
 assert report['initial']['n']==9
 page.locator('[data-count="11"]').first.click()
 page.evaluate('''__audit.tie(0,1);__audit.notes[0].u=.37;__audit.notes[0].saved=true;''')
 report['eleven_links']=page.evaluate('__audit.connected.length')
 assert report['eleven_links']==1
 page.locator('[data-resonator-layout]').first.click()
 page.wait_for_timeout(100)
 report['plus']=page.evaluate('''({mode:__audit.mode,n:__audit.notes.length,types:__audit.notes.map(n=>__audit.engine.soundType(n)),links:__audit.connected.length})''')
 assert report['plus']['types']==[0]*9+[4]*2 and report['plus']['links']==0
 page.evaluate('''__audit.tie(0,2);__audit.notes[0].u=.61;__audit.notes[0].saved=true;''')
 page.locator('[data-count="11"]').first.click()
 report['back']=page.evaluate('''({links:__audit.connected.length,u:__audit.notes[0].u})''')
 assert report['back']['links']==1 and abs(report['back']['u']-.37)<.01,report['back']
 page.locator('[data-resonator-layout]').first.click()
 report['plus_again']=page.evaluate('''({links:__audit.connected.length,u:__audit.notes[0].u})''')
 assert report['plus_again']['links']==1 and abs(report['plus_again']['u']-.61)<.01,report['plus_again']
 # Save and verify restore remains independent between mode slots
 page.evaluate('__audit.save()')
 report['saved_keys']=page.evaluate('''(()=>{const v=JSON.parse(localStorage.getItem('resonant-objects-v012'));return {positions:Object.keys(v.positions),connections:Object.keys(v.connections),mode:v.resonatorMode}})()''')
 assert '9+2' in report['saved_keys']['positions'] and '9+2' in report['saved_keys']['connections']
 save_value=page.evaluate("localStorage.getItem('resonant-objects-v012')")
 page.close()
 page=context.new_page()
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.evaluate('''(v)=>{Object.defineProperty(window,'localStorage',{configurable:true,value:{_items:{'resonant-objects-v012':v},getItem(k){return this._items[k]||null},setItem(k,v){this._items[k]=String(v)}}})}''',save_value)
 page.set_content(S)
 page.wait_for_timeout(250)
 report['reloaded']=page.evaluate('''({mode:__audit.mode,links:__audit.connected.length,u:__audit.notes[0].u,types:__audit.notes.map(n=>__audit.engine.soundType(n))})''')
 assert report['reloaded']['mode']=='9+2' and report['reloaded']['links']==1
 # Toggle materials and many scale changes with audio active
 xy=page.evaluate('''({x:__audit.notes[0].x,y:__audit.notes[0].y,r:__audit.notes[0].r})''')
 box=page.locator('#instrument').bounding_box()
 page.mouse.click(box['x']+xy['x']+xy['r']*.75,box['y']+xy['y'])
 page.wait_for_timeout(250)
 report['audio']=page.evaluate('''({running:__audit.engine.ctx?.state,voiceCount:__audit.engine.voices.length,tanks:__audit.engine.tanks.length,edges:__audit.engine.edges.length})''')
 assert report['audio']['running']=='running',report['audio']
 page.locator('#tuneBtn').click()
 for scale in ['eminor','gmajor','hirajoshi','lydian','minor']:
  page.locator('[data-scale]').last.select_option(scale)
  page.wait_for_timeout(15)
 for key in [1,2,3,4,0]:
  page.locator(f'[data-material-type="{key}"]').last.click()
  page.wait_for_timeout(15)
 for rv in ['prism','horizon','velvet','nest']:
  page.locator(f'[data-reverb-choice="{rv}"]').last.click()
  page.wait_for_timeout(10)
 page.wait_for_timeout(600)
 report['after_switch']=page.evaluate('''({type:__audit.engine.materialType,scale:__audit.state.scale,tankCount:__audit.engine.tanks.length,edges:__audit.engine.edges.length,voices:__audit.engine.voices.length})''')
 assert report['after_switch']['tankCount']==11
 # show screens at two sizes
 page.locator('#closeTune').click()
 page.screenshot(path=str(Path(__file__).with_name('audit_webgl_844.png')))
 page.set_viewport_size({'width':667,'height':375});page.wait_for_timeout(400)
 page.screenshot(path=str(Path(__file__).with_name('audit_webgl_667.png')))
 report['errors']=errors
 print(json.dumps(report,indent=2,ensure_ascii=False))
 assert not errors,errors
 browser.close()
