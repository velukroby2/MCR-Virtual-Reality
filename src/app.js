import {createModel,SOURCES,CONTROLS} from './model.js';
import {MediaBank} from './media.js';
import {paintScreens,actionActive,duration} from './screens.js';
import {Viewer,OPERATOR_POSE} from './viewer.js';
import {HeadTracker} from './orientation.js';
import {GazeDwell} from './gaze.js';
const $=s=>document.querySelector(s),model=createModel(),bank=new MediaBank(),gaze=new GazeDwell(1.3);
const screens={tv:$('#tv'),left:$('#left'),right:$('#right')};
let viewer,vr=false,flat=false,vrToken=0,ownsFullscreen=false,yaw=0,pitch=OPERATOR_POSE.pitch,drag=null,hover=null,inside=false,nx=0,ny=0,last=performance.now(),lastPaint=0,lastElapsedPaint=0;
const tracker=new HeadTracker({onStatus:({state,message})=>{const waiting=state==='waiting'&&!message.startsWith('No sensor');if(vr&&(!waiting&&state!=='tracking'&&state!=='off'))notify(message);}});
const GRAPHICS_KEY='mcr-vr-graphics-v1';
function notify(message){$('#message').textContent=message;viewer?.message(message);}
function draw(){paintScreens(screens,bank,model.state);viewer?.texturesChanged();}
function update(){const s=model.state;$('#selected').textContent=SOURCES.find(x=>x.id===s.selected).name;$('#output').textContent=SOURCES.find(x=>x.id===s.output).name;$('#mode').textContent=s.mode==='live'?'ON LIVE':s.mode==='break'?'AD BREAK':'OFF LIVE';$('#mode').className=s.mode;
  document.querySelectorAll('[data-action]').forEach(b=>{b.setAttribute('aria-pressed',String(actionActive(b.dataset.action,s)));b.disabled=b.dataset.action==='adBreak'?s.mode!=='live':b.dataset.action==='returnLive'?s.mode!=='break':false;});viewer?.sync();draw();}
function action(id){if(id==='recenter'){center();return;}if(id==='exit'){exitVR();return;}if(id==='environment'){chooseEnvironment(viewer.environment==='studio'?'photo':'studio');return;}bank.prime();const result=model.dispatch(id);if(result.ok)bank.route(model.state,id==='adBreak'||id==='off');notify(result.message);}
function center(){yaw=0;pitch=OPERATOR_POSE.pitch;if(tracker.enabled&&tracker.hasReading)tracker.recenter();else viewer?.camera.rotation.set(pitch,yaw,0,'YXZ');viewer?.anchor();gaze.reset();notify('View recentered.');}
function updateViewButtons(){const photo=viewer?.environment==='photo';$('#room-view').setAttribute('aria-pressed',String(!flat&&!photo));$('#photo-view').setAttribute('aria-pressed',String(!flat&&photo));$('#flat-view').setAttribute('aria-pressed',String(flat));$('#scene-title').textContent=photo?'YOUR ORIGINAL 360° PHOTO':'REFERENCE-BASED CONTROL ROOM';$('#scene-description').textContent=photo?'Static reference image · return to 3D room for live displays':'Blue acoustic walls · curved desk · clear screen sightlines';$('#look-hint').textContent=photo?'Drag to explore the actual room · This photograph is static':'Drag to look · Click the low-profile desk controls';}
function chooseView(value){flat=value;if(flat&&viewer?.environment==='photo')viewer.setEnvironment('studio');$('#screens').hidden=!flat;$('#stage').hidden=flat;updateViewButtons();resize();}
function chooseEnvironment(mode){if(!viewer)return;if(!viewer.setEnvironment(mode)){notify(viewer.photoError?'The reference image could not load; the 3D room is still available.':'The 360 reference is still loading. Please try again shortly.');return;}gaze.reset();chooseView(false);notify(mode==='photo'?'Original 360 photograph (static). Use 3D room for the live displays.':'Rebuilt operator room. All six controls remain active.');}
function resize(){const box=$('#stage').getBoundingClientRect();viewer?.resize(box.width,box.height);$('#rotate').hidden=!vr||innerWidth>=innerHeight;}
async function enterVR(sensors){
  if(!viewer){notify('3D is unavailable. Enable browser hardware acceleration or use Large screens.');return;}
  if(vr)return;const token=++vrToken;const permission=sensors?tracker.enable():Promise.resolve({ok:false,message:'Stereo preview. Drag to look; gaze to select.'});if(!sensors)tracker.disable();
  $('#setup').close();chooseView(false);vr=true;document.body.classList.add('vr');viewer.fov=Number($('#fov').value);viewer.stereo.eyeSep=Number($('#ipd').value)/1000;viewer.lens.uniforms.warp.value=Number($('#warp').value);applyGraphicsSettings();yaw=0;pitch=OPERATOR_POSE.pitch;viewer.camera.rotation.set(pitch,0,0,'YXZ');viewer.setVR(true);gaze.reset();resize();bank.prime();
  try{if(document.documentElement.requestFullscreen&&!document.fullscreenElement){await document.documentElement.requestFullscreen();if(!vr||token!==vrToken){if(!vr&&document.fullscreenElement===document.documentElement)await document.exitFullscreen();return;}ownsFullscreen=true;}}catch{}
  if(!vr||token!==vrToken)return;
  try{await screen.orientation?.lock?.('landscape');}catch{}
  if(!vr||token!==vrToken){if(!vr)try{screen.orientation?.unlock?.();}catch{}return;}
  const result=await permission;if(!vr||token!==vrToken)return;const resolution=viewer.resolutionInfo(),graphics=viewer.graphicsInfo(),quality=graphics.reduced?'Emergency 1× graphics':resolution.native?'Full device resolution':graphics.renderScale<1?`${Math.round(graphics.renderScale*100)}% device resolution`:'Maximum GPU-safe resolution',smoothing=graphics.msaaSamples?`${graphics.msaaSamples}× edge smoothing`:'edge smoothing off';notify(sensors&&result.ok?`${quality} · ${smoothing} · low-latency tracking active · stay seated.`:result.message);resize();
}
function exitVR(){if(!vr)return;vr=false;vrToken++;tracker.disable();gaze.reset();viewer.setVR(false);document.body.classList.remove('vr');$('#rotate').hidden=true;if(ownsFullscreen&&document.fullscreenElement)void document.exitFullscreen().catch(()=>{});ownsFullscreen=false;try{screen.orientation?.unlock?.();}catch{}center();resize();}
function trigger(){const hit=viewer?.pick(0,0);if(hit){action(hit.action);if(vr)gaze.latch(hit.key);}}
paintScreens(screens,bank,model.state);
try{viewer=new Viewer($('#world'),screens,model.state);}catch(error){console.error('3D unavailable:',error);chooseView(true);$('#room-view').disabled=true;$('#vr-open').disabled=true;notify('3D unavailable; the large-screen operator controls still work.');}
if(viewer){viewer.onPhotoStatus=ready=>{$('#photo-view').disabled=!ready;$('#photo-view').title=ready?'Explore the supplied 360 photograph':'The reference image is unavailable';};if(viewer.photoReady)$('#photo-view').disabled=false;}
model.subscribe(update);update();updateViewButtons();
try{await bank.load();}catch(error){notify(error.message+' Built-in placeholders are still shown.');}
for(const button of document.querySelectorAll('[data-action]'))button.addEventListener('click',()=>action(button.dataset.action));
$('#room-view').onclick=()=>chooseEnvironment('studio');$('#photo-view').onclick=()=>chooseEnvironment('photo');$('#flat-view').onclick=()=>chooseView(true);$('#reduced').onchange=event=>{viewer?.setQuality(event.target.checked);updateGraphicsNotes();};$('#recenter').onclick=center;$('#rotate-exit').onclick=exitVR;
function updateSetupValues(){for(const[id,suffix]of[['fov','°'],['warp',''],['ipd',' mm']])$(`#${id}-value`).textContent=$(`#${id}`).value+suffix;}
for(const id of ['fov','warp','ipd'])$(`#${id}`).addEventListener('input',updateSetupValues);updateSetupValues();
function selectedGraphics(){return{renderScale:Number($('#quality-resolution').value),msaa:Number($('#quality-msaa').value),shadowSize:Number($('#quality-shadows').value),adaptive:$('#quality-adaptive').checked};}
function updateGraphicsNotes(info=viewer?.graphicsInfo()){
  if(!info)return;const dpr=Number(info.nativePixelRatio).toFixed(2).replace(/\.00$/,''),scale=Math.round(info.renderScale*100),aa=info.maxMsaaSamples?`${info.maxMsaaSamples}× eye-buffer MSAA`:'no eye-buffer MSAA',shadow=info.maxShadowSize?`${info.maxShadowSize}px shadows`:'no shadow maps';
  const maxOption=$('#quality-msaa').querySelector('option[value="4"]');maxOption.textContent=info.maxMsaaSamples?`Maximum · ${info.maxMsaaSamples}× device`:'Maximum · unavailable';
  $('#capability-note').textContent=`Detected browser/GPU limit: ${dpr}× display density, ${aa}, ${shadow}. Requests above a device limit are capped safely.`;
  $('#resolution-note').textContent=info.reduced?'Emergency 1× graphics is overriding these device settings. Turn it off in the page footer to use them.':`${scale}% device resolution selected${info.adaptive?' · adaptive frame protection on.':' · fixed eye resolution.'}`;
}
function applyGraphicsSettings(save=false){
  if(!viewer)return;const selection=selectedGraphics(),info=viewer.setGraphics(selection);updateGraphicsNotes(info);
  if(save)try{localStorage.setItem(GRAPHICS_KEY,JSON.stringify(selection));}catch{}
}
function restoreGraphicsSettings(){
  try{const saved=JSON.parse(localStorage.getItem(GRAPHICS_KEY)||'null');if(!saved)return;for(const[id,value]of[['quality-resolution',saved.renderScale],['quality-msaa',saved.msaa],['quality-shadows',saved.shadowSize]]){const control=$('#'+id);if(Array.from(control.options).some(option=>Number(option.value)===Number(value)))control.value=String(value);}if(typeof saved.adaptive==='boolean')$('#quality-adaptive').checked=saved.adaptive;}catch{}
}
restoreGraphicsSettings();applyGraphicsSettings();
for(const id of ['quality-resolution','quality-msaa','quality-shadows','quality-adaptive'])$('#'+id).addEventListener('change',()=>applyGraphicsSettings(true));
$('#vr-open').onclick=()=>{applyGraphicsSettings();$('#tracking-note').textContent=isSecureContext?'Use a landscape phone with motion sensors.':'Head tracking requires trusted HTTPS. Use your Render link.';$('#setup').showModal();};
$('#start-vr').onclick=()=>void enterVR(true);$('#preview-vr').onclick=()=>void enterVR(false);$('#cancel-vr').onclick=()=>$('#setup').close();
$('#files').onchange=event=>{const result=bank.local(event.target.files);$('#media-status').textContent=`${result.count} source(s) loaded for this session.`+(result.ignored.length?' Ignored (wrong name/format): '+result.ignored.join(', '):'');notify('Local files stay in your browser. Add them to media/ and redeploy to make them permanent.');};
$('#audio').onchange=event=>{bank.audio=event.target.checked;bank.updateAudio();bank.prime();};
$('#left').onclick=event=>{const r=event.target.getBoundingClientRect(),x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;if(y*576>=512)action(CONTROLS[Math.max(0,Math.min(5,Math.floor(x*6)))].id);};
const world=$('#world');function point(event){const r=world.getBoundingClientRect();nx=(event.clientX-r.left)/r.width*2-1;ny=1-(event.clientY-r.top)/r.height*2;}
world.onpointerdown=event=>{if(event.button!==0||drag)return;point(event);world.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,y:event.clientY,lx:event.clientX,ly:event.clientY,moved:false};world.setPointerCapture(event.pointerId);};
world.onpointermove=event=>{point(event);inside=true;if(!drag||drag.id!==event.pointerId)return;if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>7){drag.moved=true;yaw=viewer.camera.rotation.y;pitch=viewer.camera.rotation.x;tracker.disable();}if(drag.moved){yaw+=(event.clientX-drag.lx)*.004;pitch=Math.max(-1.35,Math.min(1.35,pitch+(event.clientY-drag.ly)*.003));gaze.reset();}drag.lx=event.clientX;drag.ly=event.clientY;};
world.onpointerup=event=>{if(!drag||drag.id!==event.pointerId)return;if(!drag.moved){if(vr)trigger();else{const hit=viewer?.pick(nx,ny);if(hit)action(hit.action);}}if(world.hasPointerCapture(event.pointerId))world.releasePointerCapture(event.pointerId);drag=null;};
world.onpointercancel=()=>{drag=null;gaze.reset();};world.onpointerleave=()=>{inside=false;};
window.addEventListener('keydown',event=>{if(event.defaultPrevented)return;if(event.key==='Escape'&&vr){exitVR();return;}if($('#setup').open||event.ctrlKey||event.altKey||event.metaKey||event.repeat||/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)||event.target.isContentEditable)return;if(event.target.closest('button,a,summary')&&[' ','Enter'].includes(event.key))return;const key=event.key.toLowerCase();if(vr&&[' ','enter'].includes(key)){event.preventDefault();trigger();return;}const map={'1':'inputA','2':'inputB',' ':'takeLive',b:'adBreak',l:'returnLive',o:'off',r:'recenter'};if(map[key]){event.preventDefault();action(map[key]);}});
new ResizeObserver(resize).observe($('#stage'));window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',()=>{if(vr&&document.fullscreenElement===document.documentElement)ownsFullscreen=true;else if(vr&&ownsFullscreen&&!document.fullscreenElement)exitVR();resize();});
window.addEventListener('blur',()=>{drag=null;gaze.reset();});document.addEventListener('visibilitychange',()=>{last=performance.now();gaze.reset();if(document.hidden){bank.audio=false;bank.pause();}else bank.prime();$('#audio').checked=bank.audio;bank.updateAudio();});
world.addEventListener('webglcontextlost',event=>{event.preventDefault();exitVR();chooseView(true);notify('Graphics context lost. Use Large screens, or reload to restore 3D.');});
resize();let lastGamepad=false;
function frame(now){requestAnimationFrame(frame);const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;if(document.hidden)return;model.tick(dt);if(now-lastElapsedPaint>250){$('#elapsed').textContent=duration(model.state.elapsed-model.state.since);lastElapsedPaint=now;}
  if(now-lastPaint>($('#reduced').checked?160:vr?100:viewer?.mobile?66:42)){draw();lastPaint=now;}
  if(viewer&&!flat){if(!(vr&&tracker.update(viewer.camera.quaternion,dt)))viewer.camera.rotation.set(pitch,yaw,0,'YXZ');const hit=!$('#setup').open&&!drag?.moved?(vr?viewer.pick():inside?viewer.pick(nx,ny):null):null;hover=hit;viewer.setHover(hit?.action??null);const result=gaze.update(hit?.key,dt,vr&&!drag?.moved&&!$('#setup').open);if(result.triggered){action(hit.action);if(vr)gaze.latch(hit.key);}$('#hover').hidden=vr||!hit;if(hit)$('#hover').textContent=CONTROLS.find(c=>c.id===hit.action)?.label||(hit.action==='environment'?'Original 360 / 3D room':hit.action);
    if(vr&&navigator.getGamepads){const pressed=Array.from(navigator.getGamepads()).some(p=>p?.connected&&p.buttons[0]?.pressed);if(pressed&&!lastGamepad)trigger();lastGamepad=pressed;}else lastGamepad=false;if(vr)viewer.noteFrame(dt);viewer.render(result.progress);
  }
}requestAnimationFrame(frame);
window.__MCR_LITE__={model,bank,viewer,enterVR,exitVR,chooseView,chooseEnvironment};
