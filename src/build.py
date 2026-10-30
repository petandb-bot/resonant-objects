#!/usr/bin/env python3
"""Build standalone GitHub Pages HTML from local sources; no external dependencies."""
from pathlib import Path
root=Path(__file__).parent
out=root.parent/'index.html'
body=(root/'body.html').read_text()
css=(root/'style.css').read_text()
js='\n\n'.join((root/name).read_text() for name in ['audio.js','renderer.js','app.js'])
html=('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">\n<meta name="theme-color" content="#d8f1f2">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n<title>RESONANT OBJECTS · v0.8.1</title>\n<style>' +css+'</style></head><body>\n' +body+'\n<script>' +js+'\n</script></body></html>')
out.write_text(html)
print(out, out.stat().st_size)
