import fs from 'node:fs';
import Module from 'manifold-3d';
import {fresh,buildDesign} from '../parametric/catalog.mjs';
import {evaluateDesign} from '../parametric/solid.mjs';
const wasm=await Module();wasm.setup();
const cases=['annular','axial','rings'].map(variant=>{
 const state=fresh('watercool',variant);state.features={feet:true,flange:true,ports:2,holes:true};
 state.overrides={flangeAWidth:20,flangeBWidth:35};
 const d=buildDesign(state),r=evaluateDesign(wasm,state,{includeMesh:false,includeParts:false});
 return {name:'water-'+variant+'-unequal-flanges',family:state.family,state,tree:d.tree,manifold_volume:r.volume,water_boundary:d.waterBoundary,water_volume:r.water.volume};
});
fs.mkdirSync('.runtime/flange-validation',{recursive:true});
fs.writeFileSync('.runtime/flange-validation/cases.json',JSON.stringify(cases,null,2));
console.log(cases.length+' independent unequal-flange cases generated');
