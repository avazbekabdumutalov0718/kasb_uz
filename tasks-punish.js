/* WORDRUSH · JAZO (Punishment) bo'limi — Telegram Mini App'da "⚖️ Jazo" tabi, oddiy saytda alohida panel.
   Server: /api/punishment. Katalog va matnlar: punish-tasks.js. Proof yuklash tasks-cloud.js dagi
   kabi: imzolangan havolaga PUT -> serverga yozish -> kanalga doimiy yuboriladi. */
(()=>{
'use strict';
const PU=window.WRPunish;
if(!PU)return;
const tg=window.Telegram?.WebApp;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SUPABASE='https://qckbyhorhasicyimqcgs.supabase.co';   // tasks-cloud.js dagi bilan bir xil
const MAX=100*1024*1024;

async function call(url,opt={}){
 const h={...(tg?.initData?{'x-telegram-init-data':tg.initData}:{}),...(opt.headers||{})};
 const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opt,headers:h});
 const j=await r.json().catch(()=>({error:'Server xatosi'}));
 if(!r.ok){const e=new Error(j.error||'Server xatosi');e.status=r.status;throw e}
 return j;
}
const post=body=>call('/api/punishment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

let data=null,error='',loading=false,msgs={};
const mini=document.body.classList.contains('mini-mode');
const box=document.createElement('section');
box.id='miniPunish';box.className='pj '+(mini?'pj-mini':'pj-site');box.setAttribute('aria-label','Jazo bo‘limi');

/* ---------- joylashtirish ---------- */
let tabBtn=null;
if(mini){
 box.hidden=true;
 const anchor=$('#miniRating')||$('#miniTaskView');
 if(!anchor)return;
 anchor.parentNode.insertBefore(box,anchor.nextSibling);
 const tabs=$('#miniTabs');
 if(tabs){
  tabBtn=document.createElement('button');
  tabBtn.type='button';tabBtn.setAttribute('role','tab');tabBtn.setAttribute('aria-selected','false');
  tabBtn.dataset.miniTab='punishment';tabBtn.innerHTML='<i>⚖️</i><span>Jazo</span>';
  tabs.appendChild(tabBtn);
 }
}else{
 const content=$('.tasks-content');
 if(!content)return;
 content.insertBefore(box,content.querySelector('.task-footer'));
}
const visible=()=>!box.hidden&&document.visibilityState==='visible';

/* ---------- yordamchilar ---------- */
const bytes=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
const msg=(key,text,bad=false)=>{if(text)msgs[key]={text,bad};else delete msgs[key];render()};
const confirmBox=text=>new Promise(res=>{if(tg?.showConfirm)tg.showConfirm(text,res);else res(window.confirm(text))});
const haptic=k=>{try{k==='ok'?tg?.HapticFeedback?.notificationOccurred('success'):tg?.HapticFeedback?.selectionChanged()}catch{}};
const def=id=>PU.get(id)||(data?.catalog||[]).find(t=>t.id===id)||{id,title:id,en:'',no:'',icon:'⚖️'};
function setBadge(){
 if(!tabBtn)return;
 let dot=tabBtn.querySelector('.pj-dot');
 const n=data?data.open:0;
 if(n>0){if(!dot){dot=document.createElement('b');dot.className='pj-dot';tabBtn.appendChild(dot)}dot.textContent=n}
 else dot?.remove();
}

/* ---------- ko'rinish ---------- */
function badge(r){
 if(r.allDone)return '<span class="pj-badge ok">✅ Bajarildi'+(r.status==='penalized'?' · −'+r.penalty+' ball ayrilgan':'')+'</span>';
 if(r.status==='penalized')return '<span class="pj-badge bad">⛔ −'+r.penalty+' ball ayrilgan</span>';
 if(r.daysLeft===null)return '<span class="pj-badge bad">⏰ Muddat o‘tdi</span>';
 return '<span class="pj-badge warn">⏳ '+(r.daysLeft===1?'Bugun oxirgi kun':r.daysLeft+' kun qoldi')+'</span>';
}
function taskBlock(r,t){
 const d=def(t.id),key=r.day+'|'+t.id,m=msgs[key];
 const reqs=d.requirements?'<div class="pj-req"><b>'+esc(d.requirementsTitle||'Requirements:')+'</b><ul>'+d.requirements.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'';
 const chips=t.proofs.length?t.proofs.map(p=>'<span class="pj-chip" title="'+esc(p.name)+'"><span>▣ '+esc(p.name)+' <small>'+bytes(p.size||0)+'</small></span><button type="button" data-pj-dl="'+esc(key+'|'+p.id)+'" aria-label="Yuklab olish">↓</button><button type="button" data-pj-del="'+esc(key+'|'+p.id)+'" aria-label="O‘chirish">×</button></span>').join(''):'<span class="pj-none">Proof hali yuklanmagan · bajarilishi uchun majburiy</span>';
 return '<div class="pj-task'+(t.done?' done':'')+'"><div class="pj-task-head"><span class="pj-ico">'+esc(d.icon||'⚖️')+'</span><div class="pj-task-text"><b>'+esc(d.no?d.no+'. ':'')+esc(d.title)+'</b><p>'+esc(d.en)+'</p></div><span class="pj-st '+(t.done?'ok':'')+'">'+(t.done?'✓ DONE':'PROOF REQUIRED')+'</span></div>'+reqs+
  '<div class="pj-proofs">'+chips+'</div>'+
  '<label class="pj-up">＋ Proof yuklash<input type="file" multiple data-pj-file="'+esc(key)+'"></label>'+
  (m?'<div class="pj-msg'+(m.bad?' bad':'')+'">'+esc(m.text)+'</div>':'')+'</div>';
}
function card(r){
 const state=r.allDone?'done':(r.status==='penalized'||r.daysLeft===null?'bad':'open');
 const missed=(r.missed||[]).map(x=>esc(x.group)+' ('+x.left+'/'+x.total+')').join(', ')||'—';
 return '<article class="pj-card '+state+'"><header><div><span class="pj-day">📅 '+esc(r.day)+' · '+esc(r.planLabel||'')+'</span><h3>Jazo vazifalari</h3></div>'+badge(r)+'</header>'+
  '<p class="pj-why">⚠️ Bajarilmagan: '+missed+'</p>'+
  '<p class="pj-meta">⏳ Muddat: <b>'+esc(r.deadlineDay)+' 23:59</b> gacha · bajarilmasa <b>−'+data.config.penaltyPoints+' ball</b></p>'+
  r.tasks.map(t=>taskBlock(r,t)).join('')+'</article>';
}
function catalogHTML(){
 const T=data?.texts||PU.TEXT,list=data?.catalog||PU.TASKS;
 const assigned=new Set((data?.items||[]).filter(r=>!r.allDone).flatMap(r=>r.tasks.map(t=>t.id)));
 return '<details class="pj-cat"><summary>📋 Barcha '+list.length+' ta jazo vazifasi</summary><div class="pj-cat-body"><h4>'+esc(T.header)+'</h4><p>'+esc(T.intro)+'</p><ol>'+
  list.map(t=>'<li'+(assigned.has(t.id)?' class="on"':'')+'><b>'+esc(t.icon+' '+t.title)+'</b><span>'+esc(t.en)+'</span>'+(t.requirements?'<small>'+esc(t.requirementsTitle)+' '+t.requirements.map(esc).join(' · ')+'</small>':'')+'</li>').join('')+
  '</ol><p class="pj-note">'+esc(T.note)+'</p></div></details>';
}
function render(){
 if(error&&!data){
  box.innerHTML='<div class="pj-empty"><span>⚠️</span><strong>Jazo bo‘limini yuklab bo‘lmadi</strong><p>'+esc(error)+'</p><button type="button" data-pj-retry>Qayta urinish</button></div>';
  return;
 }
 if(!data){box.innerHTML='<div class="pj-skel"></div><div class="pj-skel"></div>';return}
 const c=data.config,open=data.items.filter(r=>!r.allDone).length;
 const hero='<div class="pj-hero"><span class="pj-eyebrow">⚖️ PUNISHMENT</span><h2>Jazo bo‘limi</h2><p>Majburiy bo‘limlar (Reading · Writing · Speaking · Listening) to‘liq bajarilmasa, keyingi kuni '+PU.TASKS.length+' ta vazifadan <b>'+c.count+' tasi avtomatik tanlanadi</b>. <b>Extra</b> bo‘limi majburiy emas.</p>'+
  '<div class="pj-rules"><div><b>'+c.count+'</b><span>avtomatik tanlanadi</span></div><div><b>'+c.deadlineDays+' kun</b><span>bajarish muddati</span></div><div><b>−'+c.penaltyPoints+'</b><span>ball, bajarilmasa</span></div></div></div>';
 const body=data.items.length?data.items.map(card).join(''):'<div class="pj-empty ok"><span>🌱</span><strong>Hozircha jazo yo‘q</strong><p>Majburiy vazifalar to‘liq bajarilsa jazo berilmaydi. Shunday davom eting!</p></div>';
 box.innerHTML=hero+(open?'<div class="pj-open">⏳ Bajarilmagan jazo: <b>'+open+'</b> ta · eslatmalar har soatda keladi</div>':'')+body+catalogHTML();
 setBadge();
}

/* ---------- yuklash ---------- */
async function load(){
 if(loading)return;loading=true;
 try{data=await call('/api/punishment');error=''}
 catch(e){error=e.status===401?'Jazo ko‘rish uchun Telegram orqali kiring (@homework_IELTS_bot → /login).':e.message;if(e.status===401)data=null}
 loading=false;render();setBadge();
}
function replaceRecord(rec){
 if(!data||!rec)return;
 const i=data.items.findIndex(x=>x.day===rec.day);
 if(i>=0)data.items[i]=rec;else data.items.push(rec);
 data.open=data.items.filter(x=>!x.allDone).length;
}
async function uploadAll(day,id,files){
 const key=day+'|'+id;
 for(let i=0;i<files.length;i++){
  const f=files[i];
  try{
   if(f.size>MAX)throw new Error('100 MB dan katta fayl yuborib bo‘lmaydi.');
   msg(key,'☁ '+f.name+' yuklanmoqda ('+(i+1)+'/'+files.length+')…');
   const signed=await post({action:'upload',day,id,name:f.name,size:f.size});
   const url=String(signed.url).startsWith('http')?signed.url:SUPABASE+signed.url;
   const up=await fetch(url,{method:'PUT',headers:{'Content-Type':f.type||'application/octet-stream'},body:f});
   if(!up.ok)throw new Error('Storage upload failed: '+(await up.text()).slice(0,160));
   msg(key,'📤 '+f.name+' kanalga yuborilmoqda…');
   const r=await post({action:'proof',day,id,proof:{pathname:signed.path,name:f.name,type:f.type||''}});
   replaceRecord(r.record);
   if(r.delivery&&r.delivery.delivered===false)msg(key,'⚠️ Saqlandi, lekin kanalga yuborilmadi: '+(r.delivery.reason||'noma’lum xato'),true);
   else msg(key,'✓ '+f.name+' saqlandi va kanalga yuborildi');
   haptic('ok');
  }catch(e){msg(key,'⚠️ '+e.message,true);return}
 }
}

/* ---------- hodisalar ---------- */
box.addEventListener('change',async e=>{
 const inp=e.target.closest('[data-pj-file]');
 if(!inp||!inp.files.length)return;
 const [day,id]=inp.dataset.pjFile.split('|'),files=[...inp.files];inp.value='';
 await uploadAll(day,id,files);
});
box.addEventListener('click',async e=>{
 if(e.target.closest('[data-pj-retry]')){load();return}
 const dl=e.target.closest('[data-pj-dl]');
 if(dl){
  const [day,id,pid]=dl.dataset.pjDl.split('|');
  try{const r=await call('/api/punishment?download=1&day='+encodeURIComponent(day)+'&id='+encodeURIComponent(id)+'&proofId='+encodeURIComponent(pid));window.open(r.url,'_blank','noopener,noreferrer')}
  catch(err){msg(day+'|'+id,'⚠️ '+err.message,true)}
  return;
 }
 const del=e.target.closest('[data-pj-del]');
 if(del){
  const [day,id,pid]=del.dataset.pjDel.split('|');
  if(!(await confirmBox('Proof o‘chirilsinmi? Kanaldagi nusxa saqlanib qoladi.')))return;
  try{const r=await post({action:'delete',day,id,proofId:pid});replaceRecord(r.record);msg(day+'|'+id,'');render()}
  catch(err){msg(day+'|'+id,'⚠️ '+err.message,true)}
 }
});
$('#miniTabs')?.addEventListener('click',e=>{
 const b=e.target.closest('[data-mini-tab]');if(!b)return;
 const on=b.dataset.miniTab==='punishment';
 box.hidden=!on;
 if(on){load();window.scrollTo({top:0,behavior:'smooth'})}
});
document.addEventListener('visibilitychange',()=>{if(visible()||!mini)load()});
setInterval(()=>{if(!mini||visible())load()},60000);

render();
load().then(()=>{
 // Bot'dagi /jazo tugmasi: tasks.html?miniapp=1&tab=punishment
 if(mini&&new URLSearchParams(location.search).get('tab')==='punishment')tabBtn?.click();
});
})();
