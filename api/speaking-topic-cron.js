import { tg, bridge } from './_tasks-kit.js';
import {
  SPEAKING_TOPICS,
  SPEAKING_CHANNEL_ID,
  SPEAKING_CYCLE_START,
  speakingForDay
} from '../speaking-topics.js';

export const config = { maxDuration: 60 };

const SITE = process.env.WORDRUSH_SITE || 'https://wordrush-chi.vercel.app';

function tashkentNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    day: v.year + '-' + v.month + '-' + v.day,
    hour: Number(v.hour) % 24,
    minute: Number(v.minute)
  };
}

function buildCaption(day, topic) {
  return [
    '\ud83c\udfa4 WORDRUSH \u00b7 BUGUNGI SPEAKING TOPIC',
    '\ud83d\udcc6 ' + day,
    '',
    '\ud83c\udfaf Topic ' + topic.id + '/30',
    '\ud83c\uddec\ud83c\udde7 ' + topic.en,
    '',
    '\ud83d\udcc4 PDF ichida:',
    '\u2022 Part 1 savollar',
    '\u2022 Part 2 cue card',
    '\u2022 Part 3 discussion',
    '\u2022 Collocations + Band 8 structures',
    '',
    '\u2705 TASKS \u2192 Speaking ga proof yuklang.',
    '\ud83d\udcce To\u2018liq material pastdagi PDF faylda.'
  ].join('\n');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sendPdf(channelId, pdfUrl, topic) {
  const caption = '\ud83c\udfa4 ' + topic.en + ' \u00b7 Topic ' + topic.id + '/30';
  const errors = [];

  // 1) Faylni o'zimiz yuklab olamiz va Telegramga multipart qilib yuboramiz (3 urinish)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(pdfUrl, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('PDF HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 1000) throw new Error('PDF juda kichik (' + buf.length + ' bayt)');

      const form = new FormData();
      form.append('chat_id', String(channelId));
      form.append('caption', caption);
      form.append('document', new Blob([buf], { type: 'application/pdf' }), topic.file);

      const t = await fetch(
        'https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/sendDocument',
        { method: 'POST', body: form, signal: AbortSignal.timeout(30000) }
      );
      const j = await t.json();
      if (!j.ok) throw new Error('Telegram: ' + (j.description || t.status));
      return { doc: j.result, error: null };
    } catch (e) {
      errors.push('#' + attempt + ' ' + String(e.message || e));
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }

  // 2) Zaxira: Telegramning o'ziga havola orqali olishni topshiramiz
  try {
    const doc = await tg('sendDocument', { chat_id: channelId, document: pdfUrl, caption });
    return { doc, error: null };
  } catch (e) {
    errors.push('url: ' + String(e.message || e));
  }

  // 3) Oxirgi zaxira: hech bo'lmasa havolani yuboramiz
  try {
    await tg('sendMessage', {
      chat_id: channelId,
      text: '\ud83d\udcc4 PDF (Topic ' + topic.id + '): ' + pdfUrl,
      disable_web_page_preview: false
    });
  } catch (e) {
    errors.push('link: ' + String(e.message || e));
  }
  return { doc: null, error: errors.join(' | ') };
}

export async function GET(req) {
  const secret = process.env.CRON_SECRET || '';
  const scheduler = process.env.WORDRUSH_SCHEDULER_SECRET || '';
  const auth = req.headers.get('authorization') || '';
  const internal = scheduler && req.headers.get('x-wordrush-scheduler') === scheduler;
  const bearerOk = secret && auth === 'Bearer ' + secret;
  if (!internal && !bearerOk) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const channelId = SPEAKING_CHANNEL_ID || process.env.WORDRUSH_CHANNEL_ID;
  if (!channelId) {
    return Response.json({ error: 'Channel not configured' }, { status: 503 });
  }

  const { day, hour, minute } = tashkentNow();
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';

  if (!force && hour !== 0) {
    return Response.json({
      skipped: 'Only 00:00\u201300:59 Asia/Tashkent',
      day, hour, minute
    });
  }

  const markerPath = 'wr-task-weekly-v1/speaking-topic-' + day + '.json';
  try {
    const existing = await bridge('read', { path: markerPath }).catch(() => ({ data: null }));
    const docOnlyReq = url.searchParams.get('docOnly') === '1';
    if (existing?.data?.sentAt && existing?.data?.documentId && !force && !docOnlyReq) {
      return Response.json({
        status: 'already_sent',
        day,
        topic: existing.data.topic,
        sentAt: existing.data.sentAt
      });
    }

    const topic = speakingForDay(day);
    const caption = buildCaption(day, topic).slice(0, 1024);
    const pdfUrl = SITE.replace(/\/$/, '') + '/speaking/' + encodeURIComponent(topic.file);
    const docOnly = url.searchParams.get('docOnly') === '1';

    // Xabar yuborilgan, lekin PDF ketmagan bo'lsa: faqat PDF'ni qayta yuboramiz
    const retryDocOnly = docOnly || (existing?.data?.sentAt && !existing?.data?.documentId && !force);

    let msg = { message_id: existing?.data?.messageId || null };
    if (!retryDocOnly) {
      msg = await tg('sendMessage', {
        chat_id: channelId,
        text: caption,
        disable_web_page_preview: true
      });
    }

    const { doc, error: docError } = await sendPdf(channelId, pdfUrl, topic);

    await bridge('save', {
      path: markerPath,
      data: {
        sentAt: new Date().toISOString(),
        messageId: msg.message_id,
        documentId: doc?.message_id || null,
        topic: { id: topic.id, en: topic.en, file: topic.file },
        day,
        cycleStart: SPEAKING_CYCLE_START
      }
    });

    return Response.json({
      status: 'sent',
      day,
      topic: { id: topic.id, en: topic.en, file: topic.file },
      messageId: msg.message_id,
      documentId: doc?.message_id || null,
      pdfUrl,
      docError,
      totalTopics: SPEAKING_TOPICS.length
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('Speaking topic cron failed', e);
    return Response.json({ error: String(e.message || e) }, { status: 503 });
  }
}
