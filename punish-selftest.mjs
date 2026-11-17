/* Jazo tizimini haqiqiy Telegram/Supabase'siz sinash:  node tools/punish-selftest.mjs
   Bridge va Telegram so'rovlari xotiradagi soxta (mock) serverga yo'naltiriladi. */
process.env.WORDRUSH_BRIDGE_SECRET='x';
process.env.WORDRUSH_SUPABASE_URL='https://bridge.test';
process.env.TELEGRAM_BOT_TOKEN='123:TEST';
process.env.WORDRUSH_CHANNEL_ID='-1001';
process.env.TASKS_SESSION_SECRET='secret';
process.env.PUNISH_FROM='2026-11-18';

const store=new Map(), tgLog=[], deleted=new Set();
let nextMsg=100;
const J=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
const users=['1001','1002','1003','1004'];
const names={1001:'Ali Valiyev',1002:'Vali Aliyev',1003:'Sardor T',1004:'Dilnoza K'};

globalThis.fetch=async(url,opt={})=>{
  const u=String(url);
  if(u.startsWith('https://bridge.test/')){
    const b=JSON.parse(opt.body);
    switch(b.action){
      case 'read': return J({data:store.has(b.path)?structuredClone(store.get(b.path)):null});
      case 'save': store.set(b.path,structuredClone(b.data));return J({ok:true});
      case 'weeklyUsers': return J({users:users.map(uid=>({uid}))});
      case 'weeklyData':{
        const rows=[];
        for(const [path,data] of store)
          if(path.startsWith('wr-task-sync-v2/u/'+b.uid+'/')){const d=path.split('/')[3];if(d>=b.start&&d<=b.end)rows.push({path,data})}
        return J({rows});
      }
      case 'uploadToken': return J({url:'https://upload.test/'+b.uid,path:'wr-task-proof/'+b.uid+'/'+b.day+'/'+b.id+'/'+b.name});
      case 'fileInfo': return J({path:b.path,size:2048});
      case 'signedRead': return J({url:'https://files.test/'+encodeURIComponent(b.path)});
      case 'deleteFile': return J({ok:true});
      case 'ranking':{
        const rows=[];
        for(const [path,data] of store)if(path.startsWith('wr-task-ranking-v1/'+b.day+'/'))rows.push({path,data});
        return J({rows});
      }
      default: return J({error:'unknown action '+b.action},400);
    }
  }
  if(u.startsWith('https://files.test/'))return new Response(Buffer.from('fake-bytes'));
  if(u.startsWith('https://api.telegram.org/bot')){
    const method=u.split('/').pop();
    let payload=opt.body instanceof FormData?Object.fromEntries([...opt.body.entries()].map(([k,v])=>[k,typeof v==='string'?v:'<file>'])):JSON.parse(opt.body);
    if(method==='getChat')return J({ok:true,result:{first_name:names[payload.chat_id]?.split(' ')[0],last_name:names[payload.chat_id]?.split(' ')[1]}});
    if(method==='deleteMessage'){deleted.add(payload.message_id);tgLog.push({method,...payload});return J({ok:true,result:true})}
    tgLog.push({method,...payload});
    return J({ok:true,result:{message_id:nextMsg++}});
  }
  throw new Error('Unexpected fetch '+u);
};

const {runPunishmentTick,loadUser,penaltiesFor,tashkentNow}=await import('../lib/punishment.js');
const {sign,taskPath}=await import('../api/_tasks-kit.js');
const punishApi=await import('../api/punishment.js');
const ranking=await import('../api/tasks-ranking.js');

let fails=0;
const ok=(cond,label)=>{console.log((cond?'  ✅ ':'  ❌ ')+label);if(!cond)fails++};
const proofDone={done:true,proofs:[{id:'p'}],seconds:0,duration:10,clock:''};
const DAY1_MANDATORY=['r1','r2','r3','r4','l1','l2','l3'];      // Reading + Writing (Extra: s1..s4 majburiy emas)
const DAY2_MANDATORY=['s5','s6','w1','w2','w3','g1','p1','p2','p3']; // Speaking + Listening
const mark=(uid,day,ids)=>ids.forEach(id=>store.set(taskPath(uid,day,id),proofDone));
const HOUR=3600e3,t0=Date.parse('2026-11-18T19:00:00Z');       // 2026-11-19 00:00 Tashkent
let clock=t0;
const tick=async(day,hour,minute)=>{const r=await runPunishmentTick({channelId:'-1001',day,hour,minute,nowMs:clock});return r};
const sentTexts=()=>tgLog.filter(x=>x.method==='sendMessage').map(x=>x.text);

// ---- 2026-11-18 (chorshanba = DAY 1) natijalari
mark('1001','2026-11-18',DAY1_MANDATORY.filter(x=>x!=='r1'));          // Ali: Reading'dan 1 ta qoldi -> JAZO
mark('1002','2026-11-18',DAY1_MANDATORY);                                // Vali: majburiylarni bajardi, Extra yo'q -> jazo YO'Q
mark('1003','2026-11-18',DAY1_MANDATORY);mark('1003','2026-11-18',['s1','s2','s3','s4']);  // Sardor: hammasi -> jazo YO'Q
// 1004 (Dilnoza): hech narsa qilmagan -> JAZO, muddatida ham bajarmaydi -> BALL AYIRILADI

console.log('\n1) 19-noyabr 00:01 — jazo avtomatik yaratiladi');
let r=await tick('2026-11-19',0,1);
const ali=await loadUser('1001'),vali=await loadUser('1002'),sardor=await loadUser('1003'),dil=await loadUser('1004');
ok(ali.items.length===1&&ali.items[0].tasks.length===2,'Ali: 2 ta jazo vazifasi tanlandi');
ok(new Set(ali.items[0].tasks.map(t=>t.id)).size===2,'tanlangan 2 ta vazifa har xil');
ok(ali.items[0].tasks.every(t=>/^x([1-9]|10)$/.test(t.id)),'vazifalar 10 ta ro‘yxatdan');
ok(vali.items.length===0,'Vali: faqat Extra bajarilmagan -> jazo yo‘q');
ok(sardor.items.length===0,'Sardor: hammasi bajarilgan -> jazo yo‘q');
ok(dil.items.length===1,'Dilnoza: hech narsa bajarilmagan -> jazo bor');
ok(ali.items[0].deadlineDay==='2026-11-21','muddat: 3 kun (19, 20, 21-noyabr)');
ok(r.created===2&&r.reminded===2,'2 ta jazo yaratildi, 2 ta eslatma ketdi');
const firstReminder=tgLog.filter(x=>x.method==='sendMessage'&&x.text.includes('JAZO ESLATMASI'));
ok(firstReminder.length===2&&firstReminder[0].text.includes('5 daqiqadan so‘ng o‘chiriladi'),'eslatma matni to‘g‘ri');
ok(sentTexts().filter(t=>t.includes('JAZO BERILDI')).length===2,'JAZO BERILDI e’loni (doimiy) yuborildi');
console.log('\n   --- namunaviy eslatma ---\n'+firstReminder[0].text.split('\n').map(l=>'   '+l).join('\n')+'\n');

console.log('2) Xuddi shu soatda qayta chaqiruv — dublikat bo‘lmasin');
const before=tgLog.length;
r=await tick('2026-11-19',0,3);
ok(tgLog.length===before&&r.duplicate===2,'ikkinchi eslatma yuborilmadi');

console.log('3) 5 daqiqadan keyin eslatma o‘chadi, e’lon qoladi');
clock=t0+6*60e3;
r=await tick('2026-11-19',0,6);
ok(r.cleanup.deleted===2,'2 ta soatlik eslatma o‘chirildi');
const reminderIds=tgLog.filter(x=>x.method==='sendMessage'&&x.text.includes('JAZO ESLATMASI')).length;
ok(deleted.size===2&&reminderIds===2,'faqat eslatmalar o‘chdi (e’lon va boshqalar emas)');

console.log('4) Keyingi soat — yana eslatma');
clock=t0+HOUR;
r=await tick('2026-11-19',1,0);
ok(r.reminded===2,'01:00 da yana 2 ta eslatma');

console.log('5) Ali proof yuklaydi (API orqali)');
const tokenAli=sign('1001');
const mkReq=(method,body,uid=tokenAli)=>new Request('https://x.test/api/punishment',{method,headers:{authorization:'Bearer '+uid,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
let res=await punishApi.GET(new Request('https://x.test/api/punishment',{headers:{authorization:'Bearer '+tokenAli}}));
let state=await res.json();
ok(res.status===200&&state.items.length===1&&state.catalog.length===10,'GET: 1 ta jazo + 10 ta katalog');
const [t1,t2]=state.items[0].tasks.map(t=>t.id);
const up=async(id,name)=>{
  const s=await (await punishApi.POST(mkReq('POST',{action:'upload',day:'2026-11-18',id,name,size:2048}))).json();
  return (await punishApi.POST(mkReq('POST',{action:'proof',day:'2026-11-18',id,proof:{pathname:s.path,name,type:'audio/mpeg'}}))).json();
};
let p1=await up(t1,'speech.mp3');
ok(p1.record.tasks.find(t=>t.id===t1).done&&!p1.record.allDone,'1-vazifa bajarildi, jazo hali yopilmadi');
ok(tgLog.some(x=>x.method==='sendDocument'&&String(x.caption).includes('JAZO')),'proof kanalga fayl sifatida yuborildi');
let bad=await punishApi.POST(mkReq('POST',{action:'proof',day:'2026-11-18',id:t2,proof:{pathname:'wr-task-proof/9999/2026-11-18/'+t2+'/hack.mp3',name:'hack.mp3'}}));
ok(bad.status===400,'boshqa foydalanuvchi yo‘lidagi proof rad etildi');
let p2=await up(t2,'essay.pdf');
ok(p2.record.allDone&&p2.record.status==='done','2-vazifa ham bajarildi -> jazo yopildi');
ok(sentTexts().some(t=>t.includes('JAZO BAJARILDI')),'JAZO BAJARILDI xabari yuborildi');
clock=t0+2*HOUR;
r=await tick('2026-11-19',2,0);
const aliReminders=tgLog.filter(x=>x.method==='sendMessage'&&x.text.includes('JAZO ESLATMASI')&&x.text.includes('Ali')).length;
ok(aliReminders===2,'Ali uchun eslatma to‘xtadi (faqat 00:00 va 01:00 dagi 2 ta)');
res=await punishApi.POST(mkReq('POST',{action:'delete',day:'2026-11-18',id:t1,proofId:p1.record.tasks.find(t=>t.id===t1).proofs[0].id}));
state=(await res.json()).record;
ok(!state.allDone&&state.status==='pending','proof o‘chirilsa jazo qayta ochiladi');
// qayta yuklaymiz
await up(t1,'speech2.mp3');

console.log('6) Dilnoza 3 kun ichida bajarmaydi -> ball ayiriladi');
// Dilnoza 19, 20, 21-noyabrda hammasini bajaradi (faqat 18-dagi jazo qolsin)
const D19=DAY2_MANDATORY,D20=DAY1_MANDATORY,D21=DAY2_MANDATORY;
['2026-11-19','2026-11-20','2026-11-21'].forEach((d,i)=>mark('1004',d,[D19,D20,D21][i]));
for(const uid of ['1001','1002','1003'])['2026-11-19','2026-11-20','2026-11-21'].forEach((d,i)=>mark(uid,d,[D19,D20,D21][i]));
clock=t0+24*HOUR;r=await tick('2026-11-20',0,1);
clock=t0+48*HOUR;r=await tick('2026-11-21',0,1);
ok((await loadUser('1004')).items.every(x=>x.status==='pending'),'21-noyabrgacha (muddat ichida) ball ayirilmadi');
clock=t0+72*HOUR;r=await tick('2026-11-22',0,1);
const dil2=await loadUser('1004');
ok(dil2.items[0].status==='penalized'&&dil2.items[0].penalty===5,'22-noyabr: muddat o‘tdi -> status penalized, −5');
const pen=await penaltiesFor(['2026-11-22']);
ok(pen.get('1004')?.points===5,'ledger: Dilnoza −5 ball');
ok(!pen.has('1001'),'Ali (bajargan) uchun ball ayirilmadi');
ok(sentTexts().some(t=>t.includes('JAZO BALLI AYIRILDI')&&t.includes('−5')),'“ball ayirildi” xabari yuborildi');
const remBefore=tgLog.filter(x=>x.method==='sendMessage'&&x.text.includes('JAZO ESLATMASI')).length;
clock=t0+73*HOUR;r=await tick('2026-11-22',1,0);
ok(tgLog.filter(x=>x.method==='sendMessage'&&x.text.includes('JAZO ESLATMASI')&&x.text.includes('Dilnoza')).length>=1&&tgLog.filter(x=>x.method==='sendMessage'&&x.text.includes('JAZO ESLATMASI')).length>remBefore,'ball ayrilgandan keyin ham eslatma davom etadi');
clock=t0+74*HOUR;await tick('2026-11-22',2,0);
ok((await penaltiesFor(['2026-11-22'])).get('1004').points===5,'ball ikki marta ayirilmaydi');
const sc=(await punishApi.GET(new Request('https://x.test/api/punishment',{headers:{authorization:'Bearer '+sign('1004')}})));
ok((await sc.json()).items.some(x=>x.status==='penalized'),'Mini App: penalized holati ko‘rinadi');

console.log('7) Reytingda −5 ball hisobga olinadi');
store.set('wr-task-ranking-v1/2026-11-22/1004.json',{uid:'1004',name:'Dilnoza K.',done:3,total:2,plan:2});
store.set('wr-task-ranking-v1/2026-11-22/1001.json',{uid:'1001',name:'Ali V.',done:2,total:2,plan:2});
const rk=await ranking.GET(new Request('https://x.test/api/tasks-ranking?day=2026-11-22&scope=day',{headers:{authorization:'Bearer '+sign('1001')}}));
const rkj=await rk.json();
const dRow=rkj.ranking.find(x=>x.name.startsWith('Dilnoza'));
ok(rk.status===200&&dRow&&dRow.penalty===5&&dRow.score===0,'Dilnoza: 3 ball − 5 = 0 (0 dan pastga tushmaydi), penalty=5');
ok(rkj.ranking[0].name.startsWith('Ali'),'Ali reytingda yuqorida');

console.log('8) 22-noyabr (yakshanba) — Extra tushib qolsa ham jazo yo‘q, Mock bajarilmasa bor');
mark('1001','2026-11-22',['r1','r2']);mark('1002','2026-11-22',['r1']);   // Vali: Review (r2) qolgan
clock=t0+96*HOUR;await tick('2026-11-23',0,1);
ok((await loadUser('1001')).items.every(x=>x.day!=='2026-11-22'),'Ali: yakshanba to‘liq -> jazo yo‘q');
ok((await loadUser('1002')).items.some(x=>x.day==='2026-11-22'),'Vali: yakshanba Review qolgan -> jazo bor');

console.log('9) Tizim boshlanmagan kun (PUNISH_FROM dan oldin) — hech narsa qilmaydi');
const early=await runPunishmentTick({channelId:'-1001',day:'2026-11-16',hour:0,minute:1,nowMs:clock});
ok(early.skipped&&early.created===0,'sana PUNISH_FROM dan oldin -> o‘tkazib yuborildi');

console.log('\n'+(fails?'❌ '+fails+' ta tekshiruv muvaffaqiyatsiz':'✅ Hamma tekshiruvlar o‘tdi'));
process.exit(fails?1:0);
