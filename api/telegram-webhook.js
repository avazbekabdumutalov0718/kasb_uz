import {passages,vocabulary,trialDay} from '../reading-lab-data.js';
import {tg,sign,save,read,cfgPath,response} from './_tasks-kit.js';
const site='https://wordrush-chi.vercel.app/';
export async function POST(req){if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_WEBHOOK_SECRET)return response({error:'Bot not configured'},503);if(req.headers.get('x-telegram-bot-api-secret-token')!==process.env.TELEGRAM_WEBHOOK_SECRET)return response({error:'Forbidden'},403);let b;try{b=await req.json()}catch{return response({error:'Invalid'},400)}const membership=b.my_chat_member;
if(membership?.chat?.type==='channel'&&['administrator','creator'].includes(membership.new_chat_member?.status)&&membership.new_chat_member?.user?.is_bot){
 const admin=membership.from?.id;
 if(admin)try{await save(cfgPath(admin),{channelId:String(membership.chat.id),channelTitle:membership.chat.title||''})}catch(e){console.error('Channel auto-link failed',e)}
 return response({ok:true});
}
const msg=b.message;if(!msg||msg.chat?.type!=='private')return response({ok:true});const chat=msg.chat.id;
if(msg.forward_origin?.type==='channel'&&msg.forward_origin.chat?.id){
 await save(cfgPath(chat),{channelId:String(msg.forward_origin.chat.id)});
 await tg('sendMessage',{chat_id:chat,text:'✅ Kanal ulandi. Proof va natijalar endi shu kanalga yuboriladi.'});
 return response({ok:true});
}
const cmd=String(msg.text||'').split(' ')[0].split('@')[0];try{if(cmd==='/sayt')await tg('sendMessage',{chat_id:chat,text:site});else if(cmd==='/reading'||cmd==='/article'||cmd==='/start'){
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const date=Object.fromEntries(p.map(z=>[z.type,z.value]));const localDate=date.year+'-'+date.month+'-'+date.day;
 const link=site+'tasks.html?miniapp=1';
 if(localDate===trialDay){
  const i=Math.floor(Math.random()*passages.length),article=passages[i];
  await tg('sendMessage',{chat_id:chat,text:'📚 WORDRUSH · ADVANCED READING\n\n🎲 Random article '+(i+1)+'/5\n'+article.title+'\n\n'+article.text+'\n\n🔤 6 ta expression · 30 words\n🎧 Audio flashcards + 3 quiz\n\nSinov faqat bugun: 03.11.2026.',
   reply_markup:{inline_keyboard:[[{text:'📖 O‘qish + Quiz + Audio',web_app:{url:site+'reading-lab.html?article='+(i+1)+'&miniapp=1'}}],[{text:'☑ TASKS ga kirish',web_app:{url:link}}],[{text:'🌐 WORDRUSH',url:site}]]}});
 }else{
  await tg('sendMessage',{chat_id:chat,text:'📋 WORDRUSH Homework Tracker\n\nAdvanced Reading Lab sinovi yakunlangan.',reply_markup:{inline_keyboard:[[{text:'📋 Vazifalar',web_app:{url:link}}],[{text:'🌐 Sayt',url:site}]]}});
 }
}else if(cmd==='/tasks'){const link=site+'tasks.html?miniapp=1';await tg('sendMessage',{chat_id:chat,text:'☑ Homework Tracker — TASKS',reply_markup:{inline_keyboard:[[{text:'📋 Vazifalar',web_app:{url:link}}],[{text:'🌐 Sayt',url:site}]]}})}else if(cmd==='/app'){const ticket=sign(chat,'session',600);const link=site+'tasks.html?session='+encodeURIComponent(ticket);await tg('sendMessage',{chat_id:chat,text:'📱 WORDRUSH Android uchun kirish havolasi (10 daqiqa amal qiladi):\n\n'+link+'\n\nHavolani nusxalang va ilovadagi Bot TASKS → KIRISH oynasiga qo‘ying.',disable_web_page_preview:true})}else if(cmd==='/login'){const ticket=sign(chat);await tg('sendMessage',{chat_id:chat,text:'🔐 WORDRUSH TASKS saytda ham ochish:',reply_markup:{inline_keyboard:[[{text:'TASKS saytga kirish',url:site+'tasks.html?session='+encodeURIComponent(ticket)}]]}})}else if(cmd.startsWith('/channel')){const parts=String(msg.text||'').trim().split(/\s+/);if(parts[1]&&/^(@[\w]{5,}|-100\d{6,})$/.test(parts[1])){await tg('getChat',{chat_id:parts[1]});await save(cfgPath(chat),{channelId:parts[1]});await tg('sendMessage',{chat_id:chat,text:'✅ Kanal ulandi. Botga post yuborish huquqini bering.'})}}}catch(e){console.error('Bot webhook error:',e.message);return response({error:'Telegram delivery failed'},500)}return response({ok:true})}


// Internal health/webhook repair plus same-origin audio for Telegram Android WebView.
// TTS requests are restricted to the 11 published Reading Lab items.
export async function GET(req) {
 const url=new URL(req.url);
 const internal=Boolean(process.env.WORDRUSH_SCHEDULER_SECRET)&&req.headers.get('x-wordrush-scheduler')===process.env.WORDRUSH_SCHEDULER_SECRET;
 if(internal&&url.searchParams.get('repair')==='webhook'){
  try{
   const before=await tg('getWebhookInfo',{});
   const updated=await tg('setWebhook',{url:site+'api/telegram-webhook',secret_token:process.env.TELEGRAM_WEBHOOK_SECRET,drop_pending_updates:false});
   const after=await tg('getWebhookInfo',{});
   return response({ok:updated===true,oldUrl:before.url,newUrl:after.url,pending:after.pending_update_count,lastError:after.last_error_message||null});
  }catch(e){return response({error:String(e.message||e)},503)}
 }
 if(url.searchParams.get('audio')!=='readinglab')return response({status:'running',mode:'webhook'},200);
 const kind=url.searchParams.get('kind'), id=Number(url.searchParams.get('id'));
 if(!Number.isInteger(id)||id<0)return response({error:'Invalid audio selection'},400);
 let text='';
 if(kind==='word'&&id<vocabulary.length)text=vocabulary[id].term;
 else if(kind==='article'&&id<passages.length)text=passages[id].text;
 else return response({error:'Audio item not found'},404);
 const endpoints=[
  'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q='+encodeURIComponent(text),
  'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=en&q='+encodeURIComponent(text)
 ];
 for(const endpoint of endpoints){
  try{
   const r=await fetch(endpoint,{headers:{'Accept':'audio/mpeg,audio/*;q=0.9','User-Agent':'Mozilla/5.0 (compatible; WORDRUSH/1.0)'},signal:AbortSignal.timeout(9000)});
   if(!r.ok)continue;
   const mime=r.headers.get('content-type')||'';
   if(!/audio|mpeg|octet-stream/i.test(mime))continue;
   const bytes=await r.arrayBuffer();
   if(bytes.byteLength<500||bytes.byteLength>1800000)continue;
   return new Response(bytes,{status:200,headers:{'Content-Type':'audio/mpeg','Cache-Control':'public, max-age=86400, s-maxage=604800','Content-Length':String(bytes.byteLength),'X-Content-Type-Options':'nosniff'}});
  }catch(e){console.warn('Reading audio source unavailable',String(e.message||e).slice(0,80))}
 }
 return response({error:'Audio source temporarily unavailable'},502);
}
