(()=>{'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const zone='Asia/Tashkent',key='wordrush.tasks.v2',groups=[
 {id:'reading',label:'READING',icon:'▤',tasks:[['r1','4 ELS',60],['r2','1 article from 61 days article',35],['r3','25+ words',30],['r4','1 passage + analyse',40]]},
 {id:'listening',label:'LISTENING',icon:'♫',tasks:[['l1','2 podcast from 61 days podcast',50],['l2','Random videos from YouTube',25],['l3','2 parts listening test',45]]},
 {id:'speaking',label:'SPEAKING',icon:'🎙',tasks:[['s1','1 Topic and speaking about it 10 minutes',10],['s2','Learn 25+ chunks',35],['s3','Speaking mock',20],['s4','Grammar topic at least 1 hour',60],['s5','Speak 30 minutes',30],['s6','Learn 2 structures',20]]},
 {id:'writing',label:'WRITING',icon:'✎',tasks:[['w1','1 band essay analysis and write 1 essay · TASK 1 or 2',65],['w2','Learn 2 structures',20],['w3','Write at least 150 sentences about any topic',90]]},
 {id:'gym',label:'GYM',icon:'◇',tasks:[['g1','Gym 1 time a day',35]]},
 {id:'prayer',label:'5 MAHAL NAMOZ',icon:'☾',tasks:[['p1','Bomdod',10],['p2','Peshin',10],['p3','Asr',10],['p4','Shom',10],['p5','Xufton',10]]}
];
const all=groups.flatMap(g=>g.tasks),dbName='wordrush.tasks.proofs.v1',storeName='proofs',maxSize=100*1024*1024;
let day='',filter='all',timers={},active=null,dbPromise=null,state=readState(),blobUrls=new Set();
function dayNow(){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function readState(){try{const d=JSON.parse(localStorage.getItem(key)||'{}');return d&&typeof d==='object'?d:{}}catch{return {}}}
function save(){try{localStorage.setItem(key,JSON.stringify(state))}catch{toast('Checklist uchun brauzer xotirasi to‘lgan.',true)}}
function ensure(d,id){state[d]??={};state[d][id]??={proofs:[],done:false,seconds:0,duration:all.find(t=>t[0]===id)?.[2]||10,clock:''};return state[d][id]}
function db(){return dbPromise??=new Promise((resolve,reject)=>{const req=indexedDB.open(dbName,1);req.onupgradeneeded=()=>{const database=req.result;if(!database.objectStoreNames.contains(storeName))database.createObjectStore(storeName,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function putProof(item){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(storeName,'readwrite');tx.objectStore(storeName).put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function deleteProof(id){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(storeName,'readwrite');tx.objectStore(storeName).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function getProof(id){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(storeName,'readonly'),req=tx.objectStore(storeName).get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function toast(text,bad=false){const node=$('#toast');node.textContent=text;node.classList.toggle('error',bad);node.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>node.hidden=true,3300)}
function clock(n){const v=Math.floor(n);return String(Math.floor(v/3600)).padStart(2,'0')+':'+String(Math.floor(v%3600/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0')}
function timestr(iso){if(!iso)return '—';return new Intl.DateTimeFormat('uz-UZ',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(new Date(iso))}
function summary(){const records=all.map(x=>ensure(day,x[0]));const done=records.filter((r,i)=>{const id=all[i][0];const isPrayer=id.startsWith('p');return r.done&&(isPrayer||(r.proofs&&r.proofs.length>0))}).length;$('#totalCount').textContent=all.length;$('#doneCount').textContent=done;$('#remainingCount').textContent=all.length-done;$('#spentCount').textContent=Math.floor(records.reduce((n,r)=>n+(r.seconds||0),0)/60)+'m';const percent=Math.round(done/all.length*100);$('#percentText').textContent=percent+'%';$('#progressFill').style.width=percent+'%';$('#progressNote').textContent=done===all.length?'Barcha '+all.length+' ta vazifa bajarildi!':done+' ta vazifa bajarildi · '+(all.length-done)+' ta qoldi.'}
function section(g){const visible=g.tasks.filter(([id])=>filter==='all'||(filter==='done'?ensure(day,id).done:!ensure(day,id).done));if(!visible.length)return '';const completed=g.tasks.filter(([id])=>ensure(day,id).done).length;return '<section class="category"><header class="category-head"><span class="category-icon">'+g.icon+'</span><div><span class="mini-label">DAILY WORKSTREAM</span><h3>'+g.label+'</h3></div><span class="category-count">'+completed+'/'+g.tasks.length+' DONE</span></header><div class="task-list">'+visible.map(([id,title,defaultDuration])=>{const r=ensure(day,id),running=active?.id===id&&active.day===day,secs=r.seconds+(running?Math.floor((Date.now()-active.start)/1000):0);return '<article class="task-card '+(r.done?'completed':'')+'" id="task-'+id+'"><div class="task-row"><button type="button" class="task-check '+(r.done?'checked':'')+'" data-check="'+id+'" aria-label="'+(r.done?'Uncheck':'Check')+' '+esc(title)+'" aria-pressed="'+r.done+'">'+(r.done?'✓':'')+'</button><div class="task-body"><div class="task-title">'+esc(title)+'</div><div class="task-meta"><span>◷ <strong>'+esc(r.duration||defaultDuration)+' min</strong> target</span><span>Last completed: '+timestr(r.clock)+'</span></div></div><span class="task-status '+(r.done?'good':'')+'">'+(r.done?'✓ DONE':id.startsWith('p')?(r.proofs.length?'PROOF READY':'TICK YETARLI'):(r.proofs.length?'PROOF READY':'PROOF REQUIRED'))+'</span></div><div class="task-bottom"><div class="timer-group"><button class="timer-button '+(running?'running':'')+'" data-timer="'+id+'">'+(running?'Ⅱ Pause':'▶ Timer')+'</button><span class="timer-face" data-face="'+id+'">'+clock(secs)+'</span><label>Target <input type="number" min="1" max="720" value="'+(r.duration||defaultDuration)+'" data-duration="'+id+'" aria-label="Target duration for '+esc(title)+'"></label><span>min</span></div><div class="proof-area"><label class="upload-label" for="file-'+id+'">＋ Upload proof <input id="file-'+id+'" data-file="'+id+'" type="file" accept=".pdf,.html,.htm,image/*,audio/*,video/*,.mp3,.wav,.m4a,.mp4,.webm,.mov,.ogg" multiple></label><span class="proof-count">'+r.proofs.length+' file'+(r.proofs.length===1?'':'s')+'</span></div></div><div class="proofs" id="proofs-'+id+'">'+(r.proofs.length?r.proofs.map(p=>'<div class="proof-chip" title="'+esc(p.name)+'"><span>▣ '+esc(p.name)+'</span><button data-download="'+p.id+'" title="Download proof">↓</button><button data-delete="'+id+':'+p.id+'" title="Delete proof">×</button></div>').join(''):'<span class="missing-proof">No proof uploaded yet · Required to complete</span>')+'</div></article>'}).join('')+'</div></section>'}
function render(){if(!day)return;$('#dateSelect').value=day;$('#liveDate').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:zone,weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date());$('#taskSections').innerHTML=groups.map(section).join('')||'<p class="empty-list">Bu filtrda vazifalar yo‘q.</p>';summary();document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x.dataset.filter===filter));$('#nextDate').disabled=day>=dayNow();$('#todayButton').disabled=day===dayNow();$('#resetHint').textContent=day===dayNow()?'Har kuni 00:00 — Asia/Tashkent bo‘yicha yangi checklist.':'Oldingi kun tarixi · '+day+' · bugungi ro‘yxatga qaytish mumkin.'}
function flushTimer(){if(!active)return;const r=ensure(active.day,active.id);r.seconds+=(Date.now()-active.start)/1000|0;save();window.WRTasksCloud?.update(active.day,active.id,r);active=null}
function setDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;if(date>dayNow()){toast('Kelajak kunini hozir belgilab bo‘lmaydi.',true);return}flushTimer();day=date;render();window.WRTasksCloud?.getDay(date).catch(e=>toast(e.message,true))}
function shiftDate(offset){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);setDate(d.toISOString().slice(0,10))}
function toggle(id){const r=ensure(day,id);const isPrayer=id.startsWith('p');if(r.done){r.done=false;r.clock='';toast('Vazifa belgisi olib tashlandi.')}else{if(!isPrayer&&!r.proofs.length){toast('Avval PDF, HTML, audio, rasm yoki video proof yuklang!',true);document.querySelector('#file-'+id)?.focus();return}r.done=true;r.clock=new Date().toISOString();toast(isPrayer?'✓ Namoz bajarildi!':'✓ Proof bilan bajarildi!')}save();render();window.WRTasksCloud?.update(day,id,ensure(day,id))}
function allowed(file){const ext=file.name.toLowerCase().split('.').pop(),extensions=['pdf','html','htm','mp3','wav','m4a','mp4','webm','mov','ogg','png','jpg','jpeg','gif','webp','bmp','heic','aac','flac'];return extensions.includes(ext)||/^(image|audio|video)\//.test(file.type)}
async function filesAdded(id,files,notes=[]){
 if(!files.length)return 0;
 const r=ensure(day,id),cloud=window.WRTasksCloud;let added=0;
 if(cloud?.ready){
  for(let i=0;i<files.length;i++){
   const file=files[i];
   try{const result=await cloud.upload(day,id,file,notes[i]||'');
    if(result){state[day][id]=result;added++}
   }catch(e){toast('Cloud proof: '+e.message,true)}
  }
  save();render();return added;
 }
 for(let i=0;i<files.length;i++){
  const file=files[i];
  if(!allowed(file)){toast(file.name+' turi qo‘llab-quvvatlanmaydi',true);continue}
  if(file.size>maxSize){toast('100 MB limit: '+file.name,true);continue}
  const uid=crypto.randomUUID(),note=String(notes[i]||'').slice(0,400);
  try{await putProof({id:uid,blob:file,name:file.name,type:file.type,size:file.size,day,taskId:id,created:new Date().toISOString()});
   r.proofs.push({id:uid,name:file.name,size:file.size,type:file.type,note});r.done=true;r.clock=new Date().toISOString();added++;
  }catch(e){console.error(e);toast('Proof saqlanmadi.',true)}
 }
 save();render();return added;
}
async function remove(id,proof){const r=ensure(day,id);if(window.WRTasksCloud?.ready){try{const updated=await window.WRTasksCloud.remove(day,id,proof);state[day][id]=updated;save();render();toast('Cloud proof o‘chirildi.');return}catch(e){toast(e.message,true);return}}await deleteProof(proof);r.proofs=r.proofs.filter(p=>p.id!==proof);if(!r.proofs.length){r.done=false;r.clock=''}save();render();toast('Proof o‘chirildi.')}
async function download(id){try{const item=await getProof(id);if(!item){const proof=Object.values(state[day]||{}).flatMap(x=>x.proofs||[]).find(p=>p.id===id);if(proof?.pathname){const query=new URLSearchParams({day,id:proof.taskId||Object.keys(state[day]||{}).find(k=>(state[day][k].proofs||[]).some(p=>p.id===id))||'',proofId:id});const response=await fetch('/api/tasks-download?'+query,{credentials:'same-origin'});const data=await response.json();if(!response.ok)throw Error(data.error||'Proof unavailable');window.open(data.url,'_blank','noopener,noreferrer');return}if(proof?.url){window.open(proof.url,'_blank','noopener,noreferrer');return}toast('Proof topilmadi.',true);return}const url=URL.createObjectURL(item.blob);const a=document.createElement('a');a.href=url;a.download=item.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}catch{toast('Proof’ni ochishda xato.',true)}}
function exportReport(){const rows=[['Date','Group','Task','Target minutes','Tracked seconds','Complete','Completed at','Proof files']];for(const g of groups)for(const [id,title]of g.tasks){const r=ensure(day,id);rows.push([day,g.label,title,r.duration,r.seconds||0,r.done?'Yes':'No',r.clock||'',r.proofs.map(p=>p.name).join('; ')])}const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='WORDRUSH_TASKS_'+day+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
// Multi-proof picker with preview and an explicit save action.
function openProofPicker(taskId){
 const old=document.querySelector('#proofPickerDialog');if(old)old.remove();
 const openedDay=day, task=all.find(t=>t[0]===taskId), existing=ensure(openedDay,taskId).proofs.map(p=>({...p,note:p.note||'',originalNote:p.note||''}));
 const pending=[], urls=new Set(), total=()=>existing.length+pending.filter(x=>!x.replaces).length;
 const dialog=document.createElement('div');dialog.id='proofPickerDialog';dialog.className='proof-picker-overlay';
 dialog.innerHTML=[
 '<section class="proof-picker-panel" role="dialog" aria-modal="true" aria-labelledby="proofPickerTitle">',
 '<div class="proof-picker-handle"></div>',
 '<header class="proof-picker-header"><div><span class="proof-picker-eyebrow">',esc(groups.find(g=>g.tasks.some(t=>t[0]===taskId))?.label||'TASKS'),'</span><h2 id="proofPickerTitle">',esc(task?.[1]||'Proof qo‘shish'),'</h2></div><button type="button" class="proof-picker-close" aria-label="Yopish" data-proof-close>×</button></header>',
 '<div class="proof-picker-tip"><span class="proof-picker-tip-icon">✓</span><p>Rasm yoki faylni tanlang, xohlasangiz izoh qo‘shing. <b>Saqlash</b> bosilganda proof yuklanadi va vazifa avtomatik bajariladi.</p></div>',
 '<div id="proofPickerList" class="proof-picker-items"></div>',
 '<button type="button" class="proof-picker-add" id="proofPickerAdd"><span class="proof-picker-add-icon">＋</span><span id="proofPickerCount">Yana qo‘shish (0/10)</span></button>',
 '<p class="proof-picker-help">PDF, HTML, rasm, audio yoki video · 10 tagacha fayl · har biri 100 MB gacha.</p>',
 '<input type="file" id="proofPickerFiles" class="proof-picker-hidden" multiple accept=".pdf,.html,.htm,image/*,audio/*,video/*,.mp3,.m4a,.mp4,.wav,.webm,.mov,.ogg">',
 '<input type="file" id="proofPickerReplace" class="proof-picker-hidden" accept=".pdf,.html,.htm,image/*,audio/*,video/*,.mp3,.m4a,.mp4,.wav,.webm,.mov,.ogg">',
 '<footer class="proof-picker-footer"><button type="button" class="proof-picker-save" id="proofPickerSave">Saqlash</button></footer>',
 '</section>'
 ].join('');
 document.body.append(dialog);
 const list=dialog.querySelector('#proofPickerList'),addButton=dialog.querySelector('#proofPickerAdd'),input=dialog.querySelector('#proofPickerFiles'),replacer=dialog.querySelector('#proofPickerReplace'),saveButton=dialog.querySelector('#proofPickerSave');
 let replaceTarget=null,busy=false;
 const cleanup=()=>{for(const url of urls)URL.revokeObjectURL(url);urls.clear();document.removeEventListener('keydown',onKey);dialog.remove()};
 const onKey=e=>{if(e.key==='Escape'&&!busy)cleanup()};
 document.addEventListener('keydown',onKey);
 dialog.querySelector('[data-proof-close]').onclick=()=>{if(!busy)cleanup()};
 dialog.addEventListener('click',e=>{if(e.target===dialog&&!busy)cleanup()});
 function preview(entry,isNew){
  const wrap=document.createElement('div');wrap.className='proof-picker-thumbnail';
  const mime=entry.type||entry.file?.type||'';
  const filename=entry.name||entry.file?.name||'';
  if(/^image\//.test(mime)||/\.(png|jpe?g|webp|gif|heic)$/i.test(filename)){
   const image=document.createElement('img');image.alt=filename||'Proof';image.loading='lazy';wrap.append(image);
   if(isNew){const url=URL.createObjectURL(entry.file);urls.add(url);image.src=url}
   else if(window.WRTasksCloud?.ready){
    const qs=new URLSearchParams({day:openedDay,id:taskId,proofId:entry.id});
    fetch('/api/tasks-download?'+qs.toString(),{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(r=>{if(r?.url&&image.isConnected)image.src=r.url}).catch(()=>{});
   }else getProof(entry.id).then(v=>{if(v?.blob&&image.isConnected){const url=URL.createObjectURL(v.blob);urls.add(url);image.src=url}}).catch(()=>{});
  }else{
   const glyph=document.createElement('span');glyph.className='proof-picker-file-glyph';
   glyph.textContent=/\.pdf$/i.test(filename)?'PDF':/\.(html?|htm)$/i.test(filename)?'HTML':/^audio\//.test(mime)?'♫':/^video\//.test(mime)?'▶':'▤';
   wrap.append(glyph);
  }
  return wrap;
 }
 function itemRow(entry,isNew,index){
  const row=document.createElement('div');row.className='proof-picker-item';
  row.append(preview(entry,isNew));
  const content=document.createElement('div');content.className='proof-picker-item-body';
  const top=document.createElement('div');top.className='proof-picker-item-top';
  const name=document.createElement('span');name.className='proof-picker-item-name';name.textContent=(index+1)+'-fayl';
  const actions=document.createElement('div');actions.className='proof-picker-actions';
  const swap=document.createElement('button');swap.type='button';swap.textContent='Almashtirish';
  swap.onclick=()=>{replaceTarget={entry,isNew};replacer.value='';replacer.click()};
  const discard=document.createElement('button');discard.type='button';discard.className='proof-picker-delete';discard.textContent="O‘chirish";
  discard.onclick=async()=>{
   if(busy)return;
   if(isNew){const at=pending.indexOf(entry);if(at!==-1)pending.splice(at,1);draw();return}
   busy=true;discard.disabled=true;
   try{await remove(taskId,entry.id);const at=existing.findIndex(v=>v.id===entry.id);if(at!==-1)existing.splice(at,1);draw()}
   catch(e){toast(e.message,true)}finally{busy=false;discard.disabled=false}
  };
  actions.append(swap,discard);top.append(name,actions);
  const filename=document.createElement('div');filename.className='proof-picker-filename';filename.textContent=entry.name||entry.file?.name||'Proof';
  const note=document.createElement('textarea');note.className='proof-picker-note';note.rows=2;note.maxLength=400;note.placeholder='Izoh (ixtiyoriy)';note.value=entry.note||'';
  note.addEventListener('input',()=>{entry.note=note.value});
  content.append(top,filename,note);row.append(content);return row;
 }
 function draw(){
  list.replaceChildren();
  const visibleOld=existing.filter(e=>!pending.some(p=>p.replaces===e.id));
  const entries=[...visibleOld.map(e=>({entry:e,isNew:false})),...pending.map(e=>({entry:e,isNew:true}))];
  entries.forEach(({entry,isNew},i)=>list.append(itemRow(entry,isNew,i)));
  const count=total();dialog.querySelector('#proofPickerCount').textContent='Yana qo‘shish ('+count+'/10)';
  addButton.disabled=count>=10;
  saveButton.textContent=pending.length?'Saqlash · '+pending.length+' ta yangi fayl':'Saqlash';
 }
 function addFiles(files,replaces=''){
  for(const f of files){
   if(!allowed(f)){toast('Bu fayl turi qo‘llab-quvvatlanmaydi: '+f.name,true);continue}
   if(f.size>maxSize){toast('100 MB limit: '+f.name,true);continue}
   if(!replaces&&total()>=10){toast('Bir vazifaga ko‘pi bilan 10 ta proof qo‘shiladi.',true);break}
   pending.push({file:f,name:f.name,type:f.type,note:'',replaces});
  }
  draw();
 }
 addButton.onclick=()=>{input.value='';input.click()};
 input.onchange=()=>{addFiles(Array.from(input.files||[]));input.value=''};
 replacer.onchange=()=>{const file=replacer.files?.[0];if(!file||!replaceTarget)return;
  const {entry,isNew}=replaceTarget;
  if(isNew){if(allowed(file)&&file.size<=maxSize){entry.file=file;entry.name=file.name;entry.type=file.type}}
  else{for(let i=pending.length-1;i>=0;i--)if(pending[i].replaces===entry.id)pending.splice(i,1);addFiles([file],entry.id)}
  replaceTarget=null;replacer.value='';draw();
 };
 saveButton.onclick=async()=>{
  if(busy)return;
  if(!pending.length&&!existing.some(e=>e.note!==e.originalNote)){toast('Yangi fayl yoki izoh mavjud emas.');return}
  busy=true;saveButton.disabled=true;addButton.disabled=true;saveButton.textContent='Saqlanmoqda…';
  let failed=0;
  try{
   if(openedDay!==day)throw Error('Sana o‘zgargan. Oynani qayta oching.');
   for(const e of existing){
    if(e.note!==e.originalNote){
     if(window.WRTasksCloud?.ready)await window.WRTasksCloud.updateNote(openedDay,taskId,e.id,e.note);
     else{const p=ensure(day,taskId).proofs.find(p=>p.id===e.id);if(p)p.note=e.note;save()}
     e.originalNote=e.note;
    }
   }
   for(const e of [...pending]){
    const amount=await filesAdded(taskId,[e.file],[e.note]);
    if(amount){const pos=pending.indexOf(e);if(pos!==-1)pending.splice(pos,1);
      if(e.replaces){await remove(taskId,e.replaces);const posOld=existing.findIndex(p=>p.id===e.replaces);if(posOld!==-1)existing.splice(posOld,1)}
    }else failed++;
   }
   if(!failed){cleanup();toast('✅ Proof saqlandi!');return}
   toast(failed+' ta faylni saqlab bo‘lmadi.',true);
  }catch(e){toast(e.message,true)}
  finally{busy=false;saveButton.disabled=false;draw()}
 };
 draw();dialog.querySelector('#proofPickerAdd').focus();
}
document.addEventListener('click',e=>{const label=e.target.closest('.upload-label');if(!label)return;e.preventDefault();e.stopImmediatePropagation();const input=label.querySelector('[data-file]');if(input)openProofPicker(input.dataset.file)},true);
document.addEventListener('click',async e=>{const target=e.target.closest('button');if(!target)return;if(target.dataset.check)toggle(target.dataset.check);else if(target.dataset.timer){const id=target.dataset.timer;if(active?.id===id&&active.day===day)flushTimer();else{flushTimer();active={id,day,start:Date.now()}}render()}else if(target.dataset.delete){const [id,proof]=target.dataset.delete.split(':');await remove(id,proof)}else if(target.dataset.download)await download(target.dataset.download);else if(target.dataset.filter){filter=target.dataset.filter;render()}});
document.addEventListener('change',async e=>{const t=e.target;if(t.dataset.file){await filesAdded(t.dataset.file,[...t.files]);t.value=''}else if(t.dataset.duration){const r=ensure(day,t.dataset.duration);r.duration=Math.max(1,Math.min(720,Number(t.value)||10));save();render();window.WRTasksCloud?.update(day,t.dataset.duration,r)}});
window.WRTasks={day:()=>day,importDay:(d,items)=>{state[d]={...state[d],...items};save();if(day===d)render()},importTask:(d,id,item)=>{state[d]??={};state[d][id]=item;save();if(day===d)render()}};
$('#prevDate').onclick=()=>shiftDate(-1);$('#nextDate').onclick=()=>shiftDate(1);$('#todayButton').onclick=()=>setDate(dayNow());$('#dateSelect').onchange=e=>setDate(e.target.value);$('#dateSelect').max=dayNow();$('#exportReport').onclick=exportReport;$('#goTop').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});$('#goBottom').onclick=()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});
setInterval(()=>{const current=dayNow();$('#dateSelect').max=current;if(day===lastDay&&current!==lastDay){flushTimer();day=current;render();toast('Yangi kun boshlandi! Checklist yangilandi.')}lastDay=current;if(active){const display=document.querySelector('[data-face="'+active.id+'"]');if(display&&active.day===day)display.textContent=clock(ensure(day,active.id).seconds+Math.floor((Date.now()-active.start)/1000));$('#spentCount').textContent=Math.floor((all.reduce((n,x)=>n+(ensure(day,x[0]).seconds||0),0)+Math.floor((Date.now()-active.start)/1000))/60)+'m'}},1000);
let lastDay=dayNow();day=lastDay;
try{if(!window.indexedDB){throw Error('IndexedDB unsupported')}}catch{toast('Bu brauzer proof fayllarini saqlay olmaydi.',true)}
render();
})();
