import {bridge,tg,titles} from './_tasks-kit.js';
import {analyze,weekStart} from './tasks-analytics.js';
export const config={maxDuration:60};
const groupItems={Reading:['r1','r2','r3'],Listening:['l1','l2','l3'],Speaking:['s1','s2','s3','s4','s5','s6'],Writing:['w1','w2','w3'],Gym:['g1'],Namoz:['p1','p2','p3','p4','p5']};
const shift=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const short=['Du','Se','Ch','Pa','Ju','Sh','Ya'];
export async function GET(req){
 if(req.headers.get('authorization')!=='Bearer '+(process.env.CRON_SECRET||process.env.WORDRUSH_WEEKLY_CRON_SECRET))return Response.json({error:'Forbidden'},{status:403});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const localTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
 const dayOfWeek=new Date(today+'T12:00:00Z').getUTCDay();
 if(dayOfWeek!==0||localTime<'22:50'||localTime>'23:59')return Response.json({skipped:'Weekly reporting only Sunday 23:00 Asia/Tashkent'});
 const start=weekStart(today),end=today;
 try{
  const {users}=await bridge('weeklyUsers');
  const results=[];
  for(const {uid} of users){
   if(!/^\d+$/.test(uid))continue;
   const path='wr-task-weekly-v1/'+uid+'/'+start+'.json';
   try{
    if((await bridge('read',{path})).data?.sentAt){results.push({uid,status:'already_sent'});continue}
    const {rows}=await bridge('weeklyData',{uid,start,end});rows.uid=uid;
    const report=analyze(rows,start,end);
    const byPath=new Map(rows.map(x=>[x.path,x.data]));
    const lines=[
      '📊 WORDRUSH — HAFTALIK HISOBOT',
      '📅 '+start+' — '+end,
      '',
      '✅ Bajarilgan: '+report.completed+'/'+report.total,
      '❌ Bajarilmagan: '+report.missed,
      '📈 Umumiy natija: '+report.percent+'%',
      '',
      '📅 KUNLAR BO‘YICHA',
      ...report.days.map((d,i)=>short[i]+': '+d.done+'/21 ✅ · '+d.missed+' ❌'),
      '',
      '📚 BO‘LIMLAR BO‘YICHA',
      ...Object.entries(report.sections).map(([name,v])=>name+': '+v.done+'/'+v.total+' ✅, '+(v.total-v.done)+' ❌'),
      '',
      '📋 HAR BIR VAZIFA (7 KUN)',
      ...Object.entries(titles).map(([id,title])=>{
        let done=0;for(let i=0;i<7;i++){const d=shift(start,i),r=byPath.get('wr-task-sync-v2/u/'+uid+'/'+d+'/'+id+'.json');if(r?.done&&r.proofs?.length)done++}
        return (done===7?'✅ ':'▫️ ')+title+': '+done+'/7';
      }),
      '',
      '🔥 Yangi haftada ham davom eting!'
    ];
    const text=lines.join('\n');
    const sent=await tg('sendMessage',{chat_id:uid,text:text.slice(0,4000),disable_web_page_preview:true});
    await bridge('save',{path,data:{sentAt:new Date().toISOString(),messageId:sent.message_id,completed:report.completed,missed:report.missed}});
    results.push({uid,status:'sent'});
   }catch(e){console.error('Weekly report failed for user',uid,e);results.push({uid,status:'failed'})}
  }
  return Response.json({week:start,results},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Weekly job failed',e);return Response.json({error:'Weekly job failed'},{status:503})}
}