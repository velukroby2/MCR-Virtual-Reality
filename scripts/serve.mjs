import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {build} from './build.mjs';
const root=await build(),port=Number(process.env.PORT||4180);
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.txt':'text/plain'};
export const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep))throw new Error('Forbidden');
    const info=await stat(file);if(!info.isFile())throw new Error('Not a file');
    if(info.size===0){res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':0});res.end();return;}
    let start=0,end=info.size-1,status=200;
    if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
      start=match[1]?Number(match[1]):Math.max(0,info.size-Number(match[2]));end=match[1]&&match[2]?Math.min(Number(match[2]),end):end;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
    }
    res.writeHead(status,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes'});
    if(req.method==='HEAD'){res.end();return;}createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`MCR Live: http://localhost:${server.address().port} — use Render HTTPS for phone sensors.`));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
