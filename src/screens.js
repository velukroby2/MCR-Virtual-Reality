import {SOURCES,CONTROLS} from './model.js';
const source=id=>SOURCES.find(s=>s.id===id);
const clocks=['America/New_York','UTC','Asia/Kolkata'].map(timeZone=>new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}));
export const duration=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n)%60).padStart(2,'0')}`;
export function text(ctx,value,x,y,size=16,color='#e1e5e3',align='left'){ctx.font=`${size}px "Segoe UI",Arial`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(value),x,y);}
export function fill(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
export function actionActive(id,s){return id==='inputA'?s.selected==='a':id==='inputB'?s.selected==='b':id==='takeLive'||id==='returnLive'?s.mode==='live':id==='adBreak'?s.mode==='break':id==='off'&&s.mode==='off';}
export function paintScreens(canvases,bank,s){
  const tv=canvases.tv.getContext('2d'),left=canvases.left.getContext('2d'),right=canvases.right.getContext('2d');
  fill(tv,0,0,1024,576,'#090d11');const now=new Date();
  clocks.forEach((fmt,i)=>{text(tv,['US EASTERN','UTC','IST'][i],22+i*341,18,12,'#b7bebe');text(tv,fmt.format(now),22+i*341,53,38,'#ff735c');});
  SOURCES.forEach((src,i)=>{const x=12+(i%2)*504,y=87+Math.floor(i/2)*238;bank.draw(tv,src.id,x,y,492,205);fill(tv,x,y+205,492,24,s.output===src.id?'#663b2c':s.selected===src.id?'#345345':'#20292e');text(tv,src.name.toUpperCase(),x+10,y+218,13);text(tv,s.output===src.id?'● CHANNEL':s.selected===src.id?'SELECTED':'READY',x+480,y+218,12,s.output===src.id?'#ffbe90':'#99baa9','right');});
  fill(left,0,0,1024,576,'#191919');fill(left,0,0,1024,39,'#262626');text(left,'CLOUDPORT-STYLE / MOCK PLAYOUT',15,20,15,'#e1e1dd');text(left,'Playout',955,20,14,'#efad79','right');
  text(left,'CH 01',16,66,28);text(left,clocks[1].format(now)+' UTC',200,66,23,'#dcd9cf');text(left,'SELECTED: '+source(s.selected).name.toUpperCase(),1006,67,17,'#f0b382','right');
  fill(left,10,97,320,382,'#282828');text(left,'SELECTED SOURCE / READY TO TAKE',19,114,11);bank.draw(left,s.selected,17,134,306,172);
  fill(left,17,316,306,32,'#322a27');text(left,source(s.selected).name,27,332,16,'#f9ba86');text(left,'CHANNEL: '+source(s.output).name.toUpperCase(),20,376,13,'#b4c1b8');text(left,s.mode==='break'?'AD BREAK ACTIVE':s.mode==='live'?'LIVE OUTPUT ACTIVE':'RESCUE / LIVE OFF',20,407,17,'#e6af86');text(left,'Session '+duration(s.elapsed),20,446,14,'#9facaf');
  const headers=[['ASSET',355],['TYPE',665],['STATE',832]];fill(left,345,99,668,40,'#333333');headers.forEach(([v,x])=>text(left,v,x,119,13,'#c9c6bf'));
  SOURCES.forEach((src,i)=>{const y=143+i*72;fill(left,345,y,668,66,s.output===src.id?'#4b3b23':s.selected===src.id?'#453044':i%2?'#343434':'#393939');fill(left,345,y,5,66,src.color);text(left,src.name,365,y+23,20,'#b1d5e6');text(left,'Local file / looping',365,y+47,12,'#aaa9a0');text(left,src.id==='rescue'?'FALLBACK':src.id==='break'?'AD BREAK':'INPUT',665,y+32,12);text(left,s.output===src.id?'ON CHANNEL':s.selected===src.id?'SELECTED':'READY',832,y+32,12,s.output===src.id?'#ffc291':'#b3cba6');});
  text(left,'Training interface only · not connected to Amagi',354,460,12,'#939b98');
  CONTROLS.forEach((control,i)=>{const x=i*170.666;fill(left,x+3,512,164,57,actionActive(control.id,s)?'#b67140':'#383c3d');text(left,control.label,x+85,541,control.id==='off'?13:15,'#f4ebe1','center');});
  fill(right,0,0,1024,576,'#0c1014');fill(right,0,0,1024,48,s.mode==='live'?'#3d2524':s.mode==='break'?'#45321f':'#253b36');text(right,'CHANNEL PREVIEW',20,25,19);text(right,s.mode==='live'?'● LIVE':s.mode==='break'?'● AD BREAK':'● RESCUE',1002,25,19,s.mode==='live'?'#ff9a8a':'#efbf8b','right');bank.draw(right,s.output,12,58,1000,466);text(right,source(s.output).name.toUpperCase(),20,551,19);text(right,duration(s.elapsed-s.since)+' / '+clocks[1].format(now)+' UTC',1004,551,17,'#9ab3ba','right');
}
