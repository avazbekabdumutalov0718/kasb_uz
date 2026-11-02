import {
  user,
  response,
  validDay,
  validTask,
  titles,
  entry,
  taskPath,
  save,
  read,
  cfgPath,
  proofPrefix,
  sign,
  entriesForDay,
  bridge,
  tg
} from './_tasks-kit.js';

import { randomUUID } from 'node:crypto';

export const config = { maxDuration: 30 };

/* Telegram bot tokeni (fayl yuklash uchun kerak).
   Sizdagi env nomi boshqacha bo'lsa, shu yerda o'zgartiring. */
const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.BOT_TOKEN ||
  process.env.TG_BOT_TOKEN ||
  '';

/* Kurs 1-kuni qaysi sana ekanini shu yerda belgilang (YYYY-MM-DD).
   Hozir: 2026-11-02 = 7-kun bo'ladigan qilib qo'yilgan. */
const COURSE_START = process.env.COURSE_START || '2026-10-27';

export async function GET(req) {
  const uid = user(req);

  if (!uid)
    return response({ error: 'Telegram orqali kiring' }, 401);

  const day = new URL(req.url).searchParams.get('day');

  if (!validDay(day))
    return response({ error: 'Invalid day' }, 400);

  const items = await entriesForDay(uid, day);

  return response({ day, uid, items });
}

export async function POST(req) {
  const uid = user(req);

  if (!uid)
    return response({ error: 'Login required' }, 401);

  let body;

  try {
    body = await req.json();
  } catch {
    return response({ error: 'Invalid JSON' }, 400);
  }

  const { day, id, action } = body;

  if (!validDay(day) || !validTask(id))
    return response({ error: 'Invalid task' }, 400);

  if (
    day > new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
  ) {
    return response({ error: 'Future day' }, 400);
  }

  const current = await entry(uid, day, id);

  if (action === 'save') {
    if (typeof body.seconds === 'number') {
      current.seconds = Math.max(0, Math.min(1e8, body.seconds));
    }

    if (Number.isFinite(body.duration)) {
      current.duration = Math.max(1, Math.min(720, body.duration));
    }

    const doneChanged = 'done' in body;

    if (doneChanged) {
      if (body.done && !current.proofs.length) {
        return response({ error: 'Proof required' }, 400);
      }

      current.done = Boolean(body.done);
      current.clock = current.done ? new Date().toISOString() : '';
    }

    await save(taskPath(uid, day, id), current);
    await publishScore(uid, day);

    // Faqat holat o'zgarganda kanalga qayta yuboramiz
    if (doneChanged) await notify(uid, day);

    return response({ item: current });
  }

  if (action === 'delete') {
    const proof = current.proofs?.find(p => p.id === body.proofId);

    if (!proof)
      return response({ error: 'Proof not found' }, 404);

    current.proofs = current.proofs.filter(p => p.id !== body.proofId);

    if (!current.proofs.length) {
      current.done = false;
      current.clock = '';
    }

    await save(taskPath(uid, day, id), current);

    try {
      await bridge('deleteFile', { uid, day, id, path: proof.pathname });
    } catch (error) {
      console.error('Storage delete warning:', error.message);
    }

    await publishScore(uid, day);
    await notify(uid, day);

    return response({ item: current });
  }

  if (action === 'proof') {
    const p = body.proof;

    if (!p || !String(p.pathname).startsWith(proofPrefix(uid, day, id))) {
      return response({ error: 'Invalid proof path' }, 400);
    }

    let cloud;

    try {
      cloud = await bridge('fileInfo', { uid, day, id, path: p.pathname });
    } catch {
      return response({ error: 'Proof not found' }, 400);
    }

    if (cloud.path !== p.pathname || cloud.size > 100 * 1024 * 1024) {
      return response({ error: 'Invalid proof' }, 400);
    }

    current.proofs ??= [];

    if (!current.proofs.some(x => x.pathname === p.pathname)) {
      current.done = true;
      current.clock = new Date().toISOString();

      current.proofs.push({
        id: randomUUID(),
        name: String(p.name || 'Proof').slice(0, 140),
        url: '',
        pathname: p.pathname,
        size: cloud.size,
        type: p.type || '',
        createdAt: new Date().toISOString()
      });

      await save(taskPath(uid, day, id), current);
      await publishScore(uid, day);
      await notify(uid, day);
    }

    return response({ item: current });
  }

  return response({ error: 'Unknown action' }, 400);
}

/* ------------------------------------------------------------------ */
/*  KANALGA YUBORISH                                                   */
/*  Eski xabarlar o'chadi -> yangi bitta tartibli xabar + HAQIQIY fayl */
/* ------------------------------------------------------------------ */

const CAPTION_LIMIT = 1024;
const MAX_PHOTO = 10 * 1024 * 1024; // Telegram: rasm 10 MB gacha
const MAX_FILE = 50 * 1024 * 1024; // Telegram: bot fayli 50 MB gacha

const esc = s =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function dayNumber(day) {
  const n = Math.floor(
    (Date.parse(day) - Date.parse(COURSE_START)) / 86400000
  ) + 1;

  return n > 0 ? n : 1;
}

async function whoIs(uid, cfg) {
  let name =
    cfg?.name ||
    [cfg?.firstName, cfg?.lastName].filter(Boolean).join(' ') ||
    '';
  let username = cfg?.username || '';

  if (!name || !username) {
    try {
      const c = await tg('getChat', { chat_id: uid });

      name ||= [c.first_name, c.last_name].filter(Boolean).join(' ');
      username ||= c.username || '';
    } catch (e) {
      console.error('getChat failed', e.message);
    }
  }

  return { name, username: String(username).replace(/^@/, '') };
}

function buildSummary(data, day, who, proofsByTask, failed) {
  const done = Object.values(data).filter(
    x => x.done && x.proofs?.length
  ).length;

  const head = [];

  const person = [];
  if (who.name) person.push('<b>' + esc(who.name) + '</b>');
  if (who.username) person.push('@' + esc(who.username));
  if (person.length) head.push('👤 ' + person.join(' · '));

  head.push('📅 ' + day);
  head.push('📊 <b>' + dayNumber(day) + '-kun: ' + done + '/21 ball</b>');

  const blocks = Object.entries(titles).map(([id, t]) => {
    const ok = data[id]?.done && data[id]?.proofs?.length;
    let block = (ok ? '✅ ' : '⬜ ') + esc(t);

    for (const n of proofsByTask[id] || []) {
      block += '\n   📎 ' + esc(n);
    }

    return block;
  });

  let text = head.join('\n') + '\n\n' + blocks.join('\n\n');

  if (failed.length) {
    text +=
      '\n\n⚠️ Yuborilmadi: ' + failed.map(esc).join(', ');
  }

  return text;
}

/* Faylni serverga yuklab olamiz (Telegram havola orqali .html olmaydi) */
async function download(url) {
  const r = await fetch(url);

  if (!r.ok) throw new Error('Download failed: ' + r.status);

  return Buffer.from(await r.arrayBuffer());
}

/* Telegramga multipart (haqiqiy fayl) yuklash */
async function tgUpload(method, fields, files) {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN topilmadi');

  const form = new FormData();

  for (const [k, v] of Object.entries(fields)) {
    form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  }

  for (const f of files) {
    form.append(
      f.field,
      new Blob([f.buffer], {
        type: f.type || 'application/octet-stream'
      }),
      f.filename
    );
  }

  const r = await fetch(
    'https://api.telegram.org/bot' + BOT_TOKEN + '/' + method,
    { method: 'POST', body: form }
  );

  const j = await r.json();

  if (!j.ok) throw new Error(j.description || 'Telegram error');

  return j.result;
}

/* items: [{ buffer, name, type }]; kind: 'photo' | 'document' */
async function sendGroup(channelId, kind, items, caption, ids) {
  const capFields = caption
    ? { caption, parse_mode: 'HTML' }
    : {};

  if (items.length === 1) {
    const it = items[0];

    const m = await tgUpload(
      kind === 'photo' ? 'sendPhoto' : 'sendDocument',
      { chat_id: String(channelId), ...capFields },
      [{ field: kind, buffer: it.buffer, filename: it.name, type: it.type }]
    );

    ids.push(m.message_id);
    return;
  }

  for (let i = 0; i < items.length; i += 10) {
    const chunk = items.slice(i, i + 10);

    if (chunk.length === 1) {
      const it = chunk[0];

      const m = await tgUpload(
        kind === 'photo' ? 'sendPhoto' : 'sendDocument',
        { chat_id: String(channelId) },
        [{ field: kind, buffer: it.buffer, filename: it.name, type: it.type }]
      );

      ids.push(m.message_id);
      continue;
    }

    const msgs = await tgUpload(
      'sendMediaGroup',
      {
        chat_id: String(channelId),
        media: chunk.map((it, idx) => ({
          type: kind,
          media: 'attach://f' + idx,
          ...(i === 0 && idx === 0 ? capFields : {})
        }))
      },
      chunk.map((it, idx) => ({
        field: 'f' + idx,
        buffer: it.buffer,
        filename: it.name,
        type: it.type
      }))
    );

    for (const m of msgs) ids.push(m.message_id);
  }
}

async function notify(uid, day) {
  try {
    const cfg = await read(cfgPath(uid)).catch(() => null);

    const channelId = process.env.WORDRUSH_CHANNEL_ID || cfg?.channelId;

    if (!channelId) {
      return { delivered: false, reason: 'Kanal ulanmagan' };
    }

    const statePath = 'wr-task-sync-v2/report/' + uid + '/' + day + '.json';

    // 1) Eski yuborilgan hamma xabarlarni (matn, rasm, fayl) o'chiramiz
    const old = await read(statePath).catch(() => null);
    const oldIds = old?.ids || (old?.id ? [old.id] : []);

    for (const mid of oldIds) {
      try {
        await tg('deleteMessage', { chat_id: channelId, message_id: mid });
      } catch (e) {
        console.error('Old message delete failed', mid, e.message);
      }
    }

    // 2) Kunning barcha proof fayllarini yuklab olamiz
    const data = await entriesForDay(uid, day);

    const images = [];
    const docs = [];
    const proofsByTask = {};
    const failed = [];

    for (const [taskId] of Object.entries(titles)) {
      for (const proof of data[taskId]?.proofs || []) {
        try {
          const file = await bridge('signedRead', {
            uid,
            day,
            path: proof.pathname
          });

          const buffer = await download(file.url);

          if (buffer.length > MAX_FILE) throw new Error('Too large');

          const type = proof.type || '';

          const item = {
            buffer,
            name: proof.name || 'proof',
            type
          };

          if (/^image\//.test(type) && buffer.length <= MAX_PHOTO) {
            images.push(item);
          } else {
            docs.push(item);
          }

          (proofsByTask[taskId] ||= []).push(item.name);
        } catch (e) {
          console.error('Proof load failed', proof.pathname, e.message);
          failed.push(proof.name || 'proof');
        }
      }
    }

    const who = await whoIs(uid, cfg);
    const summary = buildSummary(data, day, who, proofsByTask, failed);

    const ids = [];

    // 3) Yangi xabar: hisobot = fayl/rasm captioni (bitta tartibli xabar)
    const groups = [
      ['photo', images],
      ['document', docs]
    ].filter(g => g[1].length);

    const captionFits = summary.length <= CAPTION_LIMIT;

    if (!groups.length || !captionFits) {
      const sent = await tg('sendMessage', {
        chat_id: channelId,
        text: summary.slice(0, 4000),
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      ids.push(sent.message_id);
    }

    let first = true;

    for (const [kind, items] of groups) {
      try {
        await sendGroup(
          channelId,
          kind,
          items,
          first && captionFits ? summary : '',
          ids
        );

        first = false;
      } catch (e) {
        console.error('Media delivery failed', e.message);

        const sent = await tg('sendMessage', {
          chat_id: channelId,
          text:
            '⚠️ Fayl yuborilmadi: ' +
            esc(items.map(x => x.name).join(', ')) +
            '\n' + esc(e.message),
          parse_mode: 'HTML'
        }).catch(() => null);

        if (sent) ids.push(sent.message_id);
      }
    }

    await save(statePath, { ids });

    return { delivered: true };
  } catch (e) {
    console.error('Telegram channel delivery:', e.message);

    return { delivered: false, reason: e.message };
  }
}

async function publishScore(uid, day) {
  try {
    const data = await entriesForDay(uid, day);

    const done = Object.values(data).filter(
      x => x.done && x.proofs?.length
    ).length;

    await save('wr-task-ranking-v1/' + day + '/' + uid + '.json', {
      uid,
      done,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('Ranking write failed:', e);
  }
}