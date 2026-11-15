import {user,response,bridge,validDay,planFor,plan}from'./_tasks-kit.js';
export const config={maxDuration:30};

const shift=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const weekStart=day=>shift(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));

// Faqat yangi reja (plan:2) yozuvlari hisobga olinadi — eski progress reytingga kirmaydi.
async function rowsFor(day){
  const {rows}=await bridge('ranking',{day});
  return (rows||[]).map(x=>x&&x.data).filter(x=>x&&x.uid&&x.plan===2&&Number.isInteger(x.done)&&x.done>0);
}
const label=(x,uid)=>x.name||('Student '+String(uid).slice(-4));

export async function GET(req){
  const uid=user(req);
  if(!uid)return response({error:'Login required'},401);
  const q=new URL(req.url).searchParams;
  const day=q.get('day'),scope=q.get('scope')==='week'?'week':'day';
  if(!validDay(day))return response({error:'Invalid day'},400);
  try{
    let days=[day];
    if(scope==='week'){
      const start=weekStart(day);
      days=[];for(let d=start;d<=day&&days.length<7;d=shift(d,1))days.push(d);
    }
    days=days.filter(d=>planFor(d).total>0);
    const possible=days.reduce((n,d)=>n+planFor(d).total,0);
    const perDay=await Promise.all(days.map(rowsFor));
    const people=new Map();
    perDay.forEach(list=>list.forEach(x=>{
      const key=String(x.uid),p=people.get(key)||{uid:key,done:0,name:'',at:''};
      p.done+=x.done;
      if(x.name)p.name=x.name;
      if(x.updatedAt&&x.updatedAt>p.at)p.at=x.updatedAt;
      people.set(key,p);
    }));
    const list=[...people.values()].sort((a,b)=>b.done-a.done||String(a.at).localeCompare(String(b.at)));
    const ranking=list.map((x,i)=>({position:i+1,score:x.done,total:possible,name:label(x,x.uid),mine:x.uid===uid}));
    const me=ranking.find(x=>x.mine)||null;
    return response({day,scope,start:plan.START,total:possible,participants:ranking.length,ranking:ranking.slice(0,50),me});
  }catch(e){return response({error:e.message},503)}
}
