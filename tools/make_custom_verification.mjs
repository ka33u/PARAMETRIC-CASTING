import fs from 'node:fs';
import Module from 'manifold-3d';
import {fresh,buildDesign} from '../parametric/catalog.mjs';
import {SHAPES,newComponent} from '../parametric/custom.mjs';
import {evaluateDesign} from '../parametric/solid.mjs';
const wasm=await Module();wasm.setup();const cases=[];
function record(name,state,exportStep=false){const d=buildDesign(state),r=evaluateDesign(wasm,state,{includeMesh:false,includeParts:false});cases.push({name,family:state.family,state,tree:d.tree,manifold_volume:r.volume,export:exportStep});}
for(const variant of ['b3','b5'])for(const shell of ['bowl','cone','flat']){const s=fresh('endcap',variant);s.features.shell=shell;if(variant==='b5'){s.features.pilot=true;s.features.flangeHoles=true;}record(variant+'-'+shell,s,shell==='cone');}
for(const type of Object.keys(SHAPES)){const s=fresh('custom');s.components=[newComponent(type)];record('custom-'+type,s);}
const s=fresh('custom');const base=newComponent('box','base');base.values={L:180,W:150,H:12};base.position[2]=-12;
const ring=newComponent('tube','ring');const hole=newComponent('cylinder','holes');hole.operation='cut';hole.values={D:12,H:56};hole.position[2]=-13;hole.array={type:'circle',count:4,step:[0,0,0],radius:55,angle:45};s.components=[base,ring,hole];record('custom-plate-ring-holes',s,true);
const rib=newComponent('wedge','ribs');rib.values={L:30,W:6,H:45};rib.position[2]=0;rib.rotation=[0,0,180];rib.array={type:'circle',count:3,step:[0,0,0],radius:60,angle:0};s.components.push(rib);record('custom-plate-ribs-holes',s);
fs.mkdirSync('.runtime/custom-validation',{recursive:true});fs.writeFileSync('.runtime/custom-validation/cases.json',JSON.stringify(cases,null,2));console.log(cases.length+' independent B3/B5 and custom cases generated');
