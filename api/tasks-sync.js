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
    // (taymer/duration saqlashlarida kanalni bezovta qilmaymiz)
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
/*  KANALGA YUBORISH: eski xabarlarni o'chirib, yangisini yuboradi     */
/* ------------------------------------------------------------------ */

const CAPTION_LIMIT = 1024;

const esc = s =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function buildSummary(data, day, name, proofsByTask) {
  const done = Object.values(data).filter(
    x => x.done && x.proofs?.length
  ).length;

  const blocks = Object.entries(titles).map(([id, t]) => {
    const ok = data[id]?.done && data[id]?.proofs?.length;
    let block = (ok ? '✅ ' : '⬜ ') + esc(t);

    for (const n of proofsByTask[id] || []) {
      block += '\n   📎 ' + esc(n);
    }

    return block;
  });

  return (
    (name ? '👤 <b>' + esc(name) + '</b>\n' : '') +
    '📅 ' + day + '\n' +
    '📊 <b>' + done + '/21 ball</b>\n\n' +
    blocks.join('\n\n')
  );
}

async function sendGroup(channelId, kind, items, caption, ids) {
  // Bitta fayl bo'lsa alohida, ko'p bo'lsa albom (10 tadan)
  if (items.length === 1) {
    const m = await tg(kind === 'photo' ? 'sendPhoto' : 'sendDocument', {
      chat_id: channelId,
      [kind]: items[0].url,
      ...(caption ? { caption, parse_mode: 'HTML' } : {})
    });
    ids.push(m.message_id);
    return;
  }

  for (let i = 0; i < items.length; i += 10) {
    const chunk = items.slice(i, i + 10);

    if (chunk.length === 1) {
      const m = await tg(kind === 'photo' ? 'sendPhoto' : 'sendDocument', {
        chat_id: channelId,
        [kind]: chunk[0].url
      });
      ids.push(m.message_id);
      continue;
    }

    const msgs = await tg('sendMediaGroup', {
      chat_id: channelId,
      media: chunk.map((x, idx) => ({
        type: kind,
        media: x.url,
        ...(i === 0 && idx === 0 && caption
          ? { caption, parse_mode: 'HTML' }
          : {})
      }))
    });

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

    // 2) Kunning barcha proof fayllarini yig'amiz
    const data = await entriesForDay(uid, day);

    const images = [];
    const docs = [];
    const proofsByTask = {};

    for (const [taskId, title] of Object.entries(titles)) {
      for (const proof of data[taskId]?.proofs || []) {
        try {
          const file = await bridge('signedRead', {
            uid,
            day,
            path: proof.pathname
          });

          const item = { url: file.url, name: proof.name, title };

          if (/^image\//.test(proof.type || '')) images.push(item);
          else docs.push(item);

          (proofsByTask[taskId] ||= []).push(proof.name);
        } catch (e) {
          console.error('Signed read failed', proof.pathname, e.message);
        }
      }
    }

    const name = cfg?.name || cfg?.firstName || cfg?.username || '';
    const summary = buildSummary(data, day, name, proofsByTask);
    const ids = [];

    // 3) Yangisini yuboramiz: bitta tartibli xabar (caption = hisobot)
    const groups = [
      ['photo', images],
      ['document', docs]
    ].filter(g => g[1].length);

    const captionFits = summary.length <= CAPTION_LIMIT;

    try {
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
        await sendGroup(
          channelId,
          kind,
          items,
          first && captionFits ? summary : '',
          ids
        );
        first = false;
      }
    } catch (e) {
      console.error('Media delivery failed', e);

      // Zaxira: yuborilganlarini tozalab, matn + havolalar yuboramiz
      for (const mid of ids.splice(0)) {
        await tg('deleteMessage', {
          chat_id: channelId,
          message_id: mid
        }).catch(() => {});
      }

      const links = [...images, ...docs]
        .map(x => '🔗 ' + esc(x.name) + '\n' + esc(x.url))
        .join('\n');

      const sent = await tg('sendMessage', {
        chat_id: channelId,
        text: (summary + (links ? '\n\n' + links : '')).slice(0, 4000),
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
      ids.push(sent.message_id);
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