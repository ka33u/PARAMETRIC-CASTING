import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const worker=await build({entryPoints:['parametric/worker.mjs'],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,loader:{'.wasm':'binary'},external:['node:*'],define:{'import.meta.url':'""'},logLevel:'warning'});
await build({entryPoints:['parametric/app.mjs'],outfile:'dist/param-app.js',bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,define:{__SOLID_WORKER_SOURCE__:JSON.stringify(worker.outputFiles[0].text)},logLevel:'info'});
await fs.writeFile('dist/THIRD-PARTY-NOTICES.txt',`Three.js (MIT)\n${await fs.readFile('node_modules/three/LICENSE','utf8')}\n\nManifold (Apache-2.0)\n${await fs.readFile('node_modules/manifold-3d/LICENSE','utf8')}\n`);
let html=await fs.readFile('dist/index.html','utf8');
for(const file of ['parametric.css','param-app.js']){const hash=createHash('sha256').update(await fs.readFile('dist/'+file)).digest('hex').slice(0,12);html=html.replace(new RegExp(file.replace('.','\\.')+'(?:\\?v=[a-f0-9]+)?','g'),file+'?v='+hash);}
await fs.writeFile('dist/index.html',html);
