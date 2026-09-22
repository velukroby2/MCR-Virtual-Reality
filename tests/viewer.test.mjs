import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {Viewer,viewerCamera} from '../src/viewer.js';
import {createModel} from '../src/model.js';
function fakeCanvas(){return {width:1024,height:576,getContext(){return {fillRect(){},fillText(){},strokeRect(){}};}};}
function withViewer(run){
  const values={document:{createElement:fakeCanvas},devicePixelRatio:1,innerWidth:1280};const old={};for(const[k,v]of Object.entries(values)){old[k]=Object.getOwnPropertyDescriptor(globalThis,k);Object.defineProperty(globalThis,k,{value:v,configurable:true});}
  const renderer={ratio:1,calls:[],setPixelRatio(n){this.ratio=n;},getPixelRatio(){return this.ratio;},setSize(w,h){this.size=[w,h];},setRenderTarget(t){this.target=t;},setViewport(){},render(s,c){this.calls.push({scene:s,camera:c,target:this.target});}};
  try{const v=new Viewer({}, {tv:fakeCanvas(),left:fakeCanvas(),right:fakeCanvas()},createModel().state,renderer);v.resize(1200,650);v.scene.updateMatrixWorld(true);return run(v,renderer);}finally{for(const key of Object.keys(values)){if(old[key])Object.defineProperty(globalThis,key,old[key]);else delete globalThis[key];}}
}
test('exactly one TV and two monitor surfaces',()=>withViewer(v=>{const ids=[];v.room.traverse(o=>{if(o.userData.screen)ids.push(o.userData.screen);});assert.deepEqual(ids.sort(),['left','right','tv']);}));
test('all six desk controls are visible and pickable from operator eye',()=>withViewer(v=>{for(const button of v.buttons.filter(b=>!['exit','recenter'].includes(b.id))){v.camera.lookAt(button.face.getWorldPosition(new T.Vector3()));assert.equal(v.pick()?.action,button.id,button.id);}}));
test('headset exit and recenter remain accessible',()=>withViewer(v=>{v.setVR(true);v.scene.updateMatrixWorld(true);for(const id of ['exit','recenter']){const b=v.buttons.find(b=>b.id===id);v.camera.lookAt(b.face.getWorldPosition(new T.Vector3()));assert.equal(v.pick()?.action,id);}}));
test('stereo eye projections remain finite and parallel',()=>{const camera=viewerCamera();camera.aspect=2;camera.updateProjectionMatrix();camera.updateMatrixWorld();const stereo=new T.StereoCamera();stereo.aspect=.5;stereo.update(camera);assert.equal(camera.focus,Infinity);for(const c of [stereo.cameraL,stereo.cameraR])assert.ok(c.projectionMatrix.elements.every(Number.isFinite));assert.equal(stereo.cameraL.projectionMatrix.elements[8],0);assert.equal(stereo.cameraR.projectionMatrix.elements[8],0);});
test('headset renders two eyes then composite at full viewport',()=>withViewer((v,r)=>{v.setVR(true);v.resize(1200,650);v.render(.5);assert.equal(r.calls.length,3);assert.equal(r.calls[0].target,v.targets[0]);assert.equal(r.calls[1].target,v.targets[1]);assert.equal(r.calls[2].target,null);assert.equal(v.targets[0].width,600);assert.equal(v.targets[0].height,650);}));
test('return to mono hides VR controls and uses one render',()=>withViewer((v,r)=>{v.setVR(true);v.setVR(false);v.render(0);assert.equal(v.utilities.visible,false);assert.equal(v.cursor.visible,false);assert.equal(r.calls.length,1);}));
