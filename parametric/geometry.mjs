// Constructive geometry shared by the browser and independent CAD verification.
export const cube=(x,y,z,pos=[0,0,0])=>({type:'box',size:[x,y,z],position:pos});
export const cyl=(r,h,pos=[0,0,0],r2=r)=>({type:'cylinder',r,r2,h,position:pos});
export const sphere=(r,pos=[0,0,0])=>({type:'sphere',r,position:pos});
export const union=(...children)=>({type:'union',children:children.flat().filter(Boolean)});
export const cut=(body,...tools)=>({type:'difference',children:[body,...tools.flat().filter(Boolean)]});
export const transform=(body,rotate=[0,0,0],translate=[0,0,0])=>({type:'transform',body,rotate,translate});
export const prism=(points,h)=>({type:'prism',points,h});
export const revolve=points=>({type:'revolve',points});
