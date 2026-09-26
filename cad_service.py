"""Local-only CAD conversion, bounded worker execution and short-lived drawing cache."""
from pathlib import Path
import json, os, shutil, subprocess, sys, tempfile, threading, time, uuid
ROOT=Path(__file__).resolve().parent
LOCK=threading.Lock()
DRAWINGS={}

def node_path():
    return shutil.which('node') or next((p for p in ['/opt/homebrew/bin/node','/usr/local/bin/node'] if Path(p).is_file()),None)

def status():
    dxf=(ROOT/'cad-runtime/python/ezdxf').is_dir() and (ROOT/'cad-runtime/python/shapely').is_dir()
    dwg=dxf and bool(node_path()) and (ROOT/'cad-runtime/node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm').is_file()
    return {'dxf':dxf,'dwg':dwg,'local':True}

def worker(args,payload=None):
    process=subprocess.run([sys.executable,'-B',str(ROOT/'cad.py'),*args],
        input=None if payload is None else json.dumps(payload).encode(),capture_output=True,timeout=60,
        cwd=str(ROOT),env={**os.environ,'XDG_CACHE_HOME':str(ROOT/'.runtime/cache')})
    try:result=json.loads(process.stdout)
    except ValueError as exc:raise ValueError('CAD 几何读取未完成，请只导出单个零件或另存为 DXF 后重试。') from exc
    if process.returncode or 'error' in result:raise ValueError(result.get('error','CAD 处理失败。'))
    return result

def import_drawing(data,extension):
    if extension not in ('dwg','dxf'):raise ValueError('请选择 DWG 或 DXF 文件。')
    ready=status()
    if not ready[extension]:raise ValueError('本地 CAD 组件未就绪，请运行“准备CAD组件.command”。')
    if not LOCK.acquire(blocking=False):raise ValueError('正在处理另一份 CAD 图纸，请稍后重试。')
    try:
        with tempfile.TemporaryDirectory(prefix='casting-cad-') as temp:
            source=Path(temp)/('source.'+extension);source.write_bytes(data)
            if extension=='dwg':
                if not data.startswith(b'AC10'):raise ValueError('这不是有效的 DWG 文件，请检查文件格式。')
                target=Path(temp)/'converted.dxf'
                p=subprocess.run([node_path(),str(ROOT/'cad-runtime/convert-dwg.mjs'),str(source),str(target)],capture_output=True,timeout=60,cwd=str(ROOT))
                if p.returncode or not target.is_file():raise ValueError('这份 DWG 未能完整转换。请在原 CAD 软件中“另存为 DXF”后导入；不会上传在线转换。')
                source=target
            result=worker(['import',str(source)])
        now=time.time()
        for key in list(DRAWINGS):
            if now-DRAWINGS[key]['updated']>7200:del DRAWINGS[key]
        while len(DRAWINGS)>=4:del DRAWINGS[min(DRAWINGS,key=lambda k:DRAWINGS[k]['updated'])]
        drawing_id=uuid.uuid4().hex
        DRAWINGS[drawing_id]={'updated':now,'drawing':result}
        return {'drawing_id':drawing_id,'drawing':result,'format':extension.upper()}
    finally:LOCK.release()

def calculate(payload):
    if not isinstance(payload,dict):raise ValueError('CAD 计算请求无效。')
    if not LOCK.acquire(blocking=False):raise ValueError('另一项 CAD 计算尚未完成，请稍后重试。')
    try:
        record=DRAWINGS.get(payload.get('drawing_id'))
        if not record or time.time()-record['updated']>7200:raise ValueError('图纸已过期，请重新导入。')
        ids=payload.get('selected')
        if not isinstance(ids,list) or not 1<=len(ids)<=100 or any(not isinstance(v,str) for v in ids):raise ValueError('请选择材料区域。')
        regions={p['id']:p for p in record['drawing']['regions']}
        if any(k not in regions for k in ids):raise ValueError('所选区域已失效，请重新导入图纸。')
        request={k:payload.get(k) for k in ['mode','scale','axis','side','thickness','count']}
        request['regions']=[regions[k] for k in dict.fromkeys(ids)]
        result=worker(['calculate'],request)
        record['updated']=time.time()
        return result
    finally:LOCK.release()
