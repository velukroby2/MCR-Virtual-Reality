import assert from 'node:assert/strict';
import {once} from 'node:events';
process.env.PORT='0';
delete process.env.HOST; // Verify the default public bind, not a test-only override.
const {server}=await import('./serve.mjs');
if(!server.listening)await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
let checks=0;
try{
  assert.equal(server.address().address,'0.0.0.0','Default listener must be reachable by Render, not localhost-only');checks++;
  const paths=['/','/style.css','/src/app.js','/src/model.js','/src/media.js','/src/screens.js','/src/viewer.js','/src/room.js','/src/orientation.js','/src/gaze.js','/vendor/three.module.js','/vendor/three.core.js','/vendor/LICENSE.txt','/vendor/RoundedBoxGeometry.js','/assets/room-reference.jpg','/media/FOOTAGE.md','/media-manifest.json'];
  const manifest=await(await fetch(base+'/media-manifest.json')).json();assert.equal(Object.keys(manifest).length,4);checks++;
  for(const entry of Object.values(manifest)){paths.push('/'+entry.url.slice(2));if(entry.poster)paths.push('/'+entry.poster.slice(2));}
  for(const path of paths){const response=await fetch(base+path);assert.equal(response.status,200,path);assert.ok((await response.arrayBuffer()).byteLength>0,path);if(path.endsWith('.js'))assert.match(response.headers.get('content-type'),/javascript/);checks++;}
  for(const path of ['/package.json','/render.yaml','/scripts/serve.mjs','/tests/model.test.mjs','/missing.mp4','/upload/Input%20A.mp4']){assert.equal((await fetch(base+path)).status,404,path);checks++;}
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);checks++;
  const partial=await fetch(base+'/vendor/three.module.js',{headers:{Range:'bytes=0-15'}});assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,16);checks++;
  for(const id of ['a','b','break']){assert.equal(manifest[id].kind,'video');const response=await fetch(base+'/'+manifest[id].url.slice(2),{headers:{Range:'bytes=0-15'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'video/mp4');const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.slice(4,8)),'ftyp');checks++;}
  const html=await(await fetch(base+'/')).text(),app=await(await fetch(base+'/src/app.js')).text();
  const ids=new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g),m=>m[1]));
  for(const match of app.matchAll(/\$\('#([^']+)'\)/g)){assert.ok(ids.has(match[1]),`Missing DOM element #${match[1]}`);checks++;}
  assert.match(html,/id="quality-resolution"[\s\S]*Maximum · 100%/);assert.match(html,/id="quality-msaa"[\s\S]*Maximum/);assert.match(html,/Adaptive frame protection/);assert.match(html,/User-provided demo footage/);assert.doesNotMatch(html,/Sintel|Blender Foundation/);checks+=5;
  console.log(`${checks} served-site checks passed, including the panorama, MP4 byte ranges, device graphics settings and DOM bindings.`);
}finally{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
