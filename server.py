#!/usr/bin/env python3
"""Local drawing OCR and Ollama vision; only loopback services are used."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import json, os, subprocess, tempfile, threading
import vision
import cad_service
import drawing_library
SERVICE_VERSION = 'cad-library-20260924-2'

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get('CASTING_PORT', '4179'))
HOST = '127.0.0.1'
MAX_BYTES = 15 * 1024 * 1024
OCR_LOCK = threading.Lock()
BINARY = ROOT / 'native' / 'recognize'

def recognize(data):
    if not BINARY.is_file():
        raise RuntimeError('本地识别组件未就绪，请通过“启动铸衡.command”启动。')
    with tempfile.TemporaryDirectory(prefix='casting-ocr-') as temp:
        path = Path(temp) / 'drawing'
        path.write_bytes(data)
        with OCR_LOCK:
            process = subprocess.run([str(BINARY), str(path)], capture_output=True, timeout=90)
        if process.returncode:
            raise ValueError('识别失败：' + process.stderr.decode('utf-8', 'replace')[:500])
        return json.loads(process.stdout)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)
    def log_message(self, format, *args):
        # A preview host can close stderr while this local process stays alive.
        # Logging must never abort an otherwise valid HTTP response.
        try:
            super().log_message(format, *args)
        except (OSError, ValueError):
            pass
    def valid_host(self):
        return self.headers.get('Host') in (f'{HOST}:{PORT}', f'localhost:{PORT}')
    def send_json(self, payload, code=200):
        data=json.dumps(payload,ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def do_GET(self):
        if not self.valid_host(): return self.send_json({'error':'无效的本地地址。'},403)
        if self.path == '/api/status':
            return self.send_json({'service':'casting-local-ocr','version':SERVICE_VERSION,'ocr':BINARY.is_file(),'vision':True,'privacy':'local-only'})
        if self.path == '/api/vision/status':
            return self.send_json(vision.status())
        if self.path == '/api/cad/status':
            return self.send_json(cad_service.status())
        if self.path == '/api/cad/library':
            return self.send_json(drawing_library.scan())
        if self.path.startswith('/api/vision/jobs/'):
            result=vision.get_job(self.path.rsplit('/',1)[-1])
            return self.send_json(result or {'error':'识图记录已过期，请重新识别。'},200 if result else 404)
        return super().do_GET()
    def do_POST(self):
        if not self.valid_host(): return self.send_json({'error':'无效的本地地址。'},403)
        if self.path not in ('/api/ocr','/api/vision/jobs','/api/cad/import','/api/cad/calculate','/api/cad/library/open'): return self.send_json({'error':'接口不存在。'},404)
        origin=self.headers.get('Origin')
        if origin not in (f'http://{HOST}:{PORT}',f'http://localhost:{PORT}') or self.headers.get('X-Casting-Client') != 'drawing-assistant':
            return self.send_json({'error':'请从本机计算工具页面发起识别。'},403)
        try:
            size=int(self.headers.get('Content-Length','0'))
        except ValueError:
            return self.send_json({'error':'文件长度无效。'},400)
        if self.path.startswith('/api/cad/'):
            if not 0<size<=30*1024*1024: return self.send_json({'error':'CAD 文件须小于30 MB，请只导出单个零件。'},413)
            if self.path!='/api/cad/import' and size>128*1024:return self.send_json({'error':'CAD 请求过大。'},413)
            try:
                data=self.rfile.read(size)
                if self.path.endswith('/import'):
                    result=cad_service.import_drawing(data,self.headers.get('X-Cad-Format','').lower())
                elif self.path=='/api/cad/library/open':
                    payload=json.loads(data)
                    if not isinstance(payload,dict) or not isinstance(payload.get('id'),str):raise ValueError('图纸编号无效。')
                    raw,ext,record=drawing_library.read(payload['id'])
                    result=cad_service.import_drawing(raw,ext);result['record']=record
                else:
                    if size>128*1024: return self.send_json({'error':'CAD 计算请求过大。'},413)
                    result=cad_service.calculate(json.loads(data))
                return self.send_json(result)
            except subprocess.TimeoutExpired:
                return self.send_json({'error':'CAD 读取超时，请仅导出单个零件或另存为 DXF 后重试。'},504)
            except (ValueError,UnicodeError) as exc:
                return self.send_json({'error':str(exc)},422)
            except Exception:
                return self.send_json({'error':'CAD 处理未完成，请检查文件或另存为 DXF。'},500)
        if self.path == '/api/vision/jobs':
            if not 0<size<=22*1024*1024: return self.send_json({'error':'识图请求过大，请裁剪图片后重试。'},413)
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':
                return self.send_json({'error':'识图请求格式无效。'},415)
            try:
                return self.send_json(vision.start_job(json.loads(self.rfile.read(size))),202)
            except (ValueError,UnicodeError) as exc:
                return self.send_json({'error':str(exc)},422)
            except RuntimeError as exc:
                return self.send_json({'error':str(exc)},409)
        if not 0<size<=MAX_BYTES:
            return self.send_json({'error':'图片须小于 15 MB。'},413)
        if self.headers.get('Content-Type','').split(';')[0] not in ('image/png','image/jpeg','image/webp','image/bmp','image/tiff'):
            return self.send_json({'error':'请使用 PNG、JPG、WebP、BMP 或 TIFF 图片。'},415)
        try:
            self.send_json(recognize(self.rfile.read(size)))
        except subprocess.TimeoutExpired:
            self.send_json({'error':'识别超时，请裁剪图纸后重试。'},504)
        except (ValueError,RuntimeError) as exc:
            self.send_json({'error':str(exc)},422)
        except Exception:
            self.send_json({'error':'识别服务遇到问题，请换一张图片重试。'},500)

if __name__ == '__main__':
    print(f'铸衡本地工具：http://{HOST}:{PORT}',flush=True)
    print('图片仅在本机识别，服务只监听本机地址。',flush=True)
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
