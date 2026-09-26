"""Independent exact OCCT construction; never imports the rendered triangle mesh."""
from pathlib import Path
import json, math, sys, time
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'solid-runtime'))
from OCP.gp import gp_Pnt, gp_Vec, gp_Dir, gp_Ax1, gp_Trsf
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder, BRepPrimAPI_MakeCone, BRepPrimAPI_MakePrism, BRepPrimAPI_MakeRevol, BRepPrimAPI_MakeSphere
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakePolygon, BRepBuilderAPI_MakeFace, BRepBuilderAPI_Transform
from OCP.BRepAlgoAPI import BRepAlgoAPI_Fuse, BRepAlgoAPI_Cut
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.STEPControl import STEPControl_Writer, STEPControl_AsIs
from OCP.IFSelect import IFSelect_RetDone

def transformed(shape,rotation=None,translation=None):
    for i,angle in enumerate(rotation or []):
        if angle:
            direction=[0,0,0];direction[i]=1;t=gp_Trsf();t.SetRotation(gp_Ax1(gp_Pnt(0,0,0),gp_Dir(*direction)),math.radians(angle));shape=BRepBuilderAPI_Transform(shape,t,True).Shape()
    if translation and any(translation):
        t=gp_Trsf();t.SetTranslation(gp_Vec(*translation));shape=BRepBuilderAPI_Transform(shape,t,True).Shape()
    return shape

def combine(a,b,subtract=False):
    op=(BRepAlgoAPI_Cut if subtract else BRepAlgoAPI_Fuse)(a,b)
    op.Build()
    if not op.IsDone():raise ValueError('OCCT boolean operation failed')
    return op.Shape()

def construct(n):
    kind=n['type']
    if kind=='box':s=BRepPrimAPI_MakeBox(*n['size']).Shape()
    elif kind=='sphere':s=BRepPrimAPI_MakeSphere(n['r']).Shape()
    elif kind=='cylinder':
        s=(BRepPrimAPI_MakeCylinder(n['r'],n['h']) if n['r']==n['r2'] else BRepPrimAPI_MakeCone(n['r'],n['r2'],n['h'])).Shape()
    elif kind in ('prism','revolve'):
        poly=BRepBuilderAPI_MakePolygon()
        for a,b in n['points']:poly.Add(gp_Pnt(a,b,0) if kind=='prism' else gp_Pnt(a,0,b))
        poly.Close();face=BRepBuilderAPI_MakeFace(poly.Wire()).Face()
        s=BRepPrimAPI_MakePrism(face,gp_Vec(0,0,n['h'])).Shape() if kind=='prism' else BRepPrimAPI_MakeRevol(face,gp_Ax1(gp_Pnt(0,0,0),gp_Dir(0,0,1)),2*math.pi).Shape()
    elif kind in ('union','difference'):
        shapes=[construct(c) for c in n['children']]
        s=shapes[0]
        for b in shapes[1:]:s=combine(s,b,kind=='difference')
    elif kind=='transform':return transformed(construct(n['body']),n['rotate'],n['translate'])
    else:raise ValueError('Unsupported primitive '+kind)
    return transformed(s,translation=n.get('position'))

def check(case,out):
    start=time.monotonic();shape=construct(case['tree']);props=GProp_GProps();BRepGProp.VolumeProperties_s(shape,props)
    actual=props.Mass();expected=case['manifold_volume'];error=abs(expected-actual)/actual
    valid=BRepCheck_Analyzer(shape).IsValid()
    result={'name':case['name'],'family':case.get('family'),'occt_mm3':actual,'manifold_mm3':expected,'relative_error':error,'valid_solid':valid,'passed':valid and error<.0015,'seconds':round(time.monotonic()-start,3)}
    if case.get('water_boundary'):
        cavity=combine(construct(case['water_boundary']),shape,True)
        water_props=GProp_GProps();BRepGProp.VolumeProperties_s(cavity,water_props)
        water_actual=water_props.Mass();water_error=abs(case['water_volume']-water_actual)/water_actual
        water_valid=BRepCheck_Analyzer(cavity).IsValid()
        result.update(water_occt_mm3=water_actual,water_manifold_mm3=case['water_volume'],water_relative_error=water_error,water_valid_solid=water_valid)
        result['passed']=result['passed'] and water_valid and water_error<.0015
        result['seconds']=round(time.monotonic()-start,3)
    if case.get('export'):
        writer=STEPControl_Writer();writer.Transfer(shape,STEPControl_AsIs)
        target=out/(case['name']+'.step')
        if writer.Write(str(target))!=IFSelect_RetDone:raise ValueError('STEP export failed')
        result['step']=str(target)
    return result

if __name__=='__main__':
    cases=json.loads(Path(sys.argv[1]).read_text());out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);results=[]
    for case in cases:
        try:r=check(case,out)
        except Exception as exc:r={'name':case['name'],'passed':False,'error':str(exc)}
        results.append(r);print(json.dumps(r,ensure_ascii=False),flush=True)
        (out/'verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    if not all(r['passed'] for r in results):sys.exit(1)
