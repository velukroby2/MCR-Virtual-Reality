import assert from 'node:assert/strict';
import {once} from 'node:events';
process.env.PORT='0';
const {server}=await import('./serve.mjs');
if(!server.listening)await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
let checks=0;
try{
  const paths=['/','/style.css','/src/app.js','/src/model.js','/src/media.js','/src/screens.js','/src/viewer.js','/src/orientation.js','/src/gaze.js','/vendor/three.module.js','/vendor/three.core.js','/vendor/LICENSE.txt','/media-manifest.json'];
  const manifest=await(await fetch(base+'/media-manifest.json')).json();assert.equal(Object.keys(manifest).length,4);checks++;
  for(const entry of Object.values(manifest))paths.push('/'+entry.url.slice(2));
  for(const path of paths){const response=await fetch(base+path);assert.equal(response.status,200,path);assert.ok((await response.arrayBuffer()).byteLength>0,path);if(path.endsWith('.js'))assert.match(response.headers.get('content-type'),/javascript/);checks++;}
  for(const path of ['/package.json','/render.yaml','/scripts/serve.mjs','/tests/model.test.mjs','/missing.mp4']){assert.equal((await fetch(base+path)).status,404,path);checks++;}
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);checks++;
  const partial=await fetch(base+'/vendor/three.module.js',{headers:{Range:'bytes=0-15'}});assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,16);checks++;
  console.log(`${checks} served-site checks passed. All four media entries and all runtime modules resolve.`);
}finally{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
