import { bridge, tg, titles } from './_tasks-kit.js';

export const config = { maxDuration: 60 };

const timeParts = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { day: value.year+'-'+value.month+'-'+value.day, hour: Number(value.hour) % 24, minute: Number(value.minute) };
};

async function cleanDue(channelId) {
  const {messages} = await bridge('reminderDue');
  let deleted = 0, failed = 0;
  for (const m of messages) {
    // Only delete messages explicitly tracked as temporary hourly reminders.
    if (String(m.chat_id) !== String(channelId)) continue;
    try {
      await tg('deleteMessage', { chat_id: channelId, message_id: m.message_id });
      await bridge('reminderDeleted', {chat_id:channelId,message_id:m.message_id,ok:true});
      deleted++;
    } catch (e) {
      const message = String(e.message || e);
      // Telegram may already have removed the message; cleanup still succeeds.
      const alreadyGone = /message to delete not found|message can't be deleted|message cannot be deleted/i.test(message);
      await bridge('reminderDeleted',{chat_id:channelId,message_id:m.message_id,ok:alreadyGone,error:message}).catch(()=>{});
      if (alreadyGone) deleted++; else { failed++; console.error('Hourly reminder cleanup failed',message); }
    }
  }
  return {deleted, failed};
}

async function sendHourly(channelId, day, hour) {
  const {users} = await bridge('weeklyUsers');
  const output = {sent:0, complete:0, duplicate:0, failed:0};
  for (const user of users || []) {
    const uid = String(user.uid || '');
    if (!/^\d+$/.test(uid)) continue;
    let claimed = false;
    try {
      const {rows} = await bridge('weeklyData', {uid,start:day,end:day});
      const map = new Map((rows||[]).map(x => [x.path.split('/').pop().replace(/\.json$/,''), x.data]));
      const undone = Object.entries(titles).filter(([id])=> {
        const data = map.get(id);
        return !(data?.done && Array.isArray(data.proofs) && data.proofs.length>0);
      });
      if (!undone.length) {output.complete++;continue;}
      const claim = await bridge('reminderClaim', {uid,day,hour});
      if (!claim.claimed) {output.duplicate++;continue;}
      claimed = true;
      const completeCount = Object.keys(titles).length - undone.length;
      let name = 'Ishtirokchi '+uid.slice(-4);
      try {
        const chat = await tg('getChat',{chat_id:uid});
        name = [chat.first_name,chat.last_name].filter(Boolean).join(' ').trim() || chat.username || name;
      } catch(e) {console.warn('Telegram display name unavailable',e.message);}
      const text = [
        '⏰ WORDRUSH · SOATLIK ESLATMA',
        '👤 '+name.slice(0,80),
        '📅 '+day+' · '+String(hour).padStart(2,'0')+':00',
        '📊 Bajarilgan: '+completeCount+'/21',
        '📌 Qolgan: '+undone.length+' ta',
        '',
        '📝 BAJARILMAGAN VAZIFALAR',
        ...undone.map(([id,title],i)=>(i+1)+'. ⬜ '+title),
        '',
        '✅ TASKS’da proof yuklang va bajarilganini belgilang.',
        '🕔 Ushbu eslatma 5 daqiqadan so‘ng o‘chiriladi.'
      ].join('\n').slice(0,4000);
      const sent = await tg('sendMessage', {
        chat_id:channelId, text,
        disable_web_page_preview:true
      });
      // The message MUST be tracked for cleanup immediately after send.
      try {
        await bridge('reminderSent',{
          uid,day,hour,chat_id:String(channelId),message_id:sent.message_id
        });
      } catch(e) {
        // Prevent an untracked temporary message from being left behind.
        await tg('deleteMessage',{chat_id:channelId,message_id:sent.message_id}).catch(()=>{});
        throw e;
      }
      output.sent++;
    } catch(e) {
      output.failed++;
      console.error('Hourly reminder failed for participant',uid,e);
      if (claimed) await bridge('reminderRelease',{uid,day,hour}).catch(()=>{});
    }
  }
  return output;
}

export async function GET(req) {
  if (!process.env.WORDRUSH_SCHEDULER_SECRET ||
      req.headers.get('x-wordrush-scheduler')!==process.env.WORDRUSH_SCHEDULER_SECRET)
    return Response.json({error:'Forbidden'},{status:403});
  const channelId=process.env.WORDRUSH_CHANNEL_ID;
  if (!channelId) return Response.json({error:'WORDRUSH_CHANNEL_ID is missing'},{status:503});
  const {day,hour,minute}=timeParts();
  const result={day,hour,minute};
  try {
    result.cleanup=await cleanDue(channelId);
    // One reminder per hour. First 5 minutes allow retry when scheduled invocation is delayed.
    if (minute < 5) result.reminders=await sendHourly(channelId,day,hour);
    else result.reminders={skipped:'Not an hourly send minute'};
    return Response.json(result,{headers:{'cache-control':'no-store'}});
  } catch(e) {
    console.error('Hourly cron process failed',e);
    return Response.json({error:String(e.message||e)},{status:503});
  }
}
