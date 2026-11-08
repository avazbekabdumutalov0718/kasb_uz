import {user,response,bridge,titles} from './_tasks-kit.js';
export const config={maxDuration:30};
const groups={Reading:['r1','r2','r3','r4'],Listening:['l1','l2','l3'],Speaking:['s1','s2','s3','s4','s5','s6'],Writing:['w1','w2','w3'],Gym:['g1'],Namoz:['p1','p2','p3','p4','p5']};
const offset=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export function weekStart(day){const d=new Date(day+'T12:00:00Z');return offset(day,-((d.getUTCDay()+6)%7))}
export function analyze(rows,start,end=start){
 const mapped=new Map(rows.map(x=>[x.path,x.data]));
 const days=[],sections=Object.fromEntries(Object.keys(groups).map(k=>[k,{done:0,total:0}]));
 for(let n=0;n<=Math.round((new Date(end+'T12:00:00Z')-new Date(start+'T12:00:00Z'))/86400000);n++){
  const date=offset(start,n);let done=0;
  for(const [group,ids] of Object.entries(groups)){for(const id of ids){const r=mapped.get('wr-task-sync-v2/u/'+rows.uid+'/'+date+'/'+id+'.json');if(r?.done&&r.proofs?.length){done++;sections[group].done++}sections[group].total++}}
  days.push({date,done,total:21,missed:21-done,pct:Math.round(done/21*100)});
 }
 const completed=days.reduce((a,x)=>a+x.done,0),total=days.length*21;
 return {start,end,days,completed,total,missed:total-completed,percent:Math.round(completed/total*100),sections};
}
export async function GET(req){
 const uid=user(req);if(!uid)return response({error:'Login required'},401);
 const q=new URL(req.url).searchParams;const end=q.get('end');if(end&&!/^\d{4}-\d{2}-\d{2}$/.test(end))return response({error:'Invalid date'},400);
 const now=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const target=end&&end<=now?end:now;const start=weekStart(target);
 try{const result=await bridge('weeklyData',{uid,start,end:target});const rows=result.rows||[];rows.uid=uid;return response(analyze(rows,start,target))}
 catch(e){return response({error:'Analytics unavailable'},503)}
}
