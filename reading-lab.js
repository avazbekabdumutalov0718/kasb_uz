import {trialDay,vocabulary,passages,vocabularyCheck} from './reading-lab-data.js';
const $=q=>document.querySelector(q);
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const x=Object.fromEntries(p.map(z=>[z.type,z.value]));return x.year+'-'+x.month+'-'+x.day};
function speak(s){
 if(!window.speechSynthesis){alert('Audio talaffuz bu qurilmada mavjud emas. Chrome orqali oching.');return}
 try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(s);u.lang='en-US';u.rate=.88;speechSynthesis.speak(u)}
 catch(e){alert('Audio xatosi: '+e.message)}
}
const wanted=Number(new URLSearchParams(location.search).get('article'));
let current=(Number.isInteger(wanted)&&wanted>=1&&wanted<=5)?wanted-1:Math.floor(Math.random()*5);
let openCards=new Set();
function markTerms(s){
 const list=vocabulary.map(v=>v.term).sort((a,b)=>b.length-a.length);
 const pattern=new RegExp('('+list.join('|')+')','gi');
 return s.split(pattern).map(piece=>{
  const v=vocabulary.find(t=>t.term.toLowerCase()===piece.toLowerCase());
  return v?'<mark class="term" data-term="'+safe(v.term)+'" tabindex="0" title="'+safe(v.uz)+'">'+safe(piece)+'</mark>':safe(piece)
 }).join('');
}
function cards(){
 $('#cards').innerHTML=vocabulary.map((v,i)=>'<div class="flash" data-card="'+i+'" tabindex="0"><div class="muted">WORD '+(i+1)+'/6</div><div class="term-front">'+safe(v.term)+'</div>'+
 (openCards.has(i)?'<div class="uz">'+safe(v.uz)+'</div><div class="small">'+safe(v.definition)+'</div><div class="small">'+safe(v.example)+'</div>':'<p class="muted">Tarjima va definition uchun kartani bosing.</p>')+
 '<button class="listen" type="button" data-speak="'+i+'">🔊 Pronunciation</button></div>').join('');
}
function quizItems(i){
 const p=passages[i],v=vocabulary[(i+2)%6];
 return [
  {kind:'Meaning',question:'Which expression means: '+v.definition,choices:[v.term,...vocabulary.filter(x=>x.term!==v.term).slice(0,2).map(x=>x.term)].sort((a,b)=>a.localeCompare(b)),answer:v.term},
  {kind:'Fill in the gap',question:p.blank,choices:[p.blankTerm,...vocabulary.filter(x=>x.term!==p.blankTerm).slice(0,2).map(x=>x.term)].sort((a,b)=>a.localeCompare(b)),answer:p.blankTerm},
  {kind:'Comprehension',question:p.question,choices:p.choices,answer:p.choices[p.correct]}
 ];
}
function quiz(){
 $('#questions').innerHTML=quizItems(current).map((q,i)=>'<fieldset class="quiz-question"><legend>'+(i+1)+'. <span class="muted">'+safe(q.kind)+'</span> · '+safe(q.question)+'</legend>'+
 q.choices.map((v,j)=>'<label class="option"><input name="q'+i+'" type="radio" value="'+j+'">'+safe(v)+'</label>').join('')+
 '<div class="answer" id="answer'+i+'"></div></fieldset>').join('');
 $('#score').textContent='';
}
function render(i){
 current=(i+5)%5;openCards=new Set();const p=passages[current];
 $('#tabs').innerHTML=passages.map((v,n)=>'<button class="tab '+(n===current?'active':'')+'" data-index="'+n+'" type="button">Article '+(n+1)+'</button>').join('');
 $('#articleNum').textContent='READING '+(current+1)+' OF 5';
 $('#articleTitle').textContent=p.title;
 $('#articleText').innerHTML=markTerms(p.text);
 $('#wordCounter').textContent=p.text.trim().split(/\s+/).length+' words';
 cards();quiz();
 try{history.replaceState(null,'',location.pathname+'?article='+(current+1)+'&miniapp=1')}catch{}
}
function shuffle(){let i=Math.floor(Math.random()*4);if(i>=current)i++;render(i);$('#reading').scrollIntoView({behavior:'smooth'})}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-index]');if(b)render(Number(b.dataset.index))});
$('#cards').addEventListener('click',e=>{
 const play=e.target.closest('[data-speak]');if(play){e.stopPropagation();speak(vocabulary[Number(play.dataset.speak)].term);return}
 const node=e.target.closest('[data-card]');if(!node)return;const id=Number(node.dataset.card);
 openCards.has(id)?openCards.delete(id):openCards.add(id);cards();
});
$('#cards').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-card]')){e.preventDefault();e.target.click()}});
$('#articleText').addEventListener('click',e=>{const t=e.target.closest('[data-term]');if(!t)return;const i=vocabulary.findIndex(v=>v.term===t.dataset.term);if(i<0)return;openCards.add(i);cards();$('#flashcards').scrollIntoView({behavior:'smooth'})});
$('#articleText').addEventListener('keydown',e=>{if(e.key==='Enter')e.target.click()});
$('#readAloud').addEventListener('click',()=>speak(passages[current].text));
$('#random').addEventListener('click',shuffle);
$('#shuffle').addEventListener('click',shuffle);
$('#nextArticle').addEventListener('click',()=>{render(current+1);$('#reading').scrollIntoView({behavior:'smooth'})});
$('#check').addEventListener('click',()=>{
 let correct=0,answered=0;
 quizItems(current).forEach((q,i)=>{
  const checked=document.querySelector('input[name="q'+i+'"]:checked'),out=$('#answer'+i);
  if(!checked){out.textContent='Javob belgilanmagan — tekshirilmaydi.';out.className='answer muted';return}
  answered++;
  if(q.choices[Number(checked.value)]===q.answer){correct++;out.textContent='✓ To‘g‘ri';out.className='answer correct'}
  else{out.textContent='✗ Noto‘g‘ri, yana urinib ko‘ring.';out.className='answer incorrect'}
 });
 $('#score').textContent='Natija: '+correct+'/'+answered+' · faqat tanlangan javoblar';
 try{localStorage.setItem('wr-reading-trial-'+current,JSON.stringify({correct,answered}))}catch{}
});
if(today()!==trialDay){$('#lab').hidden=true;$('#expired').style.display='block'}
else if(!vocabularyCheck()){$('#lab').innerHTML='<section class="box">Article validation error.</section>'}
else {render(current);try{window.Telegram?.WebApp?.ready();window.Telegram?.WebApp?.expand()}catch{}}
