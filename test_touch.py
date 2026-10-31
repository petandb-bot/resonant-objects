from playwright.sync_api import sync_playwright
from pathlib import Path
s=Path('/mnt/data/resonant_objects_v0_16_1/index.html').read_text().replace('viewReady=true;restore();','window.__roTest={get notes(){return notes},engine};viewReady=true;restore();')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox'])
 page=b.new_page(viewport={'width':844,'height':390});errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(s);page.locator('[data-resonator-layout]').first.click()
 page.evaluate('window.__strikeLog=[];const original=__roTest.engine.strike.bind(__roTest.engine);__roTest.engine.strike=(...args)=>{window.__strikeLog.push(args[0]);return original(...args)};void 0')
 box=page.locator('#instrument').bounding_box()
 def xy(i):
  n=page.evaluate('(i)=>({x:__roTest.notes[i].x,y:__roTest.notes[i].y,r:__roTest.notes[i].r})',i)
  return box['x']+n['x'],box['y']+n['y'],n['r']
 x,y,r=xy(0)
 page.mouse.move(x,y);page.mouse.down();page.wait_for_timeout(190);page.mouse.move(x+17,y+8,steps=7);page.mouse.up();page.wait_for_timeout(100)
 drag=page.evaluate('window.__strikeLog.slice()')
 x,y,r=xy(0);page.mouse.click(x,y);page.wait_for_timeout(100)
 tap=page.evaluate('window.__strikeLog.slice()')
 x,y,r=xy(9);page.mouse.click(x+r*.7,y);page.wait_for_timeout(150)
 wave=page.evaluate('window.__strikeLog.slice()')
 print('drag',drag,'tap',tap,'wave',wave,'errors',errs)
 assert drag==[], drag
 assert tap==[0],tap
 assert wave==[0,9],wave
 assert not errs
 b.close()
