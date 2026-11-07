import { tg, bridge } from './_tasks-kit.js';
import { WRITING_TOPICS, topicForDay } from '../writing-topics.js';

export const config = { maxDuration: 30 };

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

function buildMessage(day, topic) {
  const n = topic.id;
  const ideas = (topic.ideas || []).map((x, i) => (i + 1) + '. ' + x).join('\n');
  return [
    '\u270d\ufe0f WORDRUSH \u00b7 BUGUNGI WRITING TOPIC',
    '\ud83d\udcc6 ' + day,
    '',
    '\ud83c\udfaf Topic ' + n + '/30',
    '\ud83c\uddec\ud83c\udde7 ' + topic.en,
    '\ud83c\uddfa\ud83c\uddff ' + topic.uz,
    '',
    '\ud83d\udca1 Mumkin bo\u2018lgan yo\u2018nalishlar:',
    ideas,
    '',
    '\ud83d\udcdd Vazifa:',
    '\u2022 Task 2 essay yozing (kamida 250 so\u2018z)',
    '\u2022 Yoki band essay analysis + o\u2018z essayingiz',
    '\u2022 Proof\u2019ni TASKS \u2192 Writing bo\u2018limiga yuklang',
    '',
    '\u2705 Intizom = natija. Bugungi mavzuni yozib qo\u2018ying.'
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

  const channelId = process.env.WORDRUSH_CHANNEL_ID;
  if (!channelId) {
    return Response.json({ error: 'WORDRUSH_CHANNEL_ID not configured' }, { status: 503 });
  }

  const { day, hour, minute } = tashkentNow();
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';

  // Faqat 00:00\u201300:10 (Toshkent). force=1 bilan istalgan vaqtda test.
  if (!force && (hour !== 0 || minute > 10)) {
    return Response.json({
      skipped: 'Only 00:00\u201300:10 Asia/Tashkent',
      day, hour, minute
    });
  }

  const markerPath = 'wr-task-weekly-v1/writing-topic-' + day + '.json';
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

    const topic = topicForDay(day);
    const text = buildMessage(day, topic);

    const sent = await tg('sendMessage', {
      chat_id: channelId,
      text,
      disable_web_page_preview: true
    });

    await bridge('save', {
      path: markerPath,
      data: {
        sentAt: new Date().toISOString(),
        messageId: sent.message_id,
        topic: { id: topic.id, en: topic.en, uz: topic.uz },
        day
      }
    });

    return Response.json({
      status: 'sent',
      day,
      topic: { id: topic.id, en: topic.en, uz: topic.uz },
      messageId: sent.message_id,
      totalTopics: WRITING_TOPICS.length
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('Writing topic cron failed', e);
    return Response.json({ error: String(e.message || e) }, { status: 503 });
  }
}
