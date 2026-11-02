'use strict';
const MODE=location.pathname.split('/').pop().replace('.html','');
const $=q=>document.querySelector(q), escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').toLowerCase().replace(/[‘’]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
const sectionConfig={articles:['article-units',7],essays:['essays',10],podcasts:['podcasts',10],'topic-vocab':['vocab',2]};
const labels={articles:'Articles',essays:'Model Essays',podcasts:'Podcasts','topic-vocab':'Topic Vocab'};
let units=[],currentId=1,filter='All',highlightMode=false,menuSelection=null;
let savedWords=JSON.parse(localStorage.getItem('wordrush.article.vocab.v1')||'[]');
let savedMarks=JSON.parse(localStorage.getItem('wordrush.highlights.v1')||'[]');
let savedNotes=JSON.parse(localStorage.getItem('wordrush.standalone.notes.v1')||'{}');
const types=['All','Opinion','Discussion','Positive/Negative','Advantages/Disadvantages','Problem/Solution','Two-part'];
const typeFor=n=>n<=30?'Opinion':n<=43?'Discussion':n<=45?'Positive/Negative':n<=49?'Advantages/Disadvantages':n<=52?'Problem/Solution':'Two-part';
function flash(m){const e=$('#notice');e.textContent=m;e.hidden=false;clearTimeout(flash.timer);flash.timer=setTimeout(()=>e.hidden=true,2800)}
function activateNavigation(){const link=document.querySelector('.header nav a[href="'+MODE+'.html"]');if(link)link.classList.add('active')}
function setProgress(m){$('#viewer').innerHTML='<section class="content-panel"><p>'+escapeHTML(m)+'</p></section>'}
function cleanSource(s){return String(s||'').replace(/61 (Articles|Model Essays|Podcasts) for IELTS[^\n]*/g,'').trim()}
function pageText(p){return escapeHTML(cleanSource(p))}
async function getChunks(){const [prefix,count]=sectionConfig[MODE];const files=Array.from({length:count},(_,i)=>'study-library/data/'+prefix+'-'+String(i).padStart(2,'0')+'.json');const results=await Promise.all(files.map(async url=>{const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw Error(url+': HTTP '+r.status);return r.json()}));return results.flat()}
function showFilters(){const area=$('#filters');if(MODE==='essays'){area.innerHTML='<div class="filters-heading">Task 1 / Task 2</div><div class="filter-bar"><button class="filter taskone" id="taskOne">Task 1</button><button class="filter active" id="taskTwo">Task 2 · 61 essays</button></div><div class="filters-heading">Essay type</div>'+types.map(x=>'<button class="filter '+(filter===x?'active':'')+'" data-filter="'+escapeHTML(x)+'">'+escapeHTML(x)+'</button>').join('')}else area.innerHTML=''}
function getUnit(){return units.find(x=>x.id===currentId)||units[0]}
function displayItems(){
 const search=$('#search').value.toLowerCase();
 const subset=units.filter(x=>(filter==='All'||x.type===filter)&&String(x.id+' '+x.title+' '+(x.type||'')).toLowerCase().includes(search));
 $('#items').innerHTML=subset.map(u=>'<button class="item '+(u.id===currentId?'active':'')+'" data-unit="'+u.id+'"><small>'+String(u.id).padStart(2,'0')+' · '+escapeHTML(u.type||'IELTS')+'</small>'+escapeHTML(u.title)+'</button>').join('')||'<p class="muted">Mavzu topilmadi</p>';
}
function textBlock(s,extra=''){return '<div class="source-text '+extra+'">'+escapeHTML(cleanSource(s))+'</div>'}
function header(unit,tag){return '<div class="eyebrow">'+escapeHTML(tag)+'</div><h2>'+escapeHTML(unit.title)+'</h2><div class="actions"><button id="printUnit">⎙ Print / PDF</button>'+(MODE==='articles'?'<button id="showVocabulary">Articles Vocab ('+savedWords.length+')</button>':'')+'</div>'}
function sourceSection(heading,content){return '<section class="content-panel"><h3>'+escapeHTML(heading)+'</h3>'+textBlock(content)+'</section>'}
function markedText(text,page){
 let out=escapeHTML(cleanSource(text));
 for(const m of savedMarks.filter(m=>m.source==='articles'&&m.p===page)){
  const w=escapeHTML(m.word||'');if(w&&out.includes(w))out=out.replace(w,'<mark>'+w+'</mark>')
 }
 return '<div class="readtext" data-page="'+page+'">'+out+'</div>';
}
function articleSummary(u){
 const raw=String(u.summary||'');const k=PRESET_ARTICLE_KEYS[u.id]||{};
 const opts=u.matching.map(x=>'<span class="chip">'+escapeHTML(x.word)+'</span>').join('');
 let text=escapeHTML(raw),nUsed=new Set();
 text=text.replace(/(\d{1,2})([ \t]{7,}|[ \t]*\n[ \t]*\n)/g,(all,n,space,offset)=>{
  const v=Number(n);if(v<1||v>u.summaryGaps||nUsed.has(v))return all;
  nUsed.add(v);
  return '<label class="inline-gap"><strong>'+v+'</strong><input data-gap="'+v+'" aria-label="Gap '+v+'" placeholder="Your answer"></label>';
 });
 const missing=Array.from({length:u.summaryGaps},(_,i)=>i+1).filter(n=>!nUsed.has(n));
 if(missing.length)text+='<p class="warning">PDF’da ayrim bo‘shliqlar birikib ketgan. Ularni quyida to‘ldiring:</p>'+missing.map(n=>'<label class="gap-extra">'+n+'. <input data-gap="'+n+'" placeholder="Answer '+n+'"></label>').join('');
 return '<p class="muted">Word box · from the original exercise</p><div class="chips">'+opts+'</div><div class="summary">'+text+'</div>';
}
function articleView(u){
 const matched=u.matching.map(x=>'<label class="match-row"><span>'+x.n+'. '+escapeHTML(x.word)+'</span><select data-match="'+x.n+'" aria-label="Word '+x.n+' answer"><option value="">—</option>'+Array.from('abcdefghijkl').map(c=>'<option value="'+c+'">'+c+'</option>').join('')+'</select></label>').join('');
 const defs=u.matching.map(x=>'<div class="definition"><b>'+x.letter+'</b><span>'+escapeHTML(x.meaning)+'</span></div>').join('');
 const reading=u.reading.map((t,i)=>markedText(t,u.pages[i])).join('');
 return header(u,'61 ARTICLES · '+u.id+' / 61')+
 '<section class="content-panel"><h3>01 · Reading passage</h3><p class="muted">Double-click any word for Highlight or Articles Vocab.</p>'+reading+'</section>'+
 '<section class="content-panel"><h3>02 · A · Word-list</h3>'+textBlock(u.wordList)+'</section>'+
 '<section class="content-panel"><h3>03 · B · Match the words (1–12)</h3><p class="muted">Words on the left; definitions a–l on the right.</p><div class="match-grid"><div>'+matched+'</div><div>'+defs+'</div></div></section>'+
 '<section class="content-panel"><h3>04 · C · Complete the original summary</h3>'+articleSummary(u)+'</section>'+
 '<section class="content-panel"><button class="check" id="checkAnswers">✓ Check entered answers</button><p id="feedback" role="status" class="result"></p><p class="muted">Unanswered items are not checked or revealed.</p></section>'+
 '<section class="content-panel" id="vocabularyPanel"><h3>Articles Vocab · Saved words</h3><div id="savedWords"></div><button id="pdfVocabulary" class="check">⎙ Print vocabulary / PDF</button></section>';
}
function extractEssayParts(first){
 const p=String(first||'');const qi=p.indexOf('QUESTION');if(qi<0)return {question:'Original question not separately identified',model:cleanSource(p)};
 const rest=p.slice(qi+8).replace(/^\s+/,'');
 const m=rest.match(/\n\s*1[ \t]{2,}/);
 if(!m)return {question:rest.split('\n\n')[0].trim(),model:cleanSource(rest)};
 return {question:rest.slice(0,m.index).trim(),model:cleanSource(rest.slice(m.index).trim())};
}
function essayView(u){
 const {question,model}=extractEssayParts(u.pagesData[0]?.text||'');
 const note=u.pagesData[1]?.text?.split(/A\s+Note-taking exercise/i)[1]||u.pagesData[1]?.text||'';
 const back=u.pagesData[2]?.text||'';
 const chunk=back.split(/B\s+Useful chunks/i)[1]?.split(/C\s+Grammar structures/i)[0]||back;
 const grammar=back.split(/C\s+Grammar structures/i)[1]||'';
 const key='essays:'+u.id;
 return header(u,'WRITING TASK 2 · '+u.type+' · '+u.id+' / 61')+
 '<section class="content-panel"><h3>IELTS question</h3>'+textBlock(question)+'</section>'+
 '<section class="content-panel"><h3>Model Essay · Full answer</h3>'+textBlock(model,'essay-text')+'</section>'+
 sourceSection('A · Note-taking exercise',note)+sourceSection('B · Useful chunks',chunk)+sourceSection('C · Grammar structures',grammar)+
 '<section class="content-panel"><h3>Write your own answer</h3><textarea id="essayNote" rows="9" placeholder="Write your own introduction, body paragraphs or full essay...">'+escapeHTML(savedNotes[key]||'')+'</textarea><p class="muted">Saved in this browser. There is no invented automatic score for open-ended essays.</p></section>';
}
function podcastView(u){
 const [a,b,c]=u.pagesData.map(x=>x?.text||'');
 const task=a.split(/A\s+Listening tasks/i)[1]||a;
 const tail=b.split(/B\s+Useful chunks/i)[0]||'';
 const chunks=b.split(/B\s+Useful chunks/i)[1]||'';
 const url=PODCAST_LINKS[u.id];
 const key=PRESET_PODCAST_KEYS[u.id]||{};
 return header(u,'LISTENING · PODCAST '+u.id+' / 61')+
 '<section class="content-panel"><h3>Listen to the official episode</h3>'+(url?'<p><a class="episode-link" href="'+escapeHTML(url)+'" target="_blank" rel="noopener noreferrer">▶ Open original audio / episode / transcript ↗</a></p>':'<p class="warning">No verified episode URL is available.</p>')+'<p class="muted">Video embed is shown only when a verified source supports embedding; a link is not falsely presented as a playable video.</p></section>'+
 '<section class="content-panel"><h3>A · Listening tasks · Original questions</h3>'+textBlock(task+'\n'+tail)+'</section>'+
 '<section class="content-panel"><h3>Enter your answers (1–13)</h3><div class="answer-grid">'+Array.from({length:13},(_,i)=>'<label>'+String(i+1)+'. <input data-podcast="'+String(i+1)+'" placeholder="Your answer"></label>').join('')+'</div>'+(Object.keys(key).length?'<button class="check" id="checkAnswers">✓ Check entered answers</button>':'<p class="warning">This unit has no verified answer key.</p>')+'<p class="result" id="feedback"></p></section>'+
 sourceSection('B · Useful chunks',chunks)+sourceSection('C · Transcript and D · Your turn',c);
}
function vocabView(u){return header(u,'TOPIC VOCAB · '+u.id+' / 7')+sourceSection('Vocabulary with original definitions and examples',u.pagesData.map(p=>p.text).join('\n\n'))}
function render(){
 const u=getUnit();if(!u){setProgress('No source items were loaded.');return}
 currentId=u.id;displayItems();
 $('#viewer').innerHTML=MODE==='articles'?articleView(u):MODE==='essays'?essayView(u):MODE==='podcasts'?podcastView(u):vocabView(u);
 if(MODE==='articles')renderSavedWords();
}
function checkAnswers(){
 const key=MODE==='articles'?PRESET_ARTICLE_KEYS[currentId]:PRESET_PODCAST_KEYS[currentId];
 if(!key)return;
 const controls=MODE==='articles'?[...document.querySelectorAll('[data-match],[data-gap]')]:[...document.querySelectorAll('[data-podcast]')];
 let attempted=0,correct=0;
 for(const ctrl of controls){
  const v=ctrl.value.trim();if(!v){ctrl.style.borderColor='';continue}
  attempted++;
  const expected=ctrl.dataset.match?key.B?.[ctrl.dataset.match]:ctrl.dataset.gap?key.C?.[ctrl.dataset.gap]:key[ctrl.dataset.podcast];
  const ok=String(expected||'').split(' / ').some(a=>norm(v)===norm(a));
  if(ok)correct++;
  ctrl.style.borderColor=ok?'#0f9362':'#c84e41';
 }
 $('#feedback').textContent='Checked '+attempted+' entered answers: '+correct+' correct, '+(attempted-correct)+' incorrect. Unanswered questions were not checked.';
}
function showWordMenu(e){
 if(MODE!=='articles'||!e.target.closest('[data-page]'))return;
 const sel=getSelection();if(!sel||sel.isCollapsed)return;
 const word=String(sel).trim();if(!word||word.length>130)return;
 menuSelection={word,range:sel.getRangeAt(0).cloneRange(),page:Number(e.target.closest('[data-page]').dataset.page)};
 const menu=$('#wordMenu');menu.hidden=false;const box=menuSelection.range.getBoundingClientRect();
 menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,box.left))+'px';
 menu.style.top=Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,box.bottom+10))+'px';
}
function hideWordMenu(){$('#wordMenu').hidden=true}
function addWord(){
 if(!menuSelection)return;
 if(!savedWords.some(x=>norm(x.w)===norm(menuSelection.word)))savedWords.push({w:menuSelection.word,meaning:'',source:'articles',unit:currentId});
 localStorage.setItem('wordrush.article.vocab.v1',JSON.stringify(savedWords));
 renderSavedWords();hideWordMenu();flash('Added to Articles Vocab');
}
function highlightWord(){
 if(!menuSelection)return;
 const {range,page,word}=menuSelection;
 try{const mark=document.createElement('mark');range.surroundContents(mark);savedMarks.push({source:'articles',p:page,word});localStorage.setItem('wordrush.highlights.v1',JSON.stringify(savedMarks));flash('Highlighted ✓')}catch(e){flash('Select one word or a short phrase')}
 hideWordMenu();
}
function renderSavedWords(){
 const root=$('#savedWords');if(!root)return;
 root.innerHTML=savedWords.length?savedWords.map((x,i)=>'<div class="vocab-line"><strong>'+escapeHTML(x.w)+'</strong><input data-meaning="'+i+'" placeholder="O‘zbekcha tarjima" value="'+escapeHTML(x.meaning||'')+'"><button data-remove="'+i+'">×</button></div>').join(''):'<p class="muted">Double-click words in an article and choose Articles Vocab.</p>';
}
function printWords(){
 const html='<html><head><title>WORDRUSH Articles Vocab</title><style>body{font:15px Arial;margin:30px}td,th{border:1px solid #999;padding:8px}table{border-collapse:collapse;width:100%}</style></head><body><h1>Articles Vocab</h1><table><tr><th>Word</th><th>O‘zbekcha</th></tr>'+savedWords.map(x=>'<tr><td>'+escapeHTML(x.w)+'</td><td>'+escapeHTML(x.meaning||'')+'</td></tr>').join('')+'</table></body></html>';
 const windowRef=window.open('','_blank');if(!windowRef){flash('Allow popups to print vocabulary');return}
 windowRef.document.write(html);windowRef.document.close();windowRef.print();
}
document.addEventListener('dblclick',e=>requestAnimationFrame(()=>showWordMenu(e)));
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-unit],[data-filter],#checkAnswers,#taskOne,#taskTwo,#highlightAction,#wordAction,#showVocabulary,#pdfVocabulary,#printUnit,[data-remove]');if(!t)return;
 if(t.dataset.unit){currentId=Number(t.dataset.unit);hideWordMenu();render();scrollTo({top:0,behavior:'smooth'})}
 else if(t.dataset.filter){filter=t.dataset.filter;showFilters();displayItems()}
 else if(t.id==='checkAnswers')checkAnswers();
 else if(t.id==='highlightAction')highlightWord();
 else if(t.id==='wordAction')addWord();
 else if(t.id==='showVocabulary')$('#vocabularyPanel')?.scrollIntoView({behavior:'smooth'});
 else if(t.id==='pdfVocabulary')printWords();
 else if(t.id==='printUnit')window.print();
 else if(t.id==='taskOne'){filter='All';setProgress('Task 1 model essays were not included in the supplied sources. No invented essays are shown.');$('#items').innerHTML='<p class="muted">Task 1 source not supplied</p>';$('#taskOne').classList.add('active');$('#taskTwo').classList.remove('active')}
 else if(t.id==='taskTwo'){showFilters();render()}
 else if(t.dataset.remove!==undefined){savedWords.splice(Number(t.dataset.remove),1);localStorage.setItem('wordrush.article.vocab.v1',JSON.stringify(savedWords));renderSavedWords()}
});
document.addEventListener('input',e=>{
 if(e.target.id==='search')displayItems();
 if(e.target.id==='essayNote'){savedNotes['essays:'+currentId]=e.target.value;localStorage.setItem('wordrush.standalone.notes.v1',JSON.stringify(savedNotes))}
 if(e.target.dataset.meaning!==undefined){savedWords[Number(e.target.dataset.meaning)].meaning=e.target.value;localStorage.setItem('wordrush.article.vocab.v1',JSON.stringify(savedWords))}
});
$('#toTop').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
$('#toBottom').onclick=()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});
async function boot(){
 activateNavigation();setProgress(labels[MODE]+' yuklanmoqda…');
 try{
  const data=await getChunks();
  if(MODE==='articles'){units=data.map(x=>({...x,type:'Reading'}));if(units.length!==61)throw Error('Expected 61 articles, found '+units.length)}
  else if(MODE==='essays'){const map=new Map(data.map(x=>[x.p,x]));units=Array.from({length:61},(_,i)=>{const first=4+3*i;const page=map.get(first);const title=(page?.text||'').split('\n')[0].replace(new RegExp('^'+String(i+1).padStart(2,'0')+'\\s*'),'').replace(/\b(OPINION|DISCUSSION|POSITIVE|ADVANTAGES|PROBLEM|TWO-PART).*$/i,'').trim()||'Essay '+(i+1);return {id:i+1,title,type:typeFor(i+1),pagesData:[map.get(first),map.get(first+1),map.get(first+2)]}})}
  else if(MODE==='podcasts'){const map=new Map(data.map(x=>[x.p,x]));units=Array.from({length:61},(_,i)=>{const first=5+3*i;const page=map.get(first);const lines=(page?.text||'').split('\n').map(l=>l.trim()).filter(Boolean);const title=lines.find(l=>l.includes(String(i+1).padStart(2,'0'))&&!l.includes('UNIT'))?.replace(new RegExp(String(i+1).padStart(2,'0')+'$'),'').trim()||'Podcast '+(i+1);return {id:i+1,title,type:'Listening',pagesData:[map.get(first),map.get(first+1),map.get(first+2)]}})}
  else {const topics=['Crime and Punishment','Media and Advertising','The Environment','Business and Money','Government','Sport and Exercise','Space Exploration'],ranges=[[3,4,5,6,7],[8,9,10,11,12,13],[14,15,16,17,18,19],[20,21,22,23,24],[25,26,27,28,29],[30,31,32,33,34],[35,36,37,38]],map=new Map(data.map(x=>[x.p,x]));units=topics.map((title,i)=>({id:i+1,title,type:'Vocabulary',pagesData:ranges[i].map(p=>map.get(p)).filter(Boolean)}))}
  showFilters();render();
 }catch(e){setProgress('Material yuklanmadi: '+e.message);console.error(e)}
}
boot();
