(() => {
  'use strict';
  const topics=[...window.WORDRUSH_TWO_DAY].sort((a,b)=>a.number-b.number);
  if(!Array.isArray(topics)||topics.length!==3)throw Error('2-Day vocabulary bank is missing.');
  const KEY='wordrush.two-day-speaking.v1';
  const DB_NAME='wordrush.two-day-audio.v1';
  const $=sel=>document.querySelector(sel);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9' -]/g,'').replace(/\s+/g,' ').trim();
  const shuffle=arr=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const modeList=[
    ['flash','Flashcards','Ibora, tarjima va ta’rifni eslab qolish'],
    ['choice','Multiple Choice','To‘rtta ma’nodan to‘g‘risini tanlash'],
    ['match','Matching Pairs','Inglizcha iborani o‘zbekchasi bilan bog‘lash'],
    ['gap','Fill the Gap','Faqat shu o‘yinga xos gapdagi bo‘shliq'],
    ['rush','Word Rush','60 soniyada yangi kontekstlarni topish'],
    ['typing','Typing Race','Tarjimadan inglizcha iborani yozish'],
    ['builder','Sentence Builder','Boshqa gapning so‘zlarini tartiblash']
  ];
  let saved={answers:{},learned:{},scores:{}};
  try{
    const old=JSON.parse(localStorage.getItem(KEY));
    if(old&&typeof old==='object')saved={...saved,...old,answers:old.answers||{},learned:old.learned||{},scores:old.scores||{}};
  }catch{}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{toast('Saqlash uchun brauzer xotirasi yetarli emas.');}};
  const recordings=new Map();
  let activeTopic=Math.max(0,topics.findIndex(t=>t.id===location.hash.slice(1)));
  let lastExportUrl=null,lastExportBlob=null;
  const embedded=(()=>{try{return window.top!==window.self;}catch{return true;}})();
  let recorderState=null,recordTick=null,game=null,rushTick=null,toastTick=null,audioDBPromise=null;
  let micStatus='Mikrofonni birinchi marta ishlatish uchun «Ruxsat so‘rash»ni bosing va brauzerdagi Allow / Ruxsat berish tanlovini tasdiqlang.';
  function microphoneFrameAllowed(){
    const policy=document.permissionsPolicy||document.featurePolicy;
    return typeof policy?.allowsFeature==='function'?policy.allowsFeature('microphone'):null;
  }
  function micMessage(error){
    if(microphoneFrameAllowed()===false)return 'ChatGPT ichki oynasi mikrofonga kirishni bloklagan. Yuqoridagi WORDRUSH nomi yonidagi ↗ orqali saytni Chrome/Edge’da oching, so‘ng mikrofonga ruxsat bering.';
    if(error?.name==='NotAllowedError'||error?.name==='PermissionDeniedError')return 'Mikrofonga ruxsat rad etilgan. Chrome/Edge’da sayt manzili yonidagi qulfcha yoki sozlamalar belgisini bosing → Site settings → Microphone → Allow, keyin sahifani yangilang.';
    if(error?.name==='NotFoundError'||error?.name==='DevicesNotFoundError')return 'Kompyuterda ishlaydigan mikrofon topilmadi. Mikrofonni ulang yoki Windows Settings → Privacy & security → Microphone bo‘limini tekshiring.';
    if(error?.name==='NotReadableError'||error?.name==='TrackStartError')return 'Mikrofon boshqa dastur tomonidan band bo‘lishi mumkin. Zoom/Telegram kabi ilovalarda yozuvni to‘xtatib qayta urinib ko‘ring.';
    if(!navigator.mediaDevices?.getUserMedia)return 'Bu oynada mikrofon API mavjud emas. Saytni Chrome/Edge’da alohida HTTPS oynasida oching.';
    return 'Mikrofon ishlamadi'+(error?.name?': '+error.name:'')+'. Chrome/Edge’da sayt uchun Microphone → Allow ni tekshiring.';
  }
  function setMicStatus(message){
    micStatus=message;
    const el=$('#odMicMessage');if(el)el.textContent=message;
  }
  async function checkMicrophone(){
    if(microphoneFrameAllowed()===false||!navigator.mediaDevices?.getUserMedia){setMicStatus(micMessage());return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      stream.getTracks().forEach(track=>track.stop());
      setMicStatus('✓ Mikrofonga ruxsat berildi. Endi savol ostidagi «Audio yozish» tugmasini bosishingiz mumkin.');
      toast('Mikrofon ruxsati ishlayapti ✓');
    }catch(error){setMicStatus(micMessage(error));toast('Mikrofon ruxsatini tekshiring.');}
  }
  const qKey=(topic,index)=>topic.id+':'+index;
  function toast(message){
    const el=$('#odToast');el.textContent=message;el.classList.add('show');
    clearTimeout(toastTick);toastTick=setTimeout(()=>el.classList.remove('show'),3500);
  }
  function speak(phrase) {
    if(!('speechSynthesis' in window)){toast('Talaffuz brauzerda mavjud emas.');return;}
    speechSynthesis.cancel();const utter=new SpeechSynthesisUtterance(phrase);utter.lang='en-GB';utter.rate=.84;speechSynthesis.speak(utter);
  }
  function audioDB(){
    if(!('indexedDB' in window))return Promise.reject(Error('IndexedDB not supported'));
    if(audioDBPromise)return audioDBPromise;
    audioDBPromise=new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB_NAME,1);
      r.onupgradeneeded=()=>r.result.createObjectStore('clips',{keyPath:'key'});
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error);
    }).catch(e=>{audioDBPromise=null;throw e;});
    return audioDBPromise;
  }
  async function remember(key,blob) {
    const db=await audioDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('clips','readwrite');
      tx.objectStore('clips').put({key,blob,savedAt:Date.now()});
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
  }
  async function restoreAudio() {
    try {
      const db=await audioDB();
      const clips=await new Promise((resolve,reject)=>{
        const req=db.transaction('clips','readonly').objectStore('clips').getAll();
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      for(const item of clips)if(item.blob?.size&&!recordings.has(item.key)){
        recordings.set(item.key,{blob:item.blob,url:URL.createObjectURL(item.blob)});
      }
      refreshAudioSlots();updateExportStatus();
    }catch {toast('Audio saqlash imkoniyati cheklangan. Yozuvni alohida yuklab oling.');}
  }
  const restored=restoreAudio();
  function recordingMarkup(key) {
    const clip=recordings.get(key);
    if(!clip)return '<span class="od-audio-state">Hali audio yo‘q · saqlash shu brauzerda</span>';
    const ext=clip.blob.type.includes('mp4')?'m4a':'webm';
    return '<audio controls preload="metadata" src="'+esc(clip.url)+'"></audio><a href="'+esc(clip.url)+'" download="WORDRUSH-'+esc(key.replace(':','-'))+'.'+ext+'">↓ Audio</a>';
  }
  function refreshAudioSlots(){
    document.querySelectorAll('[data-audio-key]').forEach(el=>{el.innerHTML=recordingMarkup(el.dataset.audioKey);});
    updateExportStatus();
  }
  function wordStatus(topic){
    return topic.words.filter((w,i)=>saved.learned[topic.id+':'+i]).length;
  }
  function topicStatus(topic){
    return topic.questions.filter((_,i)=>{
      const key=qKey(topic,i);return Boolean(saved.answers[key]?.trim()||recordings.has(key));
    }).length;
  }
  function updateExportStatus(){
    const answered=topics.reduce((sum,t)=>sum+topicStatus(t),0),audios=topics.reduce((sum,t)=>sum+t.questions.filter((_,i)=>recordings.has(qKey(t,i))).length,0);
    $('#odExportStatus').textContent=answered+' / 12 javob · '+audios+' ta audio saqlangan';
  }
  function render(){
    const topic=topics[activeTopic];
    $('#odTopicTabs').innerHTML=topics.map((t,i)=>
      '<button type="button" class="od-topic-tab '+(i===activeTopic?'active':'')+'" data-action="topic" data-index="'+i+'" aria-pressed="'+(i===activeTopic)+'"><span class="number">'+esc(t.number)+'</span><span><strong>'+esc(t.title)+'</strong><small>'+esc(t.period)+' · '+t.words.length+' ibora · 7 o‘yin · 4 savol</small></span></button>'
    ).join('');
    let html='<div class="od-summary"><div><span class="section-kicker">TOPIC '+esc(topic.number)+' · '+esc(topic.period)+'</span><h2>'+esc(topic.title)+'</h2><p>'+esc(topic.intro)+'</p></div><div class="od-progress"><strong>'+wordStatus(topic)+' / '+topic.words.length</strong><span>o‘rganilgan iboralar</span><strong>'+topicStatus(topic)+' / 4</strong><span>javob berilgan savollar</span></div></div>';
    html+='<section class="od-section"><div class="od-section-title"><div><span class="od-step">01 / AVVAL O‘RGANING</span><h3>'+topic.words.length+' Band 9 vocabulary</h3><p>Har bir iboraning aniq tarjimasi va ma’nosi mavjud. 🔊 bilan talaffuzini tinglang.</p></div></div><div class="od-vocab-grid">'+topic.words.map((w,i)=>
      '<article class="od-vocab"><div class="od-vocab-top"><b>'+String(i+1).padStart(2,'0')+'. '+esc(w[0])+'</b><button type="button" data-action="speak" data-phrase="'+esc(w[0])+'" aria-label="Talaffuz: '+esc(w[0])+'">🔊</button></div><small>'+esc(w[1])+'</small><small class="definition">'+esc(w[2])+'</small></article>'
    ).join('')+'</div></section>';
    html+='<section class="od-section"><div class="od-section-title"><div><span class="od-step">02 / 7 XIL USULDA MUSTAHKAMLANG</span><h3>Vocabulary Games</h3><p>Fill the Gap, Word Rush va Sentence Builder uchun alohida, takrorlanmaydigan gaplar ishlatiladi.</p></div></div><div class="od-games">'+modeList.map(([id,name,detail],i)=>
      '<button type="button" class="od-game-card" data-action="game" data-mode="'+id+'"><span class="game-number">0'+(i+1)+' / GAME</span><strong>'+esc(name)+'</strong><small>'+esc(detail)+'</small></button>'
    ).join('')+'</div></section>';
    html+='<section class="od-section" id="odQuestions"><div class="od-section-title"><div><span class="od-step">03 / ENDI O‘ZINGIZ JAVOB BERING</span><h3>'+esc(topic.title)+' — Speaking Questions</h3><p>Har bir savol uchun yozma javob va alohida mikrofon yozuvi saqlanadi. Audio mikrofonga ruxsat berganingizda yoziladi.</p></div><span class="od-step">4 QUESTIONS</span></div><div class="od-mic-setup"><div><strong>🎙 Mikrofon ruxsati</strong><p id="odMicMessage" role="status">'+esc(microphoneFrameAllowed()===false?micMessage():micStatus)+'</p></div><button type="button" data-action="mic-check">Mikrofonga ruxsat so‘rash</button></div><div class="od-question-grid">'+topic.questions.map(([question,sample],index)=>{
      const key=qKey(topic,index);
      return '<article class="od-question"><div class="od-q-head"><span class="od-q-index">'+String(index+1).padStart(2,'0')+'</span><h4>'+esc(question)+'</h4></div><details><summary>Band 9 uslubidagi yangi sample answer ↓</summary><p>'+esc(sample)+'</p></details><label for="odAnswer'+index+'">YOUR ANSWER · ENGLISH</label><textarea id="odAnswer'+index+'" data-answer-key="'+esc(key)+'" placeholder="I would say..." maxlength="10000">'+esc(saved.answers[key]||'')+'</textarea><div class="od-audio-bar"><button type="button" class="od-record" data-action="record" data-key="'+esc(key)+'">🎙 Audio yozish</button><span class="od-rec-time" data-time-key="'+esc(key)+'">00:00 / target 05:00</span><div class="od-audio-slot" data-audio-key="'+esc(key)+'">'+recordingMarkup(key)+'</div></div></article>';
    }).join('')+'</div></section>';
    $('#odContent').innerHTML=html;
    updateExportStatus();
  }
  function showRecordingTime(){
    if(!recorderState)return;
    const n=Math.floor((Date.now()-recorderState.startedAt)/1000),v=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
    const time=document.querySelector('[data-time-key="'+recorderState.key+'"]');
    if(time)time.textContent=v+' / target 05:00';
  }
  async function record(key){
    if(recorderState){
      if(recorderState.key!==key){toast('Avval boshlagan yozuvni to‘xtating.');return;}
      recorderState.recorder.stop();return;
    }
    if(microphoneFrameAllowed()===false||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setMicStatus(micMessage());toast('Mikrofonga ruxsat kerak. Yuqoridagi ko‘rsatmani o‘qing.');return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const chunks=[],mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(m=>MediaRecorder.isTypeSupported(m));
      const media=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
      media.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      media.onstop=async()=>{
        stream.getTracks().forEach(track=>track.stop());
        clearInterval(recordTick);recordTick=null;recorderState=null;
        const blob=new Blob(chunks,{type:media.mimeType||'audio/webm'});
        if(blob.size){
          const old=recordings.get(key);if(old)URL.revokeObjectURL(old.url);
          recordings.set(key,{blob,url:URL.createObjectURL(blob)});
          try{await remember(key,blob);toast('Audio brauzerda saqlandi ✓');}
          catch{toast('Audio faqat vaqtincha turibdi. Uni hozir yuklab oling.');}
        }else toast('Audio yozilmadi. Qayta urinib ko‘ring.');
        render();
      };
      media.start(250);
      setMicStatus('✓ Mikrofon yoqildi va audio yozilmoqda. Tayyor bo‘lganda «Yozishni tugatish»ni bosing.');
      recorderState={key,recorder:media,stream,startedAt:Date.now()};
      document.querySelectorAll('[data-action="record"]').forEach(b=>{
        b.disabled=b.dataset.key!==key;
        if(b.dataset.key===key){b.classList.add('recording');b.textContent='■ Yozishni tugatish';}
      });
      showRecordingTime();recordTick=setInterval(showRecordingTime,300);
      toast('Yozuv boshlandi. Tayyor bo‘lganda tugatish tugmasini bosing.');
    }catch(error){setMicStatus(micMessage(error));toast('Mikrofon ishlamadi — yuqoridagi ruxsat ko‘rsatmasini ko‘ring.');}
  }
  const fileAsDataUrl=blob=>new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
  });
  async function exportMock(){
    if(recorderState){toast('Eksportdan oldin audio yozishni to‘xtating.');return;}
    const button=$('#odExportButton');button.disabled=true;button.textContent='Fayl tayyorlanmoqda…';
    try{
      await restored;
      const sections=[];
      for(const topic of topics){
        const questions=[];
        for(let i=0;i<topic.questions.length;i++){
          const key=qKey(topic,i),audio=recordings.get(key);
          const audioHtml=audio?'<audio controls preload="metadata" src="'+esc(await fileAsDataUrl(audio.blob))+'"></audio>':'<p class="empty">Audio javob yozilmagan.</p>';
          questions.push('<article><span>QUESTION '+(i+1)+'</span><h3>'+esc(topic.questions[i][0])+'</h3><p class="answer">'+esc(saved.answers[key]?.trim()||'Yozma javob kiritilmagan.')+'</p><div>'+audioHtml+'</div></article>');
        }
        sections.push('<section><h2>'+esc(topic.title)+'</h2>'+questions.join('')+'</section>');
      }
      const now=new Date().toLocaleString('uz-UZ');
      const documentHtml='<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WORDRUSH — Alisher’s Speaking Day 2 Mock</title><style>body{margin:0;background:#f2f7ed;color:#1b3026;font-family:system-ui,Arial,sans-serif;line-height:1.6}.wrap{max-width:850px;margin:auto;padding:35px 20px}header{background:#143c2c;color:#f2ffe7;padding:35px;border-radius:22px}header h1{font-size:2.25rem;margin:0}header p{color:#c0e0be}h2{border-bottom:3px solid #9bca70;padding-bottom:12px;margin-top:38px}article{background:white;border:1px solid #d5e3cf;padding:22px;margin:15px 0;border-radius:15px}article span{font-size:.75rem;color:#568056;font-weight:800;letter-spacing:.1em}h3{font-size:1.1rem}.answer{white-space:pre-wrap;background:#f0f5eb;padding:15px;border-radius:10px}audio{width:100%;max-width:440px}.empty{color:#808b7d}@media print{audio{display:none}article{break-inside:avoid}}</style></head><body><div class="wrap"><header><h1>WORDRUSH — 2-Day Speaking</h1><p>'+esc(topics.map(t=>t.title).join(' · '))+' | 12 questions | '+esc(now)+'</p><p>Ushbu faylda barcha savollar, yozma javoblar va mavjud audio yozuvlar joylangan. Audio internetga ulanmasdan ijro etiladi.</p></header>'+sections.join('')+'</div></body></html>';
      const blob=new Blob([documentHtml],{type:'text/html;charset=utf-8'});
      if(lastExportUrl)URL.revokeObjectURL(lastExportUrl);
      const url=URL.createObjectURL(blob);
      lastExportUrl=url;lastExportBlob=blob;
      const slot=$('#odDownloadReady');
      slot.innerHTML='<div class="od-ready"><strong>✓ Mock faylingiz tayyor ('+Math.max(1,Math.ceil(blob.size/1024))+' KB)</strong>'+
        '<button type="button" id="odSaveFile">💾 Faylni kompyuterga saqlash</button>'+
        '<a id="odDirectDownload" download="WORDRUSH-2-Day-Speaking-Mock.html" href="'+esc(url)+'">⬇ Yuklash havolasi</a>'+
        '<a id="odOpenMock" target="_blank" rel="noopener" href="'+esc(url)+'">↗ Faylni yangi oynada ochish</a>'+
        '<small>ChatGPT ichida yuklash bloklansa, «yangi oynada ochish» tugmasini bosing. Ochilgan Mock sahifasida Ctrl + S orqali faylni bevosita kompyuterga saqlang.</small></div>';
      toast('Mock tayyor! «Faylni kompyuterga saqlash» tugmasini bosing.');
    }catch(error){toast('Eksport xatosi: '+String(error.message||error));}
    finally{button.disabled=false;button.textContent='📄 Mock faylni tayyorlash';}
  }
  // Each game uses one of three distinct authored practice sentences rather
  // than copying the PDF’s examples or another game’s sentences.
  function startGame(mode){
    if(recorderState){toast('Avval audio yozishni tugating.');return;}
    stopRush();
    const topic=topics[activeTopic];
    game={mode,topic,index:0,order:shuffle(topic.words.map((_,i)=>i)),score:0,feedback:'',reveal:false,locked:false,match:null,built:[],remaining:[]};
    $('#odGameOverlay').hidden=false;
    $('#odGameTitle').textContent=modeList.find(m=>m[0]===mode)?.[1]||'Game';
    if(mode==='rush'){
      game.endsAt=Date.now()+60000;
      rushTick=setInterval(()=>{
        if(!game||game.mode!=='rush')return stopRush();
        if(Date.now()>=game.endsAt){finishGame();return;}
        const el=$('#odRushClock');if(el)el.textContent=Math.ceil((game.endsAt-Date.now())/1000)+' s';
      },300);
    }
    renderGame();
  }
  function stopRush(){if(rushTick)clearInterval(rushTick);rushTick=null;}
  function closeGame(){stopRush();game=null;$('#odGameOverlay').hidden=true;}
  function gameWord(){return game.topic.words[game.order[game.index]];}
  function optionsFor(index,prop){
    const correct=game.topic.words[index][prop];
    return shuffle([correct,...shuffle(game.topic.words.filter((_,i)=>i!==index)).slice(0,3).map(w=>w[prop])]);
  }
  const gapText=(sentence)=>esc(sentence).replaceAll('{{}}','<span class="blank">______</span>');
  function renderGame(){
    if(!game)return;
    if(game.index>=game.order.length){finishGame();return;}
    const mode=game.mode,w=gameWord(),idx=game.order[game.index],total=game.order.length;
    let html='<div class="od-game-progress">TOPIC '+esc(game.topic.title)+' · '+(game.index+1)+' / '+total+' · SCORE '+game.score+(mode==='rush'?' · <strong id="odRushClock">'+Math.max(0,Math.ceil((game.endsAt-Date.now())/1000))+' s</strong>':'')+'</div>';
    if(mode==='flash'){
      html+='<div class="od-flashcard" data-game-action="flip" role="button" tabindex="0">'+(game.reveal?'<div><strong>'+esc(w[1])+'</strong><p>'+esc(w[2])+'</p><small>'+esc(w[0])+'</small></div>':'<div><strong>'+esc(w[0])+'</strong><p>Tarjimani ko‘rish uchun bosing ↗</p></div>')+'</div>';
      if(game.reveal)html+='<div class="od-game-options"><button type="button" class="od-option" data-game-action="mark" data-known="0">Yana mashq qilaman</button><button type="button" class="od-option" data-game-action="mark" data-known="1">✓ Eslab qoldim</button></div>';
    }else if(mode==='choice'){
      html+='<p class="od-game-prompt">'+esc(w[0])+'</p><div class="od-game-options">'+optionsFor(idx,1).map(s=>'<button class="od-option" type="button" data-game-action="choose" data-value="'+esc(s)+'">'+esc(s)+'</button>').join('')+'</div>';
    }else if(mode==='gap'||mode==='typing'){
      html+='<p class="od-game-prompt">'+(mode==='gap'?gapText(w[3]):esc(w[1]))+'</p>';
      html+='<form id="odGameForm"><input class="od-game-input" name="entry" aria-label="Inglizcha iborani kiriting" autocomplete="off" placeholder="English word or phrase…" required><button class="od-game-primary" type="submit">Tekshirish ✓</button></form>';
    }else if(mode==='rush'){
      html+='<p class="od-game-prompt">'+gapText(w[5])+'</p><div class="od-game-options">'+optionsFor(idx,0).map(s=>'<button class="od-option" type="button" data-game-action="choose" data-value="'+esc(s)+'">'+esc(s)+'</button>').join('')+'</div>';
    }else if(mode==='builder'){
      const full=w[4].replace('{{}}',w[0]);
      if(!game.remaining.length&&!game.built.length)game.remaining=shuffle(full.split(/\s+/).map((token,i)=>({token,i})));
      html+='<p class="od-game-prompt">So‘zlarni to‘g‘ri tartibga qo‘ying</p><div class="od-built">'+(game.built.length?game.built.map((item,i)=>'<button class="od-tile" type="button" data-game-action="unbuild" data-index="'+i+'">'+esc(item.token)+'</button>').join(' '):'<span style="color:#a4baa6">Bu yerda gapingiz paydo bo‘ladi…</span>')+'</div><div class="od-tiles">'+game.remaining.map((item,i)=>'<button class="od-tile" type="button" data-game-action="build" data-index="'+i+'">'+esc(item.token)+'</button>').join('')+'</div><button type="button" data-game-action="check-build" class="od-game-primary">Gapni tekshirish ✓</button>';
    }else if(mode==='match'){
      if(!game.match){
        const group=game.order.slice(game.index,game.index+4);
        game.match={group,uzOrder:shuffle(group),matched:new Set(),en:null,uz:null};
      }
      const pair=game.match;
      html+='<p class="od-game-prompt">Iboralarni tarjimalari bilan juftlang</p><div class="od-game-options"><div>'+pair.group.map(i=>'<button style="display:block;width:100%;margin-bottom:.6rem" class="od-option" '+(pair.matched.has(i)?'disabled':'')+' data-game-action="pair" data-side="en" data-index="'+i+'">'+esc(game.topic.words[i][0])+(pair.en===i?' ✓':'')+'</button>').join('')+'</div><div>'+pair.uzOrder.map(i=>'<button style="display:block;width:100%;margin-bottom:.6rem" class="od-option" '+(pair.matched.has(i)?'disabled':'')+' data-game-action="pair" data-side="uz" data-index="'+i+'">'+esc(game.topic.words[i][1])+(pair.uz===i?' ✓':'')+'</button>').join('')+'</div></div>';
      if(pair.matched.size===pair.group.length)html+='<button class="od-game-primary" data-game-action="next-match" type="button">Keyingi guruh →</button>';
    }
    if(game.feedback)html+='<p class="od-game-feedback" role="status">'+esc(game.feedback)+'</p>';
    if(game.locked&&mode!=='match')html+='<button type="button" data-game-action="next" class="od-game-primary">'+(game.index===total-1?'Natijani ko‘rish ↗':'Keyingi savol →')+'</button>';
    $('#odGameBody').innerHTML=html;
    if(!game.locked&&['gap','typing'].includes(mode))$('#odGameForm input')?.focus();
  }
  function markResult(correct){
    if(!game||game.locked)return;
    const word=gameWord();
    game.locked=true;if(correct)game.score++;
    game.feedback=correct?'To‘g‘ri! Zo‘r davom eting.':'To‘g‘ri javob: '+word[0]+' — '+word[1];
    renderGame();
  }
  function nextGame(){
    if(!game)return;
    game.index++;game.locked=false;game.feedback='';game.reveal=false;game.match=null;game.built=[];game.remaining=[];
    if(game.index>=game.order.length)finishGame();else renderGame();
  }
  function finishGame(){
    if(!game)return;
    stopRush();
    const score=game.score,total=game.order.length,mode=game.mode,topic=game.topic;
    saved.scores[topic.id+':'+mode]={score,total,finishedAt:new Date().toISOString()};
    save();
    $('#odGameBody').innerHTML='<div class="od-game-score"><span>SESSION FINISHED</span><strong>'+score+' / '+total+'</strong><p>'+esc(topic.title)+' · '+esc(modeList.find(m=>m[0]===mode)?.[1]||mode)+'</p><button class="od-game-primary" data-game-action="restart" type="button">Yana o‘ynash ↻</button> <button class="od-game-primary" data-game-action="close" type="button">Topicga qaytish ✓</button></div>';
    game.finished=true;
    render();
  }
  function handlePair(side,index){
    if(!game?.match||game.match.matched.has(index))return;
    game.match[side]=index;
    if(game.match.en!==null&&game.match.uz!==null){
      if(game.match.en===game.match.uz){game.match.matched.add(index);game.score++;game.feedback='To‘g‘ri juftlik ✓';}
      else game.feedback='Bu juftlik mos kelmadi. Qayta urinib ko‘ring.';
      game.match.en=null;game.match.uz=null;
    }
    renderGame();
  }
  document.addEventListener('click',e=>{
    const action=e.target.closest('[data-action]');
    if(action){
      switch(action.dataset.action){
        case 'topic':
          if(recorderState){toast('Audio yozuvni tugating.');break;}
          activeTopic=Number(action.dataset.index);location.hash=topics[activeTopic].id;render();break;
        case 'speak':speak(action.dataset.phrase);break;
        case 'game':startGame(action.dataset.mode);break;
        case 'record':record(action.dataset.key);break;
        case 'mic-check':checkMicrophone();break;
      }
    }
    const b=e.target.closest('[data-game-action]');if(!b||!game)return;
    const which=b.dataset.gameAction;
    if(which==='flip'){game.reveal=!game.reveal;renderGame();}
    else if(which==='mark'){
      if(b.dataset.known==='1'){saved.learned[game.topic.id+':'+game.order[game.index]]=true;game.score++;}
      else delete saved.learned[game.topic.id+':'+game.order[game.index]];
      save();nextGame();
    }else if(which==='choose'){const correct=norm(b.dataset.value)===norm(game.mode==='choice'?gameWord()[1]:gameWord()[0]);markResult(correct);}
    else if(which==='next')nextGame();
    else if(which==='pair')handlePair(b.dataset.side,Number(b.dataset.index));
    else if(which==='next-match'){
      game.index+=game.match.group.length;game.match=null;game.feedback='';if(game.index>=game.order.length)finishGame();else renderGame();
    }else if(which==='build'){
      const item=game.remaining.splice(Number(b.dataset.index),1)[0];if(item)game.built.push(item);renderGame();
    }else if(which==='unbuild'){
      const item=game.built.splice(Number(b.dataset.index),1)[0];if(item)game.remaining.push(item);renderGame();
    }else if(which==='check-build'){
      const target=gameWord()[4].replace('{{}}',gameWord()[0]);markResult(norm(game.built.map(x=>x.token).join(' '))===norm(target));
    }else if(which==='restart')startGame(game.mode);
    else if(which==='close')closeGame();
  });
  document.addEventListener('submit',e=>{
    if(e.target.id!=='odGameForm'||!game)return;
    e.preventDefault();
    const input=e.target.elements.entry.value;
    markResult(norm(input)===norm(gameWord()[0]));
  });
  document.addEventListener('input',e=>{
    const key=e.target?.dataset?.answerKey;
    if(key){saved.answers[key]=e.target.value.slice(0,10000);save();updateExportStatus();}
  });
  $('#odCloseGame').addEventListener('click',closeGame);
  $('#odExportButton').addEventListener('click',exportMock);
  $('#odDownloadReady').addEventListener('click',async e=>{
    if(e.target?.id!=='odSaveFile'||!lastExportBlob)return;
    const button=e.target;
    try{
      if(window.showSaveFilePicker){
        const handle=await window.showSaveFilePicker({suggestedName:'WORDRUSH-2-Day-Speaking-Mock.html',types:[{description:'HTML mock fayli',accept:{'text/html':['.html']}}]});
        const stream=await handle.createWritable();
        await stream.write(lastExportBlob);await stream.close();
        toast('Mock fayl kompyuteringizga saqlandi ✓');
        return;
      }
    }catch(error){
      if(error?.name==='AbortError')return;
    }
    const link=$('#odDirectDownload');
    if(link){
      link.click();
      toast(embedded?'ChatGPT oynasi yuklashni bloklashi mumkin. «Faylni yangi oynada ochish» orqali Ctrl + S bilan saqlang.':'Fayl yuklashga yuborildi. Downloads papkasini tekshiring.');
    }
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&game)closeGame();
    if((e.key==='Enter'||e.key===' ')&&e.target?.classList?.contains('od-flashcard')){e.preventDefault();game.reveal=!game.reveal;renderGame();}
  });
  window.addEventListener('hashchange',()=>{
    const i=topics.findIndex(t=>t.id===location.hash.slice(1));
    if(i>=0&&i!==activeTopic&&!recorderState){activeTopic=i;render();}
  });

  // Save questions and real MP3 audio as individual files in a ZIP archive.
  $('#odZipButton')?.addEventListener('click',async()=>{
    if(recorderState){toast('Avval audio yozishni to‘xtating.');return;}
    const button=$('#odZipButton'),status=$('#odZipStatus');button.disabled=true;
    try{
      await restored;
      if(!window.WORDRUSH_ZIP)throw Error('ZIP moduli yuklanmadi. Sahifani qayta oching.');
      const output=await WORDRUSH_ZIP.build({day:2,topics,recordings,answers:saved.answers,onProgress:message=>status.textContent=message});
      status.textContent=output.count+' ta audio MP3 shaklida tayyorlandi. Saqlash oynasini tanlang.';
      await WORDRUSH_ZIP.download(output.blob,'WORDRUSH-Alishers-Speaking-Day-2-MP3.zip');
      toast('ZIP tayyor: '+output.count+' ta MP3 audio');
    }catch(error){status.textContent='Eksport xatosi: '+String(error.message||error);toast(status.textContent);}
    finally{button.disabled=false;}
  });
  render();
})();
