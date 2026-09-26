"""Bundle application files, excluding user drawings, runtime logs and model weights."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parent.parent
out=root/'铸衡_电机铸件通用工具.zip'
files=[root/name for name in ['README.md','package.json','package-lock.json','server.py','vision.py','cad.py','cad_service.py','drawing_library.py','启动铸衡.command','准备CAD组件.command','铸件重量计算器.html']]
files.extend(root/'cad-runtime'/name for name in ['package.json','package-lock.json','convert-dwg.mjs'])
for folder in ['dist','parametric','native','tools','tests','docs']:
    files.extend(p for p in (root/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
with ZipFile(out,'w',ZIP_DEFLATED) as z:
    for p in files:z.write(p,'铸衡/'+str(p.relative_to(root)))
print(out)
