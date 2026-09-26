import copy
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).parents[1]))
import vision

def ring():
    return {'name':'圆环','summary':'测试','basis':'毛坯尺寸','units':'mm','complete':True,'missing':[],'warnings':[],
            'segments':[{'name':'圆环','op':'add','z':0,'h':40,'D0':100,'D1':100,'d0':60,'d1':60,'evidence':'外径100，内径60，高40'}],'corrections':[]}

class DraftTests(unittest.TestCase):
    def test_complete(self):
        r=vision.validate_draft(ring(),'毛坯尺寸');self.assertTrue(r['complete']);self.assertEqual(r['missing'],[])
    def test_unknown_is_not_zero(self):
        d=ring();d['segments'][0]['d0']=None
        r=vision.validate_draft(d,'毛坯尺寸');self.assertFalse(r['complete']);self.assertIsNone(r['segments'][0]['d0'])
    def test_wrong_basis(self):
        with self.assertRaises(ValueError):vision.validate_draft(ring(),'加工后尺寸')
    def test_invalid_numbers(self):
        for value in [True,float('inf'),float('nan'),-1,'60']:
            d=ring();d['segments'][0]['h']=value
            with self.assertRaises(ValueError):vision.validate_draft(d,'毛坯尺寸')
    def test_estimated_dimension(self):
        d=ring();d['segments'][0]['evidence']='内径约60，根据照片估算'
        self.assertFalse(vision.validate_draft(d,'毛坯尺寸')['complete'])
    def test_inverted_diameters(self):
        d=ring();d['segments'][0]['d1']=162
        self.assertFalse(vision.validate_draft(d,'毛坯尺寸')['complete'])
    def test_no_geometry(self):
        d=ring();d['segments']=[];self.assertFalse(vision.validate_draft(d,'毛坯尺寸')['complete'])
    def test_missing_overrides_complete(self):
        d=ring();d['missing']=['筋厚未知'];self.assertFalse(vision.validate_draft(d,'毛坯尺寸')['complete'])
    def test_request_validation(self):
        for payload in [None,{'basis':'wrong'}, {'basis':'毛坯尺寸','image':'not base64'},{'basis':'毛坯尺寸','image':'YWJj'}]:
            with self.assertRaises(ValueError):vision.start_job(payload)
    def test_remote_model_rejected_before_image_sent(self):
        with patch.object(vision,'status',return_value={'running':True,'installed':True}),patch.object(vision,'rpc',return_value={'remote_model':'cloud','capabilities':['vision']}):
            with self.assertRaisesRegex(RuntimeError,'云端'):vision.ensure_runtime()
    def test_plain_text_model_rejected(self):
        with patch.object(vision,'status',return_value={'running':True,'installed':True}),patch.object(vision,'rpc',return_value={'capabilities':['completion']}):
            with self.assertRaisesRegex(RuntimeError,'不支持图片'):vision.ensure_runtime()
    def test_expired_job(self):
        with patch.object(vision,'JOBS',{'old':{'state':'done','created':0}}):self.assertIsNone(vision.get_job('old'))

if __name__=='__main__':unittest.main()
