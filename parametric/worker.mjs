import Module from 'manifold-3d';
import wasmBinary from '../node_modules/manifold-3d/manifold.wasm';
import {evaluateDesign} from './solid.mjs';
const ready=Module({wasmBinary,locateFile:name=>name}).then(wasm=>{wasm.setup();return wasm;});
self.onmessage=async({data})=>{
 try{
  const result=evaluateDesign(await ready,data.state);
  const transfer=[result.mesh.positions.buffer,result.mesh.indices.buffer,...result.parts.filter(p=>p.mesh).flatMap(p=>[p.mesh.positions.buffer,p.mesh.indices.buffer])];
  if(result.water?.mesh)transfer.push(result.water.mesh.positions.buffer,result.water.mesh.indices.buffer);
  self.postMessage({id:data.id,result},transfer);
 }catch(e){self.postMessage({id:data.id,error:e.message||'三维重建未完成，请调整尺寸后重试。'});}
};
