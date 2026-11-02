import {createHmac,timingSafeEqual} from 'node:crypto';
import {put,list} from '@vercel/blob';
export const root='wr-task-sync-v2/';
const eq=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y)};
function key(){return process.env.TASKS_SESSION_SECRET}
export function sign(uid,kind='session',ttl=2592000){if(!key())throw Error('Session secret missing');const payload=Buffer.from(JSON.stringify({uid:String(uid),kind,exp:Date.now()+ttl*1000})).toString('base64url');return payload+'.'+createHmac('sha256',key()).update(payload).digest('base64url')}
export function verify(t,kind='session'){if(!key())return null;const [p,s]=String(t||'').split('.');if(!p||!s)return null;const correct=createHmac('sha256',key()).update(p).digest('base64url');if(!eq(correct,s))return null;try{const data=JSON.parse(Buffer.from(p,'base64url'));return data.kind===kind&&data.exp>Date.now()&&/^\d+$/.test(String(data.uid))?String(data.uid):null}catch{return null}}
export function initUser(s){if(!s||!process.env.TELEGRAM_BOT_TOKEN)return null;const u=new URLSearchParams(s),hash=u.get('hash');if(!hash)return null;u.delete('hash');const str=[...u.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([a,b])=>a+'='+b).join('\n');const secret=createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();const expected=createHmac('sha256',secret).update(str).digest('hex');if(!eq(hash,expected))return null;if(Math.abs(Date.now()/1000-Number(u.get('auth_date')))>86400)return null;try{return String(JSON.parse(u.get('user')).id)}catch{return null}}
export function user(req){const fromTelegram=initUser(req.headers.get('x-telegram-init-data'));if(fromTelegram)return fromTelegram;const cookie=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('wr_tasks_session='));if(cookie){const verified=verify(decodeURIComponent(cookie.slice(17)));if(verified)return verified}const a=req.headers.get('authorization')||'';return verify(a.startsWith('Bearer ')?a.slice(7):'')}
export const response=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export const validDay=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''));
export const titles={r1:'4 ELS',r2:'1 article',r3:'25+ words',l1:'2 podcasts',l2:'YouTube video',l3:'2 listening parts',s1:'Topic (10m)',s2:'25+ chunks',s3:'Speaking mock',s4:'Grammar (1h)',s5:'Speak 30m',s6:'2 structures',w1:'Essay and analysis',w2:'2 structures',w3:'150 sentences',g1:'Gym',p1:'Bomdod',p2:'Peshin',p3:'Asr',p4:'Shom',p5:'Xufton'};
export const validTask=id=>Object.hasOwn(titles,String(id||''));
export const taskPath=(uid,day,id)=>root+'u/'+uid+'/'+day+'/'+id+'.json';
export const cfgPath=uid=>root+'c/'+uid+'.json';
export async function read(path){const x=await list({prefix:path,limit:5});const entry=x.blobs.find(x=>x.pathname===path);if(!entry)return null;const r=await fetch(entry.url+'?v='+Date.now(),{cache:'no-store'});return r.ok?r.json():null}
export async function save(path,data){return put(path,JSON.stringify(data),{access:'public',contentType:'application/json',allowOverwrite:true,addRandomSuffix:false,cacheControlMaxAge:0})}
export async function entry(uid,day,id){return await read(taskPath(uid,day,id))||{proofs:[],done:false,seconds:0,duration:10,clock:''}}
export const proofPrefix=(uid,day,id)=>'wr-task-proof/'+uid+'/'+day+'/'+id+'/';
export async function tg(method,payload){const r=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(13000)});const d=await r.json();if(!d.ok)throw Error(String(d.description||'Telegram error').slice(0,180));return d.result}
