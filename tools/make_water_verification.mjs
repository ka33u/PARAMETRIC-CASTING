import fs from 'node:fs';
import Module from 'manifold-3d';
import {fresh,buildDesign} from '../parametric/catalog.mjs';
import {evaluateDesign} from '../parametric/solid.mjs';
const wasm=await Module();wasm.setup();const cases=[];
function record(name,state,exportStep=false){const d=buildDesign(state),r=evaluateDesign(wasm,state,{includeMesh:false,includeParts:false});cases.push({name,family:state.family,state,tree:d.tree,manifold_volume:r.volume,water_boundary:d.waterBoundary,water_volume:r.water.volume,export:exportStep});}
for(const variant of ['annular','axial','rings']){
 const s=fresh('watercool',variant);record('water-'+variant,s,true);
 s.features={feet:true,flange:true,ports:2,holes:true};record('water-'+variant+'-all',s);
 for(const scale of [.45,2.7]){const scaled=structuredClone(s);for(const k of Object.keys(scaled.values))scaled.values[k]*=scale;record('water-'+variant+'-scale-'+scale,scaled);}
}
const thin=fresh('watercool');thin.values.bore=267;thin.features.ports=0;record('water-gap-half-mm',thin);
const short=fresh('watercool');short.values.L=40;short.features.ports=0;record('water-short-body',short);
const asym=fresh('watercool','axial');asym.values.t=12;asym.values.outerT=5;asym.overrides.turnGap=45;record('water-asymmetric-walls',asym);
const dense=fresh('watercool','axial');dense.features.ports=0;dense.overrides.baffleCount=32;record('water-32-baffles',dense);
const rings=fresh('watercool','rings');rings.features.ports=0;rings.overrides.ringCount=12;rings.overrides.windowAngle=100;record('water-12-rings',rings);
const bare=fresh('watercool');bare.features.feet=false;bare.features.ports=0;record('water-bare-shell',bare);
fs.mkdirSync('.runtime/water-validation',{recursive:true});fs.writeFileSync('.runtime/water-validation/cases.json',JSON.stringify(cases,null,2));console.log(cases.length+' independent water-cooled housing cases generated');
