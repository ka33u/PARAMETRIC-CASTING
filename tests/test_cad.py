import math, sys, tempfile, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
try:
    import cad
except ImportError:
    cad=None
import drawing_library, cad_service

def region(outer,holes=None):return {'polygons':[{'outer':outer,'holes':holes or []}]}

@unittest.skipIf(cad is None,'本地 CAD 依赖未安装')
class GeometryTests(unittest.TestCase):
    def calc(self,regions,**kw):
        return cad.calculate(dict(regions=regions,mode='revolve',scale=1,axis=[[0,0],[0,10]],side=1,**kw))
    def test_ring_and_duplicate_union(self):
        r=region([[3,0],[5,0],[5,10],[3,10]])
        self.assertAlmostEqual(self.calc([r,r])['volume'],math.pi*(25-9)*10)
    def test_mirrored_half_is_not_counted_twice(self):
        r=region([[-5,0],[5,0],[5,10],[-5,10]])
        v=self.calc([r]);self.assertTrue(v['clipped']);self.assertAlmostEqual(v['volume'],math.pi*25*10)
    def test_holes_subtracted_in_material_region(self):
        r=region([[2,0],[6,0],[6,10],[2,10]],[[[3,2],[5,2],[5,8],[3,8]]])
        self.assertAlmostEqual(self.calc([r])['volume'],math.pi*((36-4)*10-(25-9)*6))
    def test_rotated_axis(self):
        v=cad.calculate({'regions':[region([[0,3],[10,3],[10,5],[0,5]])],'mode':'revolve','scale':2,'axis':[[0,0],[10,0]],'side':-1})
        self.assertAlmostEqual(v['volume'],math.pi*16*10*8)
    def test_extrusion_net_hole_thickness_and_count(self):
        r=region([[0,0],[10,0],[10,10],[0,10]],[[[2,2],[4,2],[4,4],[2,4]]])
        v=cad.calculate({'regions':[r,r],'mode':'extrude','scale':2,'thickness':3,'count':4})
        self.assertEqual(v['volume'],96*4*3*4);self.assertEqual(v['feature']['a']*1000*v['feature']['count'],v['volume'])
    def test_invalid_scale_side_and_axis(self):
        r=region([[3,0],[5,0],[5,10],[3,10]])
        for key,value in [('scale',None),('scale',float('nan')),('axis',[[0,0],[0,0]]),('side',0)]:
            payload={'regions':[r],'mode':'revolve','scale':1,'axis':[[0,0],[0,1]],'side':1};payload[key]=value
            with self.assertRaises(ValueError):cad.calculate(payload)
    def parse(self,doc):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'test.dxf';doc.saveas(path);return cad.parse_dxf(path)
    def test_hatch_hole_dedup_and_metadata(self):
        doc=cad.ezdxf.new('R2013');doc.units=4;m=doc.modelspace()
        outer=[[0,0],[10,0],[10,10],[0,10]];inner=[[2,2],[4,2],[4,4],[2,4]]
        h=m.add_hatch();h.paths.add_polyline_path(outer,is_closed=True,flags=1);h.paths.add_polyline_path(inner,is_closed=True,flags=0)
        m.add_lwpolyline(outer,close=True);m.add_lwpolyline(inner,close=True);m.add_text('HT200');m.add_text(r'\U+2205100')
        p=self.parse(doc);self.assertEqual(p['mm_per_unit'],1);self.assertEqual(p['regions'][0]['area'],96)
        self.assertEqual(p['regions'][0]['source'],'hatch');self.assertEqual(sum(abs(r['area']-96)<1e-9 for r in p['regions']),1)
        self.assertIn('∅100',[t['text'] for t in p['texts']]);self.assertTrue(p['metadata']['material_confirmed_gray'])
    def test_paper_space_without_model(self):
        doc=cad.ezdxf.new();doc.layout().add_lwpolyline([[0,0],[10,0],[10,10],[0,10]],close=True)
        p=self.parse(doc);self.assertEqual(p['layout'],'Layout1');self.assertIsNone(p['mm_per_unit']);self.assertEqual(len(p['regions']),1)
    def test_dashdot_is_axis_not_material_divider(self):
        doc=cad.ezdxf.new();doc.linetypes.new('DASHDOT',dxfattribs={'pattern':[2,1,-.5,0,-.5]});doc.layers.new('4',dxfattribs={'linetype':'DASHDOT'})
        m=doc.modelspace();m.add_lwpolyline([[0,0],[10,0],[10,10],[0,10]],close=True);m.add_line((5,0),(5,10),dxfattribs={'layer':'4'})
        p=self.parse(doc);self.assertEqual(sum(l['axis'] for l in p['lines']),1);self.assertEqual(len(p['regions']),1)
    def test_nonplanar_curve_warns_without_projecting(self):
        doc=cad.ezdxf.new();m=doc.modelspace();m.add_lwpolyline([[0,0],[10,0],[10,10],[0,10]],close=True);m.add_line((20,0,0),(30,10,10))
        p=self.parse(doc);self.assertEqual(len(p['lines']),1);self.assertTrue(any('非 XY' in w for w in p['warnings']))
    def test_non_gray_material_is_flagged(self):
        m=cad.drawing_metadata([{'text':'ZL102 铸铝 铝合金'}]);self.assertTrue(m['non_gray_material']);self.assertFalse(m['material_confirmed_gray'])

class LibraryTests(unittest.TestCase):
    def test_classification_excludes_assembly_and_rotors(self):
        self.assertIsNone(drawing_library.classify('B5法兰端盖/315/315总~1.DWG'))
        self.assertIsNone(drawing_library.classify('B5法兰端盖/180/端盖/铭牌.DWG'))
        self.assertIsNone(drawing_library.classify('YE4-180-/铸铝转子YE4-180.exb'))
        self.assertEqual(drawing_library.classify('YE4-180-/轴承外盖铸件.exb'),'轴承盖')
        self.assertEqual(drawing_library.classify('Y2-100/端盖/铸100.DWG'),'端盖')
    def test_library_does_not_accept_arbitrary_paths(self):
        from unittest.mock import patch
        with patch.object(drawing_library,'scan',return_value={}):
            with self.assertRaises(ValueError):drawing_library.read('../../secret')
    def test_unknown_cached_drawing_rejected(self):
        with self.assertRaises(ValueError):cad_service.calculate({'drawing_id':'missing','selected':['0']})

if __name__=='__main__':unittest.main()
