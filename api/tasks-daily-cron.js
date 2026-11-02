import {bridge,tg,titles} from './_tasks-kit.js';
export const config={maxDuration:60};
export async function GET(req){
 if(req.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)return Response.json({error:'Forbidden'},{status:403});
 const now=new Date(), day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
 if(time<'20:55'||time>'21:30')return Response.json({skipped:'Only 21:00 Tashkent'});
 try{
  const [{users},{rows}]=await Promise.all([bridge('weeklyUsers'),bridge('studyDaily',{day})]);
  const byUid=new Map(rows.map(x=>[x.uid,x])),results=[];
  for(const {uid} of users){
   const path='wr-task-weekly-v1/daily-'+uid+'-'+day+'.json';
   try{
    if((await bridge('read',{path})).data?.sentAt){results.push({uid,status:'already_sent'});continue}
    const {rows:tasks}=await bridge('weeklyData',{uid,start:day,end:day});
    const map=new Map(tasks.map(x=>[x.path.split('/').pop().replace('.json',''),x.data]));
    const completed=Object.entries(titles).filter(([id])=>map.get(id)?.done && map.get(id)?.proofs?.length).map(([,title])=>title);
    const unfinished=Object.entries(titles).filter(([id])=>!(map.get(id)?.done && map.get(id)?.proofs?.length)).map(([,title])=>title);
    const study=byUid.get(uid),mins=Math.round((study?.seconds||0)/60),poms=study?.pomodoros||0;
    const message=[
     '🌙 WORDRUSH · KUNLIK HISOBOT','📆 '+day,'',
     '✅ Bajarildi: '+completed.length+'/21',
     '❌ Bajarilmadi: '+unfinished.length+'/21',
     '📚 Study Time: '+Math.floor(mins/60)+' soat '+mins%60+' daqiqa',
     '🍅 Pomodoro: '+poms+' ta','',
     '✅ BAJARILGAN:',...(completed.length?completed.map(x=>'• '+x):['Hali yo‘q']),'',
     '⏳ QOLGAN:',...(unfinished.length?unfinished.map(x=>'• '+x):['Hammasi bajarilgan!']),
     '','📱 Ekran vaqtini telefondagi WORDRUSH ilovasida ko‘ring.'
    ].join('\n').slice(0,4000);
    const sent=await tg('sendMessage',{chat_id:uid,text:message,disable_web_page_preview:true});
    await bridge('save',{path,data:{sentAt:new Date().toISOString(),messageId:sent.message_id}});
    results.push({uid,status:'sent'});
   }catch(e){console.error('Daily report',uid,e);results.push({uid,status:'failed'})}
  }
  return Response.json({day,results},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error(e);return Response.json({error:'Daily reporting failed'},{status:503})}
}
