import {SOURCES,CONTROLS} from './model.js';
const source=id=>SOURCES.find(s=>s.id===id);
const clocks=['America/New_York','UTC','Asia/Kolkata'].map(timeZone=>new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}));
export const duration=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n)%60).padStart(2,'0')}`;
export function text(ctx,value,x,y,size=16,color='#e1e5e3',align='left',weight=600){ctx.font=`${weight} ${size}px system-ui,"Segoe UI",Arial,sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(value),x,y);}
export function fill(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
export function actionActive(id,s){return id==='inputA'?s.selected==='a':id==='inputB'?s.selected==='b':id==='takeLive'||id==='returnLive'?s.mode==='live':id==='adBreak'?s.mode==='break':id==='off'&&s.mode==='off';}
function screenContext(canvas){
  const ctx=canvas.getContext('2d'),scaleX=(canvas.width||1024)/1024,scaleY=(canvas.height||576)/576;
  ctx.setTransform?.(scaleX,0,0,scaleY,0,0);ctx.imageSmoothingEnabled=true;if('imageSmoothingQuality'in ctx)ctx.imageSmoothingQuality='high';return ctx;
}
export function paintScreens(canvases,bank,s){
  const tv=screenContext(canvases.tv),left=screenContext(canvases.left),right=screenContext(canvases.right);
  fill(tv,0,0,1024,576,'#090d11');const now=new Date();
  clocks.forEach((fmt,i)=>{text(tv,['US EASTERN','UTC','IST'][i],22+i*341,18,16,'#d0d8da');text(tv,fmt.format(now),22+i*341,54,40,'#ff816c',undefined,700);});
  SOURCES.forEach((src,i)=>{const x=12+(i%2)*504,y=87+Math.floor(i/2)*238;bank.draw(tv,src.id,x,y,492,205);fill(tv,x,y+205,492,26,s.output===src.id?'#663b2c':s.selected===src.id?'#345345':'#20292e');text(tv,src.name.toUpperCase(),x+10,y+219,17,'#f1f5f2');text(tv,s.output===src.id?'● CHANNEL':s.selected===src.id?'SELECTED':'READY',x+480,y+219,16,s.output===src.id?'#ffbe90':'#b9d4c7','right');});
  fill(left,0,0,1024,576,'#191919');fill(left,0,0,1024,42,'#262626');text(left,'CLOUDPORT-STYLE / MOCK PLAYOUT',15,22,18,'#f0f2ed');text(left,'PLAYOUT',1003,22,17,'#f4b98e','right');
  text(left,'CH 01',16,68,30,'#f2f4ef',undefined,700);text(left,clocks[1].format(now)+' UTC',200,68,25,'#e7e4dc');text(left,'SELECTED: '+source(s.selected).name.toUpperCase(),1006,68,20,'#ffc08e','right');
  fill(left,10,97,320,382,'#282828');text(left,'SELECTED SOURCE / READY TO TAKE',19,116,16,'#eef1ec');bank.draw(left,s.selected,17,134,306,172);
  fill(left,17,316,306,34,'#322a27');text(left,source(s.selected).name,27,333,19,'#ffc393');text(left,'CHANNEL: '+source(s.output).name.toUpperCase(),20,377,17,'#d2ddd6');text(left,s.mode==='break'?'AD BREAK ACTIVE':s.mode==='live'?'LIVE OUTPUT ACTIVE':'RESCUE / LIVE OFF',20,410,20,'#ffc28f',undefined,700);text(left,'SESSION '+duration(s.elapsed),20,449,17,'#bac8cc');
  const headers=[['ASSET',355],['TYPE',665],['STATE',832]];fill(left,345,99,668,40,'#333333');headers.forEach(([v,x])=>text(left,v,x,119,16,'#e0ddd6'));
  SOURCES.forEach((src,i)=>{const y=143+i*72;fill(left,345,y,668,66,s.output===src.id?'#4b3b23':s.selected===src.id?'#453044':i%2?'#343434':'#393939');fill(left,345,y,6,66,src.color);text(left,src.name,365,y+22,22,'#c4e6f3');text(left,'LOCAL FILE / LOOPING',365,y+48,16,'#d0cfc8');text(left,src.id==='rescue'?'FALLBACK':src.id==='break'?'AD BREAK':'INPUT',665,y+33,16,'#eceee9');text(left,s.output===src.id?'ON CHANNEL':s.selected===src.id?'SELECTED':'READY',832,y+33,16,s.output===src.id?'#ffc291':'#c9e2d4');});
  text(left,'TRAINING INTERFACE · NOT CONNECTED TO AMAGI',354,466,15,'#b7c0bd');
  CONTROLS.forEach((control,i)=>{const x=i*170.666;fill(left,x+3,512,164,57,actionActive(control.id,s)?'#b67140':'#383c3d');text(left,control.label,x+85,541,control.id==='off'?15:18,'#fff4e8','center',700);});
  fill(right,0,0,1024,576,'#0c1014');fill(right,0,0,1024,50,s.mode==='live'?'#3d2524':s.mode==='break'?'#45321f':'#253b36');text(right,'CHANNEL PREVIEW',20,26,22,'#f0f4f2',undefined,700);text(right,s.mode==='live'?'● LIVE':s.mode==='break'?'● AD BREAK':'● RESCUE',1002,26,22,s.mode==='live'?'#ff9a8a':'#efbf8b','right',700);bank.draw(right,s.output,12,60,1000,462);text(right,source(s.output).name.toUpperCase(),20,551,22,'#f1f4f2');text(right,duration(s.elapsed-s.since)+' / '+clocks[1].format(now)+' UTC',1004,551,20,'#b8ccd2','right');
}
