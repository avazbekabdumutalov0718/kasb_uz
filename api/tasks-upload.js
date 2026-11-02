import{user,response,validDay,validTask,bridge}from'./_tasks-kit.js';
export const config={maxDuration:30};
export async function POST(req){const uid=user(req);if(!uid)return response({error:'Telegram login required'},401);
try{const b=await req.json();if(!validDay(b.day)||!validTask(b.id))return response({error:'Invalid task'},400);const result=await bridge('uploadToken',{uid,day:b.day,id:b.id,name:b.name,size:b.size});return response(result)}catch(e){return response({error:e.message},503)}}
