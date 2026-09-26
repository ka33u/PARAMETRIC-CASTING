// Local DWG decoding only. Inputs and outputs are temporary paths controlled by the server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LibreDwg } from '@mlightcad/libredwg-web';
const dir=path.dirname(fileURLToPath(import.meta.url));
try {
 const input=fs.readFileSync(process.argv[2]);
 if(!/^AC10\d\d/.test(input.subarray(0,6).toString('ascii')))throw new Error('Invalid DWG header');
 const engine=await LibreDwg.create(path.join(dir,'node_modules/@mlightcad/libredwg-web/wasm'));
 const dxf=engine.dwg_write_dxf(input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength));
 if(!dxf||dxf.length<20)throw new Error('DWG conversion failed');
 fs.writeFileSync(process.argv[3],dxf);
} catch(e) { console.error(e.message);process.exitCode=1; }
