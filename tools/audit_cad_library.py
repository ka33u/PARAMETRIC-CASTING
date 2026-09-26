"""Check representative real drawings locally; all derivatives stay in ignored .runtime."""
from pathlib import Path
import concurrent.futures, json, os, subprocess, sys, time
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
import drawing_library as library
import cad_service
OUT=ROOT/'.runtime/cad-audit';OUT.mkdir(parents=True,exist_ok=True)

def audit(entry):
    start=time.monotonic();key=entry['id']
    result={k:entry[k] for k in ('id','series','relative','kind','frame')}
    try:
        data,ext,_=library.read(key)
        original=OUT/(key+'.'+ext);original.write_bytes(data)
        target=OUT/(key+'.dxf')
        if ext=='dwg':
            p=subprocess.run([cad_service.node_path(),str(ROOT/'cad-runtime/convert-dwg.mjs'),str(original),str(target)],capture_output=True,timeout=60)
            if p.returncode:raise ValueError('DWG conversion failed: '+p.stderr.decode(errors='replace')[-200:])
        else:target=original
        parsed=cad_service.worker(['import',str(target)])
        (OUT/(key+'.json')).write_text(json.dumps(parsed,ensure_ascii=False))
        result.update(ok=True,lines=len(parsed['lines']),regions=len(parsed['regions']),hatches=sum(r['source']=='hatch' for r in parsed['regions']),axes=sum(l['axis'] for l in parsed['lines']),metadata=parsed['metadata'],warnings=parsed['warnings'])
    except Exception as exc:result.update(ok=False,error=str(exc))
    result['seconds']=round(time.monotonic()-start,2)
    return result

if __name__=='__main__':
    catalog=library.scan();entries=[e for e in catalog['entries'] if e['readable']]
    if '--all' not in sys.argv:
        entries=[]
        for kind in library.GUIDES:
            group=[e for e in catalog['entries'] if e['readable'] and e['kind']==kind]
            group=[e for e in group if e['basis_hint']=='毛坯候选'] or group
            entries.extend(group[::max(1,len(group)//3)][:3])
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(audit,entries):
            results.append(result)
            print(json.dumps(result,ensure_ascii=False),flush=True)
            (OUT/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
