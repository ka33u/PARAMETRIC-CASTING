"""Bounded, local CAD geometry worker. No network calls or external references."""
from pathlib import Path
import json, math, os, sys, re
ROOT=Path(__file__).resolve().parent
os.environ.setdefault('XDG_CACHE_HOME',str(ROOT/'.runtime'/'cache'))
sys.dont_write_bytecode=True
sys.path.insert(0,str(ROOT/'cad-runtime'/'python'))
import ezdxf
from ezdxf import path as paths
from shapely.geometry import Polygon, MultiPolygon, LineString, box
from shapely.ops import polygonize, unary_union
from shapely import affinity

FACTORS={0:None,1:25.4,2:304.8,4:1,5:10,6:1000,7:1e6,8:.0000254,9:.0254,10:914.4,13:.001,14:100,21:304.8006096}
UNIT_NAMES={0:'未指定',1:'英寸',2:'英尺',4:'毫米',5:'厘米',6:'米',7:'千米',8:'微英寸',9:'密耳',10:'码',13:'微米',14:'分米',21:'美国测量英尺'}
MAX_POINTS=160000
MAX_ENTITIES=16000
MAX_REGIONS=3000

def clean_text(text):
    text=re.sub(r'\\U\+([0-9a-fA-F]{4})',lambda m:chr(int(m.group(1),16)),text)
    for old,new in [('%%c','φ'),('%%d','°'),('%%p','±')]:text=re.sub(re.escape(old),new,text,flags=re.I)
    return text

def drawing_metadata(texts):
    strings=[clean_text(t['text']) for t in texts];joined=' '.join(strings)
    materials=list(dict.fromkeys(re.findall(r'(?<![A-Za-z])(?:HT\s*\d{2,3}|QT\s*\d{3}(?:[-—]\d+)?|ZL\s*\d{3}|灰铸铁|铝合金|铸铝|铸钢)',joined,re.I)))
    return {'materials':materials,'scale_labels':list(dict.fromkeys(s.strip() for s in strings if re.fullmatch(r'\s*\d+(?:\.\d+)?\s*[:：]\s*\d+(?:\.\d+)?\s*',s)))[:12],
            'material_confirmed_gray':bool(re.search(r'HT\s*\d|灰铸铁',joined,re.I)),
            'non_gray_material':bool(re.search(r'QT\s*\d|ZL\s*\d|铝合金|铸铝|铸钢',joined,re.I))}

def polygons(geometry):
    if isinstance(geometry,Polygon): return [geometry]
    if isinstance(geometry,MultiPolygon): return list(geometry.geoms)
    if hasattr(geometry,'geoms'):
        return [p for g in geometry.geoms for p in polygons(g)]
    return []

def encode(geometry):
    return [{'outer':list(p.exterior.coords),'holes':[list(r.coords) for r in p.interiors]} for p in polygons(geometry)]

def decode(items):
    pp=[]
    for item in items:
        p=Polygon(item['outer'],item.get('holes',[]))
        if not p.is_valid: raise ValueError('剖面存在自交或损坏的边界，请在 CAD 中修复后重试。')
        if not p.is_empty and p.area>0:pp.append(p)
    return unary_union(pp)

def parse_dxf(filename):
    doc=ezdxf.readfile(filename)
    units=int(doc.header.get('$INSUNITS',0));factor=FACTORS.get(units)
    tolerance=.02/(factor or 1)
    lines=[];texts=[];region_geoms=[];warnings=[];unsupported={};network=[];point_count=0;entity_count=0
    # SHX shape symbols are not geometric boundaries. ezdxf 1.4.2 also cannot
    # transform some legacy SHAPE entities inside INSERTs; remove them in memory.
    for block in doc.blocks:
        for entity in list(block):
            if entity.dxftype()=='SHAPE':
                block.delete_entity(entity);unsupported['SHAPE']=unsupported.get('SHAPE',0)+1
    def add_path(points,layer,axis=False,closed=False,network_ok=True):
        nonlocal point_count
        if len(points)<2:return
        if any(not math.isfinite(v) or abs(v)>1e10 for pt in points for v in pt):raise ValueError('图纸含有无效或超大坐标。')
        point_count+=len(points)
        if point_count>MAX_POINTS:raise ValueError('图纸线条过多，请在 CAD 中只导出需要计算的零件。')
        lines.append({'points':points,'layer':layer,'axis':axis,'closed':closed})
        if network_ok and not axis:network.append(LineString(points))
    def flat(p):
        vv=list(p.flattening(tolerance,segments=4))
        if vv and max(v.z for v in vv)-min(v.z for v in vv)>max(tolerance,1e-6):raise ValueError('检测到非 XY 平面的三维曲线。请导出二维剖面图，或改用三维模型体积计算。')
        return [[v.x,v.y] for v in vv]
    def add_region(g,label,source,layer):
        if g.is_empty or g.area<=1e-10:return
        if not g.is_valid:
            warnings.append('存在无效闭合边界，已跳过该区域；请先在 CAD 中修复。');return
        if len(region_geoms)>=MAX_REGIONS:raise ValueError('封闭区域过多，请仅导出单个零件。')
        region_geoms.append((g,label,source,layer))
    def walk(entities,parent_layer='0',depth=0):
        nonlocal entity_count
        if depth>12:raise ValueError('嵌套图块过深，请在 CAD 中展开需要计算的图块。')
        for entity in entities:
            entity_count+=1
            if entity_count>MAX_ENTITIES:raise ValueError('实体过多，请仅导出单个零件。')
            kind=entity.dxftype();layer=entity.dxf.get('layer','0');layer=parent_layer if layer=='0' else layer
            if entity.dxf.get('invisible',0):continue
            if kind=='INSERT':
                block=entity.block()
                if block is None or block.block.dxf.flags&12:
                    warnings.append('存在未载入的外部参照；请将所需几何绑定后重试。');continue
                inserts=entity.multi_insert() if entity.mcount>1 else [entity]
                for ins in inserts:
                    def skipped(e,reason):unsupported[e.dxftype()]=unsupported.get(e.dxftype(),0)+1
                    walk(ins.virtual_entities(skipped_entity_callback=skipped),layer,depth+1)
                    walk(ins.attribs,layer,depth+1)
                continue
            if kind in ('TEXT','MTEXT','ATTRIB'):
                text=entity.plain_text() if kind=='MTEXT' else entity.dxf.get('text','')
                pos=entity.dxf.insert
                texts.append({'text':text[:300],'x':pos.x,'y':pos.y,'height':float(entity.dxf.char_height if kind=='MTEXT' else entity.dxf.height),'rotation':float(entity.dxf.get('rotation',0)),'layer':layer});continue
            if kind=='DIMENSION':
                # Render dimension graphics for reference; never use them to close a material region.
                try:
                    for v in entity.virtual_entities():
                        if v.dxftype()=='LINE':add_path(flat(paths.make_path(v)),layer,network_ok=False)
                        elif v.dxftype() in ('MTEXT','TEXT'):
                            t=v.plain_text() if v.dxftype()=='MTEXT' else v.dxf.text
                            texts.append({'text':t[:300],'x':v.dxf.insert.x,'y':v.dxf.insert.y,'height':(v.dxf.char_height if v.dxftype()=='MTEXT' else v.dxf.height),'rotation':v.dxf.get('rotation',0),'layer':layer})
                except (ValueError,AttributeError,ezdxf.DXFError):warnings.append('部分尺寸标注未显示，材料边界仍可选择。')
                continue
            if kind=='HATCH':
                if entity.dxf.get('hatch_style',0)!=0:
                    warnings.append('存在非普通岛屿样式的填充，未自动当作材料区域；请依据真实闭合轮廓选取材料。');continue
                try:
                    region=Polygon()
                    for p in paths.from_hatch(entity):
                        for sub in p.sub_paths():
                            coords=flat(sub)
                            if len(coords)<4:continue
                            if math.dist(coords[0],coords[-1])>max(tolerance*1e-3,1e-7):raise ValueError('填充边界未闭合')
                            poly=Polygon(coords)
                            if not poly.is_valid:raise ValueError('填充边界自交')
                            region=region.symmetric_difference(poly)
                            add_path(coords,layer,closed=True,network_ok=False)
                    add_region(region,'剖面填充 · '+layer,'hatch',layer)
                except (ValueError,AttributeError,ezdxf.DXFError) as exc:warnings.append('一处填充边界无法读取：'+str(exc)[:100])
                continue
            if kind in ('LINE','LWPOLYLINE','POLYLINE','CIRCLE','ARC','ELLIPSE','SPLINE'):
                try:
                    p=paths.make_path(entity);coords=flat(p)
                    lt=entity.dxf.get('linetype','BYLAYER')
                    if lt.upper()=='BYLAYER':lt=doc.layers.get(layer).dxf.linetype if layer in doc.layers else ''
                    style=(lt+' '+layer).upper()
                    axis=any(k in style for k in ('CENTER','CENTRE','AXIS','中心','DASHDOT'))
                    hidden=any(k in style for k in ('HIDDEN','DASHED','虚线'))
                    add_path(coords,layer,axis,p.is_closed,network_ok=not hidden)
                except (TypeError,ValueError,ezdxf.DXFError) as exc:
                    unsupported[kind]=unsupported.get(kind,0)+1
                    if isinstance(exc,ValueError):warnings.append(str(exc))
                continue
            if kind not in ('POINT','VIEWPORT','ATTDEF','SEQEND'):
                unsupported[kind]=unsupported.get(kind,0)+1
    layout=doc.modelspace()
    if not len(layout):
        layouts=[l for l in doc.layouts if l.name!='Model' and any(e.dxftype() not in ('VIEWPORT','POINT') for e in l)]
        if len(layouts)!=1:raise ValueError('模型空间为空且布局不唯一，请将单个剖面导出为 DXF。')
        layout=layouts[0]
        warnings.append('几何来自布局空间 '+layout.name+'，请按已知尺寸标定比例；视口投影未展开。')
    walk(layout)
    if not lines:raise ValueError('模型空间中没有可读取的二维线条。请把所需二维剖面放在模型空间，或从 CAD 另存为 DXF。')
    if network:
        noded=unary_union(network)
        for p in polygonize(noded):add_region(p,'闭合轮廓','outline','')
    # Prefer native HATCH regions; remove geometrically identical polygonized duplicates.
    regions=[];buckets={}
    for g,label,source,layer in region_geoms:
        key=tuple(round(v,6) for v in (*g.bounds,g.area))
        if any(g.equals(other) for other in buckets.get(key,[])):continue
        buckets.setdefault(key,[]).append(g)
        regions.append({'id':str(len(regions)),'label':label,'source':source,'layer':layer,'area':g.area,'polygons':encode(g)})
    if unsupported:warnings.append('以下对象未用于闭合区域计算：'+', '.join(k+' × '+str(v) for k,v in sorted(unsupported.items()))+'。请确认所选剖面完整。')
    if not regions:warnings.append('未找到封闭区域。请在 CAD 中闭合轮廓或保留剖面填充后重新导入。')
    for t in texts:t['text']=clean_text(t['text'])
    bounds=unary_union([LineString(l['points']) for l in lines]).bounds
    return {'lines':lines,'texts':texts[:3000],'regions':regions,'bounds':bounds,'units':units,'unit_name':UNIT_NAMES.get(units,'未知单位'),
            'mm_per_unit':factor if layout.name=='Model' else None,'curve_tolerance':tolerance,'warnings':list(dict.fromkeys(warnings))[:20],'dxf_version':doc.dxfversion,'layout':layout.name,'metadata':drawing_metadata(texts)}

def scalar(value,name,positive=True,maximum=1e6):
    if type(value) not in (int,float) or not math.isfinite(value) or value>maximum or (value<=0 if positive else value<0):raise ValueError(name+'无效。')
    return float(value)

def slice_profile(geometry):
    pp=polygons(geometry);edges=[];zs=[]
    for p in pp:
        for ring in [p.exterior,*p.interiors]:
            coords=list(ring.coords)
            for a,b in zip(coords,coords[1:]):
                zs.extend([a[1],b[1]])
                if abs(a[1]-b[1])>1e-10:edges.append((a,b))
    zs=sorted(set(round(z,9) for z in zs));segments=[]
    for lo,hi in zip(zs,zs[1:]):
        if hi-lo<1e-9:continue
        mid=(lo+hi)/2
        active=[(a,b) for a,b in edges if min(a[1],b[1])<mid<max(a[1],b[1])]
        def x(edge,z):
            a,b=edge;return a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1])
        active.sort(key=lambda e:x(e,mid))
        if len(active)%2:raise ValueError('剖面边界无法成对闭合，请检查图纸。')
        for j in range(0,len(active),2):
            inner,outer=active[j:j+2]
            d0,d1=max(0,2*x(inner,lo)),max(0,2*x(inner,hi))
            D0,D1=max(d0,2*x(outer,lo)),max(d1,2*x(outer,hi))
            if max(D0-d0,D1-d1)<1e-8:continue
            segments.append({'name':'CAD 轮廓段 '+str(len(segments)+1),'op':'add','z':max(0,lo),'h':hi-lo,'D0':D0,'D1':D1,'d0':d0,'d1':d1})
    if len(segments)>600:raise ValueError('当前剖面过于复杂（超过600个积分段）。请分区域选择，或简化细小齿形后重试。')
    return segments

def calculate(payload):
    factor=scalar(payload.get('scale'),'图形比例',maximum=1e6)
    parts=payload.get('regions')
    if not isinstance(parts,list) or not 1<=len(parts)<=100:raise ValueError('请选择1～100个材料区域。')
    geometry=unary_union([decode(p['polygons']) for p in parts])
    if geometry.is_empty:raise ValueError('所选区域没有面积。')
    if payload.get('mode')=='extrude':
        thickness=scalar(payload.get('thickness'),'净厚度')
        count=payload.get('count')
        if type(count) is not int or not 1<=count<=1000000:raise ValueError('数量应为正整数。')
        volume=geometry.area*factor**2*thickness*count
        return {'volume':volume,'area':geometry.area*factor**2,'segments':[],
                'feature':{'name':'CAD 选区拉伸','type':'volume','op':'add','a':volume/1000/count,'count':count},'material':encode(geometry)}
    if payload.get('mode')!='revolve':raise ValueError('计算方式无效。')
    axis=payload.get('axis');side=payload.get('side')
    if not isinstance(axis,list) or len(axis)!=2 or side not in (1,-1):raise ValueError('请先选择旋转轴及材料所在侧。')
    if any(not isinstance(p,list) or len(p)!=2 or any(type(v) not in (int,float) or not math.isfinite(v) or abs(v)>1e10 for v in p) for p in axis):raise ValueError('旋转轴坐标无效。')
    a,b=axis;dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
    if length<1e-8:raise ValueError('轴线上两点不能重合。')
    ux,uy=dx/length,dy/length
    rz=affinity.affine_transform(geometry,[side*uy,-side*ux,ux,uy,-side*(uy*a[0]-ux*a[1]),-ux*a[0]-uy*a[1]])
    minr,minz,maxr,maxz=rz.bounds
    if maxr<=0:raise ValueError('所选材料位于轴线另一侧，请切换计算侧。')
    clipped=rz.intersection(box(0,minz-1,maxr+1,maxz+1))
    if clipped.is_empty or clipped.area<=1e-10:raise ValueError('旋转轴这一侧没有材料。')
    material=affinity.affine_transform(clipped,[side*uy,ux,-side*ux,uy,a[0],a[1]])
    rz=affinity.scale(clipped,xfact=factor,yfact=factor,origin=(0,0))
    rz=affinity.translate(rz,yoff=-rz.bounds[1])
    if max(abs(v) for v in rz.bounds)>1e6:raise ValueError('缩放后的尺寸超过1000000 mm，请检查单位或比例。')
    segments=slice_profile(rz)
    volume=2*math.pi*rz.area*rz.centroid.x
    integrated=sum(math.pi*s['h']/12*((s['D0']**2+s['D0']*s['D1']+s['D1']**2)-(s['d0']**2+s['d0']*s['d1']+s['d1']**2)) for s in segments)
    if not math.isclose(volume,integrated,rel_tol=1e-7,abs_tol=1e-5):raise ValueError('截面积分校验未通过，请检查边界。')
    return {'volume':integrated,'area':rz.area,'segments':segments,'material':encode(material),'clipped':minr< -1e-7}

if __name__=='__main__':
    try:
        result=parse_dxf(sys.argv[2]) if sys.argv[1]=='import' else calculate(json.load(sys.stdin))
        print(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False))
    except Exception as exc:
        print(json.dumps({'error':str(exc)},ensure_ascii=False));sys.exit(1)
