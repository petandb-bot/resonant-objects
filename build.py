from pathlib import Path
root=Path(__file__).parent
styles=(root/'src/style.css').read_text()
body=(root/'src/body.html').read_text()
audio=(root/'src/audio.js').read_text()
renderer=(root/'src/renderer.js').read_text()
app=(root/'src/app.js').read_text()
html=f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#d8f1f2">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>RESONANT OBJECTS · v0.4</title>
<style>\n{styles}\n</style></head><body>
{body}
<script>\n{audio}\n{renderer}\n{app}\n</script></body></html>
'''
(root/'index.html').write_text(html)
print('Wrote',root/'index.html',len(html),'bytes')
