(()=>{'use strict';
const root=document.getElementById('miniAnalytics');
if(!root)return;
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groupNames={Reading:'Reading',Listening:'Listening',Speaking:'Speaking',Writing:'Writing',Gym:'Gym',Namoz:'Namoz'};
const shortDay=['Du','Se','Ch','Pa','Ju','Sh','Ya'];
let selectedEnd='',request=0;
const shift=(iso,d)=>{const x=new Date(iso+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+d);return x.toISOString().slice(0,10)};
function tToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function render(v){
 const days=v.days||[],percentage=n=>Math.round(n*100);
 let daily='<div class="analytics-heatmap">'+days.map((d,i)=>'<div class="analytics-day"><span>'+shortDay[i%7]+'</span><div class="analytics-cell level-'+(d.done?Math.min(4,Math.ceil(d.done/21*4)):0)+'" title="'+d.date+': '+d.done+'/21">'+d.done+'</div><small>'+d.date.slice(8)+'</small></div>').join('')+'</div>';
 const sections=Object.entries(v.sections||{}).map(([name,s])=>{const pct=s.total?Math.round(s.done/s.total*100):0;return '<div class="analytics-section"><div class="analytics-section-head"><strong>'+safe(groupNames[name]||name)+'</strong><span>'+s.done+'/'+s.total+' · '+pct+'%</span></div><div class="analytics-bar"><span style="width:'+pct+'%"></span></div></div>'}).join('');
 const ranking=Object.entries(v.sections||{}).filter(([k])=>['Reading','Listening','Speaking','Writing'].includes(k)).map(([name,s])=>({...s,name,pct:s.total?Math.round(s.done/s.total*100):0})).sort((a,b)=>b.pct-a.pct);
 root.innerHTML='<div class="analytics-top"><div><span class="analytics-eyebrow">WEEKLY PROGRESS</span><h3>📊 Personal Analytics</h3><p>'+safe(v.start)+' — '+safe(v.end)+'</p></div><div class="analytics-week-actions"><button type="button" data-week="-7" aria-label="Oldingi hafta">‹</button><button type="button" data-week="7" aria-label="Keyingi hafta" '+(v.end>=tToday()?'disabled':'')+'>›</button></div></div><div class="analytics-hero"><div><small>Bajarilgan</small><strong>'+v.completed+' <em>/ '+v.total+'</em></strong></div><div><small>Bajarilmagan</small><strong>'+v.missed+'</strong></div><div><small>Natija</small><strong>'+v.percent+'%</strong></div></div><div class="analytics-subhead">Faollik kalendari <small>Har katak — bir kun</small></div>'+daily+'<div class="analytics-legend">Kamroq <i class="level-0"></i><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i><i class="level-4"></i> Ko‘proq</div><div class="analytics-subhead">IELTS yo‘nalishlari</div>'+sections+'<div class="analytics-insight">'+(ranking.length?'<strong>💪 Kuchli yo‘nalish: '+safe(ranking[0].name)+'</strong><span>Ko‘proq eʼtibor: '+safe(ranking.at(-1).name)+' · '+ranking.at(-1).pct+'%</span>':'Hali natijalar yo‘q')+'</div><p class="analytics-note">Faqat proof bilan tasdiqlangan vazifalar bajarilgan hisoblanadi. Yakshanba oqshomida haftalik xulosa Telegram bot orqali yuboriladi.</p>';
}
async function load(end){
 const id=++request;
 root.innerHTML='<p class="analytics-loading">📊 Haftalik statistika yuklanmoqda…</p>';
 try{
  const query=end?'?end='+encodeURIComponent(end):'';
  const r=await fetch('/api/tasks-analytics'+query,{credentials:'same-origin',cache:'no-store'});
  const v=await r.json();if(!r.ok)throw Error(v.error||'Server unavailable');
  if(id!==request)return;selectedEnd=v.end;render(v);
 }catch(e){root.innerHTML='<div class="analytics-error">Statistikani yuklab bo‘lmadi. Telegram orqali kiring va qayta urinib ko‘ring.<p>'+safe(e.message)+'</p><button id="analyticsRetry" type="button">Qayta urinish</button></div>'}
}
root.addEventListener('click',e=>{const btn=e.target.closest('[data-week]');if(btn){const target=shift(selectedEnd||tToday(),Number(btn.dataset.week));load(target>tToday()?tToday():target)}else if(e.target.id==='analyticsRetry')load(selectedEnd||'')});
window.WRAnalytics={load,refresh:()=>load(selectedEnd||'')};
})();