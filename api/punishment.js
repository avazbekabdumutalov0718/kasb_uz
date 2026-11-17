/* WORDRUSH · JAZO API
   GET  /api/punishment                         -> foydalanuvchining jazolari
   GET  /api/punishment?download=1&day&id&proofId -> proof yuklab olish havolasi
   POST /api/punishment {action:'upload'|'proof'|'delete', day, id, ...}
   Proof'lar kanalda doimiy qoladi (foydalanuvchi o'chirsa ham kanal xabarlari o'chirilmaydi). */
import {randomUUID} from 'node:crypto';
import {user,response,validDay,proofPrefix,bridge} from './_tasks-kit.js';
import {
  loadUser,saveUser,allDone,settings,catalog,texts,tashkentNow,publicRecord,
  sendProofToChannel,announceDone
} from '../lib/punishment.js';

export const config={maxDuration:60};

const MAX_BYTES=100*1024*1024;

function payload(doc,cfg,now){
  const items=doc.items.map(r=>publicRecord(r,now.day,cfg));
  const rank=r=>r.allDone?2:(r.status==='penalized'?1:0);   // ochiqlari tepada
  items.sort((a,b)=>rank(a)-rank(b)||b.day.localeCompare(a.day));
  return {
    uid:doc.uid,today:now.day,
    config:{count:cfg.count,deadlineDays:cfg.deadlineDays,penaltyPoints:cfg.penaltyPoints,tempMinutes:cfg.tempMinutes,optionalGroups:cfg.optionalGroups,from:cfg.from},
    texts,catalog,items,
    open:items.filter(r=>!r.allDone).length
  };
}

export async function GET(req){
  const uid=user(req);
  if(!uid)return response({error:'Telegram orqali kiring'},401);
  const q=new URL(req.url).searchParams;
  try{
    const doc=await loadUser(uid);
    if(q.get('download')==='1'){
      const rec=doc.items.find(r=>r.day===q.get('day'));
      const proof=rec?.tasks.find(t=>t.id===q.get('id'))?.proofs.find(p=>p.id===q.get('proofId'));
      if(!proof)return response({error:'Proof topilmadi'},404);
      const file=await bridge('signedRead',{uid,day:rec.day,path:proof.pathname});
      return response({url:file.url,name:proof.name});
    }
    return response(payload(doc,settings(),tashkentNow()));
  }catch(e){return response({error:String(e.message||e)},503)}
}

export async function POST(req){
  const uid=user(req);
  if(!uid)return response({error:'Telegram orqali kiring'},401);
  let body;
  try{body=await req.json()}catch{return response({error:'Invalid JSON'},400)}
  const {action,day,id}=body;
  if(!validDay(day)||!id)return response({error:'Invalid task'},400);

  try{
    const cfg=settings(),now=tashkentNow();
    const doc=await loadUser(uid);
    const rec=doc.items.find(r=>r.day===day);
    const task=rec?.tasks.find(t=>t.id===id);
    if(!rec||!task)return response({error:'Bunday jazo vazifasi topilmadi'},404);

    /* 1) Yuklash uchun imzolangan havola */
    if(action==='upload'){
      const size=Number(body.size)||0;
      if(size>MAX_BYTES)return response({error:'100 MB dan katta proof yuborib bo‘lmaydi.'},400);
      const result=await bridge('uploadToken',{uid,day:rec.day,id:task.id,name:String(body.name||'proof').slice(0,140),size});
      return response(result);
    }

    /* 2) Yuklangan faylni jazo vazifasiga yozish */
    if(action==='proof'){
      const p=body.proof;
      if(!p||!String(p.pathname).startsWith(proofPrefix(uid,rec.day,task.id)))return response({error:'Invalid proof path'},400);
      let cloud;
      try{cloud=await bridge('fileInfo',{uid,day:rec.day,id:task.id,path:p.pathname})}
      catch{return response({error:'Proof not found'},400)}
      if(cloud.path!==p.pathname||cloud.size>MAX_BYTES)return response({error:'Invalid proof'},400);

      let proof=task.proofs.find(x=>x.pathname===p.pathname),isNew=false;
      if(!proof){
        isNew=true;
        proof={id:randomUUID(),taskId:task.id,name:String(p.name||'Proof').slice(0,140),pathname:p.pathname,size:cloud.size,type:p.type||'',note:String(p.note||'').slice(0,400),createdAt:new Date().toISOString()};
        task.proofs.push(proof);
        task.done=true;task.doneAt=proof.createdAt;
      }
      const justCompleted=allDone(rec)&&!rec.completedAt;
      if(justCompleted){rec.completedAt=new Date().toISOString();if(rec.status==='pending')rec.status='done'}
      await saveUser(doc);

      let delivery=null;
      if(isNew){
        try{delivery=await sendProofToChannel({uid,doc,rec,proof})}
        catch(e){console.error('Punish proof delivery',e.message);delivery={delivered:false,reason:String(e.message||e)}}
      }
      if(justCompleted){try{await announceDone(uid,doc,rec)}catch(e){console.error('Punish done notice',e.message)}}
      return response({record:publicRecord(rec,now.day,cfg),delivery});
    }

    /* 3) Proof'ni o'chirish (kanaldagi nusxa saqlanib qoladi) */
    if(action==='delete'){
      const proof=task.proofs.find(x=>x.id===body.proofId);
      if(!proof)return response({error:'Proof not found'},404);
      task.proofs=task.proofs.filter(x=>x.id!==body.proofId);
      if(!task.proofs.length){task.done=false;task.doneAt=''}
      if(rec.completedAt&&!allDone(rec)){rec.completedAt='';if(rec.status==='done')rec.status='pending'}
      await saveUser(doc);
      try{await bridge('deleteFile',{uid,day:rec.day,id:task.id,path:proof.pathname})}
      catch(e){console.error('Storage delete warning:',e.message)}
      return response({record:publicRecord(rec,now.day,cfg)});
    }

    return response({error:'Unknown action'},400);
  }catch(e){
    console.error('Punishment API',e);
    return response({error:String(e.message||e)},503);
  }
}
