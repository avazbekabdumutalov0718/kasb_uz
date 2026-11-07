// ============================================================
// WORDRUSH BOT — YAGONA SOZLAMALAR FAYLI
// Botning matnlari, tugmalari, komandalari va havolalari FAQAT shu yerda.
// Botni o'zgartirmoqchi bo'lsang, shu faylni tahrirla va GitHub'da Commit qil.
//
// QOIDALAR:
// - Matnlarni ' ' (bitta qo'shtirnoq) ichida yoz.
// - Matn ichida ' kerak bo'lsa, ‘ (qiyshiq) belgidan foydalan: so‘z, o‘qish.
// - Yangi qator uchun \n yoz.
// - {n} {total} {title} {text} {link} {url} kabi {…} belgilarni O'ZGARTIRMA —
//   ularni bot o'zi to'ldiradi.
// - Maxfiy kalitlarni (token va h.k.) bu yerga YOZMA!
// ============================================================

// ---------- 1. SAYT MANZILI ----------
export const SITE = 'https://wordrush-chi.vercel.app/';

// Mini App ochiladigan sahifalar (SITE ga qo'shiladi)
export const PAGES = {
  tasks: 'tasks.html?miniapp=1',
  reading: 'reading-lab.html?article={n}&miniapp=1', // {n} = article raqami
  login: 'tasks.html?session={ticket}',
};

// ---------- 2. /start, /reading, /article ----------
// Uchala komanda bir xil random Reading xabarini chiqaradi.
export const READING = {
  commands: ['/start', '/reading', '/article'],
  // {n} = article raqami, {total} = jami article, {title} = sarlavha, {text} = matn
  text:
    '📚 WORDRUSH · ADVANCED READING\n\n' +
    '🎲 Random article {n}/{total}\n' +
    '{title}\n\n' +
    '{text}\n\n' +
    '🔤 6 ta expression · 30 words\n' +
    '🎧 Audio flashcards + 3 quiz\n\n' +
    'Sinov: 6 ta so‘z · 5 ta article.',
  // Tugmalar (yuqoridan pastga). type: 'webapp' = Mini App, 'url' = oddiy havola
  buttons: [
    { text: '📖 O‘qish + Quiz + Audio', type: 'webapp', page: 'reading' },
    { text: '☑ TASKS ga kirish', type: 'webapp', page: 'tasks' },
    { text: '🌐 WORDRUSH', type: 'url', url: SITE },
  ],
};

// ---------- 3. /tasks ----------
export const TASKS = {
  text: '☑ Homework Tracker — TASKS',
  buttons: [
    { text: '📋 Vazifalar', type: 'webapp', page: 'tasks' },
    { text: '🌐 Sayt', type: 'url', url: SITE },
  ],
};

// ---------- 4. /sayt ----------
// Faqat sayt manzilini yuboradi (matn sifatida)
export const SAYT = { text: SITE };

// ---------- 5. /app (Android uchun kirish havolasi) ----------
export const APP = {
  ttlSeconds: 600, // havola necha soniya amal qiladi (600 = 10 daqiqa)
  // {link} = kirish havolasi
  text:
    '📱 WORDRUSH Android uchun kirish havolasi (10 daqiqa amal qiladi):\n\n' +
    '{link}\n\n' +
    'Havolani nusxalang va ilovadagi Bot TASKS → KIRISH oynasiga qo‘ying.',
};

// ---------- 6. /login (saytda ochish) ----------
export const LOGIN = {
  text: '🔐 WORDRUSH TASKS saytda ham ochish:',
  buttons: [{ text: 'TASKS saytga kirish', type: 'login' }],
};

// ---------- 7. /channel (kanal ulash) ----------
export const CHANNEL = {
  linked: '✅ Kanal ulandi. Proof va natijalar endi shu kanalga yuboriladi.', // kanaldan post forward qilinganda
  linkedByCommand: '✅ Kanal ulandi. Botga post yuborish huquqini bering.', // /channel @nom yozilganda
};

// ---------- 8. Telegram menyu (pastdagi ko'k tugma va "/" ro'yxati) ----------
// Bu o'zgarishlar faqat "webhook repair" ishga tushirilganda Telegram'ga yuboriladi.
export const MENU = {
  buttonText: 'WORDRUSH Mini App',
  buttonPage: 'tasks',
  commands: [
    { command: 'start', description: 'WORDRUSH Mini App va random reading' },
    { command: 'reading', description: 'Bugungi random article va audio' },
    { command: 'tasks', description: 'Homework Tracker' },
    { command: 'app', description: 'Android TASKS kirish havolasi' },
  ],
};
