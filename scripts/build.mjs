import {mkdir,cp,copyFile,writeFile,rm,stat} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const root=dirname(dirname(fileURLToPath(import.meta.url)));
export async function build(){
  const dist=join(root,'dist');await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
  for(const name of ['index.html','style.css'])await copyFile(join(root,name),join(dist,name));
  for(const name of ['src','vendor','media','assets'])await cp(join(root,name),join(dist,name),{recursive:true});
  const manifest={};
  for(const [id,name]of [['a','Input A'],['b','Input B'],['break','Break'],['rescue','Rescue']]){
    for(const ext of ['mp4','webm','png','jpg','jpeg','svg']){
      const filename=`${name}.${ext}`;
      try{const info=await stat(join(root,'media',filename));if(!info.isFile())continue;}catch{continue;}
      manifest[id]={name:filename,url:`./media/${encodeURIComponent(filename)}`,kind:['mp4','webm'].includes(ext)?'video':'image'};
      if(manifest[id].kind==='video')try{if((await stat(join(root,'media',`${name}.jpg`))).isFile())manifest[id].poster=`./media/${encodeURIComponent(name+'.jpg')}`;}catch{}
      break;
    }
    if(!manifest[id])throw new Error(`Missing media: ${name}. Keep its placeholder SVG or supply a video.`);
  }
  await writeFile(join(dist,'media-manifest.json'),JSON.stringify(manifest,null,2));
  console.log('Built MCR Reference Studio 1.2: native-resolution phone VR with comfort-focused tracking. No dependency install required.');return dist;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await build();
