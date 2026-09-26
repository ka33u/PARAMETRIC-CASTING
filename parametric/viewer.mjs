import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';

export class SolidViewer{
 constructor(container,onPick,onDimension){
  this.container=container;this.onPick=onPick;this.onDimension=onDimension;this.section=false;this.highlight=null;this.meshes=[];this.showWater=false;this.waterMesh=null;this.toolMeshes=[];this.showTools=false;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#edf1f2');
  this.camera=new THREE.PerspectiveCamera(36,1,.1,50000);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor('#edf1f2');
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.localClippingEnabled=true;
  this.renderer.domElement.setAttribute('aria-label','完整铸件三维模型，可拖动旋转、滚轮缩放、点击部位调整尺寸');this.renderer.domElement.tabIndex=0;
  container.prepend(this.renderer.domElement);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.1;
  this.controls.minPolarAngle=.04;this.controls.maxPolarAngle=Math.PI-.04;
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x6b7578,2.7));
  for(const [color,intensity,pos] of [[0xffffff,3,[2,5,6]],[0xffdfb4,1.4,[-4,1,2]],[0xaed8ed,2,[-1,2,-6]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...pos);this.scene.add(l);}
  this.root=new THREE.Group();this.scene.add(this.root);this.axis=new THREE.AxesHelper(1);this.axis.visible=false;this.scene.add(this.axis);this.plane=new THREE.Plane(new THREE.Vector3(-1,0,0),0);
  this.grid=new THREE.GridHelper(500,20,0xbcc9ce,0xdce3e6);this.grid.material.transparent=true;this.grid.material.opacity=.45;this.scene.add(this.grid);
  this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();let down=null;
  this.renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
  this.renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;down=null;const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects([...this.meshes,...(this.showTools?this.toolMeshes:[])]).find(h=>!this.section||this.plane.distanceToPoint(h.point)>=0);if(hit)this.onPick(hit.object.userData.id);});
  this.renderer.domElement.addEventListener('keydown',e=>{if(e.key==='Home'){e.preventDefault();this.reset();}});
  this.tagLayer=document.createElement('div');this.tagLayer.className='dimension-tags';container.append(this.tagLayer);this.tags=[];
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
  this.anim=()=>{this.frame=requestAnimationFrame(this.anim);this.controls.update();this.updateTags();this.renderer.render(this.scene,this.camera);};this.anim();
 }
 resize(){const r=this.container.getBoundingClientRect();this.renderer.setSize(r.width,r.height);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
 clear(){for(const m of [...this.meshes,...this.toolMeshes,...(this.waterMesh?[this.waterMesh]:[])]){m.geometry.dispose();m.material.dispose();}this.waterMesh=null;this.meshes=[];this.toolMeshes=[];this.root.clear();this.axis.visible=false;}
 update(result,{fit=false}={}){
  const oldSpan=this.span;this.clear();this.result=result;
  for(const part of result.parts){if(!part.mesh)continue;const rawGeo=new THREE.BufferGeometry();rawGeo.setAttribute('position',new THREE.BufferAttribute(part.mesh.positions,3));rawGeo.setIndex(new THREE.BufferAttribute(part.mesh.indices,1));const geo=toCreasedNormals(rawGeo,Math.PI/5);rawGeo.dispose();
   const material=new THREE.MeshStandardMaterial({color:0xb8a184,roughness:.65,metalness:.22,side:THREE.DoubleSide,clippingPlanes:this.section?[this.plane]:[]});
   const mesh=new THREE.Mesh(geo,material);mesh.userData={id:part.id,label:part.label};this.root.add(mesh);this.meshes.push(mesh);
  }
  const box=new THREE.Box3().setFromObject(this.root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());this.box=box;this.size=size;this.center=center;this.span=Math.max(size.x,size.y,size.z);
  this.axis.visible=result.state.family==='custom';this.axis.scale.setScalar(this.span*.35);
  this.verticalZ=['box','bracket','custom'].includes(result.state.family);this.grid.rotation.x=this.verticalZ?Math.PI/2:0;
  if(this.verticalZ)this.grid.position.set(center.x,center.y,box.min.z-this.span*.05);else this.grid.position.set(center.x,box.min.y-this.span*.05,center.z);this.grid.scale.setScalar(this.span/180);this.plane.constant=center.x;
  this.controls.target.copy(center);this.controls.minDistance=this.span*.5;this.controls.maxDistance=this.span*8;this.camera.near=Math.max(.001,this.span/1000);this.camera.far=this.span*100;this.camera.updateProjectionMatrix();
  if(fit||!this.initialized||this.span/oldSpan>1.7||this.span/oldSpan<.6){this.reset();this.initialized=true;}
  if(result.water?.mesh){const data=result.water.mesh,raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.BufferAttribute(data.positions,3));raw.setIndex(new THREE.BufferAttribute(data.indices,1));const geo=toCreasedNormals(raw,Math.PI/5);raw.dispose();
   this.waterMesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x289dc5,roughness:.6,metalness:0,transparent:true,opacity:.82,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.DoubleSide,clippingPlanes:this.section?[this.plane]:[]}));this.root.add(this.waterMesh);}
  for(const part of result.tools||[]){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(part.mesh.positions,3));geo.setIndex(new THREE.BufferAttribute(part.mesh.indices,1));geo.computeVertexNormals();const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xd45d50,transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide,clippingPlanes:this.section?[this.plane]:[]}));m.userData={id:part.id,label:part.label};this.root.add(m);this.toolMeshes.push(m);}
  this.setTools(this.showTools);this.setWater(this.showWater&&!!result.water);this.setHighlight(this.highlight);this.buildTags();
 }
 reset(){if(!this.center)return;const dir=new THREE.Vector3(...(this.verticalZ?[1.25,-1.65,1.5]:[1.05,.7,1.9])).normalize();this.camera.position.copy(this.center).addScaledVector(dir,this.span*2.9);this.camera.up.set(...(this.verticalZ?[0,0,1]:[0,1,0]));this.controls.target.copy(this.center);this.controls.update();}
 setSection(value){this.section=value;for(const m of [...this.meshes,...this.toolMeshes,...(this.waterMesh?[this.waterMesh]:[])]){m.material.clippingPlanes=value?[this.plane]:[];m.material.needsUpdate=true;}}
 setWater(value){this.showWater=value;if(this.waterMesh)this.waterMesh.visible=value;for(const m of this.meshes){m.material.transparent=value;m.material.opacity=value?.2:1;m.material.depthWrite=!value;m.material.needsUpdate=true;}}
 setTools(value){this.showTools=value;for(const m of this.toolMeshes)m.visible=value;}
 setHighlight(id){for(const m of this.toolMeshes)m.material.color.set(m.userData.id===id?0xff3d25:0xd45d50);this.highlight=id;for(const m of this.meshes){m.material.color.set(m.userData.id===id?0xdbac64:0xb8a184);m.material.emissive.set(m.userData.id===id?0x251600:0x000000);}}
 buildTags(){this.tagLayer.replaceChildren();this.tags=[];const s=this.result.state,p=s.values,b=this.box;let list=[];
  if(['endcap','bearing','ring','motor','watercool'].includes(s.family))list=[['D','外径',p.D,new THREE.Vector3(b.max.x,this.center.y,b.max.z)], [['motor','watercool'].includes(s.family)?'L':'H',['motor','watercool'].includes(s.family)?'长度':'深度',['motor','watercool'].includes(s.family)?p.L:p.H,new THREE.Vector3(b.min.x,this.center.y,this.center.z)]];
  else if(s.family==='custom')list=[[null,'X 跨度',Math.round(this.size.x*100)/100,new THREE.Vector3(b.max.x,this.center.y,b.min.z)],[null,'Z 跨度',Math.round(this.size.z*100)/100,new THREE.Vector3(b.min.x,this.center.y,b.max.z)]];
  else list=[['L','长度',p.L,new THREE.Vector3(b.max.x,b.min.y,b.max.z)],['W','宽度',p.W,new THREE.Vector3(b.min.x,b.max.y,b.max.z)]];
  if(s.family==='watercool'&&s.features.flange){
   for(const [end,z] of [['A',0],['B',p.L]]){const key='flange'+end+'Width',value=this.result.details.find(d=>d.key===key)?.value;
    list.push([key,end+' 端宽',value,new THREE.Vector3(-p.D*.28,p.D*.42,z)]);
   }
  }
  for(const [key,label,value,point] of list){const el=document.createElement(key?'button':'span');el.className='dimension-tag';el.textContent=`${label} ${value}`;if(key){el.setAttribute('aria-label','修改'+label);el.onclick=()=>this.onDimension(key);}this.tagLayer.append(el);this.tags.push({el,point});}
 }
 updateTags(){const r=this.container.getBoundingClientRect();for(const {el,point} of this.tags){const p=point.clone().project(this.camera);el.style.left=Math.max(12,Math.min(r.width-115,(p.x*.5+.5)*r.width))+'px';el.style.top=Math.max(48,Math.min(r.height-55,(-p.y*.5+.5)*r.height))+'px';el.hidden=p.z>1;}}
 dispose(){cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.controls.dispose();this.clear();this.renderer.dispose();}
}
