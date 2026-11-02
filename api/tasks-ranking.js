import {list} from '@vercel/blob';
import {user,response} from './_tasks-kit.js';
export const config={maxDuration:30};
export async function GET(req){
 if(!user(req))return response({error:'Telegram orqali kiring'},401);
 const u=new URL(req.url),day=u.searchParams.get('day');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return response({error:'Invalid day'},400);
 const prefix='wr-task-ranking-v1/'+day+'/';
 try{
  const rows=[];let cursor;
  do{
   const page=await list({prefix,limit:100,cursor});
   for(const b of page.blobs){
    if(!b.pathname.endsWith('.json'))continue;
    rows.push(b);
   }
   cursor=page.hasMore?page.cursor:undefined;
  }while(cursor&&rows.length<500);
  let pos=0,results=[];
  async function worker(){
   while(pos<rows.length){
    const b=rows[pos++];
    try{const r=await fetch(b.url,{cache:'no-store'});if(!r.ok)continue;const x=await r.json();
     if(x?.uid&&Number.isInteger(x.done)&&x.done>=0&&x.done<=21)
      results.push({uid:String(x.uid),done:x.done,updatedAt:x.updatedAt||''});
    }catch{}
   }
  }
  await Promise.all(Array.from({length:3},worker));
  results.sort((a,b)=>b.done-a.done||a.updatedAt.localeCompare(b.updatedAt));
  return response({day,participants:results.length,limited:rows.length>=500,ranking:results.map((x,i)=>({position:i+1,score:x.done,name:'Student '+x.uid.slice(-4),mine:x.uid===user(req)}))});
 }catch(e){console.error('Ranking read failed:',e);return response({error:'Reytingni yuklab bo‘lmadi'},503)}
}