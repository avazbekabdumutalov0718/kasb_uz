/* WORDRUSH — local-first vocabulary games with a 1-Day collection. */
(() => {
  'use strict';
  const KEY = 'wordrush.v1.personal.words';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const html = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value || '').toLocaleLowerCase('en').replace(/[’‘]/g, "'").replace(/[.,!?;:]+$/,'').replace(/\s+/g, ' ').trim();
  const shuffle = items => [...items].map(item => ({item, rank:Math.random()})).sort((a,b)=>a.rank-b.rank).map(({item})=>item);
  const fresh = () => ({words:[], known:[], stats:{xp:0,correct:0,attempts:0,gamesPlayed:0,streak:0,bestStreak:0}});
  const DAY1=Array.isArray(window.WORDRUSH_DAY1)?window.WORDRUSH_DAY1:[];
  function load(){
    let result=fresh();
    try{const parsed=JSON.parse(localStorage.getItem(KEY));if(parsed&&Array.isArray(parsed.words))result={words:parsed.words.filter(w=>w&&typeof w.w==='string'&&typeof w.u==='string'),known:Array.isArray(parsed.known)?parsed.known:[],stats:{...result.stats,...parsed.stats}};}catch{}
    for(const seed of DAY1){const existing=result.words.find(w=>norm(w.w)===norm(seed.w));if(existing){existing.day='1-Day';existing.source=existing.source||seed.source;existing.d=existing.d||seed.d;existing.e=existing.e||seed.e;existing.g=seed.g;existing.ga=seed.ga;}else result.words.push({...seed});}
    return result;
  }
  const state=load();
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}renderDashboard();};
  let game=null;
  let study=null;
  let toastTimeout;
  const MODES={flash:{title:'Flashcards',label:'MEMORY MODE',intro:'Aylantiring, tarjimani eslang va bilganlaringizni belgilang.'},choice:{title:'Multiple Choice',label:'PRECISION MODE',intro:'Inglizcha so‘zning to‘g‘ri o‘zbekcha ma’nosini tanlang.'},match:{title:'Matching Pairs',label:'CONNECTION MODE',intro:'Inglizcha va o‘zbekcha juftliklarni toping.'},gap:{title:'Fill the Gap',label:'CONTEXT MODE',intro:'Gapdagi bo‘sh joyga mos inglizcha so‘zni yozing.'},rush:{title:'Word Rush',label:'SPEED RUN · 60 SECONDS',intro:'60 soniyada iloji boricha ko‘p to‘g‘ri javob toping.'},typing:{title:'Typing Race',label:'SPELLING MODE',intro:'Tarjimasiga qarab inglizcha so‘zni to‘g‘ri yozing.'},builder:{title:'Sentence Builder',label:'STRUCTURE MODE',intro:'Aralash so‘zlar yoki harflardan to‘g‘ri ibora tuzing.'}};

  function toast(message){const item=$('#toast');item.textContent=message;item.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>item.classList.remove('show'),2900);}
  function renderDashboard(){
    $('#statWords').textContent=state.words.length;
    $('#statMastered').textContent=state.known.filter(id=>state.words.some(w=>w.id===id)).length;
    $('#statPlayed').textContent=Math.max(0,Number(state.stats.gamesPlayed)||0);
    $('#statXp').textContent=Math.max(0,Number(state.stats.xp)||0);
    $('#bankTotal').textContent=state.words.length;
    $('#bankListCount').textContent=state.words.length+' items';
    const dayWords=state.words.filter(item=>item.day==='1-Day');
    const dayKnown=dayWords.filter(item=>state.known.includes(item.id)).length;
    $('#dayKnown').textContent=dayKnown;
    $('#dayKnownBar').style.width=(dayWords.length?dayKnown/dayWords.length*100:0)+'%';
    const area=$('#wordList');
    if(!state.words.length){area.innerHTML='<div class="empty-words"><div class="empty-glyph">Aa</div><h4>Nothing here. Yet.</h4><p>Add your first word to unlock all seven games. Every counter starts at zero.</p></div>';return;}
    area.innerHTML=state.words.map(item=>'<div class="word-entry"><div><b>'+html(item.w)+'</b> '+(item.day==='1-Day'?'<span class="day-word-tag">1-Day</span>':'')+'<small>'+html(item.u)+'</small>'+(item.d?'<p>'+html(item.d)+'</p>':'')+'</div><div class="entry-actions">'+(state.known.includes(item.id)?'<span class="entry-known" title="Mastered">✓</span>':'')+(item.day==='1-Day'?'':'<button class="delete-word" type="button" data-delete="'+html(item.id)+'" aria-label="Remove '+html(item.w)+'">✕</button>')+'</div></div>').join('');
    $$('[data-delete]',area).forEach(btn=>btn.addEventListener('click',()=>{const item=state.words.find(w=>w.id===btn.dataset.delete);if(!item||!confirm('“'+item.w+'” so‘zini ro‘yxatdan o‘chirasizmi?'))return;state.words=state.words.filter(w=>w.id!==item.id);state.known=state.known.filter(id=>id!==item.id);save();toast('So‘z o‘chirildi');}));
  }
  function addWord(w,u,d='',e='',silent=false){
    w=w.trim();u=u.trim();d=d.trim();e=e.trim();
    if(!w||!u){if(!silent)toast('Inglizcha so‘z va tarjima kerak.');return false;}
    if(state.words.some(item=>norm(item.w)===norm(w))){if(!silent)toast('Bu so‘z ro‘yxatda bor.');return false;}
    state.words.push({id:'w_'+Date.now()+'_'+Math.random().toString(36).slice(2,9),w,u,d,e});return true;
  }
  $('#wordForm').addEventListener('submit',event=>{event.preventDefault();const ok=addWord($('#wordEnglish').value,$('#wordUzbek').value,$('#wordDefinition').value,$('#wordExample').value);if(ok){$('#wordForm').reset();save();toast('So‘z saqlandi! Endi o‘yinlarni boshlash mumkin.');$('#wordEnglish').focus();}});
  $('#bulkAdd').addEventListener('click',()=>{const lines=$('#bulkInput').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let added=0;for(const line of lines){const parts=line.includes('|')?line.split('|'):line.split('\t');if(parts.length>=2&&addWord(...parts.slice(0,4).concat(['','','','']).slice(0,4).map(s=>s.trim()),true))added++;}if(added){save();$('#bulkInput').value='';toast(added+' ta yangi so‘z qo‘shildi.');}else toast('Yangi so‘z qo‘shilmadi. Format: English | Uzbek | Definition | Example');});
  $$('.side-nav a').forEach(link=>link.addEventListener('click',()=>{$$('.side-nav a').forEach(x=>x.classList.remove('active'));link.classList.add('active');}));
  $$('[data-play]').forEach(button=>button.addEventListener('click',()=>startGame(button.dataset.play)));
  $$('[data-learn]').forEach(button=>button.addEventListener('click',()=>startLearn(button.dataset.learn)));
  $('#dayLearn').addEventListener('click',()=>startLearn('day1'));
  $('#closeGame').addEventListener('click',closeGame);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&(game||study))closeGame();});

  function closeGame(){if(game?.timer)clearInterval(game.timer);game=null;study=null;$('#gameOverlay').hidden=true;document.body.style.overflow='';}
  function startGame(mode){
    if(!MODES[mode])return;
    closeGame();
    const overlay=$('#gameOverlay');overlay.hidden=false;document.body.style.overflow='hidden';
    const pool=shuffle(state.words);
    game={mode,pool,index:0,correct:0,attempts:0,time:60,timer:null,finished:false,flipped:false,pairs:null,matched:new Set(),selected:null,chosen:[],locked:false};
    if(pool.length===0)return gameEmpty('Your word bank is empty','Add your first word or phrase to unlock all seven WORDRUSH games. Your counters will remain at zero until you start.');
    if(['choice','rush','match'].includes(mode)&&new Set(pool.map(x=>norm(mode==='choice'?x.u:x.w))).size<2)return gameEmpty('Add at least 2 different words','This mode needs at least two distinct vocabulary entries to create useful options or matching pairs.');
    if(mode==='rush'){
      const currentGame=game;
      game.timer=setInterval(()=>{if(game!==currentGame||game.finished)return;game.time=Math.max(0,game.time-1);const clock=$('#rushTimer');if(clock){clock.textContent='⏱ '+game.time+' s';clock.classList.toggle('urgent',game.time<=10);}if(game.time===0)finishGame();},1000);
    }
    renderGame();
  }
  function gameEmpty(title,description){$('#gameContent').innerHTML='<div class="empty-game"><div class="empty-game-icon">✳</div><h2>'+html(title)+'</h2><p>'+html(description)+'</p><button type="button" class="btn" id="addFromGame">+ Add words to get started ↗</button></div>';$('#addFromGame').onclick=()=>{closeGame();location.hash='#wordbank';$('#wordEnglish').focus();};}
  function startLearn(mode){
    closeGame();
    const cards=state.words.filter(item=>item.day==='1-Day');
    $('#gameOverlay').hidden=false;document.body.style.overflow='hidden';
    if(!cards.length)return gameEmpty('1-Day is not ready','Day 1 vocabulary has not been loaded.');
    study={mode,cards,index:0,flipped:false};renderStudy();
  }
  function renderStudy(){
    if(!study)return;
    const {cards,index,flipped}=study;
    const word=cards[index],mastered=cards.filter(item=>state.known.includes(item.id)).length;
    const isKnown=state.known.includes(word.id),isFinal=index===cards.length-1;
    const context=study.mode==='day1'?'1-DAY COLLECTION':MODES[study.mode]?.title||'1-Day';
    const back=flipped;
    $('#gameContent').innerHTML='<div class="study-header"><div><div class="play-kicker">WORDRUSH / 1-DAY / '+html(context.toUpperCase())+'</div><h1 id="playTitle">O‘rganish <span>· 1-Day</span></h1><p>Inglizcha so‘zni ko‘ring, kartani aylantirib tarjima, ta’rif va misolni o‘qing.</p></div><div class="study-learned"><strong>'+mastered+'</strong> / '+cards.length+' <small>O‘RGANILGAN</small></div></div><div class="play-progress"><span style="width:'+(mastered/cards.length*100)+'%"></span></div><div class="study-workspace"><div class="study-card-column"><div class="study-indicator"><span>FLASHCARD '+(index+1)+' / '+cards.length+'</span><span>'+(isKnown?'✓ O‘rganilgan':'1-Day')+'</span></div><button class="study-flip-card'+(back?' turned':'')+'" id="studyFlip" type="button" aria-label="Kartani aylantirish"><span>'+(back?'O‘ZBEKCHA MA’NO · SIMPLE DEFINITION':'ENGLISH · WORD OR PHRASE')+'</span><strong>'+html(back?word.u:word.w)+'</strong>'+(back?'<p>'+html(word.d)+'</p><em>'+html(word.e)+'</em>':'<p>Tarjima, definition va misolni ko‘rish uchun bosing</p>')+'<small>↻ KARTANI AYLANTIRISH</small></button><div class="study-controls"><button id="studyPrevious" class="subtle-button" type="button" '+(index===0?'disabled':'')+'>← Oldingi</button><button id="studySpeak" class="subtle-button" type="button">🔊 Listen</button><button id="studyNext" class="subtle-button" type="button">'+(isFinal?'O‘yinlarga o‘tish →':'Keyingi →')+'</button></div><div class="study-mark"><button id="studyReview" class="subtle-button" type="button">↺ Takrorlayman</button><button id="studyKnown" class="action-button" type="button">'+(isKnown?'✓ O‘rganilgan':'✓ O‘rgandim')+'</button></div></div><aside class="study-side"><span class="section-kicker">DAY ONE COLLECTION</span><h3>84 ta so‘z.<br>7 ta o‘yin.</h3><p>Oldingi IELTS Vocabulary va Becoming an Expert HTML fayllaridan olingan to‘liq to‘plam.</p><div class="study-detail"><span>IELTS VOCABULARY</span><strong>64</strong></div><div class="study-detail"><span>BECOMING AN EXPERT</span><strong>20</strong></div><div class="study-detail"><span>HOZIR O‘RGANILGAN</span><strong>'+mastered+'</strong></div><button id="studyPlay" class="btn btn-accent">'+(study.mode==='day1'?'7 ta o‘yinni ko‘rish →':html(MODES[study.mode].title)+' o‘ynash →')+'</button></aside></div>';
    $('#studyFlip').onclick=()=>{study.flipped=!study.flipped;renderStudy()};
    $('#studyPrevious').onclick=()=>{if(study.index>0){study.index--;study.flipped=false;renderStudy()}};
    $('#studyNext').onclick=()=>{if(study.index<cards.length-1){study.index++;study.flipped=false;renderStudy()}else leaveStudy()};
    $('#studySpeak').onclick=()=>speak(word.w);
    $('#studyKnown').onclick=()=>{if(!state.known.includes(word.id))state.known.push(word.id);save();if(study.index<cards.length-1){study.index++;study.flipped=false;}renderStudy();};
    $('#studyReview').onclick=()=>{state.known=state.known.filter(id=>id!==word.id);save();if(study.index<cards.length-1){study.index++;study.flipped=false;}renderStudy();};
    $('#studyPlay').onclick=leaveStudy;
  }
  function leaveStudy(){const mode=study?.mode;if(mode&&MODES[mode])startGame(mode);else{closeGame();location.hash='#games';}}
  function drawFrame(){
    const mode=MODES[game.mode];
    const done=Math.min(game.index,game.pool.length),percent=Math.round(done/game.pool.length*100);
    $('#gameContent').innerHTML='<div class="play-head"><div><div class="play-kicker">WORDRUSH / '+mode.label+'</div><h1 id="playTitle">'+mode.title+'</h1><p>'+mode.intro+'</p></div><div class="play-head-actions"><span class="play-count">'+(done+1)+' / '+game.pool.length+'</span><button type="button" class="subtle-button" id="switchToLearning">O‘rganish ↗</button></div></div><div class="play-progress"><span style="width:'+percent+'%"></span></div>'+(game.mode==='rush'?'<div class="timer-pill" id="rushTimer">⏱ '+game.time+' s</div>':'')+'<div id="challenge" class="challenge"></div>';
    $('#switchToLearning').onclick=()=>startLearn(game.mode);
  }
  function record(item,correct,master=true){
    if(!game||game.finished)return;
    game.attempts++;state.stats.attempts++;
    if(correct){game.correct++;state.stats.correct++;state.stats.xp+=10;state.stats.streak++;state.stats.bestStreak=Math.max(state.stats.bestStreak,state.stats.streak);if(master&&!state.known.includes(item.id))state.known.push(item.id);}
    else state.stats.streak=0;
    save();
  }
  function next(){if(!game||game.finished)return;game.index++;game.flipped=false;game.locked=false;game.chosen=[];if(game.index>=game.pool.length)finishGame();else renderGame();}
  function progressAndFeedback(correct,answer){
    const feedback=$('#feedback');feedback.className='feedback'+(correct?'':' bad');feedback.textContent=correct?'✓ To‘g‘ri! +10 XP':'✗ To‘g‘ri javob: '+answer;
    const nextBtn=$('#nextQuestion');nextBtn.hidden=false;nextBtn.textContent=game.index>=game.pool.length-1?'Natijani ko‘rish →':'Keyingisi →';nextBtn.onclick=next;
  }
  function renderGame(){
    if(!game||game.finished)return;if(game.index>=game.pool.length)return finishGame();
    drawFrame();
    if(game.mode==='flash')return flashcard();
    if(game.mode==='choice'||game.mode==='rush')return multipleChoice();
    if(game.mode==='match')return matchingPairs();
    if(game.mode==='gap'||game.mode==='typing')return typingPrompt();
    if(game.mode==='builder')return sentenceBuilder();
  }
  function flashcard(){
    const word=game.pool[game.index];game.flipped=false;
    function draw(){const back=game.flipped;
      $('#challenge').innerHTML='<div class="challenge-label">FLASHCARD · '+(game.index+1)+' / '+game.pool.length+'</div><button class="flash-card'+(back?' flipped':'')+'" type="button" id="flipCard"><span>'+(back?'O‘ZBEKCHA · MEANING':'ENGLISH · WORD / PHRASE')+'</span><strong>'+html(back?word.u:word.w)+'</strong>'+(back?(word.d?'<p>'+html(word.d)+'</p>':'')+(word.e?'<p><em>'+html(word.e)+'</em></p>':''):'<p>Tap to reveal meaning ↗</p>')+'<span>↻ TAP TO FLIP</span></button><div class="flash-actions"><button type="button" class="subtle-button" id="listenWord">🔊 Listen</button><button type="button" class="subtle-button" id="needWork">↺ Still learning</button><button type="button" class="action-button" id="knowWord">I know it ✓</button></div>';
      $('#flipCard').onclick=()=>{game.flipped=!game.flipped;draw()};$('#listenWord').onclick=()=>speak(word.w);
      $('#needWork').onclick=()=>{record(word,false,false);next()};$('#knowWord').onclick=()=>{record(word,true);next()};
    }draw();
  }
  function speak(text){if(!('speechSynthesis' in window)){toast('Audio bu brauzerda mavjud emas.');return;}window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(text);speech.lang='en-US';speech.rate=.88;window.speechSynthesis.speak(speech);}
  function pickOptions(word,field){const selected=[word],seen=new Set([norm(word[field])]);for(const candidate of shuffle(state.words)){if(candidate.id!==word.id&&!seen.has(norm(candidate[field]))){selected.push(candidate);seen.add(norm(candidate[field]));if(selected.length===4)break;}}return shuffle(selected);}
  function multipleChoice(){
    const word=game.pool[game.index],rush=game.mode==='rush',field=rush?'w':'u',options=pickOptions(word,field);
    if(options.length<2)return gameEmpty('More unique words needed','Add at least two unique English words and meanings to practise multiple choice.');
    const prompt=rush?word.u:word.w;
    $('#challenge').innerHTML='<div class="challenge-label">'+(rush?'⚡ WORD RUSH / CHOOSE ENGLISH':'☑ MULTIPLE CHOICE / CHOOSE MEANING')+'</div><div class="challenge-question">'+html(prompt)+'</div><div class="choice-grid">'+options.map((o,i)=>'<button type="button" class="choice-button" data-choice="'+i+'">'+html(o[field])+'</button>').join('')+'</div><div id="feedback" class="feedback" aria-live="polite"></div><button id="nextQuestion" type="button" class="next-button" hidden>Next →</button>';
    game.locked=false;
    $$('[data-choice]',$('#challenge')).forEach(button=>button.onclick=()=>{
      if(game.locked)return;game.locked=true;
      const selected=options[Number(button.dataset.choice)],correct=selected.id===word.id;record(word,correct);
      $$('[data-choice]',$('#challenge')).forEach(b=>{b.disabled=true;if(options[Number(b.dataset.choice)].id===word.id)b.classList.add('correct');});
      if(!correct)button.classList.add('wrong');progressAndFeedback(correct,rush?word.w:word.u);
      if(rush){const previousGame=game;setTimeout(()=>{if(game===previousGame&&!game.finished)next();},550);}
    });
  }
  function matchingPairs(){
    const remaining=game.pool.filter(w=>!game.matched.has(w.id));if(!remaining.length)return finishGame();
    const pack=remaining.slice(0,5),right=shuffle(pack);game.pairs=pack;game.selected=null;let packDone=0;
    $('#challenge').innerHTML='<div class="challenge-label">⌘ MATCH THE MEANING</div><p class="challenge-sub">Chapdagi inglizcha so‘zni, o‘ngdagi tarjimasi bilan juftlang.</p><div class="pair-board"><div class="pair-col">'+pack.map(w=>'<button type="button" class="pair-button" data-left="'+html(w.id)+'">'+html(w.w)+'</button>').join('')+'</div><div class="pair-col">'+right.map(w=>'<button type="button" class="pair-button" data-right="'+html(w.id)+'">'+html(w.u)+'</button>').join('')+'</div></div><div id="feedback" class="feedback" aria-live="polite"></div><button id="nextQuestion" type="button" class="next-button" hidden>Next pairs →</button>';
    $$('[data-left]').forEach(b=>b.onclick=()=>{if(b.disabled)return;game.selected=b.dataset.left;$$('[data-left]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');});
    $$('[data-right]').forEach(b=>b.onclick=()=>{
      if(b.disabled||!game.selected)return;
      const left=game.selected,correct=b.dataset.right===left;
      const item=pack.find(w=>w.id===left);record(item,correct);
      if(correct){game.matched.add(item.id);game.index++;packDone++;b.classList.add('matched');b.disabled=true;const start=$$('[data-left]').find(x=>x.dataset.left===left);start.disabled=true;start.classList.add('matched');$('#feedback').className='feedback';$('#feedback').textContent='✓ To‘g‘ri juftlik! +10 XP';if(packDone===pack.length){const nextBtn=$('#nextQuestion');nextBtn.hidden=false;nextBtn.textContent=game.index>=game.pool.length?'Natijani ko‘rish →':'Keyingi juftliklar →';nextBtn.onclick=()=>game.index>=game.pool.length?finishGame():renderGame();}}
      else{$('#feedback').className='feedback bad';$('#feedback').textContent='Bu juftlik noto‘g‘ri, yana urinib ko‘ring.';}
      game.selected=null;$$('[data-left]').forEach(x=>x.classList.remove('selected'));
    });
  }
  function makeGap(word){
    // Day 1 entries each have their own reviewed, original sentence and an
    // answer in the grammatical form that naturally fits its blank.
    if(typeof word.g==='string'&&word.g.includes('________'))return word.g;
    const source=word.e||'';const escaped=word.w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    try{const pattern=new RegExp(escaped,'gi');if(pattern.test(source))return source.replace(pattern,'________');}catch{}
    return '________  —  '+(word.d||word.u);
  }
  function typingPrompt(){
    const word=game.pool[game.index],gap=game.mode==='gap';
    const prompt=gap?makeGap(word):word.u;
    const answer=gap&&word.ga?word.ga:word.w;
    $('#challenge').innerHTML='<div class="challenge-label">'+(gap?'✎ FILL THE GAP · ENGLISH':'⌨ TYPING RACE · TRANSLATION')+'</div><p class="challenge-sub">'+(gap?'Bo‘sh joyga inglizcha so‘zni/iborani yozing.':'Berilgan tarjima uchun inglizcha so‘zni to‘liq yozing.')+'</p><div class="challenge-question">'+html(prompt)+'</div>'+(gap?'<p class="challenge-sub">Ma’nosi: '+html(word.u)+'</p>':'')+'<form id="typeForm"><input class="type-answer" id="typeInput" required autocomplete="off" spellcheck="false" placeholder="Your English answer..."><button type="submit">Check ↗</button></form><div id="feedback" class="feedback" aria-live="polite"></div><button id="nextQuestion" type="button" class="next-button" hidden>Next →</button>';
    $('#typeInput').focus({preventScroll:true});
    $('#typeForm').onsubmit=event=>{event.preventDefault();if(game.locked)return;const value=$('#typeInput').value;if(!value.trim())return;game.locked=true;const correct=norm(value)===norm(answer)||(gap&&norm(value)===norm(word.w));record(word,correct);$('#typeInput').disabled=true;$('#typeForm button').disabled=true;progressAndFeedback(correct,answer);};
  }
  function sentenceBuilder(){
    const word=game.pool[game.index];const parts=word.w.trim().split(/\s+/).filter(Boolean);const letters=parts.length===1;const tokens=letters?Array.from(word.w):parts;const order=shuffle(tokens.map((t,i)=>({text:t,index:i})));game.chosen=[];
    $('#challenge').innerHTML='<div class="challenge-label">▤ SENTENCE BUILDER</div><p class="challenge-sub">'+(letters?'Harflarni inglizcha so‘z tartibiga joylang.':'Bo‘laklarni to‘g‘ri tartibda tanlab, inglizcha iborani tuzing.')+'</p><div class="challenge-question">'+html(word.u)+'</div><div class="answer-zone" id="answerZone"><span class="challenge-sub">'+(letters?'Tap letters below':'Tap words below')+'</span></div><div class="token-bank">'+order.map(t=>'<button type="button" class="token-button" data-token="'+t.index+'">'+html(t.text)+'</button>').join('')+'</div><div class="builder-actions"><button type="button" id="clearBuilder" class="subtle-button">↺ Start over</button><button type="button" id="checkBuilder" class="action-button">Check answer →</button></div><div id="feedback" class="feedback" aria-live="polite"></div><button id="nextQuestion" type="button" class="next-button" hidden>Next →</button>';
    const redraw=()=>{const area=$('#answerZone');area.innerHTML=game.chosen.length?game.chosen.map(i=>'<button type="button" class="answer-token" data-remove="'+i+'">'+html(tokens[i])+'</button>').join(''):'<span class="challenge-sub">'+(letters?'Tap letters below':'Tap words below')+'</span>';$$('[data-token]').forEach(b=>b.disabled=game.locked||game.chosen.includes(Number(b.dataset.token)));$$('[data-remove]').forEach(b=>b.onclick=()=>{if(game.locked)return;const i=game.chosen.indexOf(Number(b.dataset.remove));if(i>=0)game.chosen.splice(i,1);redraw();});};
    $$('[data-token]').forEach(b=>b.onclick=()=>{if(game.locked)return;game.chosen.push(Number(b.dataset.token));redraw();});
    $('#clearBuilder').onclick=()=>{if(game.locked)return;game.chosen=[];redraw();};
    $('#checkBuilder').onclick=()=>{if(game.locked)return;if(game.chosen.length!==tokens.length){$('#feedback').textContent='Avval barcha bo‘laklarni tanlang.';return;}game.locked=true;const answer=game.chosen.map(i=>tokens[i]).join(letters?'':' '),correct=answer===tokens.join(letters?'':' ');record(word,correct);$$('[data-token]').forEach(b=>b.disabled=true);$('#clearBuilder').disabled=true;$('#checkBuilder').disabled=true;progressAndFeedback(correct,word.w);};
  }
  function finishGame(){
    if(!game||game.finished)return;game.finished=true;
    if(game.timer){clearInterval(game.timer);game.timer=null;}
    state.stats.gamesPlayed++;save();
    const correct=game.correct,total=game.pool.length,percent=total?Math.round(correct/total*100):0,title=MODES[game.mode].title,playedMode=game.mode;
    $('#gameContent').innerHTML='<div class="end-result"><div class="play-kicker">SESSION COMPLETE / WORDRUSH</div><div class="trophy-icon">🏆</div><h2>'+html(title)+' — completed!</h2><p>Bugungi mashg‘ulot yakunlandi. Har bir urinish sizni oldinga olib boradi.</p><div class="end-score">'+percent+'%</div><p><strong>'+correct+' / '+total+'</strong> ta to‘g‘ri · <strong>+'+(correct*10)+' XP</strong></p><button type="button" id="retryGame" class="btn btn-accent">↺ Play again</button><button type="button" id="backToGames" class="btn btn-outline">← All seven games</button></div>';
    $('#retryGame').onclick=()=>startGame(playedMode);$('#backToGames').onclick=()=>{closeGame();location.hash='#games';};
  }
  renderDashboard();
})();
