import * as T from '../vendor/three.module.js';
import {RoundedBoxGeometry} from '../vendor/RoundedBoxGeometry.js';

// Approximate physical dimensions inferred from the reference, not a measured scan.
export const OPERATOR_POSE=Object.freeze({x:0,y:1.265,z:1.18,pitch:-.038});
export const DISPLAY_LAYOUT=Object.freeze([
  {id:'tv',x:0,y:1.985,z:-1.30,w:1.80,h:1.0125,yaw:0},
  {id:'left',x:-.443,y:1.065,z:-.505,w:.84,h:.4725,yaw:.065},
  {id:'right',x:.443,y:1.065,z:-.505,w:.84,h:.4725,yaw:-.065}
]);
export const CONSOLE_POSE=Object.freeze({x:0,y:.765,z:.095,pitch:-1.36});
export function desktopFov(aspect){return Math.min(94,Math.max(62,T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(33))/Math.max(.3,aspect)))));}

const color=(hex,extra={})=>new T.MeshStandardMaterial({color:hex,roughness:.75,metalness:0,...extra});
const lamp=(hex,intensity=1)=>new T.MeshBasicMaterial({color:new T.Color(hex).multiplyScalar(intensity),toneMapped:false});
function noiseTexture(kind,anisotropy=1){
  const size=256,data=new Uint8Array(size*size*4);let seed=125893;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const random=seed/4294967295;
    const weave=(x%4<2?4:-4)+(y%4<2?3:-3);
    const mottling=4*Math.sin(x*.147)*Math.cos(y*.196)+3*Math.sin((x+y)*.098);
    let value=kind==='cloth'?199+weave+mottling+(random-.5)*22:kind==='carpet'?155+(random-.5)*54:kind==='brushed'?208+Math.sin(y*2)*5+(random-.5)*9:211+(random-.5)*12+mottling*.4;
    if(kind==='carpet'&&(x<2||y<2))value*=.82;
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=Math.max(0,Math.min(255,value));data[i+3]=255;
  }
  const tex=new T.DataTexture(data,size,size);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.anisotropy=anisotropy;tex.needsUpdate=true;return tex;
}
function alphaTexture(kind){
  const size=256,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size;
    const a=kind==='spill'?Math.pow(Math.sin(Math.PI*u),.5)*Math.exp(-v*4.5):Math.pow(Math.max(0,1-Math.hypot((u-.5)*2,(v-.5)*2)),1.6);
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(a*255);
  }
  const tex=new T.DataTexture(data,size,size);tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.needsUpdate=true;return tex;
}
export function box(parent,name,w,h,d,x,y,z,material,radius=0){
  const geo=radius?new RoundedBoxGeometry(w,h,d,3,Math.min(radius,w/2,h/2,d/2)):new T.BoxGeometry(w,h,d);
  const mesh=new T.Mesh(geo,material);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function cylinder(parent,name,r1,r2,height,x,y,z,material,segments=24){const mesh=new T.Mesh(new T.CylinderGeometry(r1,r2,height,segments),material);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
export function tube(parent,name,points,radius,material){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const mesh=new T.Mesh(new T.TubeGeometry(curve,Math.max(16,points.length*8),radius,8,false),material);mesh.name=name;mesh.castShadow=true;parent.add(mesh);return mesh;}
function contact(parent,x,z,w,d,opacity=.32,y=.006){const mesh=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map:alphaTexture('contact'),color:0x030608,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));mesh.name='Soft contact shadow';mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.userData.ignorePick=true;parent.add(mesh);}
function label(parent,value,w,h,x,y,z,rotationX=0){
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.setTransform?.(2,0,0,2,0,0);ctx.imageSmoothingEnabled=true;ctx.fillStyle='#e4e7e1';ctx.font='700 29px system-ui,"Segoe UI",Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,256,64);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.anisotropy=8;const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false}));mesh.position.set(x,y,z);mesh.rotation.x=rotationX;mesh.userData.ignorePick=true;parent.add(mesh);return mesh;
}
function frontDeskGeometry(){
  // U-shaped desktop, with an inward curved operator cutout and rounded wings.
  const shape=new T.Shape();const m=(x,z)=>shape.moveTo(x,-z),l=(x,z)=>shape.lineTo(x,-z),q=(x,z,a,b)=>shape.quadraticCurveTo(x,-z,a,-b);
  m(-1.48,-1.39);l(1.48,-1.39);l(1.48,1.59);q(1.46,1.75,1.30,1.75);l(1.17,1.73);q(1.03,1.70,1.01,1.55);
  q(.94,.72,.63,.65);q(0,.52,-.63,.65);q(-.94,.72,-1.01,1.55);q(-1.03,1.70,-1.17,1.73);l(-1.30,1.75);q(-1.46,1.75,-1.48,1.59);l(-1.48,-1.39);
  const geometry=new T.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelThickness:.009,bevelSize:.013,bevelSegments:3,curveSegments:20});geometry.rotateX(-Math.PI/2);geometry.translate(0,.697,0);return geometry;
}
export function buildStudio(parent,{anisotropy=1}={}){
  const architecture=new T.Group();architecture.name='Reference-inspired acoustic booth';parent.add(architecture);
  const desk=new T.Group();desk.name='Curved operator desk and equipment';parent.add(desk);
  const cloth=noiseTexture('cloth',anisotropy);cloth.repeat.set(2.5,7);
  const felt=noiseTexture('cloth',anisotropy);felt.repeat.set(7,7);
  const carpet=noiseTexture('carpet',anisotropy);carpet.repeat.set(7,11);
  const grain=noiseTexture('laminate',anisotropy);grain.repeat.set(3,3);
  const brushed=noiseTexture('brushed',anisotropy);brushed.repeat.set(2,2);
  const materials={
    blue:color(0x628da3,{map:cloth,bumpMap:cloth,bumpScale:.009,roughness:1}),
    felt:color(0x85827c,{map:felt,bumpMap:felt,bumpScale:.006,roughness:1}),
    ceiling:color(0xb8b7b0,{map:felt,bumpMap:felt,bumpScale:.004,roughness:.96}),
    frame:color(0x1b2226,{roughness:.37,metalness:.65}),
    metal:color(0x2d363b,{map:brushed,roughness:.37,metalness:.72}),
    black:color(0x0c1115,{roughness:.58}),rubber:color(0x181b1b,{roughness:.96}),
    laminate:new T.MeshPhysicalMaterial({color:0x716b62,map:grain,bumpMap:grain,bumpScale:.003,roughness:.55,metalness:.05,clearcoat:.18,clearcoatRoughness:.5}),
    cyan:lamp(0x18c9f4,1.4),warm:lamp(0xffe9c1,1.15),white:lamp(0xe8eddd),green:lamp(0x83d483),red:lamp(0xf36f46)
  };
  const m=materials;
  box(architecture,'Woven carpet',3.25,.07,5.85,0,-.035,.89,color(0x55616a,{map:carpet,bumpMap:carpet,bumpScale:.006,roughness:1}));
  box(architecture,'Acoustic ceiling',3.22,.09,4.28,0,2.755,.58,m.ceiling);
  box(architecture,'Front felt wall',3.18,2.74,.09,0,1.37,-1.49,m.felt);
  for(const x of [-1.40,-.92,.92,1.40])box(architecture,'Front black panel seam',.028,2.7,.023,x,1.365,-1.43,m.frame,.004);
  for(const side of [-1,1]){
    box(architecture,'Side acoustic backing',.095,2.75,4.22,side*1.59,1.375,.59,m.frame);
    for(let i=0;i<4;i++){
      const z=-.975+i*1.04;
      box(architecture,'Blue fabric acoustic panel',.069,2.64,1.004,side*1.524,1.382,z,m.blue,.012);
      const spill=new T.Mesh(new T.PlaneGeometry(1.005,.95),new T.MeshBasicMaterial({map:alphaTexture('spill'),color:0x00afff,transparent:true,opacity:.46,blending:T.AdditiveBlending,depthWrite:false}));
      spill.name='Cyan wall wash';spill.position.set(side*1.487,.495,z);spill.rotation.y=-side*Math.PI/2;spill.userData.ignorePick=true;architecture.add(spill);
    }
    box(architecture,'Black skirting',.065,.078,4.2,side*1.508,.047,.59,m.frame,.007);
    box(architecture,'Continuous cyan base light',.018,.017,4.16,side*1.474,.097,.59,m.cyan,.006);
    box(architecture,'Desk wall trunking',.055,.11,2.86,side*1.473,.625,.03,m.metal,.01);
    // Wall sockets, as visible in the reference near the doorway.
    box(architecture,'Outlet plate',.011,.10,.15,side*1.472,.46,1.82,color(0x999892,{metalness:.35,roughness:.45}),.005);
    for(const z of [1.79,1.84])box(architecture,'Outlet recess',.014,.024,.017,side*1.461,.46,z,m.black,.002);
    const wash=new T.PointLight(0x13baff,1.0,2.0,2);wash.position.set(side*1.26,.30,.6);architecture.add(wash);
  }
  // Rear glass door and sidelights, with a warm office corridor beyond.
  const back=2.655;
  box(architecture,'Corridor floor',3.2,.05,1.6,0,-.015,3.40,color(0x9a8b76,{roughness:.7}));
  box(architecture,'Corridor ceiling',3.2,.06,1.65,0,2.70,3.4,color(0xded4c3));
  box(architecture,'Office far wall',3.2,2.72,.08,0,1.36,4.16,color(0xb6aaa0));
  for(const x of [-1.44,1.44])box(architecture,'Office side wall',.06,2.72,1.7,x,1.36,3.4,color(0xcac3b5));
  box(architecture,'Office workstation',.87,.08,.47,.50,.75,3.85,color(0x7d776a));
  box(architecture,'Office monitor',.40,.26,.04,.48,.97,3.84,m.black,.007);
  box(architecture,'Office cabinet',.46,.67,.44,-.8,.335,3.88,color(0x877b6d),.01);
  box(architecture,'Door header',3.15,.37,.10,0,2.56,back,m.felt);
  for(const x of [-1.285,1.285])box(architecture,'Rear blue panel',.53,2.38,.10,x,1.19,back,m.blue,.012);
  const glass=new T.MeshPhysicalMaterial({color:0xbed7d6,roughness:.10,metalness:.08,transparent:true,opacity:.18,side:T.DoubleSide,depthWrite:false});
  for(const [x,w]of [[-.785,.40],[0,1.05],[.785,.40]]){
    const pane=new T.Mesh(new T.PlaneGeometry(w,2.28),glass);pane.name='Doorway glass';pane.position.set(x,1.16,back-.01);architecture.add(pane);
    for(const dx of [-w/2,w/2])box(architecture,'Doorway aluminium mullion',.042,2.36,.085,x+dx,1.18,back,m.frame,.006);
    for(const y of [.035,2.325])box(architecture,'Doorway horizontal frame',w+.04,.048,.085,x,y,back,m.frame,.006);
    // Faint real-world-style reflection streaks; transparent and non-occluding.
    const reflection=new T.Mesh(new T.PlaneGeometry(w*.21,2.19),new T.MeshBasicMaterial({color:0xdceffa,transparent:true,opacity:.06,side:T.DoubleSide,depthWrite:false}));reflection.position.set(x-w*.25,1.15,back-.035);reflection.userData.ignorePick=true;architecture.add(reflection);
  }
  box(architecture,'Door latch',.041,.12,.018,.433,1.03,back-.073,m.metal,.008);
  const handle=cylinder(architecture,'Brushed door pull',.013,.013,.31,.425,1.18,back-.102,color(0xb6b9b5,{metalness:.85,roughness:.24}),20);
  for(const y of [1.05,1.30])box(architecture,'Door pull mount',.019,.017,.074,.425,y,back-.065,m.metal,.004);
  label(architecture,'MCR  /  01',.30,.07,0,1.86,back-.06,0).rotation.y=Math.PI;
  for(const z of [3.05,3.80]){
    box(architecture,'Warm office ceiling panel',.52,.012,.25,0,2.653,z,m.warm,.005);
    const officeLight=new T.PointLight(0xffd8a1,2.4,3.1,2);officeLight.position.set(0,2.43,z);architecture.add(officeLight);
  }
  // Ceiling grilles and recessed downlights rather than an empty flat roof.
  for(const z of [-1.08,.84,2.05]){
    box(architecture,'Vent recessed housing',.69,.016,.30,0,2.699,z,m.frame,.008);
    for(let i=0;i<14;i++)box(architecture,'Vent louvre',.638,.017,.010,0,2.682,z-.128+i*.019,m.black,.003);
  }
  for(const [x,z]of [[-.99,-.22],[.99,-.22],[-.88,1.85],[.88,1.85]]){
    cylinder(architecture,'Downlight trim',.056,.056,.012,x,2.698,z,color(0xdadad1,{metalness:.22,roughness:.5}));
    cylinder(architecture,'Downlight diffuser',.039,.039,.015,x,2.687,z,m.warm);
  }
  cylinder(architecture,'Ceiling smoke detector',.067,.055,.026,.44,2.682,1.05,color(0xcdcfc9),24);
  // Curved desk, bullnose edge, dark fascia, cable routes and supports.
  const desktop=new T.Mesh(frontDeskGeometry(),m.laminate);desktop.name='Curved laminate desktop';desktop.castShadow=desktop.receiveShadow=true;desk.add(desktop);
  const edgePoints=[[-1.48,.713,1.53],[-1.38,.713,1.72],[-1.17,.713,1.70],[-1.00,.713,1.4],[-.87,.713,.9],[-.64,.713,.65],[0,.713,.59],[.64,.713,.65],[.87,.713,.9],[1.00,.713,1.4],[1.17,.713,1.70],[1.38,.713,1.72],[1.48,.713,1.53]];
  tube(desk,'Desk rounded dark edge',edgePoints,.017,m.rubber);
  tube(desk,'Recessed cyan desk accent',edgePoints.map(([x,y,z])=>[x,y-.04,z-.007]),.0045,m.cyan);
  for(const side of [-1,1]){
    for(const z of [-.92,1.39]){
      box(desk,'Desk leg',.087,.69,.087,side*1.31,.345,z,m.metal,.01);box(desk,'Desk foot',.37,.022,.21,side*1.31,.014,z,m.rubber,.01);contact(desk,side*1.31,z,.62,.44,.29);
    }
    box(desk,'Under-desk pedestal',.26,.60,.46,side*1.27,.325,.44,m.frame,.022);
    for(let i=0;i<5;i++)box(desk,'Pedestal ventilation slot',.008,.010,.22,side*1.131,.43-i*.045,.44,m.black,.002);
    cylinder(desk,'Cable grommet',.041,.041,.006,side*1.16,.753,-.93,m.black,32);
    tube(desk,'Screen cable',[[side*.42,.76,-.70],[side*.77,.755,-.95],[side*1.12,.755,-.94],[side*1.17,.67,-.93]],.006,m.rubber);
  }
  box(desk,'Cable basket',1.7,.075,.17,0,.622,-1.01,m.black,.01);
  contact(desk,0,-.6,2.3,1.3,.28);
  // Dual monitor arm, behind (never in front of) the picture planes.
  cylinder(desk,'Dual monitor pole',.019,.023,.34,0,.919,-.727,m.metal);
  box(desk,'Monitor clamp',.12,.05,.12,0,.753,-.73,m.black,.012);
  for(const side of [-1,1]){
    tube(desk,'Articulated monitor support',[[0,1.025,-.733],[side*.22,1.04,-.73],[side*.43,1.04,-.62],[side*.443,1.065,-.57]],.016,m.frame);
    cylinder(desk,'Monitor arm hinge',.035,.035,.038,side*.22,1.08,-.73,m.black);
  }
  // Low-profile keyboard: instancing keeps many individual keys inexpensive.
  const keyboard=new T.Group();keyboard.name='Keyboard';keyboard.position.set(-.055,.765,.391);keyboard.rotation.y=-.025;desk.add(keyboard);
  box(keyboard,'Keyboard shell',.68,.020,.215,0,0,0,m.black,.012);
  const keyGeo=new RoundedBoxGeometry(.034,.012,.032,1,.003),keys=new T.InstancedMesh(keyGeo,m.frame,75),matrix=new T.Matrix4();let key=0;
  for(let row=0;row<5;row++)for(let column=0;column<15;column++){matrix.makeTranslation(-.305+column*.043,.016,-.081+row*.041);keys.setMatrixAt(key++,matrix);}keys.instanceMatrix.needsUpdate=true;keys.castShadow=true;keyboard.add(keys);
  box(keyboard,'Spacebar',.18,.013,.029,-.045,.017,.083,m.frame,.004);
  for(const [value,x,z]of [['Q W E R T Y U I O P',-.05,-.04],['A S D F G H J K L',-.065,0],['Z X C V B N M',-.084,.04]]){const legend=label(keyboard,value,.48,.020,x,.024,z,-Math.PI/2);legend.material.opacity=.5;}
  tube(desk,'Keyboard lead',[[-.075,.756,.272],[-.05,.748,.06],[.13,.747,-.32],[.44,.75,-.75]],.0028,m.rubber);
  const pad=box(desk,'Mouse mat',.26,.003,.28,.584,.750,.405,color(0x252d30,{roughness:.95}),.016);
  const mouse=box(desk,'Mouse',.065,.029,.107,.573,.768,.387,m.black,.018);mouse.rotation.y=-.12;
  box(desk,'Mouse wheel',.008,.007,.014,.573,.784,.369,m.rubber,.003);
  // Red Scarlett-style interface and dark intercom, at the side of the console.
  const rack=new T.Group();rack.position.set(-1.10,.764,-.22);rack.rotation.y=.16;desk.add(rack);
  box(rack,'Intercom angled case',.56,.079,.23,0,0,0,color(0x536068,{map:brushed,metalness:.45,roughness:.45}),.012);
  box(rack,'Intercom fascia',.514,.055,.011,0,0,.119,m.frame,.003);
  for(let row=0;row<2;row++)for(let i=0;i<6;i++){box(rack,'Intercom key',.048,.014,.008,-.176+i*.059,.015-row*.028,.129,m.black,.002);box(rack,'Intercom key marker',.027,.0018,.002,-.176+i*.059,.020-row*.028,.134,i===2&&row===0?m.red:m.white);}
  label(rack,'TALK / LISTEN',.32,.017,-.014,-.046,.127);
  const red=new T.MeshPhysicalMaterial({color:0x9b2535,map:brushed,metalness:.65,roughness:.34,clearcoat:.3,clearcoatRoughness:.3});
  box(rack,'Red audio interface',.36,.065,.139,0,.078,-.015,red,.010);box(rack,'Audio interface face',.343,.051,.007,0,.078,.059,m.black,.005);
  for(const [x,r]of [[-.126,.013],[-.074,.013],[.065,.023],[.136,.012]]){
    const knob=cylinder(rack,'Interface knob',r,r,.014,x,.080,.070,m.frame,24);knob.rotation.x=Math.PI/2;
    box(rack,'Knob indicator',.0014,.010,.001,x,.080+r*.38,.079,m.white,.0005);
  }
  for(const x of [-.12,-.071]){const led=cylinder(rack,'Input signal LED',.0028,.0028,.002,x,.101,.064,m.green,12);led.rotation.x=Math.PI/2;}
  label(rack,'USB AUDIO / 2 IN • 2 OUT',.20,.012,-.020,.052,.064);
  // Speakers with concentric drivers and small status LEDs.
  for(const side of [-1,1]){
    const speaker=new T.Group();speaker.position.set(side*1.182,.895,-.824);speaker.rotation.y=side*-.20;desk.add(speaker);
    box(speaker,'Nearfield speaker cabinet',.19,.31,.205,0,0,0,m.black,.020);
    for(const [y,r]of [[-.040,.063],[.089,.029]]){
      const surround=cylinder(speaker,'Speaker surround',r,r,.009,0,y,.104,m.rubber,32);surround.rotation.x=Math.PI/2;
      const cone=cylinder(speaker,'Speaker driver',r*.74,r*.84,.011,0,y,.113,color(0x343d41,{metalness:.1,roughness:.65}),32);cone.rotation.x=Math.PI/2;
      const dome=new T.Mesh(new T.SphereGeometry(r*.29,16,8),m.black);dome.position.set(0,y,.123);dome.scale.z=.38;speaker.add(dome);
    }
    box(speaker,'Speaker power LED',.005,.003,.003,.047,-.119,.109,m.green,.001);
  }
  // Goose-neck mic stays outside every screen sightline.
  cylinder(desk,'Microphone base',.068,.079,.027,1.19,.765,.071,m.black,32);
  tube(desk,'Gooseneck microphone',[[1.19,.787,.071],[1.18,.94,.047],[1.15,1.065,-.02],[1.10,1.135,-.075]],.005,m.black);
  const capsule=cylinder(desk,'Microphone capsule',.011,.013,.064,1.094,1.151,-.081,m.rubber,20);capsule.rotation.z=-.55;
  // Headphones and cable on the right wing, away from controls and screens.
  const phones=new T.Group();phones.position.set(1.19,.762,.86);phones.rotation.y=-.3;desk.add(phones);
  tube(phones,'Headphone padded headband',[[-.12,.012,0],[-.105,.018,-.10],[0,.025,-.15],[.105,.018,-.10],[.12,.012,0]],.012,m.black);
  for(const x of [-.122,.122]){const cup=box(phones,'Headphone ear cushion',.048,.033,.072,x,.017,.023,m.rubber,.018);cup.rotation.y=x>0?.2:-.2;}
  tube(desk,'Headphone cable',[[1.1,.754,.9],[.97,.752,1.02],[1.28,.752,1.12],[1.40,.72,1.53],[1.40,.42,1.60]],.0028,m.rubber);
  // A restrained equipment sticker and screws add scale without screen clutter.
  label(desk,'MCR 01  •  TRANSMISSION',.30,.032,-1.19,.753,1.35,-Math.PI/2);
  for(const x of [-1.34,1.34])for(const z of [-1.1,1.52]){const screw=cylinder(desk,'Recessed desk fixing',.004,.004,.002,x,.753,z,m.metal,12);}
  // The operator's chair sits below/behind the eye, not between eye and screens.
  const chair=new T.Group();chair.name='Operator chair';chair.position.set(0,0,1.36);desk.add(chair);
  const upholstery=color(0x283238,{map:cloth,bumpMap:cloth,bumpScale:.004,roughness:1});
  box(chair,'Contoured seat cushion',.515,.073,.475,0,.463,0,upholstery,.032);
  const backrest=box(chair,'Padded chair back',.48,.665,.084,0,.94,.256,upholstery,.039);backrest.rotation.x=.11;
  box(chair,'Chair back support',.066,.49,.038,0,.695,.302,m.frame,.013);
  for(const side of [-1,1]){
    tube(chair,'Armrest support',[[side*.218,.42,.02],[side*.31,.52,.03],[side*.31,.665,.035]],.015,m.frame);
    box(chair,'Soft chair armrest',.065,.030,.322,side*.313,.677,.012,m.rubber,.014);
  }
  cylinder(chair,'Chair gas lift',.027,.034,.335,0,.257,.053,m.metal,24);
  for(let i=0;i<5;i++){
    const angle=i*Math.PI*2/5,x=Math.sin(angle)*.293,z=Math.cos(angle)*.293+.053;
    tube(chair,'Five-star chair base',[[0,.132,.053],[x*.54,.109,(z-.053)*.54+.053],[x,.072,z]],.018,m.frame);
    const wheel=cylinder(chair,'Caster wheel',.028,.028,.027,x,.033,z,m.rubber,20);wheel.rotation.z=Math.PI/2;
  }
  contact(desk,0,1.42,.88,.85,.40);
  return {architecture,desk,materials,contact:(...args)=>contact(desk,...args)};
}
