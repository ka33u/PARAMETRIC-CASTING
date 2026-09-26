(function(root){
'use strict';
function inRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
}return inside;}
function contains(region,p){return region.polygons.some(g=>inRing(p,g.outer)&&!g.holes.some(h=>inRing(p,h)));}
function hits(regions,p){return regions.filter(r=>contains(r,p)).sort((a,b)=>(a.source==='hatch'?0:1)-(b.source==='hatch'?0:1)||a.area-b.area);}
function distanceToLine(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],ll=dx*dx+dy*dy;if(ll===0)return Infinity;const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/ll));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function sideOf(axis,p){const [a,b]=axis;return (b[1]-a[1])*(p[0]-a[0])-(b[0]-a[0])*(p[1]-a[1])>=0?1:-1;}
function calibration(a,b,length){const d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d<1e-8||!Number.isFinite(length)||length<=0)throw Error('标定两点须不同，实际长度须大于 0。');return length/d;}
const api={inRing,contains,hits,distanceToLine,sideOf,calibration};if(typeof module!=='undefined')module.exports=api;root.CastingCAD=api;
})(typeof globalThis!=='undefined'?globalThis:this);
