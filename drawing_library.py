"""Read-only index of the two drawing collections explicitly selected by the user."""
from pathlib import Path
import hashlib, re, threading

BASE = Path("/Volumes/kakku's disk")
COLLECTIONS = {'Y2': '上海电科所 Y2', 'YE4': 'YE4图纸-'}
LOCK = threading.RLock()
RECORDS = {}

GUIDES = {
    '机座': '先取筒体轴向剖面回转，再补散热筋、底脚、接线座；筋高从筒体表面算，避免重复计料。',
    '端盖': '取轴向材料剖面回转；单独核对安装耳、加强筋及偏心孔，正视图不能当回转剖面。',
    '法兰端盖': '回转部分含法兰、止口和轴承座；螺栓孔按实际穿过材料的深度扣除。',
    '轴承盖': '取轴向剖面，保留台阶、油槽和中心孔；核对内盖／外盖及毛坯／加工图。',
    '接线盒': '优先按闭合截面面积 × 净厚度计算围壁、底板和盒盖；接线盒通常不适合整圈回转。',
    '底脚': '选底脚净截面并输入厚度；斜撑、孔槽另外增减，与机座相交部分不要重复计入。',
    '压圈': '先核对材料；环形部分回转计算，开口和焊接件不能直接按整圈铸铁处理。',
    '平衡块': '先核对材料和数量，再按选区拉伸或局部净体积计算。',
}

def classify(relative):
    name = Path(relative).stem.replace(' ', '')
    if any(x in name for x in ('总图','总装','装配','加工设计','铭牌')) or re.search(r'总~\d',name): return None
    if any(x in relative for x in ('轴承盖', '轴承内盖', '轴承外盖')): return '轴承盖'
    if 'B5法兰端盖' in relative or '凸缘端' in name: return '法兰端盖'
    if '端盖' in relative or re.search(r'(前铸|后铸|^铸\d|^加[前后])', name): return '端盖'
    if '机座' in relative: return '机座'
    if '接线盒' in name: return '接线盒'
    if any(x in name for x in ('撑脚', '底脚')): return '底脚'
    if '压圈' in name: return '压圈'
    if '平衡块' in name: return '平衡块'
    return None

def scan():
    records = {}; totals = {}; connected = {}
    for series, folder in COLLECTIONS.items():
        root = BASE / folder
        connected[series] = root.is_dir()
        total = 0
        if not root.is_dir():
            totals[series] = 0; continue
        for path in sorted(root.rglob('*')):
            if not path.is_file() or path.suffix.lower() not in ('.dwg', '.dxf', '.exb') or path.name.startswith('._'): continue
            total += 1
            relative = str(path.relative_to(root)); kind = classify(relative)
            if not kind: continue
            # Only indexes files inside the selected collection; never follows outside symlinks.
            if root.resolve() not in path.resolve().parents: continue
            key = hashlib.sha256((series + '/' + relative).encode()).hexdigest()[:20]
            frame = re.search(r'(?:YE4-|Y2-)(\d+)', relative)
            if not frame: frame = re.search(r'(?:^|/)(\d+)', relative)
            name = path.stem
            basis = '毛坯候选' if '铸' in name else '加工候选' if ('加工' in name or name.startswith('加')) else '待核对'
            records[key] = {'id': key, 'series': series, 'relative': relative, 'name': name, 'kind': kind,
                'frame': frame.group(1) if frame else '通用', 'format': path.suffix[1:].upper(),
                'basis_hint': basis, 'guide': GUIDES[kind], 'size': path.stat().st_size,
                'readable': path.suffix.lower() in ('.dwg', '.dxf'), '_path': path}
        totals[series] = total
    with LOCK:
        RECORDS.clear(); RECORDS.update(records)
    return {'entries': [{k: v for k, v in r.items() if not k.startswith('_')} for r in records.values()],
        'totals': totals, 'connected': connected,
        'note': '目录按文件名与所在文件夹归类，含毛坯和加工对照图；铸铁材质以图内标题栏为准。EXB 目前仅编目。'}

def read(key):
    with LOCK: record = RECORDS.get(key)
    if not record:
        scan()
        with LOCK: record = RECORDS.get(key)
    if not record: raise ValueError('图纸不在已授权的本地图纸库中，请刷新目录。')
    if not record['readable']: raise ValueError('EXB 已收录目录，目前需用 CAXA 导出 DWG／DXF 后导入才能读取几何。')
    path = record['_path']; root = (BASE / COLLECTIONS[record['series']]).resolve()
    if root not in path.resolve().parents or not path.is_file(): raise ValueError('原图不可用，请连接 kakku’s disk 后刷新目录。')
    if path.stat().st_size > 30 * 1024 * 1024: raise ValueError('图纸超过 30 MB，请仅导出单个零件。')
    return path.read_bytes(), record['format'].lower(), {k: v for k, v in record.items() if not k.startswith('_')}
