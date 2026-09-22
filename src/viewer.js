import * as T from '../vendor/three.module.js';
import {CONTROLS} from './model.js';
import {text,fill,actionActive} from './screens.js';
export function viewerCamera(){const camera=new T.PerspectiveCamera(61,1,.035,40);camera.position.set(0,1.53,2.35);camera.rotation.order='YXZ';camera.rotation.x=-.07;camera.focus=Infinity;return camera;}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function texture(c){const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.minFilter=T.LinearFilter;t.generateMipmaps=false;return t;}
export class Viewer{
  constructor(element,screens,state,renderer=null){
    this.element=element;this.state=state;this.inVR=false;this.fov=80;this.warp=.12;this.hover=null;
    this.renderer=renderer??new T.WebGLRenderer({canvas:element,antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<900?1.25:1.5));
    this.scene=new T.Scene();this.scene.background=new T.Color('#1b2932');this.camera=viewerCamera();this.scene.add(this.camera);this.room=new T.Group();this.scene.add(this.room);this.buttons=[];
    this.scene.add(new T.HemisphereLight(0xc3dbe6,0x30404b,1.5));const sun=new T.DirectionalLight(0xe6ded1,1.2);sun.position.set(2,4,3);this.scene.add(sun);
    this.box(this.room,4.8,.12,7,0,-.07,0,0x39464d);this.box(this.room,4.8,.1,7,0,3.6,0,0x515e64);this.box(this.room,4.8,3.6,.12,0,1.8,-2.55,0x41464a);
    for(const side of [-1,1]){
      this.box(this.room,.12,3.6,6.8,side*2.35,1.8,.1,0x456e83);
      for(let i=0;i<4;i++)this.box(this.room,.04,3.4,.034,side*2.27,1.78,-2.45+i*1.7,0x172f3a);
      this.box(this.room,.03,.05,6.7,side*2.22,.1,.1,0x28c6ed,true);
      this.box(this.room,.09,3.5,.08,side*1.9,1.8,-2.44,0x151e23);
    }
    this.box(this.room,4.5,3.6,.1,0,1.8,3.5,0x3e626f);this.box(this.room,1.45,2.65,.06,0,1.35,3.39,0x71838a);
    for(const side of [-1,1])this.box(this.room,.07,2.75,.1,side*.76,1.37,3.33,0x1c2d34);
    this.box(this.room,4.35,.1,2.1,0,.8,-.03,0x787a73);this.box(this.room,4.1,.028,.028,0,.74,1.02,0x33cbea,true);
    for(const x of [-1.94,1.94])this.box(this.room,.12,.75,1.5,x,.37,-.03,0x263944);
    this.screenTextures=Object.fromEntries(Object.entries(screens).map(([id,c])=>[id,texture(c)]));
    this.monitor('tv',2.97,1.67,0,2.57,-2.22,0);
    this.monitor('left',1.52,.855,-.81,1.34,-.55,.09);
    this.monitor('right',1.52,.855,.81,1.34,-.55,-.09);
    for(const side of [-1,1]){this.box(this.room,.075,.23,.1,side*.81,.92,-.6,0x1a262c);this.box(this.room,.4,.03,.3,side*.81,.86,-.54,0x182b33);this.box(this.room,.23,.4,.22,side*1.97,1.04,-.61,0x162630);}
    // Basic reference-shaped red audio interface and grey intercom; decorative only.
    this.box(this.room,.57,.13,.22,0,.9,-.15,0x9b303e);this.box(this.room,.53,.1,.014,0,.9,-.029,0x101b21);
    for(const x of [-.2,-.075,.13]){const knob=new T.Mesh(new T.CylinderGeometry(x>.1?.037:.023,x>.1?.037:.023,.019,16),new T.MeshLambertMaterial({color:0x182830}));knob.rotation.x=Math.PI/2;knob.position.set(x,.9,-.013);this.room.add(knob);}
    this.box(this.room,1.4,.08,.2,0,.857,.12,0x34444d);
    for(let i=0;i<8;i++)this.box(this.room,.13,.026,.012,-.57+i*.16,.86,.226,0x79939a);
    const panel=new T.Group();panel.position.set(0,1.08,.66);panel.rotation.x=-.85;this.room.add(panel);this.box(panel,2.32,.77,.065,0,0,0,0x23343e);
    CONTROLS.forEach((control,i)=>this.makeButton(panel,control.id,control.label,((i%3)-1)*.75,.17-Math.floor(i/3)*.33,.69,.26));
    this.ray=new T.Raycaster();this.pointer=new T.Vector2();this.stereo=new T.StereoCamera();this.stereo.aspect=.5;this.stereo.eyeSep=.064;
    this.targets=[new T.WebGLRenderTarget(8,8),new T.WebGLRenderTarget(8,8)];this.targets.forEach(t=>{t.texture.colorSpace=T.LinearSRGBColorSpace;});
    this.composite=new T.Scene();this.ortho=new T.OrthographicCamera(-1,1,1,-1,0,1);
    this.lens=new T.ShaderMaterial({uniforms:{leftEye:{value:this.targets[0].texture},rightEye:{value:this.targets[1].texture},warp:{value:this.warp}},depthTest:false,depthWrite:false,toneMapped:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`varying vec2 vUv;uniform sampler2D leftEye;uniform sampler2D rightEye;uniform float warp;
      void main(){bool right=vUv.x>=.5;vec2 uv=vec2(fract(vUv.x*2.),vUv.y);vec2 p=(uv-.5)*2.;uv=.5+p*.5*(1.+warp*dot(p,p));
      if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.||abs(vUv.x-.5)<.001){gl_FragColor=vec4(0.,0.,0.,1.);return;}
      gl_FragColor=right?texture2D(rightEye,uv):texture2D(leftEye,uv);
      #include <colorspace_fragment>
      }`});this.composite.add(new T.Mesh(new T.PlaneGeometry(2,2),this.lens));
    this.cursorMaterial=new T.ShaderMaterial({uniforms:{progress:{value:0}},transparent:true,depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;uniform float progress;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=mod(atan(p.x,p.y)/6.2831853+1.,1.);float ring=step(.58,r)*(1.-step(.72,r));float arc=step(.79,r)*(1.-step(.97,r))*step(a,progress);float core=1.-step(.1,r);gl_FragColor=vec4(mix(vec3(.95),vec3(1.,.66,.35),arc),max(core,max(ring*.8,arc)));}'});
    this.cursor=new T.Mesh(new T.PlaneGeometry(.07,.07),this.cursorMaterial);this.cursor.position.z=-1.8;this.cursor.renderOrder=99;this.cursor.visible=false;this.camera.add(this.cursor);
    this.utilities=new T.Group();this.scene.add(this.utilities);this.utilities.visible=false;this.makeButton(this.utilities,'recenter','RECENTER',-.26,0,.47,.16,true);this.makeButton(this.utilities,'exit','EXIT VR',.26,0,.47,.16,true);
    this.feedbackCanvas=canvas(1024,120);this.feedbackTexture=texture(this.feedbackCanvas);this.feedback=new T.Mesh(new T.PlaneGeometry(1.4,.164),new T.MeshBasicMaterial({map:this.feedbackTexture,depthTest:false,depthWrite:false}));this.feedback.position.set(0,.43,-2);this.feedback.visible=false;this.feedback.renderOrder=98;this.camera.add(this.feedback);this.feedbackUntil=0;
    this.sync();this.anchor();
  }
  box(parent,w,h,d,x,y,z,color,unlit=false){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),unlit?new T.MeshBasicMaterial({color}):new T.MeshLambertMaterial({color}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
  monitor(id,w,h,x,y,z,yaw){const group=new T.Group();group.position.set(x,y,z);group.rotation.y=yaw;this.room.add(group);this.box(group,w+.085,h+.085,.085,0,0,0,0x10191f);const plane=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:this.screenTextures[id]}));plane.position.z=.047;plane.userData.screen=id;group.add(plane);this.box(group,.018,.01,.012,w*.45,-h/2-.023,.047,0x99d693,true);}
  makeButton(parent,id,label,x,y,w,h,overlay=false){const c=canvas(420,144),t=texture(c);this.box(parent,w+.013,h+.013,.025,x,y,.043,0x101c24);const face=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:t,depthTest:!overlay}));face.position.set(x,y,.058);face.userData.action=id;parent.add(face);this.buttons.push({id,label,c,t,face});}
  sync(){for(const button of this.buttons){const ctx=button.c.getContext('2d'),on=actionActive(button.id,this.state),hover=this.hover===button.id;fill(ctx,0,0,420,144,hover?'#866143':on?'#855b39':'#263b48');ctx.strokeStyle=hover?'#ffe2b0':on?'#d49a6b':'#526e7c';ctx.lineWidth=5;ctx.strokeRect(3,3,414,138);text(ctx,button.label,210,72,button.id==='off'?29:34,'#e8ece7','center');button.t.needsUpdate=true;}}
  setHover(id){if(id===this.hover)return;this.hover=id;this.sync();}
  pick(x=0,y=0){this.scene.updateMatrixWorld(true);this.ray.setFromCamera(this.pointer.set(x,y),this.camera);const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
    if(this.inVR){const util=this.ray.intersectObjects(this.utilities.children,true).find(h=>h.object.userData.action&&visible(h.object));if(util)return{key:util.object.userData.action,action:util.object.userData.action};}
    const hit=this.ray.intersectObject(this.room,true).find(h=>visible(h.object));if(!hit)return null;
    if(hit.object.userData.action)return{key:hit.object.userData.action,action:hit.object.userData.action};
    if(hit.object.userData.screen==='left'&&(1-hit.uv.y)*576>=512){const action=CONTROLS[Math.max(0,Math.min(5,Math.floor(hit.uv.x*6)))].id;return{key:'screen-'+action,action};}return null;
  }
  anchor(){this.utilities.position.set(this.camera.position.x,this.camera.position.y-.88,this.camera.position.z-1.28);this.utilities.rotation.set(-.4,0,0);}
  message(value){const ctx=this.feedbackCanvas.getContext('2d');fill(ctx,0,0,1024,120,'#25363d');const words=String(value).split(' '),lines=[''];for(const word of words){if((lines.at(-1)+' '+word).length>60&&lines.length===1)lines.push(word);else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}lines.slice(0,2).forEach((line,i)=>text(ctx,line,512,lines.length===1?60:39+i*45,27,'#f5cba6','center'));this.feedbackTexture.needsUpdate=true;this.feedbackUntil=performance.now()+4200;}
  setVR(value){this.inVR=value;this.cursor.visible=value;this.utilities.visible=value;this.anchor();}
  resize(w,h){if(!w||!h)return;this.width=Math.round(w);this.height=Math.round(h);this.renderer.setSize(this.width,this.height,false);this.camera.aspect=w/h;this.camera.fov=this.inVR?this.fov:61;this.camera.updateProjectionMatrix();if(this.inVR){const ratio=this.renderer.getPixelRatio();this.targets.forEach(t=>t.setSize(Math.max(1,Math.floor(w*.5*ratio)),Math.max(1,Math.floor(h*ratio))));}}
  render(progress){this.feedback.visible=this.inVR&&performance.now()<this.feedbackUntil;this.cursorMaterial.uniforms.progress.value=progress;this.scene.updateMatrixWorld();
    if(this.inVR){this.stereo.update(this.camera);this.renderer.setRenderTarget(this.targets[0]);this.renderer.render(this.scene,this.stereo.cameraL);this.renderer.setRenderTarget(this.targets[1]);this.renderer.render(this.scene,this.stereo.cameraR);this.renderer.setRenderTarget(null);this.renderer.setViewport(0,0,this.width,this.height);this.renderer.render(this.composite,this.ortho);}else this.renderer.render(this.scene,this.camera);
  }
  texturesChanged(){Object.values(this.screenTextures).forEach(t=>{t.needsUpdate=true;});}
}
