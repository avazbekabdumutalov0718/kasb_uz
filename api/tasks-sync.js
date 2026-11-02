import {user,response,validDay,validTask,titles,entry,taskPath,save,read,cfgPath,proofPrefix,sign,entriesForDay,bridge} from './_tasks-kit.js';

import {randomUUID} from 'node:crypto';
export const config={maxDuration:30};
export async function GET(req){const uid=user(req);if(!uid)return response({error:'Telegram orqali kiring'},401);const day=new URL(req.url).searchParams.get('day');if(!validDay(day))return response({error:'Invalid day'},400);const items=await entriesForDay(uid,day);return response({day,uid,items})}
export async function POST(req){const uid=user(req);if(!uid)return response({error:'Login required'},401);let body;try{body=await req.json()}catch{return response({error:'Invalid JSON'},400)}const {day,id,action}=body;if(!validDay(day)||!validTask(id))return response({error:'Invalid task'},400);if(day>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))return response({error:'Future day'},400);const current=await entry(uid,day,id);
if(action==='save'){if(typeof body.seconds==='number')current.seconds=Math.max(0,Math.min(1e8,body.seconds));if(Number.isFinite(body.duration))current.duration=Math.max(1,Math.min(720,body.duration));if('done' in body){if(body.done&&!current.proofs.length)return response({error:'Proof required'},400);current.done=Boolean(body.done);current.clock=current.done?new Date().toISOString():'';}await save(taskPath(uid,day,id),current);await publishScore(uid,day);await notify(uid,day,null);return response({item:current})}
if(action==='delete'){
 const proof=current.proofs?.find(p=>p.id===body.proofId);
 if(!proof)return response({error:'Proof not found'},404);
 current.proofs=current.proofs.filter(p=>p.id!==body.proofId);
 if(!current.proofs.length){current.done=false;current.clock=''}
 await save(taskPath(uid,day,id),current);
 try{await bridge('deleteFile',{uid,day,id,path:proof.pathname})}catch(error){console.error('Storage delete warning:',error.message)}
 await publishScore(uid,day);await notify(uid,day,null);
 return response({item:current});
}
if(action==='proof'){const p=body.proof;if(!p||!String(p.pathname).startsWith(proofPrefix(uid,day,id)))return response({error:'Invalid proof path'},400);let cloud;try{cloud=await bridge('fileInfo',{uid,day,id,path:p.pathname})}catch{return response({error:'Proof not found'},400)}if(cloud.path!==p.pathname||cloud.size>100*1024*1024)return response({error:'Invalid proof'},400);current.proofs??=[];if(!current.proofs.some(x=>x.pathname===p.pathname)){current.done=true;current.clock=new Date().toISOString();current.proofs.push({id:randomUUID(),name:String(p.name||'Proof').slice(0,140),url:'',pathname:p.pathname,size:cloud.size,type:p.type||'',createdAt:new Date().toISOString()});await save(taskPath(uid,day,id),current);await publishScore(uid,day);await notify(uid,day,current.proofs.at(-1))}return response({item:current})}
return response({error:'Unknown action'},400)}
async function notify(uid,day,proof){
 try{
 const cfg=await read(cfgPath(uid)).catch(()=>null);const channelId=process.env.WORDRUSH_CHANNEL_ID||cfg?.channelId;if(!channelId)return {delivered:false,reason:'Kanal ulanmagan'};
 const {tg}=await import('./_tasks-kit.js');
 const data=await entriesForDay(uid,day),done=Object.values(data).filter(x=>x.done&&x.proofs?.length).length;
 const lines=Object.entries(titles).map(([id,t])=>(data[id].done&&data[id].proofs?.length?'✅ ':'⬜ ')+t);
 const summary='📚 WORDRUSH HOMEWORK\\n📅 '+day+'\\n📊 '+done+'/21 ball\\n\\n'+lines.join('\\n');
 if(proof){
  const file=await bridge('signedRead',{uid,day,path:proof.pathname});
  const note='📎 Yangi proof · '+proof.name+'\\n✅ '+done+'/21 ball\\n'+day;
  const isImage=/^image\//.test(proof.type||'');
  const method=isImage?'sendPhoto':'sendDocument';
  try{await tg(method,{chat_id:channelId,[isImage?'photo':'document']:file.url,caption:note.slice(0,950)})}
  catch(e){console.error('Media delivery failed',e);await tg('sendMessage',{chat_id:channelId,text:note+'\\n'+file.url,disable_web_page_preview:true})}
 }
 const oldPath='wr-task-sync-v2/report/'+uid+'/'+day+'.json';
 const old=await read(oldPath);
 if(old?.id){
  try{await tg('editMessageText',{chat_id:channelId,message_id:old.id,text:summary}) ;return {delivered:true}}
  catch(e){console.error('Channel message edit failed',e.message)}
 }
 const sent=await tg('sendMessage',{chat_id:channelId,text:summary});
 await save(oldPath,{id:sent.message_id});
 return {delivered:true};
 }catch(e){console.error('Telegram channel delivery:',e.message);return {delivered:false,reason:e.message}}
}

async function publishScore(uid,day){try{const data=await entriesForDay(uid,day);const done=Object.values(data).filter(x=>x.done&&x.proofs?.length).length;await save('wr-task-ranking-v1/'+day+'/'+uid+'.json',{uid,done,updatedAt:new Date().toISOString()})}catch(e){console.error('Ranking write failed:',e)}}
