"""Known geometry fixture: blank D100 d60 H40; finished D96 d64 H36."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
im=Image.new('RGB',(1200,760),'white');g=ImageDraw.Draw(im)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',27)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',23)
g.text((50,25),'RING / AXIAL SECTION     Units: mm',fill='black',font=font)
g.text((50,65),'Cast dimensions outside (finished dimensions inside)',fill='black',font=small)
def line(points,width=3):g.line(points,fill='black',width=width)
def dim(a,b,label,pos):
 line([a,b],2)
 for p,q in [(a,b),(b,a)]:
  dx=q[0]-p[0];dy=q[1]-p[1];r=(dx*dx+dy*dy)**.5;ux,uy=dx/r,dy/r
  g.polygon([p,(p[0]+12*ux+5*uy,p[1]+12*uy-5*ux),(p[0]+12*ux-5*uy,p[1]+12*uy+5*ux)],fill='black')
 g.text(pos,label,font=font,fill='black')
g.ellipse((90,170,450,530),outline='black',width=4)
g.ellipse((162,242,378,458),outline='black',width=4)
line([(60,350),(480,350)],1);line([(270,140),(270,560)],1)
g.text((172,575),'FRONT VIEW',fill='black',font=small)
for bounds in [(650,170,794,242),(650,458,794,530)]:
 x0,y0,x1,y1=bounds
 for i in range(x0-72,x1,14):
  ax=max(x0,i);ay=y1-(ax-i);bx=min(x1,i+72);by=y1-(bx-i)
  if bx>ax:line([(ax,ay),(bx,by)],1)
 g.rectangle(bounds,outline='black',width=4)
line([(615,350),(835,350)],1)
for y in [170,530]:line([(794,y),(958,y)],1)
dim((920,170),(920,530),'OD 100 (96)',(965,340))
for y in [242,458]:line([(650,y),(573,y)],1)
dim((595,242),(595,458),'ID 60 (64)',(455,330))
for x in [650,794]:line([(x,530),(x,620)],1)
dim((650,605),(794,605),'40 (36)',(675,630))
g.text((650,120),'SECTION A-A',fill='black',font=small)
im.save(Path(__file__).with_name('ring.png'))
