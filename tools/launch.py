"""Start or reuse the local service independently of the launcher terminal."""
from pathlib import Path
import argparse
import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get('CASTING_PORT', '4179'))
URL = f'http://127.0.0.1:{PORT}'
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))
SERVICE_VERSION = 'cad-library-20260924-2'

def service_status():
    try:
        with HTTP.open(URL + '/api/status', timeout=1) as response:
            data=json.load(response)
            return data if data.get('service')=='casting-local-ocr' else None
    except (OSError, ValueError):
        return None

def ready():
    return (service_status() or {}).get('version')==SERVICE_VERSION

def ensure_service():
    if ready():
        return
    runtime = ROOT / '.runtime'
    runtime.mkdir(exist_ok=True)
    if service_status():
        # Only upgrade the process this project launched, after verifying its command.
        try:
            pid=int((runtime/'server.pid').read_text())
            command=subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True)
            if str(ROOT/'server.py') not in command:
                raise ValueError('PID does not belong to this project')
            os.kill(pid,signal.SIGTERM)
            for _ in range(30):
                if not service_status(): break
                time.sleep(.1)
        except (OSError,ValueError,subprocess.SubprocessError) as error:
            raise RuntimeError('发现旧版服务，但无法安全重启。请关闭旧版启动进程后重试。') from error
    log_path = runtime / 'server.log'
    with log_path.open('ab', buffering=0) as log:
        child = subprocess.Popen(
            [sys.executable, '-u', str(ROOT / 'server.py')],
            cwd=str(ROOT), stdin=subprocess.DEVNULL,
            stdout=log, stderr=subprocess.STDOUT,
            close_fds=True, start_new_session=True,
        )
    for _ in range(40):
        if child.poll() is not None:
            raise RuntimeError(f'本地服务启动失败，详情见 {log_path}。可先使用同目录下的离线 HTML。')
        if ready():
            (runtime / 'server.pid').write_text(str(child.pid))
            return
        time.sleep(0.2)
    child.terminate()
    raise RuntimeError('本地服务未能正常响应。可先使用同目录下的离线 HTML。')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    try:
        ensure_service()
        print(f'工具已就绪：{URL}')
        print('这个启动窗口可以关闭，计算工具会继续运行。')
        if not args.no_browser:
            webbrowser.open(URL)
        return 0
    except (OSError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
