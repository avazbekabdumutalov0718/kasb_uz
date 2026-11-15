import {createHmac,timingSafeEqual} from 'node:crypto';
import '../tasks-plan.js';

export const root='wr-task-sync-v2/';
export const plan=globalThis.WRPlan;
const eq=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y)};
function key(){return process.env.TASKS_SESSION_SECRET}
export function sign(uid,kind='session',ttl=2592000){if(!key())throw Error('Session secret missing');const payload=Buffer.from(JSON.stringify({uid:String(uid),kind,exp:Date.now()+ttl*1000})).toString('base64url');return payload+'.'+createHmac('sha256',key()).update(payload).digest('base64url')}
export function verify(t,kind='session'){if(!key())return null;const [p,s]=String(t||'').split('.');if(!p||!s)return null;const correct=createHmac('sha256',key()).update(p).digest('base64url');if(!eq(correct,s))return null;try{const data=JSON.parse(Buffer.from(p,'base64url'));return data.kind===kind&&data.exp>Date.now()&&/^\d+$/.test(String(data.uid))?String(data.uid):null}catch{return null}}
// Telegram initData imzosini tekshiradi va foydalanuvchi obyektini qaytaradi.
function initData(s){if(!s||!process.env.TELEGRAM_BOT_TOKEN)return null;const u=new URLSearchParams(s),hash=u.get('hash');if(!hash)return null;u.delete('hash');const str=[...u.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([a,b])=>a+'='+b).join('\n');const secret=createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();const expected=createHmac('sha256',secret).update(str).digest('hex');if(!eq(hash,expected))return null;if(Math.abs(Date.now()/1000-Number(u.get('auth_date')))>86400)return null;try{const data=JSON.parse(u.get('user'));return data&&data.id!=null?data:null}catch{return null}}
export function initUser(s){const data=initData(s);return data?String(data.id):null}
// Reyting uchun: Telegram'dagi ism (faqat tekshirilgan initData bo'lsa).
export function userName(req){const data=initData(req.headers.get('x-telegram-init-data'));return data?[data.first_name,data.last_name].filter(Boolean).join(' ').trim():''}
// "Avazbek Abdumutalov" -> "Avazbek A."
export function shortName(s){const parts=String(s||'').trim().split(/\s+/).filter(Boolean);if(!parts.length)return '';const first=Array.from(parts[0]).slice(0,18).join('');return parts[1]?first+' '+Array.from(parts[1])[0]+'.':first}
export function user(req){const fromTelegram=initUser(req.headers.get('x-telegram-init-data'));if(fromTelegram)return fromTelegram;const cookie=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('wr_tasks_session='));if(cookie){const verified=verify(decodeURIComponent(cookie.slice(17)));if(verified)return verified}const a=req.headers.get('authorization')||'';return verify(a.startsWith('Bearer ')?a.slice(7):'')}
export const response=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export const validDay=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''));

// ---- Kunlik reja (tasks-plan.js) ----
export const planFor=day=>plan.forDay(day);
export const idsFor=day=>planFor(day).tasks.map(t=>t[0]);
export const inPlan=(day,id)=>idsFor(day).includes(String(id||''));
export const isDone=x=>Boolean(x&&x.done&&Array.isArray(x.proofs)&&x.proofs.length>0);
// Eski kodlar bilan moslik uchun: barcha rejalardagi vazifa nomlari.
export const titles=Object.fromEntries(plan.all.map(t=>[t[0],t[1]]));
export const validTask=id=>plan.has(id);

export const taskPath=(uid,day,id)=>root+'u/'+uid+'/'+day+'/'+id+'.json';
export const cfgPath=uid=>root+'c/'+uid+'.json';
export async function read(path){return (await bridge('read',{path})).data}
export async function entriesForDay(uid,day){
  const ids=idsFor(day),results={};
  // Blob API bir vaqtda ko'p so'rovda HTTP 429 beradi — 2 tadan parallel o'qiymiz.
  let next=0;
  async function worker(){
    while(next<ids.length){
      const id=ids[next++];
      results[id]=await entry(uid,day,id);
    }
  }
  await Promise.all([worker(),worker()]);
  return results;
}
export async function save(path,data){return bridge('save',{path,data})}
export async function entry(uid,day,id){return await read(taskPath(uid,day,id))||{proofs:[],done:false,seconds:0,duration:plan.minutesOf(id)||10,clock:''}}
export const proofPrefix=(uid,day,id)=>'wr-task-proof/'+uid+'/'+day+'/'+id+'/';
export async function tg(method,payload){const r=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(13000)});const d=await r.json();if(!d.ok)throw Error(String(d.description||'Telegram error').slice(0,180));return d.result}

export async function bridge(action,details={}){if(!process.env.WORDRUSH_BRIDGE_SECRET||!process.env.WORDRUSH_SUPABASE_URL)throw Error('Supabase bridge not configured');const r=await fetch(process.env.WORDRUSH_SUPABASE_URL+'/functions/v1/wordrush-tasks-bridge',{method:'POST',headers:{'Content-Type':'application/json','x-wordrush-internal':process.env.WORDRUSH_BRIDGE_SECRET},body:JSON.stringify({action,...details}),signal:AbortSignal.timeout(20000)});const j=await r.json().catch(()=>({error:'Bridge unavailable'}));if(!r.ok)throw Error(j.error||'Supabase request failed');return j}
