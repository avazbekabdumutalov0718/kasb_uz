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
const cmd=String(msg.text||'').split(' ')[0].split('@')[0];try{if(cmd==='/sayt')await tg('sendMessage',{chat_id:chat,text:site});else if(cmd==='/start'||cmd==='/tasks'){const link=site+'tasks.html?miniapp=1';await tg('sendMessage',{chat_id:chat,text:'☑ Homework Tracker — TASKS',reply_markup:{inline_keyboard:[[{text:'📋 Vazifalar',web_app:{url:link}}],[{text:'🌐 Sayt',url:site}]]}})}else if(cmd==='/app'){const ticket=sign(chat,'session',600);const link=site+'tasks.html?session='+encodeURIComponent(ticket);await tg('sendMessage',{chat_id:chat,text:'📱 WORDRUSH Android uchun kirish havolasi (10 daqiqa amal qiladi):\n\n'+link+'\n\nHavolani nusxalang va ilovadagi Bot TASKS → KIRISH oynasiga qo‘ying.',disable_web_page_preview:true})}else if(cmd==='/login'){const ticket=sign(chat);await tg('sendMessage',{chat_id:chat,text:'🔐 WORDRUSH TASKS saytda ham ochish:',reply_markup:{inline_keyboard:[[{text:'TASKS saytga kirish',url:site+'tasks.html?session='+encodeURIComponent(ticket)}]]}})}else if(cmd.startsWith('/channel')){const parts=String(msg.text||'').trim().split(/\s+/);if(parts[1]&&/^(@[\w]{5,}|-100\d{6,})$/.test(parts[1])){await tg('getChat',{chat_id:parts[1]});await save(cfgPath(chat),{channelId:parts[1]});await tg('sendMessage',{chat_id:chat,text:'✅ Kanal ulandi. Botga post yuborish huquqini bering.'})}}}catch(e){console.error('Bot webhook error:',e.message);return response({error:'Telegram delivery failed'},500)}return response({ok:true})}
