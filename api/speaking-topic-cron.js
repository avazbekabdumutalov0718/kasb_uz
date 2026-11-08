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
  const bullets = (arr, max = 3) =>
    (arr || []).slice(0, max).map((x, i) => (i + 1) + '. ' + x).join('\n');
  return [
    '\ud83c\udfa4 WORDRUSH \u00b7 BUGUNGI SPEAKING TOPIC',
    '\ud83d\udcc6 ' + day,
    '',
    '\ud83c\udfaf Topic ' + topic.id + '/30',
    '\ud83c\uddec\ud83c\udde7 ' + topic.en,
    '',
    '\ud83d\udccc PART 1',
    bullets(topic.part1, 3) || '\u2014',
    '',
    '\ud83d\udccc PART 2 (Cue card)',
    bullets(topic.part2, 4) || '\u2014',
    '',
    '\ud83d\udccc PART 3',
    bullets(topic.part3, 3) || '\u2014',
    '',
    '\ud83d\udcce To\u2018liq material (collocations, structures, Band 8) \u2014 PDF faylda.',
    '\u2705 TASKS \u2192 Speaking bo\u2018limiga proof yuklang.'
  ].join('\n');
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

  if (!force && (hour !== 0 || minute > 15)) {
    return Response.json({
      skipped: 'Only 00:00\u201300:15 Asia/Tashkent',
      day, hour, minute
    });
  }

  const markerPath = 'wr-task-weekly-v1/speaking-topic-' + day + '.json';
  try {
    const existing = await bridge('read', { path: markerPath }).catch(() => ({ data: null }));
    if (existing?.data?.sentAt && !force) {
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

    const msg = await tg('sendMessage', {
      chat_id: channelId,
      text: caption,
      disable_web_page_preview: true
    });

    let doc = null;
    let docError = null;
    try {
      const head = await fetch(pdfUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      if (head.ok) {
        doc = await tg('sendDocument', {
          chat_id: channelId,
          document: pdfUrl,
          caption: '\ud83c\udfa4 ' + topic.en + ' \u00b7 Topic ' + topic.id + '/30'
        });
      } else {
        docError = 'PDF not found at ' + pdfUrl + ' (HTTP ' + head.status + ')';
      }
    } catch (e) {
      docError = String(e.message || e);
    }

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
