#!/usr/bin/env python3
"""Build the self-contained GitHub Pages index.html from editable sources."""
from pathlib import Path
root=Path(__file__).resolve().parent
src=root/'source'
shell=(src/'shell.html').read_text()
style=(src/'styles.css').read_text()
js=''.join((src/name).read_text() for name in ['material_engines.js','audio.js','graphics.js','interaction.js'])
page=shell.replace('\n/* STYLE_BUNDLE */\n',style).replace('\n/* SCRIPT_BUNDLE */\n',js)
(root/'index.html').write_text(page)
print('Built',root/'index.html')
