/* Telegram Mini App presentation only. TASKS checklist/proof logic remains in tasks.js.
   Telegram user info is used ONLY for display, not authentication. */
(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const telegram=window.Telegram?.WebApp;
const miniMode=params.get('miniapp')==='1'||Boolean(telegram?.initData);
if(!miniMode)return;
document.body.classList.add('mini-mode');
try{telegram?.ready();telegram?.expand();telegram?.setHeaderColor?.('#f5f5f5');telegram?.setBackgroundColor?.('#f5f5f5')}catch{}
const $=s=>document.querySelector(s);
const first=telegram?.initDataUnsafe?.user?.first_name||'';
const last=telegram?.initDataUnsafe?.user?.last_name||'';
const user=[first,last].filter(Boolean).join(' ').trim();
$('#miniName').textContent=user||'IELTS Student';
const fmtDate=d=>{
 const bits=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const p=Object.fromEntries(bits.map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
};
const today=()=>fmtDate(new Date());
const isTrialDay=today()==='2026-11-03';
if(isTrialDay && params.get('skipReading')!=='1' && !sessionStorage.getItem('wr-readinglab-redirect-bypass')){
 // Opening TASKS inside Telegram begins with one randomized Reading Lab lesson.
 // Returning with skipReading=1 opens the actual homework list immediately.
 location.replace('./reading-lab.html?miniapp=1&article='+(1+Math.floor(Math.random()*5)));
 return;
}

const trialReading=$('#readingLabTrial');if(trialReading){trialReading.hidden=today()!=='2026-11-03';trialReading.style.display=trialReading.hidden?'none':'block';}

const isoOffset=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const shortDate=iso=>{const d=new Date(iso+'T12:00:00Z');return new Intl.DateTimeFormat('uz-UZ',{day:'numeric',month:'short',timeZone:'UTC'}).format(d)};
function readStats(){
 let data={};try{data=JSON.parse(localStorage.getItem('wordrush.tasks.v2')||'{}')}catch{}
 const d=$('#dateSelect').value||today();
 const records=Object.values(data[d]||{});
 const done=records.filter(x=>x&&x.done&&Array.isArray(x.proofs)&&x.proofs.length>0).length;
 const allDone=Object.values(data).reduce((n,v)=>n+Object.values(v||{}).filter(x=>x&&x.done&&Array.isArray(x.proofs)&&x.proofs.length>0).length,0);
 return {date:d,done,allDone,allDays:Object.keys(data).length};
}
let activeTab='tasks';
async function loadRanking(){
 const target=$('#miniRating');if(!target)return;
 const d=$('#dateSelect').value||today();
 target.innerHTML='<h3>Reyting 🏆</h3><p>Yuklanmoqda…</p>';
 try{const r=await fetch('/api/tasks-ranking?day='+encodeURIComponent(d),{credentials:'same-origin',cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Server xatosi');
 const safe=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
 target.innerHTML='<h3>🏆 Kunlik reyting · '+safe(d)+'</h3><p>'+j.participants+' ishtirokchi · faqat proof bilan tasdiqlangan vazifalar</p>'+(j.ranking.length?'<ol class="rating-list">'+j.ranking.map(x=>'<li style="padding:12px;border-bottom:1px solid #ddd;display:flex;justify-content:space-between"><span>'+x.position+'. '+safe(x.name)+(x.mine?' (Siz)':'')+'</span><strong>'+x.score+'/21</strong></li>').join('')+'</ol>':'<p>Bu kunda hali tasdiqlangan natija yo‘q.</p>');
 }catch(e){target.innerHTML='<h3>Reyting 🏆</h3><p>'+e.message+'</p>'}
}
function renderMini(){
 const v=readStats();
 const todayDate=today();
 const done=Number($('#doneCount')?.textContent)||0;
 const total=Number($('#totalCount')?.textContent)||21;
 $('#miniDone').textContent=done;
 $('#miniTotal').textContent=total;
 $('#miniTotalAgain').textContent=total+' vazifa';
 $('#miniAllDone').textContent=v.allDone;
 $('#miniProgress').style.width=Math.min(100,Math.round(done/Math.max(total,1)*100))+'%';
 $('#miniPeriod').textContent=(v.date===todayDate?'Bugun':'Tanlangan kun')+' · '+done+'/'+total;
 const days=Array.from({length:8},(_,i)=>isoOffset(todayDate,-i));
 const existing=$('#miniDays');
 const current=v.date;
 const buttons=days.map((d,i)=>{
 const rDate=new Date(d+'T12:00:00Z');
 const numLabel=d.slice(8,10)+'-kun';
 const label=i===0?'Bugun':shortDate(d);
 return '<button type="button" class="mini-day '+(current===d?'selected':'')+'" data-mini-date="'+d+'"><strong>'+numLabel+'</strong><small>'+(i===0?'Bugun':label)+'</small></button>';
 }).join('');
 if(existing.dataset.days!==todayDate){existing.innerHTML=buttons;existing.dataset.days=todayDate}
 else {existing.querySelectorAll('.mini-day').forEach(b=>b.classList.toggle('selected',b.dataset.miniDate===current))}
 $('#miniDayName').textContent=(current===todayDate?'Bugun':shortDate(current))+' · '+current;
 $('#miniDayCount').textContent=done+' / '+total+' bajarildi';
 $('#miniTaskView').hidden=activeTab!=='tasks';
 $('#miniRating').hidden=activeTab!=='rating';
 $('#miniAnalytics').hidden=activeTab!=='analytics';
 $('#miniDays').hidden=activeTab!=='tasks';
 $('#miniDayHeading').hidden=activeTab!=='tasks';
 $('#taskSections').hidden=activeTab!=='tasks';

 document.querySelectorAll('[data-mini-tab]').forEach(btn=>{
 btn.classList.toggle('selected',btn.dataset.miniTab===activeTab);
 btn.setAttribute('aria-selected',String(btn.dataset.miniTab===activeTab));
 });
}
$('#miniDays').addEventListener('click',e=>{
 const b=e.target.closest('[data-mini-date]');
 if(!b)return;
 const input=$('#dateSelect');input.value=b.dataset.miniDate;
 input.dispatchEvent(new Event('change',{bubbles:true}));
 try{telegram?.HapticFeedback?.selectionChanged()}catch{}
});
$('#miniTabs').addEventListener('click',e=>{
 const b=e.target.closest('[data-mini-tab]');if(!b)return;
 activeTab=b.dataset.miniTab;renderMini();if(activeTab==='rating')loadRanking();if(activeTab==='analytics')window.WRAnalytics?.load();
 try{telegram?.HapticFeedback?.selectionChanged()}catch{}
});
const observer=new MutationObserver(()=>{renderMini()});
const content=$('#taskSections');if(content)observer.observe(content,{childList:true});
renderMini();
setInterval(()=>{if($('#miniDays').dataset.days!==today())renderMini()},60000);
})();