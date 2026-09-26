"""Regression: losing the preview log pipe must not drop HTTP responses."""
import importlib.util
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).parents[1]))
spec = importlib.util.spec_from_file_location('casting_server', Path(__file__).parents[1] / 'server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class BrokenPipe:
    def write(self, value):
        raise BrokenPipeError('preview output pipe closed')

class LoggingTests(unittest.TestCase):
    def handler(self):
        instance=object.__new__(server.Handler)
        instance.client_address=('127.0.0.1',12345)
        return instance
    def test_disconnected_preview_stderr(self):
        with patch('sys.stderr',BrokenPipe()):
            self.handler().log_message('GET / %s','200')
    def test_closed_output_stream(self):
        stream=io.StringIO()
        stream.close()
        with patch('sys.stderr',stream):
            self.handler().log_message('GET / %s','200')

if __name__=='__main__': unittest.main()
