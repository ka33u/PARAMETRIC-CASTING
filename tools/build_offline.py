from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
public=root/'dist'
html=(public/'index.html').read_text()
html=re.sub(r'<link rel="stylesheet" href="([a-z-]+\.css)(?:\?[^\"]*)?">',lambda m:'<style>'+(public/m.group(1)).read_text()+'</style>',html)
scripts=[]
def inline(match):
    scripts.append((public/match.group(1)).read_text())
    return ''
html=re.sub(r'<script defer src="([a-z-]+\.js)(?:\?[^\"]*)?"></script>',inline,html)
html=html.replace('href="advanced.html"','href="dist/advanced.html"').replace('href="THIRD-PARTY-NOTICES.txt"','href="dist/THIRD-PARTY-NOTICES.txt"').replace('href="index.html"','href="铸件重量计算器.html"')
html=html.replace('</body>',''.join('<script>'+script.replace('</script','<\\/script')+'</script>' for script in scripts)+'</body>')
(root/'铸件重量计算器.html').write_text(html)
print('Offline calculator generated,',len(scripts),'embedded scripts')
