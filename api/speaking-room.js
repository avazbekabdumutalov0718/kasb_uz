import {list,put,del} from '@vercel/blob';
import {randomUUID,randomBytes,createHash} from 'node:crypto';

const PREFIX='speaking-room-v1/';
const TTL=3*60*60*1000;
const ACTIVE=30*1000;
const sha=s=>createHash('sha256').update(String(s)).digest('hex');
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const clean=s=>String(s||'').replace(/[^\p{L}\p{N} _.-]/gu,'').trim().slice(0,36);
const codeOk=s=>/^[A-Z0-9]{8}$/.test(String(s||''));
const blobPath=(code,name)=>PREFIX+'rooms/'+code+'/'+name;
const genCode=()=>randomBytes(5).toString('hex').slice(0,8).toUpperCase();
function checkOrigin(request){const origin=request.headers.get('origin');if(!origin)return true;try{return new URL(origin).host===new URL(request.url).host}catch{return false}}
async function getJson(path){const r=await list({prefix:path,limit:8});const item=r.blobs.find(x=>x.pathname===path);if(!item)return null;const response=await fetch(item.url,{cache:'no-store'});if(!response.ok)return null;return response.json()}
async function store(path,value,overwrite=false){return put(path,JSON.stringify(value),{access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:overwrite,cacheControlMaxAge:0})}
async function room(code){const v=await getJson(blobPath(code,'room.json'));if(!v||Date.now()-v.created>TTL)return null;return v}
async function enter(code,name){
 const r=await room(code);if(!r)return {error:'Xona topilmadi yoki muddati tugagan.',status:404};
 const token=randomBytes(24).toString('hex'),guest={name:clean(name)||'Guest',tokenHash:sha(token),time:Date.now()};
 if(r.closed)return {error:'Xona yopilgan.',status:410};
 try{await store(blobPath(code,'guest.json'),guest);return {code,token,role:'guest',name:guest.name,room:r}}
 catch(e){if(String(e).includes('exist')||String(e).includes('409')||e?.status===409)return {error:'Xona to‘lgan (2/2).',status:409};throw e}
}
async function authorise(code,token){
 const r=await room(code);if(!r)return {error:'Xona topilmadi.',status:404};
 if(sha(token)===r.hostHash)return {r,role:'host',guest:await getJson(blobPath(code,'guest.json'))};
 const guest=await getJson(blobPath(code,'guest.json'));if(guest&&sha(token)===guest.tokenHash)return {r,role:'guest',guest};
 return {error:'Xonaga kirish huquqi yo‘q.',status:403}
}
function sanitizeEvent(type,data){
 if(!['ready','next','turn','chat','signal','leave'].includes(type))return null;
 if(type==='chat')return {message:String(data?.message||'').trim().slice(0,500)};
 if(type==='turn')return {role:data?.role==='host'?'host':'guest'};
 if(type==='next')return {part:[1,2,3].includes(Number(data?.part))?Number(data.part):1,topicIndex:Math.max(0,Math.min(1000,Number(data?.topicIndex)||0)),nonce:String(data?.nonce||'').slice(0,40)};
 if(type==='signal'){
  const signal=data?.signal;
  if(!signal||!['offer','answer','candidate'].includes(signal.type))return null;
  const encoded=JSON.stringify(signal);if(encoded.length>28000)return null;
  return {signal};
 }
 return {};
}
export async function POST(request){
 if(!process.env.BLOB_READ_WRITE_TOKEN)return json({error:'Speaking Room xotirasi sozlanmagan.'},503);
 if(!checkOrigin(request))return json({error:'Origin not allowed'},403);
 if(Number(request.headers.get('content-length')||0)>45000)return json({error:'So‘rov juda katta.'},413);
 let b;try{b=await request.json()}catch{return json({error:'Invalid JSON'},400)}
 if(!b||typeof b!=='object'||Array.isArray(b))return json({error:'Invalid request'},400);
 try{
  if(b.action==='create'){
   const token=randomBytes(24).toString('hex');
   for(let i=0;i<5;i++){
    const code=genCode(),r={code,created:Date.now(),hostName:clean(b.name)||'Host',hostHash:sha(token),closed:false};
    try{await store(blobPath(code,'room.json'),r);return json({code,token,role:'host',name:r.hostName})}catch(e){if(i===4)throw e}
   }
  }
  if(b.action==='random'){
   const now=Date.now();
   const queue=await list({prefix:PREFIX+'queue/',limit:80});
   for(const entry of queue.blobs){
    const match=entry.pathname.match(/queue\/([A-Z0-9]{8})\.json$/);if(!match)continue;
    if(now-new Date(entry.uploadedAt).getTime()>8*60*1000)continue;
    const candidate=await room(match[1]);if(!candidate)continue;
    const activity=await getJson(blobPath(match[1],'host-heartbeat.json'));
    const occupancy=await getJson(blobPath(match[1],'guest.json'));
    if(occupancy||!activity||now-activity.at>ACTIVE)continue;
    try{const result=await enter(match[1],b.name);if(result.code)return json({...result,matched:true})}catch{}
   }
   const token=randomBytes(24).toString('hex');
   for(let i=0;i<4;i++){
    const code=genCode(),r={code,created:Date.now(),hostName:clean(b.name)||'Host',hostHash:sha(token),closed:false};
    try{
     await store(blobPath(code,'room.json'),r);
     await store(PREFIX+'queue/'+code+'.json',{code,created:Date.now()});
     return json({code,token,role:'host',matched:false,name:r.hostName});
    }catch(e){if(i===3)throw e}
   }
  }
  if(!codeOk(b.code))return json({error:'8 belgili xona kodi kerak.'},400);
  const code=b.code;
  if(b.action==='join'){
   const result=await enter(code,b.name);
   return result.error?json({error:result.error},result.status):json(result);
  }
  const auth=await authorise(code,b.token);
  if(auth.error)return json({error:auth.error},auth.status);
  if(b.action==='heartbeat'){
   await store(blobPath(code,auth.role+'-heartbeat.json'),{at:Date.now()},true);
   return json({ok:true});
  }
  if(b.action==='event'){
   const type=String(b.type||''),payload=sanitizeEvent(type,b.data);
   if(!payload)return json({error:'Noto‘g‘ri event.'},400);
   const evt={id:randomUUID(),at:Date.now(),role:auth.role,type,data:payload};
   const path=blobPath(code,'events/'+String(evt.at).padStart(13,'0')+'-'+evt.id+'.json');
   await store(path,evt);return json({ok:true,id:evt.id});
  }
  return json({error:'Unknown action'},400);
 }catch(err){console.error('Room POST failed',err);return json({error:'Xona serverida xatolik. Keyinroq urinib ko‘ring.'},500)}
}
export async function GET(request){
 if(!process.env.BLOB_READ_WRITE_TOKEN)return json({error:'Room storage unavailable'},503);
 const u=new URL(request.url),code=u.searchParams.get('code'),token=u.searchParams.get('token');
 if(!codeOk(code)||!token)return json({error:'Room code and session required'},400);
 try{
  const a=await authorise(code,token);if(a.error)return json({error:a.error},a.status);
  const {blobs}=await list({prefix:blobPath(code,'events/'),limit:300});
  const recent=blobs.slice(-140);
  const activeGuest=a.guest?await getJson(blobPath(code,'guest-heartbeat.json')):null;
  const events=await Promise.all(recent.map(async x=>{try{const r=await fetch(x.url,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}}));
  return json({code,hostName:a.r.hostName,guestName:a.guest?.name||null,guestOnline:!!(a.guest&&activeGuest&&Date.now()-activeGuest.at<ACTIVE),role:a.role,events:events.filter(Boolean).sort((x,y)=>x.at-y.at)});
 }catch(err){console.error('Room GET failed',err);return json({error:'Xonaga ulanishda xatolik.'},500)}
}