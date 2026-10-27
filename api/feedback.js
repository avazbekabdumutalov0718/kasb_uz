import { list, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

const PREFIX = 'wordrush-feedback/';
const MAX_FEEDBACK = 40;
const BAND_VALUES = new Set([
  ...Array.from({ length: 19 }, (_, i) => (i / 2).toFixed(1)),
  'not-taken'
]);

function reply(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function configured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function GET() {
  if (!configured()) return reply({ error: 'Feedback xotirasi ulanmagan.' }, 503);
  try {
    // Reverse timestamps in blob names make the newest comments sort first.
    const { blobs } = await list({ prefix: PREFIX, limit: MAX_FEEDBACK });
    const feedback = await Promise.all(blobs.map(async (item) => {
      const response = await fetch(item.url, { cache: 'no-store' });
      if (!response.ok) return null;
      const value = await response.json();
      if (!value || typeof value !== 'object') return null;
      return {
        id: String(value.id || ''),
        name: String(value.name || '').slice(0, 40),
        band: String(value.band || ''),
        message: String(value.message || '').slice(0, 800),
        createdAt: String(value.createdAt || '')
      };
    }));
    return reply({
      feedback: feedback.filter(Boolean).sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      )
    });
  } catch (error) {
    console.error('WORDRUSH feedback read failed:', error);
    return reply({ error: 'Fikrlarni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.' }, 500);
  }
}

export async function POST(request) {
  if (!configured()) return reply({ error: 'Feedback xotirasi ulanmagan.' }, 503);
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return reply({ error: 'Bu manbadan fikr yuborishga ruxsat yo‘q.' }, 403);
      }
    } catch {
      return reply({ error: 'Noto‘g‘ri so‘rov.' }, 400);
    }
  }
  const size = Number(request.headers.get('content-length') || 0);
  if (size > 3000) return reply({ error: 'Fikr juda uzun.' }, 413);

  let input;
  try {
    input = await request.json();
  } catch {
    return reply({ error: 'So‘rov formati noto‘g‘ri.' }, 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return reply({ error: 'So‘rov formati noto‘g‘ri.' }, 400);
  }
  // A hidden honeypot field discourages automatic form spam.
  if (input.website) return reply({ error: 'Fikr qabul qilinmadi.' }, 400);
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  const band = String(input.band ?? '');
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (name.length < 2 || name.length > 40 || /[<>\r\n]/.test(name)) {
    return reply({ error: 'Ism 2–40 ta belgidan iborat bo‘lsin.' }, 400);
  }
  if (!BAND_VALUES.has(band)) {
    return reply({ error: 'IELTS overall band score’ni tanlang.' }, 400);
  }
  if (message.length < 10 || message.length > 800) {
    return reply({ error: 'Fikr 10–800 ta belgidan iborat bo‘lsin.' }, 400);
  }
  if (/<[^>]*>|https?:\/\/|www\./i.test(message)) {
    return reply({ error: 'Fikrda HTML yoki reklama havolasi bo‘lmasin.' }, 400);
  }

  const feedback = {
    id: randomUUID(),
    name,
    band,
    message,
    createdAt: new Date().toISOString()
  };
  const reverseTime = String(9999999999999 - Date.now()).padStart(13, '0');
  try {
    await put(`${PREFIX}${reverseTime}-${feedback.id}.json`, JSON.stringify(feedback), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    });
    return reply({ feedback }, 201);
  } catch (error) {
    console.error('WORDRUSH feedback save failed:', error);
    return reply({ error: 'Fikrni saqlab bo‘lmadi. Keyinroq urinib ko‘ring.' }, 500);
  }
}
