import * as T from '../vendor/three.module.js';
import {CONTROLS} from './model.js';
import {text,fill,actionActive} from './screens.js';
import {OPERATOR_POSE,DISPLAY_LAYOUT,CONSOLE_POSE,desktopFov,buildStudio,box} from './room.js';
export {OPERATOR_POSE,DISPLAY_LAYOUT,desktopFov};

const MIN_ADAPTIVE_EYE_SCALE=.70;
const SLOW_FRAME_SECONDS=.0205;
const FAST_FRAME_SECONDS=.0174;

export function displayPixelRatio(value=globalThis.devicePixelRatio){
  return Number.isFinite(value)&&value>0?value:1;
}

export function fittedPixelRatio(desired,width,height,maxWidth=Infinity,maxHeight=Infinity){
  const w=Number.isFinite(width)&&width>0?width:1,h=Number.isFinite(height)&&height>0?height:1;
  const safeDesired=displayPixelRatio(desired),limitX=Number.isFinite(maxWidth)&&maxWidth>0?maxWidth/w:Infinity,limitY=Number.isFinite(maxHeight)&&maxHeight>0?maxHeight/h:Infinity;
  return Math.max(Number.EPSILON,Math.min(safeDesired,limitX,limitY));
}

export function viewerCamera(){
  const camera=new T.PerspectiveCamera(62,1,.025,45);
  camera.position.set(OPERATOR_POSE.x,OPERATOR_POSE.y,OPERATOR_POSE.z);
  camera.rotation.order='YXZ';camera.rotation.x=OPERATOR_POSE.pitch;
  camera.focus=Infinity; // Parallel stereo frusta: never force far objects to diverge.
  return camera;
}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function texture(c,anisotropy=1){const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.minFilter=T.LinearFilter;t.generateMipmaps=false;t.anisotropy=anisotropy;return t;}
function visible(object){for(;object;object=object.parent)if(!object.visible)return false;return true;}
export function referenceSphere(map,origin){
  const geometry=new T.SphereGeometry(25,80,48);geometry.scale(-1,1,1);
  // Weld duplicate seam positions exactly, retaining different u=0 / u=1 UVs.
  // This avoids a floating-point crack when looking precisely down the front seam.
  const position=geometry.getAttribute('position');for(let row=0;row<=48;row++){const first=row*81,last=first+80;position.setXYZ(last,position.getX(first),position.getY(first),position.getZ(first));}position.needsUpdate=true;
  map.wrapS=T.RepeatWrapping;
  const sphere=new T.Mesh(geometry,new T.MeshBasicMaterial({map,toneMapped:false}));
  sphere.name='Original supplied 360 photograph';sphere.position.copy(origin);sphere.rotation.y=Math.PI/2;sphere.visible=false;return sphere;
}

export class Viewer{
  constructor(element,screens,state,renderer=null){
    this.element=element;this.state=state;this.inVR=false;this.fov=75;this.warp=.08;this.hover=null;
    this.environment='studio';this.photoReady=false;this.photoError=false;this.realRenderer=!renderer;
    this.renderer=renderer??new T.WebGLRenderer({canvas:element,antialias:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.mobile=typeof matchMedia==='function'?matchMedia('(pointer: coarse)').matches:innerWidth<900;
    this.nativePixelRatio=displayPixelRatio();this.pixelRatio=this.nativePixelRatio;this.reduced=false;
    this.eyeScale=1;this.frameAverage=0;this.frameSamples=0;this.frameCooldown=0;
    this.renderLimits=this.detectRenderLimits();this.renderer.setPixelRatio(this.pixelRatio);
    if(this.renderer.shadowMap){this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;}
    this.anisotropy=Math.min(8,this.renderer.capabilities?.getMaxAnisotropy?.()||1);
    this.scene=new T.Scene();this.scene.background=new T.Color('#1b242c');
    this.camera=viewerCamera();this.scene.add(this.camera);
    this.room=new T.Group();this.room.name='Interactive rebuilt control room';this.scene.add(this.room);
    this.buttons=[];this.surfaces={};
    this.studio=buildStudio(this.room,{anisotropy:this.anisotropy});
    this.buildLighting();
    this.screenTextures=Object.fromEntries(Object.entries(screens).map(([id,c])=>[id,texture(c,this.anisotropy)]));
    DISPLAY_LAYOUT.forEach(layout=>this.monitor(layout));
    this.buildConsole();
    this.ray=new T.Raycaster();this.pointer=new T.Vector2();
    this.buildStereo();this.buildUtilities();
    this.sync();this.anchor();
    if(this.realRenderer)this.loadReference();
  }
  buildLighting(){
    const ambient=new T.HemisphereLight(0xd4e3eb,0x39424c,.68);this.scene.add(ambient);
    const key=new T.SpotLight(0xffedd5,33,7.5,1.15,.7,2);
    key.name='Soft ceiling key light';key.position.set(.35,2.59,.16);key.target.position.set(0,.63,-.35);
    key.castShadow=true;key.shadow.mapSize.set(this.mobile?1024:1536,this.mobile?1024:1536);
    key.shadow.bias=-.0003;key.shadow.normalBias=.014;key.shadow.radius=3.5;key.shadow.camera.near=.2;key.shadow.camera.far=7;
    this.scene.add(key,key.target);
    const frontFill=new T.PointLight(0xcfe3f3,2.0,3.8,2);frontFill.position.set(0,2.35,-1.01);this.scene.add(frontFill);
    const screenSpill=new T.PointLight(0x5cb7e8,.34,1.8,2);screenSpill.position.set(0,1.50,-.9);this.scene.add(screenSpill);
    const backFill=new T.PointLight(0xd9e6eb,.65,3.0,2);backFill.position.set(0,2.43,1.91);this.scene.add(backFill);
  }
  detectRenderLimits(){
    const fallback=this.renderer.capabilities?.maxTextureSize||Infinity;
    let width=fallback,height=fallback,target=fallback;
    try{
      const gl=this.renderer.getContext?.(),viewport=gl?.getParameter?.(gl.MAX_VIEWPORT_DIMS),renderbuffer=gl?.getParameter?.(gl.MAX_RENDERBUFFER_SIZE);
      if(viewport?.length>=2){width=Math.min(width,viewport[0]);height=Math.min(height,viewport[1]);}
      if(Number.isFinite(renderbuffer)&&renderbuffer>0)target=Math.min(target,renderbuffer);
    }catch{/* Conservative capability fallback above remains valid. */}
    return{width,height,target};
  }
  monitor({id,w,h,x,y,z,yaw}){
    const m=this.studio.materials,group=new T.Group();group.name=`${id.toUpperCase()} display assembly`;group.position.set(x,y,z);group.rotation.y=yaw;this.room.add(group);
    const body=box(group,`${id} matte bezel`,w+.033,h+.038,.048,0,0,-.006,m.black,.009);
    box(group,`${id} aluminium rear case`,w-.08,h-.06,.043,0,0,-.039,m.metal,.013);
    // Screen is in front of the bezel's face. No glossy overlay or console can mask it.
    const plane=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:this.screenTextures[id],toneMapped:false}));
    plane.name=`${id} live picture`;plane.position.z=.023;plane.userData.screen=id;group.add(plane);this.surfaces[id]=plane;
    box(group,`${id} bottom chin`,w+.025,.013,.008,0,-h/2-.011,.018,m.black,.003);
    const brandCanvas=canvas(256,32),ctx=brandCanvas.getContext('2d');text(ctx,id==='tv'?'MULTIVIEW / 01':'MCR · '+id.toUpperCase(),128,16,15,'#899393','center');
    const badge=new T.Mesh(new T.PlaneGeometry(w*.16,.010),new T.MeshBasicMaterial({map:texture(brandCanvas),transparent:true,depthWrite:false,toneMapped:false}));badge.position.set(0,-h/2-.011,.024);badge.userData.ignorePick=true;group.add(badge);
    box(group,`${id} power LED`,.0035,.002,.002,w*.456,-h/2-.010,.024,m.green,.0008);
    if(id==='tv'){
      box(group,'TV wall bracket',.34,.19,.043,0,0,-.081,m.frame,.007);
      this.studio.contact(0,-1.1,1.9,.60,.16,.752);
    }
  }
  buildConsole(){
    const p=CONSOLE_POSE,m=this.studio.materials,panel=new T.Group();panel.name='Low-profile playout console';panel.position.set(p.x,p.y,p.z);panel.rotation.x=p.pitch;this.room.add(panel);this.console=panel;
    box(panel,'Thin desk control surface',1.433,.381,.020,0,0,0,m.frame,.009);
    box(panel,'Console inlay',1.399,.350,.002,0,0,.011,new T.MeshStandardMaterial({color:0x18232b,roughness:.67}),.001);
    CONTROLS.forEach((control,i)=>this.makeButton(panel,control.id,control.label,((i%3)-1)*.467,.088-Math.floor(i/3)*.176,.429,.144));
    for(const x of [-.694,.694])for(const y of [-.168,.168])box(panel,'Console countersunk screw',.007,.007,.002,x,y,.012,m.metal,.002);
  }
  makeButton(parent,id,label,x,y,w,h,overlay=false){
    const c=canvas(480,160),t=texture(c,this.anisotropy),m=this.studio.materials;
    box(parent,`${label} key housing`,w+.006,h+.006,.011,x,y,.018,m.black,.004);
    const face=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:t,depthTest:!overlay,toneMapped:false}));
    face.name=`${label} clickable face`;face.position.set(x,y,.024);face.userData.action=id;face.renderOrder=overlay?95:0;parent.add(face);
    this.buttons.push({id,label,c,t,face});
  }
  sync(){
    for(const b of this.buttons){
      const ctx=b.c.getContext('2d'),on=b.id==='environment'?this.environment==='photo':actionActive(b.id,this.state),hover=this.hover===b.id;
      const accent=b.id==='off'?'#dc887b':b.id==='adBreak'?'#e9b567':b.id==='takeLive'||b.id==='returnLive'?'#90c7ac':'#9ebac9';
      fill(ctx,0,0,480,160,hover?'#304553':on?'#303d42':'#17252e');
      fill(ctx,0,0,7,160,hover?'#ffce9a':on?accent:'#344b57');
      ctx.strokeStyle=hover?'#f0bd8b':on?accent:'#3b525d';ctx.lineWidth=2;ctx.strokeRect(2,2,476,156);
      text(ctx,b.id==='environment'?(this.environment==='photo'?'3D ROOM':'ORIGINAL 360'):b.label,240,77,b.id==='off'?31:33,hover?'#fff1df':'#e5eded','center');
      if(CONTROLS.some(c=>c.id===b.id)){text(ctx,on?'●':'○',442,132,16,on?accent:'#627880','right');text(ctx,['inputA','inputB'].includes(b.id)?'SOURCE':b.id==='off'?'RESCUE':'CHANNEL',25,132,14,'#91a4ad');}
      b.t.needsUpdate=true;
    }
  }
  setHover(id){if(id===this.hover)return;this.hover=id;this.sync();}
  pick(x=0,y=0){
    this.scene.updateMatrixWorld(true);this.ray.setFromCamera(this.pointer.set(x,y),this.camera);
    if(this.inVR){const utility=this.ray.intersectObjects(this.utilities.children,true).find(h=>h.object.userData.action&&visible(h.object));if(utility)return{key:utility.object.userData.action,action:utility.object.userData.action};}
    if(this.environment==='photo')return null;
    const hit=this.ray.intersectObject(this.room,true).find(h=>visible(h.object)&&!h.object.userData.ignorePick&&!(h.object.material?.transparent&&h.object.material.opacity<.5));
    if(!hit)return null;
    if(hit.object.userData.action)return{key:hit.object.userData.action,action:hit.object.userData.action};
    if(hit.object.userData.screen==='left'&&(1-hit.uv.y)*576>=512){const action=CONTROLS[Math.max(0,Math.min(5,Math.floor(hit.uv.x*6)))].id;return{key:'screen-'+action,action};}
    return null;
  }
  buildStereo(){
    this.stereo=new T.StereoCamera();this.stereo.aspect=.5;this.stereo.eyeSep=.064;
    // RGBA8 is enough for the final phone display and halves eye-buffer bandwidth
    // versus float targets on many mobile GPUs. Spatial resolution stays native.
    this.targets=[new T.WebGLRenderTarget(8,8,{type:T.UnsignedByteType}),new T.WebGLRenderTarget(8,8,{type:T.UnsignedByteType})];
    this.targets.forEach(t=>{t.texture.colorSpace=T.LinearSRGBColorSpace;});
    this.composite=new T.Scene();this.ortho=new T.OrthographicCamera(-1,1,1,-1,0,1);
    this.lens=new T.ShaderMaterial({uniforms:{leftEye:{value:this.targets[0].texture},rightEye:{value:this.targets[1].texture},warp:{value:this.warp}},depthTest:false,depthWrite:false,toneMapped:true,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`varying vec2 vUv;uniform sampler2D leftEye;uniform sampler2D rightEye;uniform float warp;
      void main(){bool right=vUv.x>=.5;vec2 uv=vec2(fract(vUv.x*2.),vUv.y);vec2 p=(uv-.5)*2.;uv=.5+p*.5*(1.+warp*dot(p,p));
      if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.||abs(vUv.x-.5)<.001){gl_FragColor=vec4(0.,0.,0.,1.);return;}
      gl_FragColor=right?texture2D(rightEye,uv):texture2D(leftEye,uv);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});this.composite.add(new T.Mesh(new T.PlaneGeometry(2,2),this.lens));
    this.cursorMaterial=new T.ShaderMaterial({uniforms:{progress:{value:0}},transparent:true,depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;uniform float progress;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=mod(atan(p.x,p.y)/6.2831853+1.,1.);float ring=step(.58,r)*(1.-step(.72,r));float arc=step(.79,r)*(1.-step(.97,r))*step(a,progress);float core=1.-step(.1,r);gl_FragColor=vec4(mix(vec3(.95),vec3(1.,.66,.35),arc),max(core,max(ring*.8,arc)));}'});
    this.cursor=new T.Mesh(new T.PlaneGeometry(.052,.052),this.cursorMaterial);this.cursor.position.z=-1.4;this.cursor.renderOrder=99;this.cursor.visible=false;this.camera.add(this.cursor);
  }
  buildUtilities(){
    this.utilities=new T.Group();this.utilities.name='Headset safety utilities';this.scene.add(this.utilities);this.utilities.visible=false;
    this.makeButton(this.utilities,'environment','ORIGINAL 360',-.45,0,.423,.135,true);
    this.makeButton(this.utilities,'recenter','RECENTER',0,0,.423,.135,true);
    this.makeButton(this.utilities,'exit','EXIT VR',.45,0,.423,.135,true);
    this.feedbackCanvas=canvas(1024,70);this.feedbackTexture=texture(this.feedbackCanvas);
    this.feedback=new T.Mesh(new T.PlaneGeometry(1.20,.082),new T.MeshBasicMaterial({map:this.feedbackTexture,depthTest:false,depthWrite:false,toneMapped:false}));
    // World-anchored in the gap below the monitors: looking up cannot slide it over a video.
    this.feedback.name='Below-screen status strip';this.feedback.position.set(0,.911,.05);this.feedback.rotation.x=-.30;this.feedback.visible=false;this.feedback.renderOrder=98;this.scene.add(this.feedback);this.feedbackUntil=0;
  }
  anchor(){this.utilities.position.set(this.camera.position.x,this.camera.position.y-.83,this.camera.position.z-1.00);this.utilities.rotation.set(-.58,0,0);}
  message(value){const ctx=this.feedbackCanvas.getContext('2d');fill(ctx,0,0,1024,70,'#1d303b');const message=String(value),short=message.length>82?message.slice(0,79)+'…':message;text(ctx,short,512,35,short.length>56?24:33,'#efceb0','center');this.feedbackTexture.needsUpdate=true;this.feedbackUntil=performance.now()+3400;}
  loadReference(){
    new T.TextureLoader().load('./assets/room-reference.jpg',map=>{
      this.photoMap=map;map.colorSpace=T.SRGBColorSpace;map.anisotropy=this.anisotropy;
      const sphere=referenceSphere(map,this.camera.position);this.scene.add(sphere);this.photo=sphere;
      // The real room's photograph also supplies the rebuilt materials' soft reflections.
      let pmrem,probeMap;try{
        // Keep the visible panorama full-resolution, but make the rough reflection probe small.
        const probe=canvas(this.mobile?512:1024,this.mobile?256:512);probe.getContext('2d').drawImage(map.image,0,0,probe.width,probe.height);
        probeMap=texture(probe);probeMap.mapping=T.EquirectangularReflectionMapping;pmrem=new T.PMREMGenerator(this.renderer);
        this.environmentTarget=pmrem.fromEquirectangular(probeMap);this.scene.environment=this.environmentTarget.texture;this.scene.environmentIntensity=.70;this.scene.environmentRotation.y=Math.PI/2;
      }catch(error){console.warn('Panorama reflections unavailable; direct room lighting remains active.',error);}finally{probeMap?.dispose();pmrem?.dispose();}
      this.photoReady=true;if(this.renderer.shadowMap)this.renderer.shadowMap.needsUpdate=true;this.onPhotoStatus?.(true);
    },undefined,()=>{this.photoError=true;this.onPhotoStatus?.(false);});
  }
  setEnvironment(mode){
    if(mode==='photo'&&!this.photoReady)return false;
    this.environment=mode==='photo'?'photo':'studio';this.room.visible=this.environment==='studio';if(this.photo)this.photo.visible=this.environment==='photo';
    if(this.renderer.shadowMap)this.renderer.shadowMap.needsUpdate=true;this.sync();return true;
  }
  setVR(value){
    this.inVR=value;this.cursor.visible=value;this.utilities.visible=value;this.anchor();
    if(value){this.eyeScale=1;this.frameAverage=0;this.frameSamples=0;this.frameCooldown=1.5;}
    if(this.width)this.resize(this.width,this.height);
  }
  setQuality(reduced){this.reduced=Boolean(reduced);this.eyeScale=1;this.frameAverage=0;this.frameSamples=0;if(this.renderer.shadowMap){this.renderer.shadowMap.enabled=!this.reduced;this.renderer.shadowMap.needsUpdate=true;}if(this.width)this.resize(this.width,this.height);}
  noteFrame(deltaSeconds){
    if(!this.inVR||this.reduced||!Number.isFinite(deltaSeconds)||deltaSeconds<=0||deltaSeconds>.1)return false;
    this.frameAverage=this.frameSamples?this.frameAverage*.94+deltaSeconds*.06:deltaSeconds;this.frameSamples++;
    this.frameCooldown=Math.max(0,this.frameCooldown-deltaSeconds);if(this.frameSamples<90||this.frameCooldown>0)return false;
    let next=this.eyeScale;
    if(this.frameAverage>SLOW_FRAME_SECONDS&&next>MIN_ADAPTIVE_EYE_SCALE){next=Math.max(MIN_ADAPTIVE_EYE_SCALE,Math.round((next-.1)*100)/100);this.frameCooldown=1.5;}
    else if(this.frameAverage<FAST_FRAME_SECONDS&&next<1){next=Math.min(1,Math.round((next+.05)*100)/100);this.frameCooldown=4;}
    if(next===this.eyeScale)return false;this.eyeScale=next;this.resizeEyeTargets();this.onResolutionChange?.(this.resolutionInfo());return true;
  }
  resizeEyeTargets(){
    if(!this.inVR||!this.width||!this.height)return;
    const ratio=this.renderer.getPixelRatio(),limit=this.renderLimits.target,rawWidth=this.width*.5*ratio*this.eyeScale,rawHeight=this.height*ratio*this.eyeScale;
    const limitScale=Math.min(1,limit/rawWidth,limit/rawHeight),width=Math.max(1,Math.floor(rawWidth*limitScale)),height=Math.max(1,Math.floor(rawHeight*limitScale));
    this.targets.forEach(t=>t.setSize(width,height));
  }
  resize(w,h){
    if(!w||!h)return;this.width=Math.round(w);this.height=Math.round(h);
    const desired=this.reduced?1:this.nativePixelRatio;this.pixelRatio=fittedPixelRatio(desired,this.width,this.height,this.renderLimits.width,this.renderLimits.height);
    this.renderer.setPixelRatio(this.pixelRatio);this.renderer.setSize(this.width,this.height,false);
    this.camera.aspect=w/h;this.camera.fov=this.inVR?this.fov:desktopFov(w/h);this.camera.updateProjectionMatrix();
    this.resizeEyeTargets();
  }
  resolutionInfo(){
    const ratio=this.renderer.getPixelRatio(),outputWidth=Math.max(1,Math.round((this.width||1)*ratio)),outputHeight=Math.max(1,Math.round((this.height||1)*ratio));
    return{native:Math.abs(ratio-this.nativePixelRatio)<.01,pixelRatio:ratio,eyeScale:this.eyeScale,outputWidth,outputHeight,eyeWidth:this.targets[0].width,eyeHeight:this.targets[0].height};
  }
  render(progress){
    this.feedback.visible=this.inVR&&performance.now()<this.feedbackUntil;this.cursorMaterial.uniforms.progress.value=progress;this.scene.updateMatrixWorld();
    if(this.inVR){this.stereo.update(this.camera);this.renderer.setRenderTarget(this.targets[0]);this.renderer.render(this.scene,this.stereo.cameraL);this.renderer.setRenderTarget(this.targets[1]);this.renderer.render(this.scene,this.stereo.cameraR);this.renderer.setRenderTarget(null);this.renderer.setViewport(0,0,this.width,this.height);this.renderer.render(this.composite,this.ortho);}else this.renderer.render(this.scene,this.camera);
  }
  texturesChanged(){Object.values(this.screenTextures).forEach(t=>{t.needsUpdate=true;});}
}
