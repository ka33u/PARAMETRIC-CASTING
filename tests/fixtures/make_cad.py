from pathlib import Path
import sys,os
os.environ.setdefault('XDG_CACHE_HOME',str(Path(__file__).resolve().parents[2]/'.runtime/cache'))
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'cad-runtime/python'))
import ezdxf
root=Path(__file__).resolve().parents[2]
doc=ezdxf.new('R2013');doc.units=4
m=doc.modelspace()
doc.linetypes.new('CENTER',dxfattribs={'pattern':[16,8,-2,2,-2,2,-2]})
doc.layers.new('中心线',dxfattribs={'color':4,'linetype':'CENTER'})
doc.layers.new('回转主体',dxfattribs={'color':7})
doc.layers.new('筋板',dxfattribs={'color':3})
profile=[(30,0),(90,0),(90,12),(55,12),(55,50),(40,50),(40,8),(30,8)]
for side in [1,-1]:
 points=[(side*x,y) for x,y in profile]
 m.add_lwpolyline(points,close=True,dxfattribs={'layer':'回转主体'})
 h=m.add_hatch(dxfattribs={'layer':'回转主体'});h.paths.add_polyline_path(points,is_closed=True)
m.add_line((0,-15),(0,70),dxfattribs={'layer':'中心线'})
m.add_lwpolyline([(130,0),(160,0),(130,25)],close=True,dxfattribs={'layer':'筋板'})
m.add_text('CAD DEMO: mm / revolve profile',dxfattribs={'height':5,'insert':(-90,80)})
m.add_text('RIB 30 x 25; thickness 5; count 3',dxfattribs={'height':3,'insert':(112,-12)})
m.add_text('Select one shaded side',dxfattribs={'height':4,'insert':(-70,-22)})
doc.saveas(root/'dist/cad-demo.dxf')
print(root/'dist/cad-demo.dxf')
