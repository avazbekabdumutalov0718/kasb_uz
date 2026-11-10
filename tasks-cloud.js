/* WORDRUSH shared Tasks between normal website and Telegram Mini App.
 * Same-origin session cookie. Never place the Telegram bot token in browser JS. */
(()=>{
'use strict';
const $=x=>document.querySelector(x);
let uid=null,ready=false,pending=Promise.resolve(),working=false;
const mini=Boolean(window.Telegram?.WebApp?.initData);
const apiFetch=(url,opt={})=>{
 const data=window.Telegram?.WebApp?.initData;
 if(data&&String(url).startsWith('/api/'))opt={...opt,headers:{...(opt.headers||{}),'x-telegram-init-data':data}};
 return fetch(url,opt);
};
function status(msg,bad=false){const note=$('#cloudStatus');if(note){note.textContent=msg;note.classList.toggle('cloud-error',bad)}}
async function parse(r){const j=await r.json().catch(()=>({error:'Server error'}));if(!r.ok)throw Error(j.error||'Cloud request failed');return j}
async function login(){
 const url=new URL(location.href);
 const ticket=url.searchParams.get('session');
 if(ticket){
  await parse(await apiFetch('/api/tasks-auth?ticket='+encodeURIComponent(ticket),{credentials:'same-origin',cache:'no-store'}));
  url.searchParams.delete('session');history.replaceState({},'',url.pathname+url.search+url.hash);
 }else if(mini){
  try{await parse(await apiFetch('/api/tasks-auth',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({initData:window.Telegram.WebApp.initData})}));}catch(e){console.warn('Cookie auth skipped:',e.message)}
 }
 const response=await apiFetch('/api/tasks-sync?day='+encodeURIComponent(window.WRTasks?.day()||''),{credentials:'same-origin',cache:'no-store'});
 if(response.status===401){status('Sinxronlash uchun @homework_IELTS_bot ga /login yozing va yuborilgan havolani oching.');return false}
 const data=await parse(response);uid=String(data.uid||'');window.WRTasks?.importDay(data.day,data.items);status('☁ TASKS cloud sinxronlandi · Telegram va sayt bitta xotirada.');return true;
}
async function getDay(day){if(!ready)return;const r=await parse(await apiFetch('/api/tasks-sync?day='+encodeURIComponent(day),{credentials:'same-origin',cache:'no-store'}));window.WRTasks?.importDay(day,r.items)}
async function update(day,id,state){
 if(!ready)return;
 const r=await parse(await apiFetch('/api/tasks-sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',day,id,done:!!state.done,duration:Number(state.duration),seconds:Number(state.seconds)||0})}));
 window.WRTasks?.importTask(day,id,r.item);
}
// 1-bosqich: faylni bulutga yuklash (parallel ishlashi mumkin)
async function uploadFile(day,id,file){
 if(!ready)throw Error('Bulutli saqlashga kirilmagan. Telegram orqali kiring.');
 if(file.size>100*1024*1024)throw Error('100 MB dan katta proof yuborib bo‘lmaydi.');
 if(!uid)throw Error('Telegram login is required');status('☁ '+file.name+' bulutga yuklanmoqda…');
 const signed=await parse(await apiFetch('/api/tasks-upload',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({day,id,name:file.name,size:file.size})}));
 const uploadUrl=signed.url.startsWith('http')?signed.url:'https://qckbyhorhasicyimqcgs.supabase.co'+signed.url;
 const uploaded=await fetch(uploadUrl,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});
 if(!uploaded.ok){const error=await uploaded.text();throw Error('Storage upload failed: '+error.slice(0,180))}
 return {pathname:signed.path};
}
// 2-bosqich: yuklangan faylni vazifaga yozish (ketma-ket bo‘lishi kerak)
async function register(day,id,file,blob,note='',silent=false){
 const saved=await parse(await apiFetch('/api/tasks-sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'proof',day,id,silent,proof:{url:'',pathname:blob.pathname,name:file.name,type:file.type,note:String(note).slice(0,400)}})}));
 if(saved.delivery&&saved.delivery.delivered===false)status('⚠️ Kanalga yuborilmadi: '+(saved.delivery.reason||'noma’lum xato'),true);
 window.WRTasks?.importTask(day,id,saved.item);
 status('✓ '+file.name+' cloud’da saqlandi');
 return saved.item;
}
// Eski chaqiruvlar uchun: ikkalasini ketma-ket bajaradi
async function upload(day,id,file,note=''){
 const blob=await uploadFile(day,id,file);
 return register(day,id,file,blob,note);
}
async function updateNote(day,id,proofId,note){
 if(!ready)throw Error('Cloud login required');
 const r=await parse(await apiFetch('/api/tasks-sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'note',day,id,proofId,note:String(note||'').slice(0,400)})}));
 window.WRTasks?.importTask(day,id,r.item);return r.item;
}
async function remove(day,id,proofId){if(!ready)throw Error('Cloud login required');const r=await parse(await apiFetch('/api/tasks-sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',day,id,proofId})}));window.WRTasks?.importTask(day,id,r.item);return r.item}
function addResend(){
 if(document.getElementById('resendReport'))return;
 const b=document.createElement('button');b.id='resendReport';b.type='button';b.textContent='📤 Kanalga qayta yuborish';
 b.style.cssText='position:fixed;right:12px;bottom:12px;z-index:50;padding:11px 15px;border:0;border-radius:999px;background:#fb7a2b;color:#fff;font:inherit;font-weight:800;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.28);cursor:pointer';
 b.onclick=async()=>{
  if(b.disabled)return;const old=b.textContent;b.disabled=true;b.textContent='Yuborilmoqda…';
  try{
   const day=window.WRTasks.day();
   const r=await apiFetch('/api/tasks-sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resend',day})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(d.error||('Server xatosi '+r.status));
   if(d.delivery&&d.delivery.delivered)b.textContent='✅ Yuborildi';
   else{b.textContent='⚠️ '+((d.delivery&&d.delivery.reason)||'Yuborilmadi');status('⚠️ Kanalga yuborilmadi: '+((d.delivery&&d.delivery.reason)||'noma’lum xato'),true)}
  }catch(e){b.textContent='⚠️ '+e.message}
  setTimeout(()=>{b.disabled=false;b.textContent=old},5000);
 };
 document.body.appendChild(b);
}
async function boot(){
 if(!window.WRTasks){setTimeout(boot,90);return}
 addResend();
 status('☁ Telegram bilan bulutli saqlash tekshirilmoqda…');
 try{ready=await login();if(ready){window.addEventListener('focus',()=>{getDay(window.WRTasks.day()).catch(()=>{})});setInterval(()=>{if(document.visibilityState==='visible')getDay(window.WRTasks.day()).catch(()=>{})},30000)}}catch(e){status('☁ Sinxronlash xatosi: '+e.message,true)}
}
window.WRTasksCloud={
 get ready(){return ready},
 getDay,
 update:(day,id,state)=>{pending=pending.then(()=>update(day,id,state)).catch(e=>status('Cloud save: '+e.message,true));return pending},
 upload,uploadFile,register,remove,updateNote,
 refresh:()=>getDay(window.WRTasks?.day())
};
window.addEventListener('load',boot);
})();
