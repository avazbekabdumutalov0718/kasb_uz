/* WORDRUSH Speaking Studio: the original VIVID IELTS question banks and topics.
   All written progress is browser-local, independent of the WORDRUSH word bank. */
(() => {
  'use strict';
  const KEY = 'wordrush.speaking.v1';
  const CONTENT_REV='2026-10-27-speaking-fix';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const norm = value => String(value ?? '').toLocaleLowerCase('en').replace(/\s+/g,' ').trim();
  const random = list => list[Math.floor(Math.random() * list.length)];
  function shuffle(source) { const list=[...source]; for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];} return list; }
  const DEFAULT = {answers:{},dayNotes:{},completedDays:[],mockDraft:null,mockHistory:[]};
  function restore() {
    try {
      const item=JSON.parse(localStorage.getItem(KEY));
      if(item&&typeof item==='object'&&!Array.isArray(item))return {...DEFAULT,...item,answers:item.answers||{},dayNotes:item.dayNotes||{},completedDays:Array.isArray(item.completedDays)?item.completedDays:[],mockHistory:Array.isArray(item.mockHistory)?item.mockHistory:[]};
    } catch {}
    return {...DEFAULT};
  }
  const saved=restore();
  const state={view:'practice',part:1,topic:0,question:0,search:'',page:0,showSample:false,day:0,daySearch:'',timer:null,timerEnds:0,mockReview:null,recorder:null,recorded:new Map()};
  // Persist recordings in IndexedDB: blob URLs alone disappear on refresh.
  const AUDIO_DB='wordrush.speaking.audio.v1';
  let audioDBPromise=null;
  function audioDB() {
    if(!('indexedDB' in window))return Promise.reject(Error('IndexedDB unavailable'));
    if(audioDBPromise)return audioDBPromise;
    audioDBPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(AUDIO_DB,1);
      request.onupgradeneeded=()=>request.result.createObjectStore('clips',{keyPath:'key'});
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    }).catch(error=>{audioDBPromise=null;throw error;});
    return audioDBPromise;
  }
  async function rememberAudio(key,blob) {
    const db=await audioDB();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('clips','readwrite');
      transaction.objectStore('clips').put({key,blob,savedAt:Date.now()});
      transaction.oncomplete=resolve;
      transaction.onerror=()=>reject(transaction.error);
    });
  }
  async function restoreAudio() {
    try{
      const db=await audioDB();
      const records=await new Promise((resolve,reject)=>{
        const request=db.transaction('clips','readonly').objectStore('clips').getAll();
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });
      for(const item of records){
        if(!item.blob?.size||state.recorded.has(item.key))continue;
        state.recorded.set(item.key,{blob:item.blob,url:URL.createObjectURL(item.blob)});
        const slot=$$('[data-audio-slot]').find(el=>el.dataset.audioSlot===item.key);
        if(slot)slot.outerHTML=audioMarkup(item.key);
      }
    }catch { /* Recorded clips still have a manual-download fallback. */ }
  }
  let speakingBank=null,thirtyBank=null,bankPromise=null,thirtyPromise=null,toastTimer=null;
  const counts={part1:{topics:0,questions:0},part2:{topics:0,questions:0},part3:{topics:0,questions:0}};

  // Exact topic names from the original Part 1 and Part 2 question collections.
  // Each day of the 30-topic collocation bank has appropriate speaking tasks.
  const DAY_TOPIC_PAIRS = [
    ['Work or Studies','Interesting lesson'],
    ['Computers / Laptops / Tablets','Technology other than a phone'],
    ['Sleeping','Article about a health problem'],
    ['Rubbish & Recycling','Environmental law'],
    ['Work or Studies','Perfect job'],
    ['Hometown','Family member you are proud of'],
    ['Gifts','Child who likes drawing'],
    ['Social Media','Person you follow on social media'],
    ['Driving / Cars','Trip by vehicle'],
    ['Hometown','Interesting place on holiday'],
    ['Food / Meals','Least favourite food'],
    ['Sports','Live sports event'],
    ['Politeness','Rule at school'],
    ['Secondary School','Environmental law'],
    ['Shopping','Saved money to buy something'],
    ['Advertisements','Advertisement'],
    ['Websites','Local news'],
    ['Music','Favourite song'],
    ['Hometown','Person who learns languages easily'],
    ['Pets','Story with animals'],
    ['Hometown','City'],
    ['Accommodation / Home','House or apartment you would like to live in'],
    ['Science','Invention'],
    ['Conversations & Communication','Interesting discussion with friends'],
    ['Friends','Childhood friend'],
    ['Hobbies & Free time','Competition'],
    ['Shopping','Shop you often visit'],
    ['Art / Drawing','Favourite song'],
    ['Reading','Person who learns languages easily'],
    ['Trying New Things','Successful business person']
  ];

  const panels = {
    practice:{title:'Speaking Practice — Coming Soon',desc:'The Part 1–3 practice workspace will be available soon.'},
    day:{title:'30-Day Speaking',desc:'30 original speaking topics, 1,500 collocations, matching practice questions and daily progress.'},
    mock:{title:'Speaking Mock',desc:'Random Part 1 topic, Part 2 cue card and its related Part 3 questions from the same question bank.'}
  };

  function persist() {
    try { localStorage.setItem(KEY,JSON.stringify(saved)); } catch { toast('Xotirada joy yetarli emas.'); }
  }
  function toast(message) {
    const el=$('#spToast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.classList.remove('show'),2900);
  }
  function loadQuestions() {
    if(speakingBank)return Promise.resolve(speakingBank);
    if(bankPromise)return bankPromise;
    bankPromise=fetch('./speaking-chunks.json?rev='+CONTENT_REV,{cache:'no-cache'}).then(response=>{
      if(!response.ok)throw Error('Savollar ro‘yxati yuklanmadi');
      return response.json();
    }).then(async manifest=>{
      const files=[...manifest.part1,...manifest.part2,...manifest.part3];
      const chunks=await Promise.all(files.map(async file=>{
        const response=await fetch('./'+file+'?rev='+CONTENT_REV,{cache:'no-cache'});
        if(!response.ok)throw Error('Fayl yuklanmadi: '+file);
        return response.json();
      }));
      let n=0;const result={};
      for(const part of ['part1','part2','part3'])result[part]=manifest[part].flatMap(()=>chunks[n++]);
      for(const part of ['part1','part2','part3']) {
        const groups=result[part];
        if(!groups.length||groups.some(g=>!g.questions?.length))throw Error('Speaking bank incomplete: '+part);
        counts[part]={topics:groups.length,questions:groups.reduce((x,g)=>x+g.questions.length,0)};
      }
      speakingBank=result;return result;
    }).catch(error=>{bankPromise=null;throw error;});
    return bankPromise;
  }
  function loadThirty() {
    if(thirtyBank)return Promise.resolve(thirtyBank);
    if(thirtyPromise)return thirtyPromise;
    thirtyPromise=fetch('./speaking-30-topics.json?rev='+CONTENT_REV,{cache:'no-cache'}).then(response=>{
      if(!response.ok)throw Error('30 topiclik material yuklanmadi');
      return response.json();
    }).then(data=>{
      if(!Array.isArray(data.topics)||data.topics.length!==30)throw Error('30 topiclik bank to‘liq emas');
      thirtyBank=data.topics;return thirtyBank;
    }).catch(error=>{thirtyPromise=null;throw error;});
    return thirtyPromise;
  }
  function setPage(page) {
    const selected=panels[page]?page:'practice';
    state.view=selected;stopTimer();
    $$('[data-speaking-nav]').forEach(link=>{
      link.classList.toggle('active',link.dataset.speakingNav===selected);
      if(link.dataset.speakingNav===selected)link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    document.title='WORDRUSH — '+panels[selected].title;
    const module=$('#spContent');
    if(selected==='practice'){
      module.innerHTML='<section class="sp-panel sp-coming-soon" style="max-width:800px;margin:34px auto;padding:56px 32px;text-align:center"><span class="section-kicker">WORDRUSH / SPEAKING STUDIO</span><div style="font-size:64px;margin:20px 0">🎙</div><h2 style="font-size:clamp(34px,5vw,56px);margin:0 0 14px">COMING SOON</h2><p style="max-width:550px;margin:0 auto 26px;line-height:1.7">Speaking Practice (Part 1, Part 2, Part 3) hozircha yopiq. Tez orada ishga tushadi. Hozir 1-Day, 30-Day Speaking va Speaking Mock bo‘limlaridan foydalanishingiz mumkin.</p><div class="sp-actions" style="justify-content:center"><a href="./oneday.html" class="sp-primary">1-Day Speaking ↗</a><a href="#day" class="sp-soft">30-Day Speaking ↗</a><a href="#mock" class="sp-soft">Speaking Mock ↗</a></div></section>';
      return;
    }
    module.innerHTML='<div class="sp-loading"><span class="sp-spin"></span> Ma’lumotlar yuklanmoqda…</div>';
    const promise=selected==='day'?Promise.all([loadQuestions(),loadThirty()]):loadQuestions();
    promise.then(()=>{if(state.view===selected)render();}).catch(error=>{
      if(state.view!==selected)return;
      module.innerHTML='<div class="sp-error"><h2>Speaking fayllarini yuklab bo‘lmadi.</h2><p>'+esc(error.message)+'</p><button type="button" data-sp-action="retry" class="sp-primary">Qayta urinish ↗</button></div>';
    });
  }
  function render() {
    // The original practice UI must remain inaccessible until launch.
    if(state.view==='practice')return;
    if(state.view==='day'&&speakingBank&&thirtyBank)renderDay();
    else if(state.view==='mock'&&speakingBank)renderMock();
  }
  const tag=(caption,value)=>'<span class="sp-tag">'+esc(caption)+' <strong>'+esc(value)+'</strong></span>';
  const title=(kicker,heading,description,aside='')=>'<div class="sp-heading"><div><span class="section-kicker">'+esc(kicker)+'</span><h2>'+esc(heading)+'</h2><p>'+esc(description)+'</p></div>'+(aside?'<div class="sp-heading-aside">'+aside+'</div>':'')+'</div>';
  const answerMarkup = value => esc(value).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n\n/g,'</p><p>').replace(/\n/g,' ');
  function collocations(question) {
    if(!question?.cards?.length)return '<p class="sp-muted">Hozircha collocation yo‘q.</p>';
    return '<div class="sp-terms">'+question.cards.map((c,i)=>
      '<div class="sp-term"><span>'+String(i+1).padStart(2,'0')+'</span><div><strong>'+esc(c.w)+'</strong><small>'+esc(c.u||'Tarjima kiritilmagan')+'</small>'+(c.e?'<p>'+esc(c.e)+'</p>':'')+'</div><button type="button" data-sp-action="speak" data-phrase="'+esc(c.w)+'" aria-label="Talaffuz: '+esc(c.w)+'">🔊</button></div>'
    ).join('')+'</div>';
  }
  function speak(text) {
    if(!('speechSynthesis' in window)){toast('Bu brauzerda talaffuz ishlamaydi.');return;}
    speechSynthesis.cancel();const voice=new SpeechSynthesisUtterance(text);voice.lang='en-US';voice.rate=.86;speechSynthesis.speak(voice);
  }
  function currentGroup() {
    const groups=speakingBank['part'+state.part];
    state.topic=Math.max(0,Math.min(state.topic,groups.length-1));
    const group=groups[state.topic];
    state.question=Math.max(0,Math.min(state.question,group.questions.length-1));
    const question=group.questions[state.question];
    return {groups,group,question};
  }
  function switchPart(part) {
    if(![1,2,3].includes(part))return;
    savePracticeCurrent();state.part=part;state.topic=0;state.question=0;state.search='';state.page=0;state.showSample=false;stopTimer();renderPractice();
  }
  function selectQuestion(topic,index,keepSearch=false) {
    savePracticeCurrent();state.topic=topic;state.question=index;state.showSample=false;
    if(!keepSearch){state.search='';state.page=Math.floor(index/12);}
    stopTimer();renderPractice();
  }
  function moveQuestion(step) {
    const groups=speakingBank['part'+state.part],group=groups[state.topic];
    let topic=state.topic,index=state.question+step;
    if(index<0){topic=(topic+groups.length-1)%groups.length;index=groups[topic].questions.length-1;}
    if(index>=group.questions.length){topic=(topic+1)%groups.length;index=0;}
    selectQuestion(topic,index);
  }
  function randomPracticeQuestion() {
    const groups=speakingBank['part'+state.part];
    const options=groups.flatMap((g,topic)=>g.questions.map((question,index)=>({topic,index,id:question.id})));
    const current=currentGroup().question.id;
    const choices=options.filter(item=>item.id!==current);
    const selected=random(choices.length?choices:options);
    selectQuestion(selected.topic,selected.index);
  }
  function practiceAnswer(question) { return saved.answers[question?.id]?.text||''; }
  function savePracticeCurrent() {
    const field=$('#spPracticeAnswer');if(!field||!speakingBank)return;
    const {question}=currentGroup();if(!question)return;
    const text=field.value.trim().slice(0,4000);
    if(text)saved.answers[question.id]={text,savedAt:new Date().toISOString(),question:question.q};
    else delete saved.answers[question.id];
    persist();
  }
  function practiceTimer(part,seconds) {return '<button class="sp-soft" type="button" data-sp-action="timer" data-seconds="'+seconds+'">⏱ '+(part===2&&seconds===60?'1 min tayyorgarlik':part===1?'25 s javob':part===2?'2 min 15 s javob':'40 s javob')+'</button>';}
  function stopTimer() {
    if(state.timer)clearInterval(state.timer);
    state.timer=null;state.timerEnds=0;
  }
  function startTimer(seconds) {
    stopTimer();state.timerEnds=Date.now()+seconds*1000;
    function tick(){
      const remaining=Math.max(0,Math.ceil((state.timerEnds-Date.now())/1000));
      const el=$('#spTimer');if(el)el.textContent=remaining?Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0'):'Vaqt tugadi';
      if(!remaining)stopTimer();
    }
    tick();state.timer=setInterval(tick,250);
  }
  function renderPractice() {
    const {groups,group,question}=currentGroup();
    const search=norm(state.search);
    const found=[];
    if(search){groups.forEach((g,ti)=>g.questions.forEach((q,qi)=>{if(norm(g.title+' '+q.q+' '+(q.topic||'')).includes(search))found.push({ti,qi,q,topic:g.title});}));}
    else group.questions.forEach((q,qi)=>found.push({ti:state.topic,qi,q,topic:group.title}));
    const pages=Math.max(1,Math.ceil(found.length/12));state.page=Math.min(state.page,pages-1);
    const results=found.slice(state.page*12,state.page*12+12),part=state.part;
    const count=counts['part'+part];
    let html=title('01 / FULL QUESTION BANK','Speaking Practice','VIVID IELTS manbasidagi barcha original savollar, namunaviy javoblar va tarjimali collocationlar.',tag('SAVOLLAR',count.questions)+tag('TOPICLAR',count.topics));
    html+='<div class="sp-parts" role="tablist" aria-label="Speaking Parts">'+[1,2,3].map(p=>'<button type="button" role="tab" aria-selected="'+(p===part)+'" data-sp-action="part" data-part="'+p+'" class="'+(p===part?'active':'')+'"><span>PART 0'+p+'</span><strong>'+counts['part'+p].questions+' savol</strong><small>'+(p===1?'Interview':p===2?'Cue cards':'Discussion')+'</small></button>').join('')+'</div><div class="sp-random-row"><span>Part '+part+' savollari uchun baraban</span><button type="button" data-sp-action="random-practice" class="sp-primary">✧ Random savol aylantirish ↻</button></div>';
    html+='<div class="sp-practice-layout"><aside class="sp-panel sp-topic-panel"><div class="sp-panel-title"><h3>Topiclar</h3><span>'+groups.length+'</span></div><div class="sp-topic-items">'+groups.map((g,i)=>'<button type="button" data-sp-action="topic" data-index="'+i+'" class="'+(i===state.topic?'active':'')+'"><span>'+esc(g.title)+'</span><small>'+g.questions.length+'</small></button>').join('')+'</div></aside>';
    html+='<div class="sp-practice-work"><section class="sp-panel sp-question-panel"><div class="sp-panel-title"><h3>Part '+part+' savollar</h3><span>'+found.length+'</span></div><label class="sp-input-label">Mavzu yoki savolni qidirish<input id="spQuestionSearch" type="search" autocomplete="off" placeholder="E.g. city, school, science..." value="'+esc(state.search)+'"></label><div class="sp-question-items">'+(results.length?results.map(x=>'<button type="button" data-sp-action="question" data-topic="'+x.ti+'" data-index="'+x.qi+'" class="'+(x.q.id===question.id?'active':'')+'"><small>'+esc(x.topic)+'</small><strong>'+esc(x.q.q)+'</strong></button>').join(''):'<p class="sp-muted">Bu so‘rov uchun savol topilmadi.</p>')+'</div><div class="sp-pager"><button type="button" data-sp-action="list-prev" '+(state.page===0?'disabled':'')+'>← Oldingi</button><small>'+String(state.page+1)+' / '+pages+'</small><button type="button" data-sp-action="list-next" '+(state.page===pages-1?'disabled':'')+'>Keyingi →</button></div></section>';
    html+='<section class="sp-panel sp-answer-panel"><div class="sp-badges">'+tag('PART',part)+tag('TOPIC',question.topic||group.title)+tag('VAQT',part===1?'25 s':part===2?'2:15':'40 s')+'</div><h2>'+esc(question.q)+'</h2><div class="sp-question-nav"><button type="button" data-sp-action="q-prev">← Oldingi savol</button><span>'+(state.question+1)+' / '+group.questions.length+'</span><button type="button" data-sp-action="q-next">Keyingi savol →</button></div>';
    html+='<div class="sp-ideas"><h3>Javob uchun g‘oyalar</h3><ol>'+((question.ideas||[]).slice(0,2).map(idea=>'<li>'+esc(idea)+'</li>').join('')||'<li>O‘z tajribangizdan misol keltiring.</li>')+'</ol></div>';
    html+='<button type="button" class="sp-toggle" data-sp-action="sample" aria-expanded="'+state.showSample+'">'+(state.showSample?'Sample answerni yashirish ↑':'Sample answerni ochish ↓')+'</button>';
    if(state.showSample)html+='<div class="sp-sample"><div class="sp-panel-title"><h3>Sample answer</h3><span>'+esc(question.words||'')+' words</span></div><p>'+answerMarkup(question.answer)+'</p><p class="sp-muted">Namuna fikrlari va iboralardan foydalaning, lekin javobingizni o‘z hayotingizga moslang.</p><h3>Javobdan olingan collocationlar</h3>'+collocations(question)+'</div>';
    html+='<div class="sp-write"><h3>Endi siz javob bering</h3><div class="sp-timer-row">'+practiceTimer(part,part===1?25:part===2?135:40)+(part===2?practiceTimer(2,60):'')+'<strong id="spTimer" aria-live="off"></strong></div><label for="spPracticeAnswer">Yozma javobingiz</label><textarea id="spPracticeAnswer" rows="6" maxlength="4000" placeholder="I would say...">'+esc(practiceAnswer(question))+'</textarea><div class="sp-actions"><button type="button" class="sp-primary" data-sp-action="save-answer">Javobni saqlash ✓</button><button type="button" class="sp-soft" data-sp-action="record" data-rec-key="practice:'+esc(question.id)+'">🎙 Audio yozish</button></div>'+audioMarkup('practice:'+question.id)+'</div>';
    html+='</section></div></div>';
    $('#spContent').innerHTML=html;
  }
  function audioMarkup(key) {
    const entry=state.recorded.get(key);
    return '<div class="sp-audio-slot" data-audio-slot="'+esc(key)+'">'+(entry?'<audio controls preload="metadata" src="'+esc(entry.url)+'"></audio><a class="sp-soft sp-download" href="'+esc(entry.url)+'" download="wordrush-speaking-'+Date.now()+'.webm">↓ Audio yuklab olish</a>':'<p>Audio shu brauzerda saqlanadi. Nusxasini yuklab olish ham mumkin.</p>')+'</div>';
  }
  async function toggleRecord(key) {
    if(state.recorder) {
      state.recorder.recorder.stop();return;
    }
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('Brauzeringiz ovoz yozishni qo‘llab-quvvatlamaydi.');return;}
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const recorder=new MediaRecorder(stream);
      const chunks=[];
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=()=>{
        for(const track of stream.getTracks())track.stop();
        const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
        const prior=state.recorded.get(key);if(prior)URL.revokeObjectURL(prior.url);
        if(blob.size){
          state.recorded.set(key,{blob,url:URL.createObjectURL(blob)});
          rememberAudio(key,blob).catch(()=>toast('Audio saqlanmadi; hozir yuklab oling.'));
        }
        state.recorder=null;
        const slot=$$('[data-audio-slot]').find(item=>item.dataset.audioSlot===key);
        if(slot)slot.outerHTML=audioMarkup(key);
        $$('[data-sp-action="record"]').forEach(button=>button.textContent='🎙 Audio yozish');
        toast('Audio tayyor. Nusxasini ham yuklab olishingiz mumkin.');
      };
      recorder.start();
      state.recorder={recorder,key,stream};
      $$('[data-sp-action="record"]').forEach(button=>button.textContent='■ Yozishni tugatish');
      toast('Mikrofon orqali yozish boshlandi.');
    } catch {toast('Mikrofonga ruxsat berilmadi yoki qurilma topilmadi.');}
  }
  function stopRecording() { if(state.recorder?.recorder.state==='recording')state.recorder.recorder.stop(); }

  function dayQuestions(index) {
    const [p1Title,p2Title]=DAY_TOPIC_PAIRS[index];
    const one=speakingBank.part1.find(g=>g.title===p1Title)||speakingBank.part1[0];
    const two=speakingBank.part2.find(g=>g.title===p2Title)||speakingBank.part2[0];
    const three=speakingBank.part3[two.relatedPart3]||speakingBank.part3[0];
    return {one,two,three,items:[
      ...one.questions.slice(0,3).map(q=>({...q,part:1,topic:one.title})),
      ...two.questions.slice(0,1).map(q=>({...q,part:2,topic:two.title})),
      ...three.questions.slice(0,3).map(q=>({...q,part:3,topic:three.title}))
    ]};
  }
  function dayCompleted(topic) {return saved.completedDays.includes(topic.id);}
  function renderDay() {
    const selected=thirtyBank[state.day]||thirtyBank[0],complete=dayCompleted(selected),parts=dayQuestions(state.day);
    const filtered=selected.entries.filter(e=>norm(e.term+' '+e.uz).includes(norm(state.daySearch)));
    const done=saved.completedDays.filter(id=>thirtyBank.some(x=>x.id===id)).length;
    let html=title('02 / DAILY SPEAKING','30-Day Speaking','VIVID IELTS’dagi 30 ta to‘liq speaking mavzusi. Har kuni bitta mavzu, savollar, iboralar va mustaqil javoblar.',tag('PROGRESS',done+' / 30')+tag('COLLOCATIONS',1500));
    html+='<div class="sp-day-progress"><div><strong>'+done+'</strong> / 30 KUN BAJARILGAN</div><div class="sp-track"><span style="width:'+(done/30*100)+'%"></span></div><small>O‘rganish jarayoningiz shu brauzerda saqlanadi.</small></div>';
    html+='<div class="sp-day-layout"><aside class="sp-panel sp-day-index"><div class="sp-panel-title"><h3>30 kunlik reja</h3><span>30 DAY</span></div><div class="sp-day-grid">'+thirtyBank.map((topic,i)=>'<button type="button" data-sp-action="day-open" data-index="'+i+'" class="'+(i===state.day?'active ':'')+(dayCompleted(topic)?'completed':'')+'"><small>DAY '+String(i+1).padStart(2,'0')+'</small><strong>'+esc(topic.title)+'</strong><span>'+(dayCompleted(topic)?'✓':'↗')+'</span></button>').join('')+'</div></aside>';
    html+='<div class="sp-day-work"><section class="sp-panel sp-day-focus"><div class="sp-badges">'+tag('DAY',String(state.day+1).padStart(2,'0'))+tag('TOPIC',selected.title)+tag('WORDS',selected.entries.length)+'</div><h2>'+esc(selected.title)+'</h2><p>Bugungi vazifa: quyidagi Part 1, Part 2 va Part 3 savollariga ovoz chiqarib javob bering, so‘ng mavzuga oid iboralarni o‘z gaplaringizda ishlating.</p>';
    html+='<div class="sp-day-stats"><div><strong>03</strong><small>PART 1 QUESTIONS</small></div><div><strong>01</strong><small>PART 2 CUE CARD</small></div><div><strong>03</strong><small>PART 3 QUESTIONS</small></div><div><strong>'+selected.entries.length+'</strong><small>COLLOCATIONS</small></div></div>';
    html+='<div class="sp-actions"><button class="sp-primary" type="button" data-sp-action="day-complete">'+(complete?'✓ Kun bajarildi · Belgini olib tashlash':'✓ Bugungi kunni tugatdim')+'</button><button class="sp-soft" type="button" data-sp-action="day-tasks">Bugungi 7 savolni ko‘rish ↓</button></div></section>';
    html+='<section class="sp-panel" id="spDayTasks"><div class="sp-panel-title"><h3>Bugungi Speaking savollari</h3><span>7 TASKS</span></div><div class="sp-day-tasks">'+parts.items.map((q,i)=>
      '<details class="sp-task"><summary><span>PART '+q.part+' · '+esc(q.topic)+'</span><strong>'+(i+1)+'. '+esc(q.q)+'</strong></summary><div><p class="sp-muted">Namuna javob — fikrni o‘zingizning tajribangiz bilan boyiting.</p><p>'+answerMarkup(q.answer)+'</p><div class="sp-ideas"><strong>2 ta g‘oya</strong><ol>'+((q.ideas||[]).slice(0,2).map(s=>'<li>'+esc(s)+'</li>').join(''))+'</ol></div></div></details>'
    ).join('')+'</div></section>';
    html+='<section class="sp-panel sp-collocation-bank"><div class="sp-panel-title"><h3>Topic collocations</h3><span>'+filtered.length+' / '+selected.entries.length+'</span></div><p class="sp-muted">Tarjima va mashq uchun savollar. Hozircha bu iboralar uchun 7 ta o‘yin qo‘shilmagan.</p><label class="sp-input-label">Ibora qidirish<input id="spDaySearch" type="search" autocomplete="off" placeholder="English / Uzbek..." value="'+esc(state.daySearch)+'"></label>';
    html+='<div class="sp-day-phrases">'+(filtered.length?filtered.map((entry,i)=>
      '<details class="sp-phrase"><summary><span class="sp-phrase-number">'+String(i+1).padStart(2,'0')+'</span><strong>'+esc(entry.term)+'</strong><span class="sp-phrase-arrow">⌄</span></summary><div><p><b>O‘zbekcha:</b> '+esc(entry.uz)+'</p>'+(entry.prompts?.[0]?'<p><b>Practice:</b> '+esc(entry.prompts[0])+'</p>':'')+'<button class="sp-soft" type="button" data-sp-action="speak" data-phrase="'+esc(entry.term)+'">🔊 Listen</button></div></details>'
    ).join(''):'<p class="sp-muted">Bu so‘zga mos ibora topilmadi.</p>')+'</div></section>';
    html+='<section class="sp-panel sp-day-notes"><div class="sp-panel-title"><h3>Shaxsiy speaking notes</h3><span>LOCAL SAVE</span></div><p class="sp-muted">Bugungi speaking javobingizdagi yaxshi jumlalar yoki xatolaringizni yozib boring.</p><textarea id="spDayNotes" rows="5" maxlength="9000" placeholder="Today I practised...">'+esc(saved.dayNotes[selected.id]||'')+'</textarea><button class="sp-primary" type="button" data-sp-action="day-notes-save">Eslatmalarni saqlash ✓</button></section>';
    html+='</div></div>';$('#spContent').innerHTML=html;
  }
  function makeMock() {
    if(!speakingBank)return;
    stopTimer();
    const existing=saved.mockDraft;
    if(existing&&!existing.finished&&existing.answers?.some(x=>String(x||'').trim())&&!confirm('Avvalgi tugallanmagan mock javoblari o‘rniga yangisini boshlaysizmi?'))return;
    const one=random(speakingBank.part1.filter(g=>g.questions.length>=4));
    const two=random(speakingBank.part2.filter(g=>speakingBank.part3[g.relatedPart3]?.questions.length>=4));
    const three=speakingBank.part3[two.relatedPart3]||speakingBank.part3[0];
    const questions=[
      ...shuffle(one.questions).slice(0,4).map(q=>({id:q.id,part:1,topic:one.title,q:q.q})),
      ...two.questions.slice(0,1).map(q=>({id:q.id,part:2,topic:two.title,q:q.q})),
      ...shuffle(three.questions).slice(0,4).map(q=>({id:q.id,part:3,topic:three.title,q:q.q}))
    ];
    saved.mockDraft={id:'mock_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),startedAt:new Date().toISOString(),questions,answers:questions.map(()=>''),current:0,topics:{part1:one.title,part2:two.title,part3:three.title},finished:false};
    state.mockReview=null;persist();renderMock();
  }
  function mockCurrent() {return saved.mockDraft;}
  function mockPersistField() {
    const draft=mockCurrent(),field=$('#spMockAnswer');
    if(draft&&field&&!draft.finished){draft.answers[draft.current]=field.value.slice(0,4000);persist();}
  }
  function mockAdvance(direction) {
    const mock=mockCurrent();if(!mock||mock.finished)return;
    if(state.recorder){toast('Oldin audio yozishni to‘xtating.');return;}
    mockPersistField();
    const key='mock:'+mock.id+':'+mock.current;
    if(direction>0&&!mock.answers[mock.current].trim()&&!state.recorded.has(key)){toast('Keyingi savol uchun avval matn yoki audio javob bering.');return;}
    stopTimer();
    mock.current=Math.min(mock.questions.length-1,Math.max(0,mock.current+direction));persist();renderMock();
  }
  function finishMock() {
    const mock=mockCurrent();if(!mock||mock.finished)return;
    mockPersistField();
    const count=mock.answers.filter((s,i)=>s.trim()||state.recorded.has('mock:'+mock.id+':'+i)).length;
    if(count!==mock.questions.length){toast('Avval barcha '+mock.questions.length+' ta savolga javob bering.');return;}
    stopTimer();
    mock.finished=true;mock.completedAt=new Date().toISOString();
    saved.mockHistory.unshift(JSON.parse(JSON.stringify(mock)));
    saved.mockHistory=saved.mockHistory.slice(0,30);
    state.mockReview=mock;persist();renderMock();
  }
  function mockSummary(mock) {
    const answered=mock.answers.filter((s,i)=>s.trim()||state.recorded.has('mock:'+mock.id+':'+i)).length;
    let html=title('03 / SPEAKING MOCK','Session review','Mock tugadi. Savollar va javoblaringizni ko‘rib chiqing, keyin zaif tomonlaringizni belgilang.',tag('ANSWERED',answered+' / '+mock.questions.length));
    html+='<div class="sp-mock-summary"><div class="sp-mock-big">✓<span>COMPLETED</span></div><div><h3>Good work. Every answer counts.</h3><p>Bu speaking mashqi. Audio to‘liq baholanmasdan rasmiy IELTS bandini hisoblash ishonchli emas.</p><div class="sp-actions"><button class="sp-primary" type="button" data-sp-action="mock-download" data-mock-id="'+esc(mock.id)+'">↓ Javoblarimni TXT yuklash</button><button class="sp-soft" type="button" data-sp-action="mock-new">↻ Yangi random mock</button></div></div></div>';
    html+='<section class="sp-panel"><div class="sp-panel-title"><h3>IELTS self-review checklist</h3><span>4 CRITERIA</span></div><div class="sp-rubric">'+[
      ['Fluency & Coherence','Fikrlarni to‘xtamasdan, mantiqiy bog‘lab aytdimmi?'],
      ['Lexical Resource','Mavzuga mos so‘z va collocationlardan foydalandimmi?'],
      ['Grammatical Range & Accuracy','Murakkab gaplarni aniq va to‘g‘ri qurdimmi?'],
      ['Pronunciation','Urg‘u, talaffuz va intonatsiyam tushunarlimi?']
    ].map(([t,d])=>'<label><input type="checkbox"><span><b>'+esc(t)+'</b><small>'+esc(d)+'</small></span></label>').join('')+'</div></section>';
    html+='<section class="sp-panel"><div class="sp-panel-title"><h3>Part 1–3 savollar va javoblar</h3><span>'+mock.questions.length+' QUESTIONS</span></div>'+mock.questions.map((q,i)=>{
      const audio=state.recorded.get('mock:'+mock.id+':'+i);
      return '<div class="sp-review-item"><span>PART '+q.part+' · '+esc(q.topic)+'</span><h4>'+(i+1)+'. '+esc(q.q)+'</h4><p>'+esc(mock.answers[i]||'Yozma javob kiritilmagan. Audio yozilgan bo‘lishi mumkin.')+'</p>'+(audio?'<audio controls preload="metadata" src="'+esc(audio.url)+'"></audio>':'')+'</div>';
    }).join('')+'</section>';
    $('#spContent').innerHTML=html;
  }
  function renderMock() {
    const mock=mockCurrent();
    if(state.mockReview||mock?.finished){mockSummary(state.mockReview||mock);return;}
    if(!mock){
      let html=title('03 / MOCK SIMULATOR','Speaking Mock','Practice savollaridan har safar yangi 9 savolli to‘plam: Part 1 mavzusi, Part 2 cue card va unga mos Part 3 savollari.',tag('BANK',[1,2,3].reduce((n,p)=>n+counts['part'+p].questions,0)+' QUESTIONS'));
      html+='<section class="sp-mock-start"><div class="sp-mock-step"><span>01 / WARM-UP</span><b>Part 1</b><small>4 ta tasodifiy savol, bitta topic</small></div><div class="sp-mock-step"><span>02 / LONG TURN</span><b>Part 2</b><small>1 ta tasodifiy cue card</small></div><div class="sp-mock-step"><span>03 / DISCUSSION</span><b>Part 3</b><small>Part 2 bilan bog‘liq 4 ta savol</small></div><div class="sp-mock-start-bottom"><h3>Ready to speak?</h3><p>Taymer majburiy emas. Javobni yozish yoki mikrofonda aytish mumkin. Yakunda javoblar tarixda saqlanadi.</p><button class="sp-primary" type="button" data-sp-action="mock-new">Random mockni boshlash ↗</button></div></section>';
      if(saved.mockHistory.length)html+='<section class="sp-panel sp-history"><div class="sp-panel-title"><h3>Oldingi mocklar</h3><span>'+saved.mockHistory.length+'</span></div>'+saved.mockHistory.slice(0,12).map((item,i)=>'<button type="button" data-sp-action="mock-history" data-index="'+i+'"><span>Mock '+(i+1)+' · '+new Date(item.completedAt||item.startedAt).toLocaleDateString('uz-UZ')+'</span><strong>'+esc(item.topics?.part2||'Speaking')+'</strong><small>Ko‘rish ↗</small></button>').join('')+'</section>';
      $('#spContent').innerHTML=html;return;
    }
    const q=mock.questions[mock.current],number=mock.current+1,answered=mock.answers.filter((s,i)=>s.trim()||state.recorded.has('mock:'+mock.id+':'+i)).length;
    let html=title('03 / REAL SPEAKING PRACTICE','Speaking Mock','Savollar original Speaking Practice bankidan olindi. Javobingiz tayyor bo‘lgach keyingisiga o‘ting.',tag('QUESTION',number+' / '+mock.questions.length)+tag('ANSWERED',answered));
    html+='<div class="sp-mock-progress"><span style="width:'+(number/mock.questions.length*100)+'%"></span></div><div class="sp-mock-steps">'+[1,2,3].map(part=>'<span class="'+(part===q.part?'active':'')+'">PART '+part+'</span>').join('')+'</div>';
    html+='<section class="sp-panel sp-mock-question"><div class="sp-badges">'+tag('PART',q.part)+tag('TOPIC',q.topic)+'</div><span class="sp-q-position">QUESTION '+String(number).padStart(2,'0')+' / '+mock.questions.length+'</span><h2>'+esc(q.q)+'</h2>'+(q.part===2?'<p>1 daqiqa rejalashtirib, taxminan 2 daqiqa uzluksiz javob bering.</p>':'')+'<div class="sp-timer-row">'+(q.part===2?practiceTimer(2,60):'')+practiceTimer(q.part,q.part===1?25:q.part===2?135:40)+'<strong id="spTimer" aria-live="off"></strong></div></section>';
    html+='<section class="sp-panel sp-mock-answer"><label for="spMockAnswer">YOUR ANSWER · ENGLISH</label><textarea id="spMockAnswer" rows="8" maxlength="4000" placeholder="I think...">'+esc(mock.answers[mock.current])+'</textarea><div class="sp-actions"><button class="sp-soft" type="button" data-sp-action="record" data-rec-key="mock:'+esc(mock.id)+':'+mock.current+'">🎙 Audio yozish</button><button class="sp-soft" type="button" data-sp-action="mock-save">✓ Draft saqlash</button></div>'+audioMarkup('mock:'+mock.id+':'+mock.current)+'</section>';
    html+='<div class="sp-mock-controls"><button type="button" class="sp-soft" data-sp-action="mock-prev" '+(mock.current===0?'disabled':'')+'>← Oldingi savol</button><span>'+answered+' / '+mock.questions.length+' javob tayyor</span><button type="button" class="sp-primary" data-sp-action="'+(mock.current===mock.questions.length-1?'mock-finish':'mock-next')+'">'+(mock.current===mock.questions.length-1?'Mockni yakunlash ✓':'Keyingi savol →')+'</button></div>';
    $('#spContent').innerHTML=html;
  }
  function downloadMock(id) {
    const mock=[saved.mockDraft,...saved.mockHistory].find(x=>x?.id===id)||state.mockReview;
    if(!mock)return;
    const lines=['WORDRUSH — IELTS SPEAKING MOCK',new Date(mock.startedAt).toLocaleString('uz-UZ'),''];
    for(let i=0;i<mock.questions.length;i++){
      const q=mock.questions[i];lines.push('PART '+q.part+' — '+q.topic,(i+1)+'. '+q.q,'Answer: '+(mock.answers[i]||'[No written answer]'),'');
    }
    const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='wordrush-speaking-mock-'+id+'.txt';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.addEventListener('click', event=>{
    const button=event.target.closest('[data-sp-action]');if(!button)return;
    const action=button.dataset.spAction;
    if(state.recorder&&!['record','speak'].includes(action)){toast('Oldin audio yozishni to‘xtating.');return;}
    switch(action) {
      case 'retry':setPage(state.view);break;
      case 'part':switchPart(Number(button.dataset.part));break;
      case 'topic':selectQuestion(Number(button.dataset.index),0);break;
      case 'question':selectQuestion(Number(button.dataset.topic),Number(button.dataset.index),Boolean(state.search));break;
      case 'q-prev':moveQuestion(-1);break;
      case 'q-next':moveQuestion(1);break;
      case 'random-practice':randomPracticeQuestion();break;
      case 'list-prev':state.page--;renderPractice();break;
      case 'list-next':state.page++;renderPractice();break;
      case 'sample':state.showSample=!state.showSample;savePracticeCurrent();renderPractice();break;
      case 'save-answer':savePracticeCurrent();toast('Speaking javobingiz saqlandi.');break;
      case 'timer':startTimer(Number(button.dataset.seconds));break;
      case 'speak':speak(button.dataset.phrase||'');break;
      case 'record':toggleRecord(button.dataset.recKey);break;
      case 'day-open':state.day=Number(button.dataset.index);state.daySearch='';renderDay();break;
      case 'day-complete':{
        const id=thirtyBank[state.day].id;const i=saved.completedDays.indexOf(id);
        if(i>=0)saved.completedDays.splice(i,1);else saved.completedDays.push(id);
        persist();renderDay();break;
      }
      case 'day-notes-save':saved.dayNotes[thirtyBank[state.day].id]=$('#spDayNotes').value.slice(0,9000);persist();toast('Kunlik notes saqlandi.');break;
      case 'day-tasks':$('#spDayTasks')?.scrollIntoView({behavior:'smooth',block:'start'});break;
      case 'mock-new':makeMock();break;
      case 'mock-prev':mockAdvance(-1);break;
      case 'mock-next':mockAdvance(1);break;
      case 'mock-save':mockPersistField();toast('Mock javobi saqlandi.');break;
      case 'mock-finish':finishMock();break;
      case 'mock-history':state.mockReview=saved.mockHistory[Number(button.dataset.index)];renderMock();break;
      case 'mock-download':downloadMock(button.dataset.mockId);break;
    }
  });
  document.addEventListener('input',event=>{
    const el=event.target;
    if(el.id==='spQuestionSearch'){
      const pos=el.selectionStart??el.value.length;
      state.search=el.value;state.page=0;renderPractice();const replacement=$('#spQuestionSearch');replacement?.focus();replacement?.setSelectionRange(pos,pos);
    }
    if(el.id==='spDaySearch'){
      const pos=el.selectionStart??el.value.length;
      state.daySearch=el.value;renderDay();const replacement=$('#spDaySearch');replacement?.focus();replacement?.setSelectionRange(pos,pos);
    }
    if(el.id==='spPracticeAnswer')savePracticeCurrent();
    if(el.id==='spMockAnswer')mockPersistField();
    if(el.id==='spDayNotes') {saved.dayNotes[thirtyBank[state.day].id]=el.value.slice(0,9000);persist();}
  });
  window.addEventListener('hashchange',()=>setPage(location.hash.slice(1)));
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.recorder)stopRecording();});
  setPage(location.hash.slice(1));
  restoreAudio();
})();
