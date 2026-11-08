import{user,response,bridge,entry,validDay,validTask}from'./_tasks-kit.js';
export const config={maxDuration:30};

// tasks-upload (POST) va tasks-download (GET) shu yerda birlashtirilgan.
// Eski manzillar vercel.json dagi rewrite orqali ishlayveradi.

export async function POST(req){
  const uid=user(req);if(!uid)return response({error:'Telegram login required'},401);
  try{
    const b=await req.json();
    if(!validDay(b.day)||!validTask(b.id))return response({error:'Invalid task'},400);
    const result=await bridge('uploadToken',{uid,day:b.day,id:b.id,name:b.name,size:b.size});
    return response(result)
  }catch(e){return response({error:e.message},503)}
}

export async function GET(req){
  const uid=user(req);if(!uid)return response({error:'Login required'},401);
  const p=new URL(req.url).searchParams,day=p.get('day'),id=p.get('id'),proofId=p.get('proofId');
  if(!validDay(day)||!validTask(id))return response({error:'Invalid task'},400);
  try{
    const item=await entry(uid,day,id),proof=item.proofs?.find(p=>p.id===proofId);
    if(!proof)return response({error:'Proof not found'},404);
    const result=await bridge('signedRead',{uid,day,path:proof.pathname});
    return response({url:result.url,name:proof.name})
  }catch(e){return response({error:e.message},503)}
}
