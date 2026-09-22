import { SOURCES } from './model.js';
export function matchFilename(name){const match=/^(Input A|Input B|Break|Rescue)\.(mp4|webm|jpg|jpeg|png|svg)$/i.exec(name);return match?{id:SOURCES.find(s=>s.name.toLowerCase()===match[1].toLowerCase()).id,kind:/^(mp4|webm)$/i.test(match[2])?'video':'image'}:null;}
export class MediaBank{
  constructor(){this.items={};this.audio=false;this.output='rescue';}
  async load(){
    const response=await fetch('./media-manifest.json');if(!response.ok)throw new Error('Media manifest missing. Run the build command.');
    const manifest=await response.json();for(const source of SOURCES){const entry=manifest[source.id];this.set(source.id,entry.url,entry.kind,entry.name);}
  }
  set(id,url,kind,name,blob=false){
    const old=this.items[id];if(old?.kind==='video'){old.el.pause();old.el.removeAttribute('src');old.el.load();}if(old?.blob)URL.revokeObjectURL(old.url);
    const el=kind==='video'?document.createElement('video'):new Image();
    const item={el,kind,name,url,blob,error:false,blocked:false};this.items[id]=item;
    el.addEventListener('error',()=>{item.error=true;});
    if(kind==='video'){el.muted=true;el.volume=.3;el.loop=true;el.playsInline=true;el.setAttribute('playsinline','');el.preload='auto';}
    el.src=url;
    if(kind==='video')this.play(item);
  }
  play(item){item.el.play().then(()=>{item.blocked=false;},()=>{item.blocked=true;});}
  prime(){for(const item of Object.values(this.items))if(item.kind==='video')this.play(item);}
  route(state,restart=false){this.output=state.output;const current=this.items[state.output];if(restart&&current?.kind==='video'&&current.el.readyState>0)try{current.el.currentTime=0;}catch{}this.updateAudio();}
  updateAudio(){for(const [id,item]of Object.entries(this.items))if(item.kind==='video')item.el.muted=!(this.audio&&id===this.output);}
  local(files){let count=0;const ignored=[];for(const file of files){const match=matchFilename(file.name);if(!match){ignored.push(file.name);continue;}this.set(match.id,URL.createObjectURL(file),match.kind,file.name,true);count++;}this.updateAudio();this.prime();return {count,ignored};}
  draw(ctx,id,x,y,w,h){
    const source=SOURCES.find(s=>s.id===id),item=this.items[id];ctx.fillStyle='#080b0f';ctx.fillRect(x,y,w,h);
    const iw=item?.kind==='video'?item.el.videoWidth:item?.el.naturalWidth,ih=item?.kind==='video'?item.el.videoHeight:item?.el.naturalHeight;
    if(iw&&ih&&!item.error&&(item.kind!=='video'||item.el.readyState>=2)){
      const ratio=Math.min(w/iw,h/ih),dw=iw*ratio,dh=ih*ratio;ctx.drawImage(item.el,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
    }else{ctx.fillStyle=source.color+'22';ctx.fillRect(x,y,w,h);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=source.color;ctx.font=`600 ${Math.max(13,w*.065)}px Arial`;ctx.fillText(source.name.toUpperCase(),x+w/2,y+h*.43);ctx.fillStyle='#a6b7c0';ctx.font=`${Math.max(9,w*.022)}px Arial`;ctx.fillText(item?.error?'MEDIA UNAVAILABLE · USE H.264 MP4':'PLACEHOLDER / LOADING',x+w/2,y+h*.61);}
    if(item?.blocked){ctx.fillStyle='#201910e8';ctx.fillRect(x,y+h-24,w,24);ctx.fillStyle='#f3be8d';ctx.font='12px Arial';ctx.textAlign='center';ctx.fillText('Tap a control to enable video playback',x+w/2,y+h-12);}
  }
  dispose(){for(const item of Object.values(this.items)){if(item.kind==='video')item.el.pause();if(item.blob)URL.revokeObjectURL(item.url);}}
}
