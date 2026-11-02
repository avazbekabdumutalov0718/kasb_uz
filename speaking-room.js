/* WORDRUSH Speaking Room — 2-person IELTS peer practice, no sample answers. */
(()=>{'use strict';
const $=s=>document.querySelector(s),escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const API='./api/speaking-room',STORAGE='wordrush.room.session.v1',NAME_KEY='wordrush.room.name';
let session=null,bank=null,eventsSeen=new Set(),roomState={hostName:'',guestName:'',current:null,turn:'host'},poll=null,polling=false,localStream=null,pc=null,voiceStarted=false,micMuted=false,remoteSignalIds=new Set(),offerDone=false,chosenPart=1;
let clockInterval=null,clockStart=0,lastHeartbeat=0,micPromise=null,voiceRequested=false;
const random=a=>a[Math.floor(Math.random()*a.length)];
function notice(s,err=false){const e=$('#globalMessage');e.textContent=s;e.hidden=false;e.classList.toggle('error',err)}
async function api(body){const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let data=await response.json().catch(()=>({error:'Server error'}));if(!response.ok)throw Error(data.error||'Request failed');return data}
function saveSession(){sessionStorage.setItem(STORAGE,JSON.stringify(session))}
function renderConnected(){const exists=!!roomState.guestName;$('#people').innerHTML='<div class="person online '+(roomState.turn==='host'?'active':'')+'"><span class="presence"></span><strong>'+escapeHTML(roomState.hostName||'Host')+'</strong><small>Host '+(roomState.turn==='host'?'· speaking now':'')+'</small></div><div class="person '+(exists?'online ':'')+(roomState.turn==='guest'&&exists?'active':'')+'"><span class="presence"></span><strong>'+escapeHTML(roomState.guestName||'Waiting for partner…')+'</strong><small>Guest '+(roomState.turn==='guest'?'· speaking now':'')+'</small></div>';
 $('#roomInfo').textContent=exists?'✓ 2/2 ishtirokchi ulangan. Topic va voice suhbatni boshlang.':'Ikkinchi ishtirokchini kuting… Invite linkni yuboring yoki random sherikni kuting.';
 $('#nextTopic').disabled=!exists;$('#switchTurn').disabled=!exists;
 $('#turnInfo').textContent=exists?'🎙 Hozir gapiradi: '+(roomState.turn==='host'?roomState.hostName:roomState.guestName):'Navbat sherik ulangach boshlanadi.';
}
function enterRoom(payload){session={code:payload.code,token:payload.token,role:payload.role,name:payload.name||$('#userName').value.trim()||'Learner'};
 saveSession();$('#joinScreen').hidden=true;$('#roomScreen').hidden=false;$('#displayCode').textContent=session.code;history.replaceState(null,'','#'+session.code);roomState={hostName:payload.role==='host'?session.name:payload.room?.hostName||'Host',guestName:payload.role==='guest'?session.name:'',current:null,turn:'host'};
 renderConnected();startPolling();
 if(session.role==='guest')sendEvent('ready',{}).catch(()=>{});
 if(localStream){voice().catch(e=>notice('Voice: '+e.message,true))}

}
async function sendEvent(type,data={}){if(!session)return;await api({action:'event',code:session.code,token:session.token,type,data})}
async function loadBank(){if(bank)return bank;const response=await fetch('./speaking-room-questions.json');if(!response.ok)throw Error('Speaking questions unavailable');const data=await response.json();if(!Array.isArray(data.groups)||!data.groups.length)throw Error('Speaking bank empty');bank=data.groups;return bank}
async function newTopic(part=chosenPart){if(!roomState.guestName){notice('Avval ikkinchi kishi ulansin.',true);return}await loadBank();const groups=bank.filter(g=>!part||g.part===part);const picked=random(groups);if(!picked)return;const topicIndex=bank.indexOf(picked);await sendEvent('next',{part:picked.part,topicIndex,nonce:crypto.randomUUID()})}
function renderTopic(){const current=roomState.current;if(!current||!bank){$('#topicSpace').innerHTML='<span class="muted">Partner ulanganidan keyin random speaking topic chiqadi.</span>';return}
 const topic=bank[current.topicIndex];if(!topic){notice('Topic ID missing',true);return}
 chosenPart=topic.part;document.querySelectorAll('[data-part]').forEach(b=>b.classList.toggle('primary',Number(b.dataset.part)===chosenPart));
 $('#topicSpace').innerHTML='<div class="tag">IELTS SPEAKING · PART '+topic.part+'</div><div class="topic-name">'+escapeHTML(topic.title)+'</div>'+topic.questions.map((q,i)=>'<div class="question"><span>'+String(i+1).padStart(2,'0')+'</span>'+escapeHTML(q)+'</div>').join('');
}
function renderChat(messages){const e=$('#chatMessages');const nearBottom=e.scrollHeight-e.scrollTop-e.clientHeight<55;e.innerHTML=messages.slice(-60).map(m=>'<div class="chat-entry"><strong>'+escapeHTML(m.role==='host'?roomState.hostName:roomState.guestName)+'</strong><div>'+escapeHTML(m.data.message)+'</div></div>').join('');if(nearBottom)e.scrollTop=e.scrollHeight}
async function pollRoom(){
 if(!session||polling)return;polling=true;
 if(Date.now()-lastHeartbeat>9000){lastHeartbeat=Date.now();api({action:'heartbeat',code:session.code,token:session.token}).catch(()=>{})}
 try{
  const r=await fetch(API+'?code='+encodeURIComponent(session.code)+'&token='+encodeURIComponent(session.token)+'&t='+Date.now(),{cache:'no-store'});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Room offline');
  const justJoined=!roomState.guestName&&!!data.guestName;
  const otherOnline=data.guestOnline!==false;
  roomState.hostName=data.hostName;roomState.guestName=data.guestName;
  const entries=Array.isArray(data.events)?data.events:[];
  let newItems=entries.filter(x=>!eventsSeen.has(x.id));
  for(const ev of newItems){
   eventsSeen.add(ev.id);
   if(ev.type==='next'){roomState.current=ev.data;roomState.turn='host'}
   else if(ev.type==='turn'){roomState.turn=ev.data.role}
   else if(ev.type==='signal'&&ev.role!==session.role){await handleSignal(ev.data.signal)}
   else if(ev.type==='ready'&&ev.role==='guest'&&session.role==='host'&&voiceStarted){if(pc&&pc.signalingState!=='stable'){pc.close();pc=null;offerDone=false}await startOffer()}
   else if(ev.type==='leave'){notice('Sherik xonadan chiqdi. Room tugagan bo‘lishi mumkin.',true)}
  }
  if(eventsSeen.size>1100)eventsSeen=new Set(entries.map(x=>x.id));
  renderConnected();renderChat(entries.filter(x=>x.type==='chat'));renderTopic();
  if(justJoined && session.role==='host'){await newTopic(0);if(voiceStarted)await startOffer()}
  if(justJoined && session.role==='guest'&&voiceStarted){$('#voiceStatus').textContent='Partner microphone started. Voice signal kutilmoqda…'}
 }catch(err){notice('Room sync: '+err.message,true)}
 finally{polling=false}
}
function startPolling(){clearInterval(poll);pollRoom();poll=setInterval(pollRoom,2600)}
async function ensurePC(){
 if(pc)return pc;
 const peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
 pc=peer;
 peer.onicecandidate=e=>{if(e.candidate)sendEvent('signal',{signal:{type:'candidate',candidate:e.candidate.toJSON()}}).catch(()=>{})};
 peer.ontrack=e=>{const audio=$('#remoteAudio');if(e.streams?.[0])audio.srcObject=e.streams[0];else{const stream=audio.srcObject||new MediaStream();stream.addTrack(e.track);audio.srcObject=stream}audio.play().catch(()=>{});$('#voiceStatus').textContent='✓ Partner ovozi ulandi'};
 peer.onconnectionstatechange=()=>{$('#voiceStatus').textContent='Voice connection: '+peer.connectionState;if(peer.connectionState==='failed')$('#voiceStatus').textContent='WebRTC connection failed. TURN server kerak bo‘lishi mumkin.'};
 if(localStream)localStream.getTracks().forEach(track=>peer.addTrack(track,localStream));
 return pc
}
function waitForIce(peer){
 if(peer.iceGatheringState==='complete')return Promise.resolve();
 return new Promise(resolve=>{
  const timeout=setTimeout(()=>{peer.removeEventListener('icegatheringstatechange',onChange);resolve()},6500);
  function onChange(){if(peer.iceGatheringState==='complete'){clearTimeout(timeout);peer.removeEventListener('icegatheringstatechange',onChange);resolve()}}
  peer.addEventListener('icegatheringstatechange',onChange);
 });
}
async function startOffer(){if(session.role!=='host'||!voiceStarted||!roomState.guestName)return;const p=await ensurePC();if(p.signalingState!=='stable'||offerDone)return;offerDone=true;const offer=await p.createOffer();await p.setLocalDescription(offer);await waitForIce(p);await sendEvent('signal',{signal:{type:'offer',sdp:p.localDescription.sdp}})}
async function handleSignal(signal){
 if(!signal||!voiceStarted)return;
 const peer=await ensurePC();
 try{
  if(signal.type==='offer'&&session.role==='guest'){
   await peer.setRemoteDescription({type:'offer',sdp:signal.sdp});
   const answer=await peer.createAnswer();await peer.setLocalDescription(answer);await waitForIce(peer);
   await sendEvent('signal',{signal:{type:'answer',sdp:peer.localDescription.sdp}});
  }else if(signal.type==='answer'&&session.role==='host'&&peer.signalingState==='have-local-offer'){
   await peer.setRemoteDescription({type:'answer',sdp:signal.sdp});
  }else if(signal.type==='candidate'&&signal.candidate){
   try{await peer.addIceCandidate(signal.candidate)}catch(e){console.warn('ICE candidate',e)}
  }
 }catch(e){console.warn('Voice signal error',e);$('#voiceStatus').textContent='Voice negotiation error: '+e.message}
}
async function voice(){
 if(!navigator.mediaDevices?.getUserMedia){notice('Mikrofon bu brauzerda ishlamaydi.',true);return}
 try{
  $('#voiceStatus').textContent='Mikrofon ruxsati so‘ralmoqda…';
  localStream=localStream||await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
  voiceStarted=true;await ensurePC();$('#startVoice').disabled=true;$('#muteVoice').disabled=false;
  $('#voiceStatus').textContent='✓ Microphone ready. Sherik ham micni yoqishi kerak.';
  if(session.role==='host')await startOffer();
  // When a guest enables mic after an earlier offer, request a fresh offer.
  if(session.role==='guest')await sendEvent('ready',{});
 }catch(e){notice('Microphone: '+e.message,true);$('#voiceStatus').textContent='Mikrofon ishlamadi.'}
}
function stopVoice(){if(localStream)localStream.getTracks().forEach(t=>t.stop());if(pc)pc.close();pc=null;localStream=null;voiceStarted=false;offerDone=false}
function timer(){if(clockInterval){clearInterval(clockInterval);clockInterval=null;$('#startTimer').textContent='⏱ Timer';return}
 clockStart=Date.now();$('#startTimer').textContent='⏸ Stop timer';
 const tick=()=>{const s=Math.floor((Date.now()-clockStart)/1000);$('#timer').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
 tick();clockInterval=setInterval(tick,1000);
}
function exitRoom(){if(session)sendEvent('leave',{}).catch(()=>{});clearInterval(poll);clearInterval(clockInterval);stopVoice();session=null;sessionStorage.removeItem(STORAGE);history.replaceState(null,'',location.pathname);$('#roomScreen').hidden=true;$('#joinScreen').hidden=false;eventsSeen.clear();roomState={hostName:'',guestName:'',current:null,turn:'host'};$('#globalMessage').hidden=true}
async function start(action){const name=$('#userName').value.trim()||'Learner';localStorage.setItem(NAME_KEY,name);
 const button=action==='random'?$('#findPartner'):action==='create'?$('#createRoom'):$('#joinRoom');
 button.disabled=true;
 // Start click is a user gesture: request microphone immediately, before any network await.
 if(!localStream && navigator.mediaDevices?.getUserMedia){
  micPromise=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false}).then(s=>{localStream=s;return s}).catch(err=>{notice('Mikrofon uchun ruxsat kerak: '+err.message,true);return null});
 }
 try{
 let body={action,name};if(action==='join')body.code=$('#roomCodeInput').value.toUpperCase().replace(/[^A-Z0-9]/g,'');
 const r=await api(body);if(micPromise)await micPromise;enterRoom(r);notice(action==='random'&&!r.matched?'Online sherik qidirilmoqda. Boshqa foydalanuvchi Start bosganda avtomatik ulanadi…':'Ulandingiz. Savollar avtomatik chiqadi.');
 }catch(e){notice(e.message,true)}finally{button.disabled=false}
}
async function init(){
 $('#userName').value=localStorage.getItem(NAME_KEY)||'';
 $('#findPartner').onclick=()=>start('random');$('#createRoom').onclick=()=>start('create');$('#joinRoom').onclick=()=>start('join');
 $('#copyLink').onclick=()=>{const url=location.origin+location.pathname+'#'+session.code;navigator.clipboard.writeText(url).then(()=>notice('✓ Invite link copied')).catch(()=>prompt('Copy link:',url))};
 $('#leaveRoom').onclick=exitRoom;
 $('#startVoice').onclick=voice;
 $('#muteVoice').onclick=()=>{micMuted=!micMuted;localStream?.getAudioTracks().forEach(t=>t.enabled=!micMuted);$('#muteVoice').textContent=micMuted?'🎤 Unmute':'🔇 Mute'};
 $('#nextTopic').onclick=()=>newTopic(chosenPart).catch(e=>notice(e.message,true));$('#anyPart').onclick=()=>newTopic(0).catch(e=>notice(e.message,true));
 document.querySelectorAll('[data-part]').forEach(btn=>btn.onclick=()=>{chosenPart=Number(btn.dataset.part);newTopic(chosenPart).catch(e=>notice(e.message,true))});
 $('#switchTurn').onclick=()=>sendEvent('turn',{role:roomState.turn==='host'?'guest':'host'}).catch(e=>notice(e.message,true));
 $('#startTimer').onclick=timer;
 $('#chatForm').onsubmit=e=>{e.preventDefault();const field=$('#chatInput'),message=field.value.trim();if(message){field.value='';sendEvent('chat',{message}).then(pollRoom).catch(err=>notice(err.message,true))}};
 $('#toTop').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});$('#toBottom').onclick=()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});
 await loadBank().catch(e=>notice(e.message,true));
 try{const old=JSON.parse(sessionStorage.getItem(STORAGE)||'null');if(old?.code&&old?.token){enterRoom(old);return}}catch{}
 const code=location.hash.replace('#','').toUpperCase();
 if(/^[A-Z0-9]{8}$/.test(code)){$('#roomCodeInput').value=code;notice('Invite link qabul qilindi. Ismingizni kiriting va "Kod bilan kirish" ni bosing.')}
}
window.addEventListener('pagehide',()=>{stopVoice();clearInterval(poll)});
init();
})();
