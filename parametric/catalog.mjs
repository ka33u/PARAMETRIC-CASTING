/* Template relationships are explicit estimates, not claims about Y2/YE4 drawings. */
const field=(key,label,value,min=0.5,max=5000)=>({key,label,value,min,max,step:1,unit:'mm'});
export const FAMILIES={
 endcap:{name:'端盖',subtitle:'碗形 · 锥形 · 平盘',icon:'endcap',variants:[['bowl','碗形端盖'],['cone','锥形端盖'],['flat','平盘端盖']],
  fields:[field('D','主体外径',180,20),field('H','总深度',50,3),field('t','壁厚',6),field('bore','中心孔径',52,0),field('hubD','轴承座外径',85,5)],
  options:[['ears','安装耳',[[0,'无'],[3,'三耳'],[4,'四耳']],3],['ribs','加强筋',[[0,'无'],[3,'三筋'],[6,'六筋']],3],['flange','安装法兰',[[false,'无'],[true,'有']],false],['holes','耳部铸出孔',[[false,'无'],[true,'有']],false]]},
 motor:{name:'电机机座',subtitle:'散热筋 · 双底脚 · 接线座',icon:'motor',variants:[['axial','轴向散热筋'],['rings','环形散热筋'],['plain','光筒机座']],
  fields:[field('D','筒体外径（不含筋）',220,30),field('L','筒体长度',220,10),field('t','筒壁厚度',8),field('finH','散热筋高度',20,0)],
  options:[['feet','安装底脚',[[false,'无'],[true,'双底脚']],true],['terminal','接线座',[[false,'无'],[true,'有']],false],['flange','端部加强圈',[[false,'无'],[true,'两端']],true],['holes','底脚铸出孔',[[false,'无'],[true,'有']],false]]},
 bearing:{name:'轴承盖',subtitle:'内盖 · 外盖 · 阶梯盖',icon:'bearing',variants:[['inner','内盖'],['outer','外盖'],['stepped','阶梯盖']],
  fields:[field('D','端盘外径',115,15),field('bore','中心孔径',45,0),field('H','总高度',24,2),field('t','端盘厚度',6)],
  options:[['groove','环形油槽',[[false,'无'],[true,'有']],false],['holes','法兰铸出孔',[[false,'无'],[true,'四孔']],false]]},
 ring:{name:'法兰与环件',subtitle:'圆环 · 凸台法兰 · 锥套',icon:'ring',variants:[['ring','圆柱 / 圆环'],['flange','凸台法兰'],['cone','锥形套筒']],
  fields:[field('D','主体外径',150,5),field('bore','内径（实心填 0）',80,0),field('H','总高度',30,1)],
  options:[['holes','法兰铸出孔',[[false,'无'],[true,'四孔']],false]]},
 box:{name:'接线盒与盒盖',subtitle:'方盒 · 圆角盒 · 平盖',icon:'box',variants:[['box','方形盒体'],['rounded','圆角盒体'],['lid','盒盖']],
  fields:[field('L','外长',120,10),field('W','外宽',90,10),field('H','外高',55,1),field('t','壁厚 / 盖厚',5)],
  options:[['lugs','安装耳',[[0,'无'],[2,'双耳'],[4,'四耳']],2],['bottom','盒体底板',[[false,'无'],[true,'有']],true],['holes','耳部铸出孔',[[false,'无'],[true,'有']],false]]},
 watercool:{name:'水冷机座',subtitle:'环形水套 · 轴向筋 · 环向筋',icon:'watercool',variants:[['annular','环形水套'],['axial','轴向隔水筋'],['rings','环向隔水筋']],
  fields:[field('D','机座外径',300,30),field('bore','定子腔内径',230,5),field('L','机座总长',300,20),field('t','内筒壁厚',8),field('outerT','外筒壁厚',8)],
  options:[['feet','安装底脚',[[false,'无'],[true,'双底脚']],true],['flange','端部法兰',[[false,'无'],[true,'两端']],false],['ports','进出水口',[[0,'无'],[1,'实心管座'],[2,'铸出水孔']],1],['holes','底脚铸出孔',[[false,'无'],[true,'有']],false]]}

};
const LEGACY_FAMILIES={bracket:{name:'底脚与支架',subtitle:'平底脚 · 三角撑 · 平衡块',icon:'bracket',variants:[['foot','平底脚'],['bracket','带筋支架'],['weight','平衡块']],
  fields:[field('L','长度',100,5),field('W','宽度',55,5),field('H','高度',40,1),field('t','板厚',8)],
  options:[['ribs','加强筋',[[1,'单筋'],[2,'双筋']],2],['holes','底板铸出孔',[[false,'无'],[true,'双孔']],false]]}};
export const getFamily=id=>FAMILIES[id]||LEGACY_FAMILIES[id];
export const clone=x=>JSON.parse(JSON.stringify(x));
export function fresh(family='endcap',variant){
 const f=getFamily(family);if(!f)throw Error('未知零件类别。');
 return {format:'casting-parametric',version:1,family,variant:variant||f.variants[0][0],name:f.name,values:Object.fromEntries(f.fields.map(x=>[x.key,x.value])),features:Object.fromEntries(f.options.map(x=>[x[0],x[3]])),overrides:{},edited:[],density:7.2,quantity:1,basis:'毛坯尺寸'};
}
export function primaryFields(state){
 const list=getFamily(state.family).fields;
 return list.filter(x=>!(state.family==='motor'&&state.variant==='plain'&&x.key==='finH')&&!(state.family==='box'&&state.variant==='lid'&&x.key==='H')&&!(state.family==='bracket'&&state.variant==='foot'&&x.key==='H')&&!(state.family==='bracket'&&state.variant==='weight'&&x.key==='t'));
}
export function activeOptions(s){return getFamily(s.family).options.filter(x=>
 !(s.family==='box'&&s.variant==='lid'&&x[0]==='bottom')&&!(s.family==='bracket'&&s.variant!=='bracket'&&x[0]==='ribs')&&!(s.family==='ring'&&s.variant!=='flange'&&x[0]==='holes')&&
 !(x[0]==='holes'&&((['motor','watercool'].includes(s.family)&&!s.features.feet)||(s.family==='endcap'&&!s.features.ears)||(s.family==='box'&&!s.features.lugs))));
}
export function normalize(input){
 if(!input||input.format!=='casting-parametric'||input.version!==1||!getFamily(input.family))throw Error('不是支持的参数化计算方案。');
 const f=getFamily(input.family);if(!f.variants.some(v=>v[0]===input.variant))throw Error('零件款式无效。');
 const s=fresh(input.family,input.variant);s.name=String(input.name||f.name).slice(0,80);
 for(const k of Object.keys(s.values)){if(input.values&&k in input.values)s.values[k]=input.values[k];}
 for(const o of f.options){const v=input.features?.[o[0]];if(v!==undefined){if(!o[2].some(x=>x[0]===v))throw Error(o[1]+'选项无效。');s.features[o[0]]=v;}}
 s.overrides=input.overrides&&typeof input.overrides==='object'&&!Array.isArray(input.overrides)?clone(input.overrides):{};
 for(const [key,value] of Object.entries(s.overrides)){if(!Number.isFinite(value)||value<0||value>50000||key==='__proto__')throw Error('详细尺寸无效：'+key);}
 // Older water-cooled plans used one axial thickness for both flanges.
 if(s.family==='watercool'&&Object.hasOwn(s.overrides,'flangeT')){
  for(const key of ['flangeAWidth','flangeBWidth'])if(!Object.hasOwn(s.overrides,key))s.overrides[key]=s.overrides.flangeT;
  delete s.overrides.flangeT;
 }
 s.density=input.density??7.2;s.quantity=input.quantity??1;s.basis=input.basis||'毛坯尺寸';
 s.edited=Array.isArray(input.edited)?[...new Set(input.edited.filter(k=>f.fields.some(x=>x.key===k)))]:[];
 if(!['毛坯尺寸','加工后尺寸'].includes(s.basis))throw Error('计算口径无效。');
 return s;
}

// Explicit constructive-solid tree, shared by the browser and independent CAD checker.
export const cube=(x,y,z,pos=[0,0,0])=>({type:'box',size:[x,y,z],position:pos});
export const cyl=(r,h,pos=[0,0,0],r2=r)=>({type:'cylinder',r,r2,h,position:pos});
export const union=(...children)=>({type:'union',children:children.flat().filter(Boolean)});
export const cut=(body,...tools)=>({type:'difference',children:[body,...tools.flat().filter(Boolean)]});
export const transform=(body,rotate=[0,0,0],translate=[0,0,0])=>({type:'transform',body,rotate,translate});
export const prism=(points,h)=>({type:'prism',points,h});
export const revolve=points=>({type:'revolve',points});
const TAU=2*Math.PI;

export function buildDesign(raw){
 const s=normalize(raw),p=s.values,f=s.features,groups=[],cuts=[],details=[],warnings=[];
 let waterBoundary=null,waterInfo=null;
 const assert=(v,m)=>{if(!v)throw Error(m);};
 for(const x of primaryFields(s))assert(Number.isFinite(p[x.key])&&p[x.key]>=x.min&&p[x.key]<=x.max,`${x.label}应在 ${x.min}～${x.max} mm 之间。`);
 assert(Number.isFinite(s.density)&&s.density>0&&s.density<=30,'密度应大于 0 且不超过 30 g/cm³。');
 assert(Number.isInteger(s.quantity)&&s.quantity>=1&&s.quantity<=1000000,'数量应为 1～1000000 的整数。');
 function auto(key,label,value,min=.1,max=50000,unit='mm'){
  assert(max>=min,`${label}没有足够空间，请增大主体尺寸或减小壁厚。`);
  const suggested=Math.max(min,Math.min(max,Math.round(value*1000)/1000));
  const overridden=Object.hasOwn(s.overrides,key),v=overridden?s.overrides[key]:suggested;
  assert(Number.isFinite(v)&&v>=min&&v<=max,`${label}应在 ${min}～${Math.round(max*1000)/1000} ${unit}之间。`);
  if(unit==='个')assert(Number.isInteger(v),label+'应为整数。');
  details.push({key,label,value:v,suggested,min,max,unit,overridden});return v;
 }
 const add=(id,label,shape,keys=[])=>groups.push({id,label,shape,keys});
 function radialRibs(count,r0,r1,z0,z1,thickness){
  return union(Array.from({length:count},(_,i)=>transform(prism([[r0,z0],[r1,z0],[r0,z1]],thickness),[90,0,360*i/count],[-Math.sin(TAU*i/count)*thickness/2,Math.cos(TAU*i/count)*thickness/2,0])));
 }
 function ears(count,R,z,thick,width,length,hole){
  const x=R+length-width/2;
  const shape=union(cube(x-R+thick,width,thick,[R-thick,-width/2,z]),cyl(width/2,thick,[x,0,z]));
  add('ears','安装耳',union(Array.from({length:count},(_,i)=>transform(shape,[0,0,360*i/count]))),['earLength','earWidth','earT']);
  if(hole)for(let i=0;i<count;i++)cuts.push(transform(cyl(hole/2,thick+2,[x,0,z-1]),[0,0,360*i/count]));
 }
 if(s.family==='endcap'){
  const {D,H,t,bore,hubD}=p,R=D/2;
  assert(t<H,'壁厚应小于总深度。');assert(hubD<D-2*t,'轴承座外径应小于主体内径。');assert(bore<hubD,'中心孔径应小于轴承座外径。');
  const backRatio=s.variant==='cone'?auto('backRatio','锥壳后端 / 前端直径比',.68,.3,1,'倍'):1,rb=R*backRatio;
  assert(hubD<2*(rb-t),'轴承座过大，已超过端盖后端内径；增大主体外径或后端比例。');
  const hubH=auto('hubH','轴承座总高度',s.variant==='flat'?H:Math.min(H*.6,t*4),t,H);
  const body=s.variant==='flat'?cyl(R,t):revolve([[0,0],[rb,0],[R,H],[R-t,H],[rb+(R-rb)*t/H-t,t],[0,t]]);
  add('body','盖体',body,['D','H','t']);add('hub','轴承座',cyl(hubD/2,hubH),['hubD','bore','hubH']);
  if(bore>0)cuts.push(cyl(bore/2,H+2,[0,0,-1]));
  if(f.flange){const fw=auto('flangeWidth','法兰伸出宽度',D*.07,.5,D/2),ft=auto('flangeT','法兰厚度',t*1.3,.5,H);add('flange','安装法兰',cut(cyl(R+fw,ft,[0,0,H-ft]),cyl(R-t,ft+2,[0,0,H-ft-1])),['flangeWidth','flangeT']);}
  if(f.ears){const et=auto('earT','安装耳厚度',t*1.5,.5,H),ew=auto('earWidth','安装耳宽度',D*.15,t,D),el=auto('earLength','安装耳伸出',D*.15,ew/2,D);
   const hole=f.holes?auto('holeD','铸出孔径',Math.min(ew*.35,et),.5,ew*.85):0;ears(f.ears,R,s.variant==='flat'?0:H-et,et,ew,el,hole);}
  if(f.ribs){const rt=auto('ribT','加强筋厚度',t*.7,.5,D/8),rh=auto('ribH','加强筋总高度',Math.min(hubH,H*.8),t,H);add('ribs','加强筋',radialRibs(f.ribs,hubD/2-t*.4,rb-t*.4,t*.75,rh,rt),['ribT','ribH']);}
 }else if(s.family==='motor'){
  const {D,L,t,finH}=p,R=D/2;assert(2*t<D,'筒壁厚度应小于外径的一半。');
  add('body','机座筒体',cut(cyl(R,L),cyl(R-t,L+2,[0,0,-1])),['D','L','t']);
  cuts.push(cyl(R-t,L+2,[0,0,-1]));
  if(f.flange){const w=auto('ringWidth','端圈轴向宽度',L*.07,.5,L/3),h=auto('ringH','端圈径向增厚',t*.6,.1,D/3);add('flange','前后加强圈',union([0,L-w].map(z=>cut(cyl(R+h,w,[0,0,z]),cyl(R-t,w+2,[0,0,z-1])))),['ringWidth','ringH']);}
  if(s.variant!=='plain'&&finH>0){
   const n=auto('finCount','散热筋数量',s.variant==='rings'?4:24,1,64,'个'),ft=auto('finT','散热筋根厚',Math.max(2,t*.55),.5,Math.min(D,L)/3),end=auto('finEnd','筋端部留空',L*.12,0,L*.45),len=L-2*end;
   if(s.variant==='rings'){assert(n*ft<=len,'环筋数量 × 厚度超过可用长度。');add('fins','环形散热筋',union(Array.from({length:n},(_,i)=>cut(cyl(R+finH,ft,[0,0,end+(n===1?(len-ft)/2:i*(len-ft)/(n-1))]),cyl(R-t*.2,ft+2,[0,0,end+(n===1?(len-ft)/2:i*(len-ft)/(n-1))-1])))),['finH','finCount','finT','finEnd']);}
   else {const fin=prism([[R-t*.3,-ft/2],[R+finH,-ft*.32],[R+finH,ft*.32],[R-t*.3,ft/2]],len);const items=[];
    for(let i=0;i<n;i++){const a=i*360/n;if(f.feet&&a>220&&a<320)continue;items.push(transform(fin,[0,0,a],[0,0,end]));}
    add('fins','轴向散热筋',union(items),['finH','finCount','finT','finEnd']);if(f.feet)warnings.push('双底脚款式已让开底部散热筋；“散热筋数量”是整圈分度数。');}
  }
  if(f.feet){
   const fl=auto('footL','底脚长度',L*.68,t,L*1.3),fw=auto('footW','单脚宽度',D*.24,t,D/2),ft=auto('footT','底脚板厚',t*1.7,.5,D/3),web=auto('footWeb','脚座连接厚度',t*1.5,.5,fw);
   const shapes=[];for(const sign of [-1,1]){const x=sign*R*.7;shapes.push(cube(fw,ft,fl,[x-fw/2,-R*1.05-ft,(L-fl)/2]),cube(web,R*.46,fl*.65,[x-web/2,-R*1.05,(L-fl*.65)/2]));
    if(f.holes){const hd=autoOnce('holeD','底脚铸出孔径',Math.min(t*1.6,fw*.4),.5,fw*.7);for(const zz of [L/2-fl*.32,L/2+fl*.32])cuts.push(transform(cyl(hd/2,ft+2),[90,0,0],[x,-R*1.05+1,zz]));}}
   add('feet','底脚与脚座',union(shapes),['footL','footW','footT','footWeb']);
  }
  if(f.terminal){const bl=auto('terminalL','接线座长度',L*.35,3*t,L),bw=auto('terminalW','接线座宽度',D*.4,3*t,D),bh=auto('terminalH','接线座高度',D*.22,2*t,D),bt=auto('terminalT','接线座壁厚',t,.5,Math.min(bl,bw,bh)/2-.1);
   const boxBody=cut(cube(bw,bh,bl,[-bw/2,R*.82,(L-bl)/2]),cube(bw-2*bt,bh-bt+1,bl-2*bt,[-bw/2+bt,R*.82+bt,(L-bl)/2+bt]));
   add('terminal','接线座',boxBody,['terminalL','terminalW','terminalH','terminalT']);}
 }else if(s.family==='watercool'){
  const {D,bore,L,t,outerT}=p,R=D/2,ri=bore/2+t,ro=R-outerT,gap=ro-ri;
  assert(bore<D,'定子腔内径应小于机座外径。');
  assert(gap>=.5,'水套没有足够空间：外径与内径的半差，须大于内外筒壁厚之和，并至少留 0.5 mm 水套净厚。');
  const seal=auto('sealT','两端封水环厚度',Math.max(t,outerT)*1.5,.5,(L-1)/2),wl=L-2*seal;
  const annulus=(r0,r1,h,z=0)=>cut(cyl(r1,h,[0,0,z]),cyl(r0,h+2,[0,0,z-1]));
  waterBoundary=annulus(ri,ro,wl,seal);
  waterInfo={gap,length:wl,innerDiameter:ri*2,outerDiameter:ro*2};
  add('inner','内筒',annulus(bore/2,ri,L),['bore','t','L']);
  add('outer','外筒',annulus(ro,R,L),['D','outerT','L']);
  add('seals','两端封水环',union([0,L-seal].map(z=>annulus(ri-t*.1,ro+outerT*.1,seal,z))),['sealT']);
  let n=0;
  if(s.variant==='axial'){
   n=auto('baffleCount','轴向隔水筋数量',8,2,32,'个');
   const bt=auto('baffleT','隔水筋厚度',t*.75,.5,Math.min(t*3,ri*Math.sin(Math.PI/n))),endGap=auto('turnGap','端部过水间隙',wl*.12,.5,wl*.45);
   const rib=(z,h)=>cube(gap+t*.2+outerT*.2,bt,h,[ri-t*.2,-bt/2,z]);
   add('baffles','轴向隔水筋',union(Array.from({length:n},(_,i)=>transform(rib(seal+(i>0&&i%2===0?endGap:0),wl-(i===0?0:endGap)),[0,0,90+i*360/n]))),['baffleCount','baffleT','turnGap']);
  }else if(s.variant==='rings'){
   n=auto('ringCount','环向隔水筋数量',3,1,12,'个');
   const bt=auto('baffleT','隔水筋厚度',t*.75,.5,wl/(n+1)*.6),angle=auto('windowAngle','交替过水窗口角度',50,10,120,'°');
   const ribs=[];
   for(let i=0;i<n;i++){
    const z=seal+(i+1)*wl/(n+1)-bt/2,a=(i%2?270:90)*Math.PI/180,half=angle*Math.PI/360;
    const window=transform(prism([[0,0],[2*R*Math.cos(a-half),2*R*Math.sin(a-half)],[2*R*Math.cos(a+half),2*R*Math.sin(a+half)]],bt+2),[0,0,0],[0,0,z-1]);
    ribs.push(cut(annulus(ri-t*.2,ro+outerT*.2,bt,z),window));
   }
   add('baffles','环向隔水筋',union(ribs),['ringCount','baffleT','windowAngle']);
  }
  if(f.feet){
   const fl=auto('footL','底脚长度',L*.68,.5,L*1.3),fw=auto('footW','单脚宽度',D*.24,.5,D/2),ft=auto('footT','底脚板厚',outerT*1.7,.5,D/3),web=auto('footWeb','脚座连接厚度',outerT*1.5,.5,fw);
   const shapes=[];for(const sign of [-1,1]){const x=sign*R*.7;shapes.push(cube(fw,ft,fl,[x-fw/2,-R*1.05-ft,(L-fl)/2]),cube(web,R*.46,fl*.65,[x-web/2,-R*1.05,(L-fl*.65)/2]));
    if(f.holes){const hd=autoOnce('holeD','底脚铸出孔径',Math.min(ft,fw*.35),.5,fw*.7);for(const zz of [L/2-fl*.32,L/2+fl*.32])cuts.push(transform(cyl(hd/2,ft+2),[90,0,0],[x,-R*1.05+1,zz]));}}
   // Feet attach only to the outside wall, never fill the water jacket.
   add('feet','底脚与脚座',cut(union(shapes),cyl(ro,L+2,[0,0,-1])),['footL','footW','footT','footWeb']);
  }
  if(f.flange){
   const fw=auto('flangeWidth','两端法兰径向伸出',D*.07,.5,D/2),a=auto('flangeAWidth','A 端法兰轴向宽度',seal,.5,L-.5),b=auto('flangeBWidth','B 端法兰轴向宽度',seal,.5,L-.5);
   assert(a+b<=L,'A、B 两端法兰轴向宽度之和不能超过机座总长。');
   add('flangeA','A 端法兰',annulus(ro,R+fw,a),['flangeAWidth','flangeWidth']);
   add('flangeB','B 端法兰',annulus(ro,R+fw,b,L-b),['flangeBWidth','flangeWidth']);
  }
  if(f.ports){
   const portLimit=s.variant==='axial'?Math.floor(1700*R*Math.sin(Math.PI/n))/1000:D;
   const pd=auto('portD','水口管座外径',Math.min(D*.13,wl*.2),2,Math.min(D*.4,wl*.45,portLimit)),ph=auto('portH','管座伸出高度',outerT*2,.5,D/3);
   const hd=f.ports===2?auto('portBore','铸出水孔直径',pd*.45,.5,pd*.8):0;
   const zMargin=pd/2+.1;assert(wl>2*zMargin,'水套长度不足以容纳水口管座，请减小管座外径或封水环厚度。');
   const portAt=s.variant==='axial'?[[90+180/n,seal+zMargin],[90-180/n,n%2?L-seal-zMargin:seal+zMargin]]:[[90,seal+zMargin],[90,L-seal-zMargin]];
   const places=portAt.map(([angle,z])=>{const a=angle*Math.PI/180;return{angle,z,c:Math.cos(a),s:Math.sin(a)};});
   if(s.variant==='axial')assert(pd<2*(R+ph/2)*Math.sin(Math.PI/n),'管座过宽，会与相邻管座相交；请减小管座外径或隔水筋数量。');
   add('ports','进出水管座',union(places.map(q=>transform(cyl(pd/2,ph+outerT*.4),[0,90,q.angle],[(R-outerT*.4)*q.c,(R-outerT*.4)*q.s,q.z]))),['portD','portH','portBore']);
   if(hd)for(const q of places){const r0=(ri+ro)/2;cuts.push(transform(cyl(hd/2,R+ph-r0+1),[0,90,q.angle],[r0*q.c,r0*q.s,q.z]));}
   else warnings.push('当前为实心进出水管座，未扣后续钻孔；水套空腔已扣除。');
  }
  warnings.push('水冷模型按整体灰铸铁结构估重。水套容积不含接管，水与外购接头不计重；隔水筋为通用模板，不作流量或冷却性能验证。');
 }else if(s.family==='bearing'){
  const {D,bore,H,t}=p;assert(t<=H,'端盘厚度不能超过总高度。');assert(bore<D,'中心孔径应小于端盘外径。');
  const hd=auto('hubD','凸台外径',Math.max(bore+(D-bore)*.4,D*.62),bore+.5,D),h2=s.variant==='stepped'?auto('stepH','第二级凸台高度',H*.4,.1,H-.1):0;
  add('body','端盘',cyl(D/2,t,[0,0,s.variant==='outer'?H-t:0]),['D','t']);add('hub','轴承凸台',cyl(hd/2,s.variant==='stepped'?H-h2:H),['hubD','H']);
  if(s.variant==='stepped')add('step','阶梯凸台',cyl((hd+bore)/4,H,[0,0,0]),['stepH']);
  if(bore>0)cuts.push(cyl(bore/2,H+2,[0,0,-1]));
  if(f.groove){const gw=auto('grooveW','油槽宽度',Math.min(t*.45,(hd-bore)*.12),.2,(hd-bore)/4),gd=auto('grooveDepth','油槽深度',t*.3,.1,Math.min(H,t)*.8),r=(bore+hd)/4;cuts.push(cut(cyl(r+gw/2,gd+1,[0,0,H-gd]),cyl(r-gw/2,gd+3,[0,0,H-gd-1])));}
  if(f.holes){const hole=auto('holeD','铸出孔径',Math.min(t*1.4,(D-hd)*.2),.5,(D-hd)*.45),pcd=(D+hd)/2;for(let i=0;i<4;i++)cuts.push(cyl(hole/2,H+2,[pcd/2*Math.cos(i*TAU/4),pcd/2*Math.sin(i*TAU/4),-1]));}
 }else if(s.family==='ring'){
  const {D,bore,H}=p;assert(bore<D,'内径应小于外径。');
  if(s.variant==='cone'){
   const endD=auto('endD','末端外径',D*.7,.5,D*2),endBore=auto('endBore','末端内径',Math.max(0,endD-(D-bore)),0,endD-.1);
   add('body','锥形套筒',revolve([[bore/2,0],[D/2,0],[endD/2,H],[endBore/2,H]]),['D','bore','H','endD','endBore']);
  }else {
   const base=s.variant==='flange'?auto('flangeT','法兰盘厚度',H*.35,.5,H):H;
   add('body',s.variant==='flange'?'法兰盘':'圆环主体',cyl(D/2,base),['D','H','flangeT']);
   if(s.variant==='flange'){const hd=auto('hubD','凸台外径',Math.max(D*.65,bore+(D-bore)*.4),bore+.5,D);add('hub','中心凸台',cyl(hd/2,H),['hubD']);if(f.holes){const hole=auto('holeD','铸出孔径',Math.min(base,(D-hd)*.22),.5,(D-hd)*.45),pcd=(D+hd)/2;for(let i=0;i<4;i++)cuts.push(cyl(hole/2,H+2,[pcd/2*Math.cos(i*TAU/4),pcd/2*Math.sin(i*TAU/4),-1]));}}
   if(bore>0)cuts.push(cyl(bore/2,H+2,[0,0,-1]));
  }
 }else if(s.family==='box'){
  const {L,W,H,t}=p;assert(2*t<Math.min(L,W),'壁厚应小于短边的一半。');
  const h=s.variant==='lid'?t:H;assert(s.variant==='lid'||t<H,'底板厚度应小于盒体高度。');
  const r=s.variant==='rounded'?auto('cornerR','外圆角半径',Math.min(L,W)*.12,t,Math.min(L,W)/2-.1):0;
  const rr=(a,b,c,z=0)=>r?roundedBox(a,b,c,Math.max(.1,r-(L-a)/2),[-a/2,-b/2,z]):cube(a,b,c,[-a/2,-b/2,z]);
  const body=s.variant==='lid'?rr(L,W,t):cut(rr(L,W,H),rr(L-2*t,W-2*t,H+2,f.bottom?t:-1));
  add('body',s.variant==='lid'?'盒盖':'盒体',body,['L','W','H','t','cornerR']);
  if(f.lugs){const el=auto('earLength','耳部伸出长度',W*.2,t,L/2),ew=auto('earWidth','耳部宽度',W*.25,t,W/2),et=auto('earT','耳部厚度',t,.5,h),hole=f.holes?auto('holeD','铸出孔径',ew*.3,.5,Math.min(ew,el)*.7):0;
   const shapes=[];for(const sign of [-1,1])for(const y of f.lugs===4?[-W*.3,W*.3]:[0]){shapes.push(cube(el+t,ew,et,[sign>0?L/2-t:-L/2-el,y-ew/2,0]));if(hole)cuts.push(cyl(hole/2,et+2,[sign*(L/2+el/2),y,-1]));}
   add('ears','安装耳',union(shapes),['earLength','earWidth','earT']);}
 }else if(s.family==='bracket'){
  const {L,W,H,t}=p,h=s.variant==='foot'?t:H;
  assert(s.variant==='weight'||t<=Math.min(L,W,h),'板厚不能大于零件尺寸。');
  if(s.variant==='weight')add('body','平衡块',cube(L,W,H,[-L/2,-W/2,0]),['L','W','H']);
  else {add('body','底板',cube(L,W,t,[-L/2,-W/2,0]),['L','W','t']);if(s.variant==='bracket'){
   add('back','立板',cube(t,W,H,[-L/2,-W/2,0]),['H']);const rt=auto('ribT','加强筋厚度',t*.7,.5,W/(f.ribs+1));
   const ribs=[];for(let i=0;i<f.ribs;i++){const y=f.ribs===1?0:(i?1:-1)*W*.28;ribs.push(transform(prism([[-L/2+t*.5,t*.5],[L/2-t,t*.5],[-L/2+t*.5,H-t*.5]],rt),[90,0,0],[0,y+rt/2,0]));}add('ribs','三角加强筋',union(ribs),['ribT']);}}
  if(f.holes){const hd=auto('holeD','铸出孔径',Math.min(W*.18,t*1.5),.5,Math.min(W,L)*.35);for(const x of [-L*.28,L*.28])cuts.push(cyl(hd/2,h+2,[x,0,-1]));}
 }
 function autoOnce(...args){const old=details.find(d=>d.key===args[0]);return old?old.value:auto(...args);}
 function roundedBox(L,W,H,r,pos){r=Math.min(r,L/2,W/2);return transform(union(cube(L-2*r,W,H,[r,0,0]),cube(L,W-2*r,H,[0,r,0]),[r,L-r].flatMap(x=>[r,W-r].map(y=>cyl(r,H,[x,y,0])))),[0,0,0],pos);}
 if(s.family==='bracket')warnings.push('这是已取消类别的旧方案，仅保留读取兼容；新建请选择上方类别。');
 const known=new Set(details.map(d=>d.key));for(const key of Object.keys(s.overrides))if(!known.has(key))warnings.push(`未启用的详细参数 ${key} 本次不参与计算。`);
 return {state:s,groups,cuts,waterBoundary,waterInfo,tree:cut(union(groups.map(g=>g.shape)),cuts),details,warnings,primary:primaryFields(s),label:getFamily(s.family).variants.find(v=>v[0]===s.variant)[1]};
}
