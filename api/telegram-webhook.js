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
 const i=Math.floor(Math.random()*passages.length),article=passages[i];
 const link=site+'tasks.html?miniapp=1';
 await tg('sendMessage',{chat_id:chat,
  text:'📚 WORDRUSH · ADVANCED READING\n\n🎲 Random article '+(i+1)+'/5\n'+article.title+'\n\n'+article.text+'\n\n🔤 6 ta expression · 30 words\n🎧 Audio flashcards + 3 quiz\n\nSinov: 6 ta so‘z · 5 ta article.',
  reply_markup:{inline_keyboard:[
   [{text:'📖 O‘qish + Quiz + Audio',web_app:{url:site+'reading-lab.html?article='+(i+1)+'&miniapp=1'}}],
   [{text:'☑ TASKS ga kirish',web_app:{url:link}}],
   [{text:'🌐 WORDRUSH',url:site}]
  ]}
 });
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
   const menuUpdated=await tg('setChatMenuButton',{menu_button:{type:'web_app',text:'WORDRUSH Mini App',web_app:{url:site+'tasks.html?miniapp=1'}}});
   const commandsUpdated=await tg('setMyCommands',{commands:[{command:'start',description:'WORDRUSH Mini App va random reading'},{command:'reading',description:'Bugungi random article va audio'},{command:'tasks',description:'Homework Tracker'},{command:'app',description:'Android TASKS kirish havolasi'}]});
   const after=await tg('getWebhookInfo',{});
   return response({ok:updated===true,oldUrl:before.url,newUrl:after.url,pending:after.pending_update_count,menuUpdated,commandsUpdated,lastError:after.last_error_message||null});
  }catch(e){return response({error:String(e.message||e)},503)}
 }
 if(url.searchParams.get('audio')!=='readinglab')return response({status:'running',mode:'webhook'},200);
 const kind=url.searchParams.get('kind'), id=Number(url.searchParams.get('id'));
 if(!Number.isInteger(id)||id<0)return response({error:'Invalid audio selection'},400);
 let text='';
 if(kind==='word'&&id<vocabulary.length)text=vocabulary[id].term;
 else if(kind==='article'&&id<passages.length)text=passages[id].text;
 else return response({error:'Audio item not found'},404);
 const parts=[];
 let fragment='';
 for(const word of text.trim().split(/\s+/)){
  if(fragment&&fragment.length+word.length+1>145){parts.push(fragment);fragment=''}
  fragment+=(fragment?' ':'')+word;
 }
 if(fragment)parts.push(fragment);
 async function getMp3(phrase){
  const encoded=encodeURIComponent(phrase);
  const endpoints=[
   'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q='+encoded,
   'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=en&q='+encoded
  ];
  for(const endpoint of endpoints){
   try{
    const r=await fetch(endpoint,{headers:{'Accept':'audio/mpeg,audio/*;q=0.9','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(12000)});
    if(!r.ok)continue;
    const mime=r.headers.get('content-type')||'';
    if(!/audio|mpeg|octet-stream/i.test(mime))continue;
    const bytes=new Uint8Array(await r.arrayBuffer());
    if(bytes.byteLength<500||bytes.byteLength>850000)continue;
    return bytes;
   }catch(e){console.warn('Reading audio provider unavailable',String(e?.message||e).slice(0,80))}
  }
  throw Error('Audio provider temporarily unavailable');
 }
 try{
  const clips=await Promise.all(parts.map(getMp3));
  const total=clips.reduce((n,a)=>n+a.length,0);
  const full=new Uint8Array(total);let offset=0;
  for(const clip of clips){full.set(clip,offset);offset+=clip.length}
  const headers={
   'Content-Type':'audio/mpeg',
   'Cache-Control':'public, max-age=86400, s-maxage=604800',
   'Accept-Ranges':'bytes',
   'X-Content-Type-Options':'nosniff'
  };
  const range=req.headers.get('range');
  if(range){
   const m=/^bytes=(\d+)-(\d*)$/.exec(range.trim());
   if(m){
    const start=Number(m[1]);
    const stop=m[2]?Math.min(total-1,Number(m[2])):total-1;
    if(start>=total||stop<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+total}});
    const slice=full.subarray(start,stop+1);
    return new Response(slice,{status:206,headers:{...headers,'Content-Range':'bytes '+start+'-'+stop+'/'+total,'Content-Length':String(slice.byteLength)}});
   }
  }
  return new Response(full,{status:200,headers:{...headers,'Content-Length':String(total)}});
 }catch(e){
  console.error('Reading Lab audio unavailable',String(e?.message||e));
  return response({error:'Audio temporarily unavailable'},502);
 }
}
