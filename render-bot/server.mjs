import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const port = Number(process.env.PORT || 10000);
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const webBase = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_BASE_URL || '';
const website = 'https://wordrush-chi.vercel.app/';
const miniApp = 'https://wordrush-chi.vercel.app/tasks.html?miniapp=1';
const botConfigured = Boolean(token && webhookSecret);
const json = (response, status, payload) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(payload));
};
const constantCompare = (a,b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x,y);
};
async function telegram(method, payload) {
  if (!token) throw new Error('Bot token not configured');
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!data.ok) throw new Error('Telegram ' + method + ' failed with HTTP ' + response.status);
  return data.result;
}
const send = (chatId,text,markup) => telegram('sendMessage',{chat_id:chatId,text, ...(markup?{reply_markup:markup}:{}) });
function tasksButton() {
  return { inline_keyboard: [[{ text:'☑ TASKS — Mini App', web_app: {url:miniApp} }], [{text:'🌐 WORDRUSH sayt',url:website}]] };
}
async function onUpdate(update) {
  const msg = update.message;
  if (!msg || msg.chat?.type !== 'private') return;
  const text = String(msg.text || '').trim().split(/\s+/)[0]?.split('@')[0]?.toLowerCase();
  if (text === '/sayt') return send(msg.chat.id,'🌐 WORDRUSH rasmiy sayt:\n'+website);
  if (text === '/start' || text === '/tasks') {
    return send(msg.chat.id,'WORDRUSH TASKS ☑\nQuyidagi tugma orqali faqat TASKS Mini App ochiladi.',tasksButton());
  }
}
async function setupWebhook() {
  if (!botConfigured || !webBase.startsWith('https://')) {
    console.log('Telegram webhook disabled: add a NEW bot token, webhook secret and public Render URL.');
    return;
  }
  try {
    await telegram('setWebhook', {
      url: new URL('/telegram/webhook', webBase).toString(),
      secret_token: webhookSecret,
      allowed_updates: ['message'],
      drop_pending_updates: false
    });
    console.log('Telegram webhook registered');
  } catch(error) {
    console.error('Telegram webhook setup error:',error.message);
  }
}
const server = http.createServer(async(req,res)=>{
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    return json(res,200,{ok:true,service:'wordrush-telegram-tasks',botReady:botConfigured, proofSyncReady:false});
  }
  if (url.pathname !== '/telegram/webhook' || req.method !== 'POST') return json(res,404,{error:'Not found'});
  if (!botConfigured) return json(res,503,{error:'Bot is not configured'});
  if (!constantCompare(req.headers['x-telegram-bot-api-secret-token'],webhookSecret)) return json(res,403,{error:'Forbidden'});
  let body='',received=0;
  try {
    for await (const part of req) {
      received+=part.length;
      if (received>1024*1024) return json(res,413,{error:'Too large'});
      body+=part;
    }
    const update=JSON.parse(body);
    // Acknowledge only after Telegram send attempt; retries may follow failed attempts.
    await onUpdate(update);
    return json(res,200,{ok:true});
  } catch(err) {
    console.error('Webhook delivery failed:', err.message);
    return json(res,500,{error:'Webhook processing failed'});
  }
});
server.listen(port,'0.0.0.0',()=>{
  console.log('WORDRUSH bot server listening on port',port);
  void setupWebhook();
});
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
