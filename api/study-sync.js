import {user,response,bridge} from './_tasks-kit.js';
export async function POST(req){
 const uid=user(req);if(!uid)return response({error:'Telegram login required'},401);
 try{const b=await req.json();const day=String(b.day||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return response({error:'Invalid date'},400);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(day!==today)return response({error:'Only today can be synced'},400);
 const seconds=Number(b.seconds),pomodoros=Number(b.pomodoros);
 if(!Number.isFinite(seconds)||seconds<0||seconds>86400||!Number.isFinite(pomodoros)||pomodoros<0||pomodoros>100)return response({error:'Invalid totals'},400);
 await bridge('studySave',{uid,day,seconds,pomodoros});return response({ok:true})
 }catch(e){return response({error:'Study sync failed'},503)}
}