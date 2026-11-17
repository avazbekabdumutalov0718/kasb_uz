/* Telegram Mini App presentation only. TASKS checklist/proof logic remains in tasks.js.
   Telegram user info is used ONLY for display, not authentication. */
(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const telegram=window.Telegram?.WebApp;
const miniMode=params.get('miniapp')==='1'||Boolean(telegram?.initData);
if(!miniMode)return;
const PLAN=window.WRPlan;
if(!PLAN)return;
document.body.classList.add('mini-mode');
const BG='#0a0a12';
try{telegram?.ready();telegram?.expand();telegram?.setHeaderColor?.(BG);telegram?.setBackgroundColor?.(BG);telegram?.setBottomBarColor?.(BG);telegram?.disableVerticalSwipes?.()}catch{}
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const haptic=(kind='select')=>{try{kind==='success'?telegram?.HapticFeedback?.notificationOccurred('success'):telegram?.HapticFeedback?.selectionChanged()}catch{}};
const KEY='wordrush.tasks.v3';
const WD=['Yak','Dush','Sesh','Chor','Pay','Jum','Shan'];
const MONTHS=['yan','fev','mar','apr','may','iyn','iyl','avg','sen','okt','noy','dek'];
const first=telegram?.initDataUnsafe?.user?.first_name||'';
const last=telegram?.initDataUnsafe?.user?.last_name||'';
const user=[first,last].filter(Boolean).join(' ').trim();
const nameNode=$('#miniName');if(nameNode)nameNode.textContent=user||'IELTS Student';
const avatar=$('#miniAvatar');if(avatar)avatar.textContent=Array.from((user||'W').trim())[0].toUpperCase();
const fmtDate=d=>{
 const bits=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const p=Object.fromEntries(bits.map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
};
const today=()=>fmtDate(new Date());
const isoOffset=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const shortDate=iso=>{const d=new Date(iso+'T12:00:00Z');return d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]};
const wday=iso=>WD[new Date(iso+'T12:00:00Z').getUTCDay()];
const setText=(sel,text)=>{const n=$(sel);if(n)n.textContent=text};

/* Brauzer xotirasidagi (cloud bilan sinxronlangan) kun natijasi — kun chiplari uchun */
function localDay(iso){
 let data={};try{data=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
 const st=data[iso]||{},P=PLAN.forDay(iso);
 const done=P.tasks.filter(t=>{const x=st[t[0]];return x&&x.done&&Array.isArray(x.proofs)&&x.proofs.length>0}).length;
 return {P,done,total:P.total};
}

let activeTab='tasks',rankScope='day',lastKey='',lastDone=-1,touched=0;
/* Konfetti faqat foydalanuvchi o'zi biror narsa bosgandan keyin (sinxronlashda emas) */
document.addEventListener('click',()=>{touched=Date.now()},true);
const CIRC=2*Math.PI*52;

function confetti(){
 const box=document.createElement('div');box.className='mx-confetti';box.setAttribute('aria-hidden','true');
 const colors=['#7c5cff','#ff5c9d','#2ee6a6','#ffb84d','#19c3ff','#ffffff'];
 for(let i=0;i<42;i++){
  const s=document.createElement('span');
  s.style.cssText='left:'+(Math.random()*100).toFixed(1)+'%;background:'+colors[i%colors.length]+';animation-delay:'+(Math.random()*.5).toFixed(2)+'s;animation-duration:'+(1.6+Math.random()*1.1).toFixed(2)+'s;transform:rotate('+Math.floor(Math.random()*360)+'deg)';
  box.append(s);
 }
 document.body.append(box);haptic('success');
 setTimeout(()=>box.remove(),3200);
}

function renderMini(){
 const todayDate=today();
 const current=$('#dateSelect')?.value||todayDate;
 const P=PLAN.forDay(current);
 const total=P.total;
 const done=Math.min(total,Number($('#doneCount')?.textContent)||0);
 const pct=total?Math.round(done/total*100):0;

 const hero=$('#miniHero');
 if(hero)hero.dataset.kind=P.kind;
 setText('#miniEyebrow',current===todayDate?'BUGUNGI REJA':'TANLANGAN KUN');
 setText('#miniPlanLabel',P.label);
 setText('#miniPlanTitle',P.title);
 setText('#miniPlanEmoji',P.emoji);
 setText('#miniDone',done);
 setText('#miniDoneTile',done);
 setText('#miniTotal',total);
 setText('#miniPercent',pct+'%');
 setText('#miniLeft',total-done);
 setText('#miniTime',$('#spentCount')?.textContent||'0m');
 setText('#miniPeriod',(current===todayDate?'Bugun':shortDate(current))+' · '+done+'/'+total);
 const bar=$('#miniProgress');if(bar)bar.style.width=pct+'%';
 const ring=$('#miniRingFg');
 if(ring){ring.style.strokeDasharray=CIRC.toFixed(1);ring.style.strokeDashoffset=(CIRC*(1-pct/100)).toFixed(1)}

 if(total&&done===total&&lastKey===current&&lastDone>=0&&lastDone<total&&Date.now()-touched<90000)confetti();
 lastKey=current;lastDone=done;

 const days=Array.from({length:8},(_,i)=>isoOffset(todayDate,-i));
 const rows=days.map(d=>({d,info:localDay(d)}));
 const sig=rows.map(r=>r.d+':'+r.info.done+'/'+r.info.total).join('|')+'@'+current;
 const strip=$('#miniDays');
 if(strip&&strip.dataset.sig!==sig){
  const left=strip.scrollLeft;
  strip.innerHTML=rows.map(({d,info})=>{
   const full=info.total>0&&info.done===info.total;
   const cls='mini-day'+(d===current?' selected':'')+(info.total?'':' off')+(full?' full':'');
   return '<button type="button" class="'+cls+'" data-mini-date="'+d+'" data-kind="'+info.P.kind+'"><small>'+(d===todayDate?'Bugun':wday(d))+'</small><strong>'+Number(d.slice(8))+'</strong><i>'+(full?'✓':(info.P.total?info.P.emoji:'·'))+'</i></button>';
  }).join('');
  strip.dataset.sig=sig;strip.scrollLeft=left;
 }
 setText('#miniDayName',(current===todayDate?'Bugun':shortDate(current))+(total?' · '+P.label:''));
 setText('#miniDayCount',total?done+' / '+total+' bajarildi':'Reja yo‘q');

 const tasksView=activeTab==='tasks';
 const set=(sel,hidden)=>{const n=$(sel);if(n)n.hidden=hidden};
 set('#miniTaskView',!tasksView);
 set('#miniRating',activeTab!=='rating');
 set('#miniAnalytics',activeTab!=='analytics');
 set('#miniDays',!tasksView);
 set('#miniDayHeading',!tasksView);
 set('#taskSections',!tasksView);
 const hint=$('#miniHeroHint');if(hint)hint.hidden=!tasksView;

 document.querySelectorAll('[data-mini-tab]').forEach(btn=>{
  btn.classList.toggle('selected',btn.dataset.miniTab===activeTab);
  btn.setAttribute('aria-selected',String(btn.dataset.miniTab===activeTab));
 });
}

/* ---------- REYTING ---------- */
const api=url=>fetch(url,{credentials:'same-origin',cache:'no-store',headers:telegram?.initData?{'x-telegram-init-data':telegram.initData}:{}});
const MEDAL=['🥇','🥈','🥉'];
function rankHTML(j,d){
 const list=j.ranking||[];
 const seg='<div class="rk-seg" role="tablist"><button type="button" data-rank-scope="day" class="'+(rankScope==='day'?'selected':'')+'">Kunlik</button><button type="button" data-rank-scope="week" class="'+(rankScope==='week'?'selected':'')+'">Haftalik</button></div>';
 const head='<div class="rk-head"><div><span class="rk-eyebrow">'+(rankScope==='week'?'HAFTALIK REYTING':'KUNLIK REYTING')+'</span><h3>🏆 Reyting</h3><p>'+esc(d)+' · '+j.participants+' ishtirokchi</p></div></div>';
 if(!list.length)return head+seg+'<div class="rk-empty"><span>🌱</span><strong>Hali natija yo‘q</strong><p>Reytingga faqat <b>proof bilan tasdiqlangan</b> vazifalar hisoblanadi. Birinchi bo‘ling!</p></div>';
 const pod=[1,0,2].filter(i=>list[i]).map(i=>{const x=list[i];return '<div class="rk-pod pos'+(i+1)+(x.mine?' mine':'')+'"><span class="rk-medal">'+MEDAL[i]+'</span><b>'+esc(x.name)+(x.mine?' <em>(Siz)</em>':'')+(x.penalty?' <em class="rk-pen">−'+x.penalty+' jazo</em>':'')+'</b><span class="rk-score">'+x.score+'<small>/'+x.total+'</small></span><div class="rk-block"></div></div>'}).join('');
 const rest=list.slice(3).map(x=>{const w=x.total?Math.round(x.score/x.total*100):0;return '<li class="rk-row'+(x.mine?' mine':'')+'"><span class="rk-pos">'+x.position+'</span><div class="rk-info"><b>'+esc(x.name)+(x.mine?' <em>(Siz)</em>':'')+(x.penalty?' <em class="rk-pen">−'+x.penalty+' jazo</em>':'')+'</b><div class="rk-bar"><span style="width:'+w+'%"></span></div></div><strong>'+x.score+'<small>/'+x.total+'</small></strong></li>'}).join('');
 const mineOutside=j.me&&!list.some(x=>x.mine)?'<div class="rk-me">Sizning o‘rningiz: <b>'+j.me.position+'</b> · '+j.me.score+'/'+j.me.total+'</div>':'';
 return head+seg+'<div class="rk-podium">'+pod+'</div>'+(rest?'<ol class="rk-list">'+rest+'</ol>':'')+mineOutside+'<p class="rk-note">Faqat proof bilan tasdiqlangan vazifalar hisoblanadi.</p>';
}
async function loadRanking(){
 const target=$('#miniRating');if(!target)return;
 const d=$('#dateSelect')?.value||today();
 target.innerHTML='<div class="rk-head"><div><span class="rk-eyebrow">REYTING</span><h3>🏆 Reyting</h3><p>Yuklanmoqda…</p></div></div><div class="rk-skel"></div><div class="rk-skel"></div><div class="rk-skel"></div>';
 try{
  const r=await api('/api/tasks-ranking?day='+encodeURIComponent(d)+'&scope='+rankScope);
  const j=await r.json();if(!r.ok)throw Error(j.error||'Server xatosi');
  target.innerHTML=rankHTML(j,d);
 }catch(e){
  target.innerHTML='<div class="rk-empty"><span>⚠️</span><strong>Reytingni yuklab bo‘lmadi</strong><p>'+esc(e.message)+'</p><button type="button" class="rk-retry" data-rank-retry>Qayta urinish</button></div>';
 }
}

/* ---------- HODISALAR ---------- */
$('#miniDays')?.addEventListener('click',e=>{
 const b=e.target.closest('[data-mini-date]');
 if(!b)return;
 const input=$('#dateSelect');input.value=b.dataset.miniDate;
 input.dispatchEvent(new Event('change',{bubbles:true}));
 if(activeTab==='rating')loadRanking();
 haptic();
});
$('#miniTabs')?.addEventListener('click',e=>{
 const b=e.target.closest('[data-mini-tab]');if(!b)return;
 activeTab=b.dataset.miniTab;renderMini();
 if(activeTab==='rating')loadRanking();
 if(activeTab==='analytics')window.WRAnalytics?.load();
 window.scrollTo({top:0,behavior:'smooth'});
 haptic();
});
$('#miniRating')?.addEventListener('click',e=>{
 const seg=e.target.closest('[data-rank-scope]');
 if(seg){rankScope=seg.dataset.rankScope;loadRanking();haptic();return}
 if(e.target.closest('[data-rank-retry]'))loadRanking();
});
const observer=new MutationObserver(()=>{renderMini()});
const content=$('#taskSections');if(content)observer.observe(content,{childList:true});
const spent=$('#spentCount');if(spent)observer.observe(spent,{childList:true,characterData:true,subtree:true});
renderMini();
setInterval(renderMini,60000);
})();
