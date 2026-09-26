import fs from 'node:fs';
import Module from 'manifold-3d';
import {fresh,FAMILIES,buildDesign} from '../parametric/catalog.mjs';
import {evaluateDesign} from '../parametric/solid.mjs';
const wasm=await Module();wasm.setup();const cases=[];
function record(name,state,exportStep=false){const d=buildDesign(state),r=evaluateDesign(wasm,state,{includeMesh:false,includeParts:false});cases.push({name,family:state.family,state,tree:d.tree,manifold_volume:r.volume,export:exportStep});}
for(const [family,f] of Object.entries(FAMILIES))for(const [variant] of f.variants)record(family+'-'+variant,fresh(family,variant),['endcap-bowl','motor-axial','box-rounded','bracket-bracket'].includes(family+'-'+variant));
for(const [family,f] of Object.entries(FAMILIES)){
 if(family==='custom')continue; // Component transforms and dimensions have a dedicated verification generator.
 const state=fresh(family,family==='ring'?'flange':family==='bracket'?'bracket':undefined);
 for(const option of f.options)state.features[option[0]]=option[2].at(-1)[0];
 record(family+'-all-features',state);
 for(const scale of [.45,2.7]){const scaled=structuredClone(state);for(const k of Object.keys(scaled.values))scaled.values[k]*=scale;record(family+'-scale-'+scale,scaled);}
}
const cone=fresh('ring','cone');cone.values.bore=0;record('ring-solid-cone',cone);
const shallow=fresh('endcap');shallow.values.H=8;record('endcap-shallow',shallow);
const thin=fresh('ring');thin.values.bore=149;record('ring-thin-wall',thin);
const thick=fresh('motor','plain');thick.values.t=109.9;thick.features.feet=false;thick.features.flange=false;record('motor-small-bore',thick);
const open=fresh('box');open.features.bottom=false;open.features.lugs=0;record('box-through-open',open);
const overridden=fresh('bracket','bracket');overridden.overrides.ribT=12;overridden.features.holes=true;record('bracket-override-and-holes',overridden);
fs.mkdirSync('.runtime/solid-validation',{recursive:true});fs.writeFileSync('.runtime/solid-validation/cases.json',JSON.stringify(cases,null,2));console.log(cases.length+' independent solid cases generated');
