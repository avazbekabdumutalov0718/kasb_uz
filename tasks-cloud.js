/* WORDRUSH shared Tasks between normal website and Telegram Mini App.
 * Same-origin session cookie. Never place the Telegram bot token in browser JS. */
(()=>{
'use strict';
const $=x=>document.querySelector(x);
let uid=null,ready=false,pending=Promise.resolve(),working=false;
const mini=Boolean(window.Telegram?.WebApp?.initData);
function status(msg,bad=false){const note=$('#cloudStatus');if(note){note.textContent=msg;note.classList.toggle('cloud-error',bad)}}
async function parse(r){const j=await r.json().catch(()=>({error:'Server error'}));if(!r.ok)throw Error(j.error||'Cloud request failed');return j}
async function login(){
 const url=new URL(location.href);
 const ticket=url.searchParams.get('session');
 if(ticket){
  await parse(await fetch('/api/tasks-auth?ticket='+encodeURIComponent(ticket),{credentials:'same-origin',cache:'no-store'}));
  url.searchParams.delete('session');history.replaceState({},'',url.pathname+url.search+url.hash);
 }else if(mini){
  await parse(await fetch('/api/tasks-auth',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({initData:window.Telegram.WebApp.initData})}));
 }
 const response=await fetch('/api/tasks-sync?day='+encodeURIComponent(window.WRTasks?.day()||''),{credentials:'same-origin',cache:'no-store'});
 if(response.status===401){status('Sinxronlash uchun @homework_IELTS_bot ga /login yozing va yuborilgan havolani oching.');return false}
 const data=await parse(response);uid=String(data.uid||'');window.WRTasks?.importDay(data.day,data.items);status('☁ TASKS cloud sinxronlandi · Telegram va sayt bitta xotirada.');return true;
}
async function getDay(day){if(!ready)return;const r=await parse(await fetch('/api/tasks-sync?day='+encodeURIComponent(day),{credentials:'same-origin',cache:'no-store'}));window.WRTasks?.importDay(day,r.items)}
async function update(day,id,state){
 if(!ready)return;
 const r=await parse(await fetch('/api/tasks-sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',day,id,done:!!state.done,duration:Number(state.duration),seconds:Number(state.seconds)||0})}));
 window.WRTasks?.importTask(day,id,r.item);
}
async function upload(day,id,file){
 if(!ready)return null;
 if(file.size>100*1024*1024)throw Error('100 MB dan katta proof yuborib bo‘lmaydi.');
 if(!uid)throw Error('Telegram login is required');status('☁ '+file.name+' bulutga yuklanmoqda…');
 const source=await import('https://esm.sh/@vercel/blob@2.8.2/client');
 const prefix='wr-task-proof/'+uid+'/'+day+'/'+id+'/';
 // UID is not exposed to the browser API: fetch the scoped upload path with a server challenge instead.
 // The server also validates the verified user ID and path.
 const full=prefix+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120);
 const blob=await source.upload(full,file,{access:'public',handleUploadUrl:'/api/tasks-upload',clientPayload:JSON.stringify({day,id}),multipart:file.size>10*1024*1024});
 const saved=await parse(await fetch('/api/tasks-sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'proof',day,id,proof:{url:blob.url,pathname:blob.pathname,name:file.name,type:file.type}})}));
 window.WRTasks?.importTask(day,id,saved.item);
 status('✓ '+file.name+' cloud’da saqlandi');
 return saved.item;
}
async function remove(day,id,proofId){if(!ready)throw Error('Cloud login required');const r=await parse(await fetch('/api/tasks-sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',day,id,proofId})}));window.WRTasks?.importTask(day,id,r.item);return r.item}
async function boot(){
 if(!window.WRTasks){setTimeout(boot,90);return}
 status('☁ Telegram bilan bulutli saqlash tekshirilmoqda…');
 try{ready=await login();if(ready){window.addEventListener('focus',()=>{getDay(window.WRTasks.day()).catch(()=>{})});setInterval(()=>{if(document.visibilityState==='visible')getDay(window.WRTasks.day()).catch(()=>{})},30000)}}catch(e){status('☁ Sinxronlash xatosi: '+e.message,true)}
}
window.WRTasksCloud={
 get ready(){return ready},
 getDay,
 update:(day,id,state)=>{pending=pending.then(()=>update(day,id,state)).catch(e=>status('Cloud save: '+e.message,true));return pending},
 upload,remove,
 refresh:()=>getDay(window.WRTasks?.day())
};
window.addEventListener('load',boot);
})();