/* WORDRUSH · JAZO (Punishment) — server mantiqi.
   - Kunlik majburiy vazifalar bajarilmasa, 2 ta jazo vazifasi avtomatik tanlanadi
   - Soatlik eslatma (5 daqiqadan so'ng o'chadi)
   - Muddatda bajarilmasa ball ayiriladi (penalties ledger)
   - Proof'lar kanalga doimiy yuboriladi
   Barcha ma'lumot bridge 'read'/'save' orqali wr-punish-v1/ ostida saqlanadi. */
import {createHash} from 'node:crypto';
import {bridge,tg,planFor,isDone,read,save,cfgPath} from '../api/_tasks-kit.js';
import '../punish-tasks.js';

const PU=globalThis.WRPunish;
export const catalog=PU.TASKS;
export const texts=PU.TEXT;

/* ---------------- Sozlamalar ---------------- */
export function settings(){
  const c={...PU.CONFIG};
  const n=(v,d)=>{const x=Number(v);return Number.isFinite(x)&&x>0?Math.floor(x):d};
  c.count=Math.min(n(process.env.PUNISH_COUNT,c.count),catalog.length);
  c.deadlineDays=n(process.env.PUNISH_DAYS,c.deadlineDays);
  c.penaltyPoints=n(process.env.PUNISH_PENALTY,c.penaltyPoints);
  c.tempMinutes=n(process.env.PUNISH_TEMP_MINUTES,c.tempMinutes);
  if(/^\d{4}-\d{2}-\d{2}$/.test(process.env.PUNISH_FROM||''))c.from=process.env.PUNISH_FROM;
  return c;
}

/* ---------------- Sana yordamchilari ---------------- */
export const shift=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export const diffDays=(a,b)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
export function tashkentNow(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(date);
  const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {day:v.year+'-'+v.month+'-'+v.day,hour:Number(v.hour)%24,minute:Number(v.minute)};
}

/* ---------------- Saqlash ---------------- */
const ROOT='wr-punish-v1/';
export const userPath=uid=>ROOT+'u/'+uid+'.json';
const TEMP=ROOT+'temp.json';
const LEDGER=ROOT+'penalties.json';

const normalize=(d,uid)=>{
  const x=d&&typeof d==='object'?d:{};
  return {uid:String(uid),name:x.name||'',evaluatedThrough:x.evaluatedThrough||'',remindKey:x.remindKey||'',items:Array.isArray(x.items)?x.items:[]};
};
export async function loadUser(uid){return normalize(await read(userPath(uid)).catch(()=>null),uid)}
export async function saveUser(doc){
  doc.items.sort((a,b)=>b.day.localeCompare(a.day));
  doc.items=doc.items.slice(0,60);
  return save(userPath(doc.uid),doc);
}
export const allDone=rec=>Boolean(rec&&rec.tasks&&rec.tasks.length&&rec.tasks.every(t=>t.done&&Array.isArray(t.proofs)&&t.proofs.length>0));
export const isOpen=(rec,cfg)=>!allDone(rec)&&(rec.status==='pending'||(rec.status==='penalized'&&cfg.remindAfterPenalty));

/* ---------------- Avtomatik tanlash ---------------- */
/* Foydalanuvchi + kun asosida barqaror "tasodifiy" tanlash. Oldingi jazodagi vazifalar iloji boricha takrorlanmaydi. */
export function pickTasks(uid,day,count,avoid=[]){
  const ids=catalog.map(t=>t.id);
  const score=id=>createHash('sha256').update(uid+'|'+day+'|'+id).digest('hex');
  let pool=ids.filter(id=>!avoid.includes(id));
  if(pool.length<count)pool=ids;
  return pool.sort((a,b)=>score(a).localeCompare(score(b))).slice(0,count);
}

/* ---------------- Kun bo'yicha tekshiruv ---------------- */
async function missedFor(uid,day,cfg){
  const P=planFor(day);
  const groups=P.groups.filter(g=>!cfg.optionalGroups.includes(g.id));
  if(!P.total||!groups.length)return null;
  const {rows}=await bridge('weeklyData',{uid,start:day,end:day});
  const map=new Map((rows||[]).map(x=>[String(x.path).split('/').pop().replace(/\.json$/,''),x.data]));
  const missed=[];
  for(const g of groups){
    const left=g.tasks.filter(([id])=>!isDone(map.get(id))).length;
    if(left)missed.push({group:g.name,left,total:g.tasks.length});
  }
  return {label:P.label,missed};
}

function makeRecord(doc,day,info,today,cfg,nowMs){
  const last=doc.items.slice().sort((a,b)=>b.day.localeCompare(a.day))[0];
  const ids=pickTasks(doc.uid,day,cfg.count,last?last.tasks.map(t=>t.id):[]);
  return {
    day,planLabel:info.label,missed:info.missed,
    assignedDay:today,deadlineDay:shift(today,cfg.deadlineDays-1),
    createdAt:new Date(nowMs).toISOString(),
    tasks:ids.map(id=>({id,done:false,doneAt:'',proofs:[]})),
    status:'pending',penalty:0,penalizedAt:'',completedAt:'',announced:false,penaltyAnnounced:false
  };
}

/* Hali tekshirilmagan o'tgan kunlarni ko'rib chiqadi, bajarilmaganlariga jazo yaratadi. */
async function evaluate(doc,today,cfg,nowMs){
  const yesterday=shift(today,-1);
  const created=[];
  if(doc.evaluatedThrough>=yesterday)return {created,error:null};
  let start=doc.evaluatedThrough?shift(doc.evaluatedThrough,1):cfg.from;
  if(start<cfg.from)start=cfg.from;
  const floor=shift(today,-7);                 // uzoq orqaga qaytmaymiz
  if(start<floor)start=floor;
  let error=null;
  for(let d=start;d<=yesterday;d=shift(d,1)){
    try{
      if(!doc.items.some(i=>i.day===d)){
        const info=await missedFor(doc.uid,d,cfg);
        if(info&&info.missed.length){const rec=makeRecord(doc,d,info,today,cfg,nowMs);doc.items.push(rec);created.push(rec)}
      }
      doc.evaluatedThrough=d;
    }catch(e){error=String(e.message||e);break}  // shu kunda to'xtaymiz, keyingi urinishda davom etamiz
  }
  return {created,error};
}

/* ---------------- Ball ayirish (ledger) ---------------- */
async function addLedger(entry){
  const doc=(await read(LEDGER).catch(()=>null))||{items:[]};
  const items=Array.isArray(doc.items)?doc.items:[];
  if(items.some(x=>x.key===entry.key))return false;      // bir xil jazo uchun ikki marta ayirilmaydi
  items.push(entry);
  await save(LEDGER,{items});
  return true;
}
/* Berilgan kunlarda ayirilgan ballar: Map(uid -> {points,name}) */
export async function penaltiesFor(days){
  const set=new Set(days);
  const doc=(await read(LEDGER).catch(()=>null))||{items:[]};
  const out=new Map();
  for(const x of Array.isArray(doc.items)?doc.items:[]){
    if(!set.has(x.appliedOn))continue;
    const cur=out.get(x.uid)||{points:0,name:''};
    cur.points+=Number(x.points)||0;
    if(x.name)cur.name=x.name;
    out.set(x.uid,cur);
  }
  return out;
}
async function applyPenalties(doc,today,cfg,nowMs){
  const applied=[];
  for(const rec of doc.items){
    if(rec.status!=='pending')continue;
    if(allDone(rec)){rec.status='done';rec.completedAt=rec.completedAt||new Date(nowMs).toISOString();continue}
    if(today<=rec.deadlineDay)continue;
    const who=await displayName(doc);
    await addLedger({key:doc.uid+':'+rec.day,uid:doc.uid,name:who,day:rec.day,appliedOn:today,points:cfg.penaltyPoints,at:new Date(nowMs).toISOString()});
    rec.status='penalized';rec.penalty=cfg.penaltyPoints;rec.penaltyAnnounced=false;
    rec.penalizedAt=new Date(nowMs).toISOString();
    applied.push(rec);
  }
  return applied;
}

/* ---------------- Matnlar ---------------- */
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const slice=t=>String(t).slice(0,4000);
function taskLines(rec){
  return rec.tasks.map((t,i)=>{
    const def=PU.get(t.id)||{title:t.id,en:''};
    return (t.done&&t.proofs.length?'✅ ':'⬜ ')+(i+1)+'. '+def.title+' — '+def.en;
  });
}
const missedText=rec=>(rec.missed||[]).map(m=>m.group+' ('+m.left+'/'+m.total+')').join(', ')||'—';
export function leftText(rec,today){
  const d=diffDays(rec.deadlineDay,today);
  if(d<0)return 'muddat o‘tdi';
  if(d===0)return 'bugun oxirgi kun (23:59 gacha)';
  return (d+1)+' kun qoldi ('+rec.deadlineDay+' 23:59 gacha)';
}
export function openLines(doc,today,cfg=settings()){
  const open=doc.items.filter(r=>isOpen(r,cfg));
  const out=[];
  for(const rec of open.slice(0,3)){
    out.push('📅 '+rec.day+' · '+rec.planLabel+' — bajarilmagan: '+missedText(rec));
    out.push(...taskLines(rec));
    out.push('⏳ '+leftText(rec,today)+(rec.status==='penalized'?' · ⛔ −'+rec.penalty+' ball ayrilgan':' · bajarilmasa −'+cfg.penaltyPoints+' ball'));
    out.push('');
  }
  if(open.length>3)out.push('… va yana '+(open.length-3)+' ta jazo (Mini App → ⚖️ Jazo).','');
  return out;
}
function reminderText(doc,name,day,hour,cfg){
  return slice([
    '⚖️ WORDRUSH · JAZO ESLATMASI',
    '👤 '+name,
    '📅 '+day+' · '+String(hour).padStart(2,'0')+':00',
    '',
    ...openLines(doc,day,cfg),
    '📤 Proof yuklash: TASKS → ⚖️ Jazo bo‘limi.',
    '🕔 Ushbu eslatma '+cfg.tempMinutes+' daqiqadan so‘ng o‘chiriladi.'
  ].join('\n'));
}
function assignedText(rec,name,cfg){
  return slice([
    '⚖️ WORDRUSH · JAZO BERILDI',
    '👤 '+name,
    '📅 '+rec.day+' · '+rec.planLabel+' to‘liq bajarilmadi',
    '⚠️ Bajarilmagan: '+missedText(rec),
    '',
    '🎲 Avtomatik tanlangan '+rec.tasks.length+' ta jazo vazifasi:',
    ...taskLines(rec),
    '',
    '⏳ Muddat: '+rec.deadlineDay+' 23:59 gacha ('+cfg.deadlineDays+' kun)',
    '⛔ Bajarilmasa: −'+cfg.penaltyPoints+' ball',
    '📤 Proof yuklash: TASKS → ⚖️ Jazo bo‘limi.'
  ].join('\n'));
}
const penaltyText=(rec,name)=>['⛔ WORDRUSH · JAZO BALLI AYIRILDI','👤 '+name,'📅 '+rec.day+' kunidagi jazo muddatida bajarilmadi','➖ −'+rec.penalty+' ball ayirildi','','Jazo vazifalarini baribir bajaring — eslatmalar davom etadi.'].join('\n');
export const doneText=(rec,name)=>['✅ WORDRUSH · JAZO BAJARILDI','👤 '+name,'📅 '+rec.day+' kunidagi jazo · '+rec.tasks.length+'/'+rec.tasks.length+' vazifa','👏 Proof’lar yuqorida saqlangan.'].join('\n');

/* ---------------- Telegram ---------------- */
async function displayName(doc){
  if(doc.name)return doc.name;
  try{
    const c=await tg('getChat',{chat_id:doc.uid});
    const n=[c.first_name,c.last_name].filter(Boolean).join(' ').trim()||c.username||'';
    if(n){doc.name=n.slice(0,80);return doc.name}
  }catch(e){console.warn('Telegram name unavailable',e.message)}
  return 'Ishtirokchi '+doc.uid.slice(-4);
}
export const channelFor=async uid=>process.env.WORDRUSH_CHANNEL_ID||(await read(cfgPath(uid)).catch(()=>null))?.channelId||'';

async function trackTemp(entry){
  const doc=(await read(TEMP).catch(()=>null))||{items:[]};
  const items=Array.isArray(doc.items)?doc.items:[];
  items.push(entry);
  await save(TEMP,{items});
}
export async function cleanupTemp(nowMs){
  const doc=(await read(TEMP).catch(()=>null))||{items:[]};
  const items=Array.isArray(doc.items)?doc.items:[];
  if(!items.some(x=>x.deleteAfter<=nowMs))return {deleted:0,failed:0};
  const keep=[];let deleted=0,failed=0;
  for(const m of items){
    if(m.deleteAfter>nowMs){keep.push(m);continue}
    try{await tg('deleteMessage',{chat_id:m.chat_id,message_id:m.message_id});deleted++}
    catch(e){
      const msg=String(e.message||e);
      if(/not found|can't be deleted|cannot be deleted/i.test(msg))deleted++;    // allaqachon yo'q
      else{m.tries=(m.tries||0)+1;if(m.tries<6)keep.push(m);failed++}
    }
  }
  await save(TEMP,{items:keep});
  return {deleted,failed};
}

async function sendPermanent(channelId,text){return tg('sendMessage',{chat_id:channelId,text,disable_web_page_preview:true})}

export async function announceDone(uid,doc,rec){
  const channelId=await channelFor(uid);
  if(!channelId)return null;
  return sendPermanent(channelId,doneText(rec,await displayName(doc)));
}

async function remind(doc,day,hour,cfg,nowMs,channelId){
  if(!doc.items.some(r=>isOpen(r,cfg)))return 'none';
  const key=day+'T'+String(hour).padStart(2,'0');
  if(doc.remindKey===key)return 'duplicate';
  doc.remindKey=key;await saveUser(doc);                      // bu soat uchun "band qilamiz"
  try{
    const name=await displayName(doc);
    const sent=await tg('sendMessage',{chat_id:channelId,text:reminderText(doc,name,day,hour,cfg),disable_web_page_preview:true});
    try{await trackTemp({chat_id:String(channelId),message_id:sent.message_id,uid:doc.uid,deleteAfter:nowMs+cfg.tempMinutes*60000})}
    catch(e){await tg('deleteMessage',{chat_id:channelId,message_id:sent.message_id}).catch(()=>{});throw e}   // kuzatilmagan xabar qolib ketmasin
    return 'sent';
  }catch(e){doc.remindKey='';await saveUser(doc).catch(()=>{});throw e}
}

/* ---------------- Soatlik tick (hourly-reminders.js chaqiradi) ---------------- */
export async function runPunishmentTick({channelId,day,hour,minute,nowMs=Date.now()}){
  const cfg=settings();
  const out={cleanup:null,users:0,created:0,penalized:0,reminded:0,duplicate:0,failed:0};
  out.cleanup=await cleanupTemp(nowMs).catch(e=>({error:String(e.message||e)}));
  if(minute>=5)return {...out,skipped:'Not an hourly send minute'};
  if(shift(day,-1)<cfg.from)return {...out,skipped:'Jazo tizimi hali boshlanmagan ('+cfg.from+')'};
  const {users}=await bridge('weeklyUsers');
  for(const u of users||[]){
    const uid=String(u.uid||'');
    if(!/^\d+$/.test(uid))continue;
    out.users++;
    try{
      const doc=await loadUser(uid);
      const before=JSON.stringify([doc.evaluatedThrough,doc.items.length]);
      const ev=await evaluate(doc,day,cfg,nowMs);
      if(ev.error)console.error('Punish evaluate',uid,ev.error);
      const penalized=await applyPenalties(doc,day,cfg,nowMs);
      out.created+=ev.created.length;out.penalized+=penalized.length;
      const changed=before!==JSON.stringify([doc.evaluatedThrough,doc.items.length])||penalized.length>0||ev.created.length>0;
      if(changed)await saveUser(doc);

      // e'lonlar (yuborilmay qolgan bo'lsa, keyingi tickda qayta uriniladi)
      let flagsChanged=false;
      for(const rec of doc.items){
        if(!rec.announced&&(rec.status==='pending'||rec.status==='penalized')&&!allDone(rec)){
          try{await sendPermanent(channelId,assignedText(rec,await displayName(doc),cfg));rec.announced=true;flagsChanged=true}
          catch(e){console.error('Punish announce',uid,e.message)}
        }
        if(rec.status==='penalized'&&!rec.penaltyAnnounced){
          try{await sendPermanent(channelId,penaltyText(rec,await displayName(doc)));rec.penaltyAnnounced=true;flagsChanged=true}
          catch(e){console.error('Punish penalty notice',uid,e.message)}
        }
      }
      if(flagsChanged)await saveUser(doc);

      if(hour>=cfg.remindFromHour&&hour<=cfg.remindToHour){
        const r=await remind(doc,day,hour,cfg,nowMs,channelId);
        if(r==='sent')out.reminded++;else if(r==='duplicate')out.duplicate++;
      }
    }catch(e){out.failed++;console.error('Punishment tick failed for',uid,e)}
  }
  return out;
}

/* ---------------- Bot (/jazo) ---------------- */
export async function statusLines(uid){
  const cfg=settings(),doc=await loadUser(uid),today=tashkentNow().day;
  const lines=openLines(doc,today,cfg);
  return {open:doc.items.filter(r=>isOpen(r,cfg)).length,text:lines.join('\n').trim()};
}

/* ---------------- Proof'ni kanalga yuborish (api/punishment.js) ---------------- */
const MAX_PHOTO=10*1024*1024,MAX_FILE=50*1024*1024;
async function tgUpload(method,fields,files){
  const token=process.env.TELEGRAM_BOT_TOKEN||process.env.BOT_TOKEN||process.env.TG_BOT_TOKEN||'';
  if(!token)throw new Error('BOT_TOKEN topilmadi');
  const form=new FormData();
  for(const [k,v] of Object.entries(fields))form.append(k,typeof v==='string'?v:JSON.stringify(v));
  for(const f of files)form.append(f.field,new Blob([f.buffer],{type:f.type||'application/octet-stream'}),f.filename);
  const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',body:form});
  const j=await r.json();
  if(!j.ok)throw new Error(j.description||'Telegram error');
  return j.result;
}
export async function sendProofToChannel({uid,doc,rec,proof}){
  const channelId=await channelFor(uid);
  if(!channelId)return {delivered:false,reason:'Kanal ulanmagan'};
  const def=PU.get(proof.taskId)||{title:proof.taskId};
  const name=await displayName(doc);
  const caption=('⚖️ <b>JAZO</b> · <b>'+esc(name)+'</b>\n📅 '+rec.day+' kunidagi jazo\n✅ <b>'+esc(def.title)+'</b>'+(proof.note?'\n📝 '+esc(proof.note):'')).slice(0,1024);
  const file=await bridge('signedRead',{uid,day:rec.day,path:proof.pathname});
  const r=await fetch(file.url);
  if(!r.ok)throw new Error('Download failed: '+r.status);
  const buffer=Buffer.from(await r.arrayBuffer());
  if(buffer.length>MAX_FILE){
    await tg('sendMessage',{chat_id:channelId,text:caption+'\n⚠️ Fayl Telegram limitidan katta ('+esc(proof.name)+'), Mini App’da saqlangan.',parse_mode:'HTML'});
    return {delivered:true,partial:true};
  }
  const photo=/^image\//.test(proof.type||'')&&buffer.length<=MAX_PHOTO;
  await tgUpload(photo?'sendPhoto':'sendDocument',{chat_id:String(channelId),caption,parse_mode:'HTML'},
    [{field:photo?'photo':'document',buffer,filename:proof.name||'proof',type:proof.type}]);
  return {delivered:true};
}

/* ---------------- Mini App uchun ochiq ko'rinish ---------------- */
export function publicRecord(rec,today,cfg=settings()){
  const done=allDone(rec);
  const left=diffDays(rec.deadlineDay,today);
  return {
    day:rec.day,planLabel:rec.planLabel,missed:rec.missed||[],
    assignedDay:rec.assignedDay,deadlineDay:rec.deadlineDay,
    status:rec.status,penalty:rec.penalty||0,allDone:done,
    daysLeft:left<0?null:left+1,overdue:left<0&&!done,
    completedAt:rec.completedAt||'',
    tasks:rec.tasks.map(t=>({
      id:t.id,done:Boolean(t.done&&t.proofs.length),doneAt:t.doneAt||'',
      proofs:t.proofs.map(p=>({id:p.id,name:p.name,size:p.size,type:p.type,createdAt:p.createdAt}))
    }))
  };
}
