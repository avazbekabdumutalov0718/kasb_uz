import {user,response,validDay,validTask,titles,entry,taskPath,save,read,cfgPath,proofPrefix,sign,entriesForDay} from './_tasks-kit.js';
import {head} from '@vercel/blob';
import {randomUUID} from 'node:crypto';
export const config={maxDuration:30};
export async function GET(req){const uid=user(req);if(!uid)return response({error:'Telegram orqali kiring'},401);const day=new URL(req.url).searchParams.get('day');if(!validDay(day))return response({error:'Invalid day'},400);const items=await entriesForDay(uid,day);return response({day,uid,items})}
export async function POST(req){const uid=user(req);if(!uid)return response({error:'Login required'},401);let body;try{body=await req.json()}catch{return response({error:'Invalid JSON'},400)}const {day,id,action}=body;if(!validDay(day)||!validTask(id))return response({error:'Invalid task'},400);if(day>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))return response({error:'Future day'},400);const current=await entry(uid,day,id);
if(action==='save'){if(typeof body.seconds==='number')current.seconds=Math.max(0,Math.min(1e8,body.seconds));if(Number.isFinite(body.duration))current.duration=Math.max(1,Math.min(720,body.duration));if('done' in body){if(body.done&&!current.proofs.length)return response({error:'Proof required'},400);current.done=Boolean(body.done);current.clock=current.done?new Date().toISOString():'';}await save(taskPath(uid,day,id),current);await notify(uid,day,null);return response({item:current})}
if(action==='delete'){
 const proof=current.proofs?.find(p=>p.id===body.proofId);
 if(!proof)return response({error:'Proof not found'},404);
 current.proofs=current.proofs.filter(p=>p.id!==body.proofId);
 if(!current.proofs.length){current.done=false;current.clock=''}
 await save(taskPath(uid,day,id),current);
 try{const {del}=await import('@vercel/blob');await del(proof.url)}catch(error){console.error('Blob delete warning:',error.message)}
 await notify(uid,day,null);
 return response({item:current});
}
if(action==='proof'){const p=body.proof;if(!p||!String(p.pathname).startsWith(proofPrefix(uid,day,id)))return response({error:'Invalid proof path'},400);let cloud;try{cloud=await head(p.url)}catch{return response({error:'Proof not found'},400)}if(cloud.pathname!==p.pathname||cloud.size>100*1024*1024)return response({error:'Invalid proof'},400);current.proofs??=[];if(!current.proofs.some(x=>x.url===p.url)){current.proofs.push({id:randomUUID(),name:String(p.name||'Proof').slice(0,140),url:p.url,pathname:p.pathname,size:cloud.size,type:p.type||'',createdAt:new Date().toISOString()});await save(taskPath(uid,day,id),current);await notify(uid,day,current.proofs.at(-1))}return response({item:current})}
return response({error:'Unknown action'},400)}
async function notify(uid,day,proof){const cfg=await read(cfgPath(uid));if(!cfg?.channelId)return;try{const {tg}=await import('./_tasks-kit.js');const data=await entriesForDay(uid,day),done=Object.keys(titles).filter(id=>data[id].done&&data[id].proofs?.length).length;const summary=['📚 WORDRUSH TASKS — '+day,'✅ '+done+'/21','',...Object.entries(titles).map(([id,t])=>(data[id].done&&data[id].proofs?.length?'✅ ':'⬜ ')+t),'',...(proof?['📎 '+proof.name,proof.url]:[])].join('\n');const oldPath='wr-task-sync-v2/report/'+uid+'/'+day+'.json',old=await read(oldPath);if(old?.id)try{await tg('deleteMessage',{chat_id:cfg.channelId,message_id:old.id})}catch{}const x=await tg('sendMessage',{chat_id:cfg.channelId,text:summary.slice(0,3950),disable_web_page_preview:true});await save(oldPath,{id:x.message_id});}catch(e){console.error('Telegram channel delivery:',e.message)}}
