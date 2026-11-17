# ⚖️ WORDRUSH — JAZO (Punishment) bo‘limi

## Qoidalar (qanday ishlaydi)

| Qoida | Qiymat |
|---|---|
| Qachon jazo beriladi | Kunlik **majburiy** bo‘limlar (Reading, Writing, Speaking, Listening, yakshanba Mock) to‘liq bajarilmasa |
| Extra bo‘limi | Majburiy **emas** — u bajarilmasa jazo berilmaydi |
| Nechta jazo | 10 ta vazifadan **2 tasi avtomatik** tanlanadi (har bir odam + kun uchun barqaror tasodifiy, oldingi jazodagi vazifalar takrorlanmaslikka harakat qilinadi) |
| Qachon beriladi | Bajarilmagan kundan **keyingi kuni** (00:00 dan keyingi birinchi soatlik tekshiruvda) |
| Muddat | 3 kun (berilgan kun ham hisobda), oxirgi kun 23:59 gacha |
| Eslatma | Jazo berilgandan boshlab **har soatda** (24 soat), **5 daqiqadan so‘ng o‘chib ketadi**, bajarilmaguncha davom etadi |
| Jazo | Muddatda bajarilmasa **−5 ball** (reytingda; ball 0 dan pastga tushmaydi, bir jazo uchun faqat bir marta) |
| Proof | Kanalga **doimiy** yuboriladi (o‘chirilmaydi) va Mini App’da saqlanadi |

Doimiy xabarlar (o‘chmaydi): «JAZO BERILDI», «JAZO BALLI AYIRILDI», «JAZO BAJARILDI» va proof fayllari.
O‘chib ketadigan xabar: faqat soatlik «JAZO ESLATMASI».

## Fayllar

**Yangi**
- `punish-tasks.js` — 10 ta vazifa matni + **barcha sozlamalar** (nechta jazo, muddat, ball, boshlanish sanasi, optional bo‘limlar)
- `lib/punishment.js` — server mantiqi (jazo yaratish, eslatma, ball ayirish, kanalga yuborish)
- `api/punishment.js` — Mini App uchun API (ro‘yxat, yuklash, o‘chirish)
- `tasks-punish.js`, `tasks-punish.css` — Mini App’dagi **⚖️ Jazo** tabi (oddiy saytda alohida panel)
- `tools/punish-selftest.mjs` — sinov skripti

**O‘zgartirilgan**
- `lib/hourly-reminders.js` — soatlik tickka jazo tekshiruvi ulandi
- `api/tasks-ranking.js` — reytingda −5 ball hisobga olinadi
- `api/telegram-webhook.js`, `bot-config.js` — `/jazo` komandasi
- `tasks.html` — yangi fayllar ulandi
- `tasks-mini.js` — reytingda «−5 jazo» belgisi

## O‘rnatish

1. Zip ichidagi fayllarni repoga yuklang (yo‘llar saqlansin) → Vercel o‘zi deploy qiladi. Yangi paket yoki yangi env **shart emas** (mavjud `WORDRUSH_*`, `TELEGRAM_*`, `TASKS_SESSION_SECRET` ishlatiladi).
2. Bot menyusida `/jazo` ko‘rinishi uchun «webhook repair» ni bir marta ishga tushiring (`/api/telegram-webhook?repair=webhook`, `x-wordrush-scheduler` sarlavhasi bilan) — komanda `repair`siz ham ishlaydi, faqat menyuda chiqmaydi.
3. Ixtiyoriy env (kod ichidagi qiymatlarni bosadi): `PUNISH_FROM`, `PUNISH_DAYS`, `PUNISH_PENALTY`, `PUNISH_COUNT`, `PUNISH_TEMP_MINUTES`.

**Boshlanish sanasi:** `punish-tasks.js` da `from: '2026-11-17'` — shu kundan boshlab bajarilmagan kunlar jazoga olinadi (ya’ni 17-noyabr natijasi 18-noyabrda jazoga aylanadi). Boshqa sana kerak bo‘lsa shu qiymatni (yoki `PUNISH_FROM` env) o‘zgartiring. Deploy kechiksa, tizim o‘tgan 7 kungacha orqaga qarab hisoblaydi.

## Sinash

```
node tools/punish-selftest.mjs
```
Haqiqiy Telegram/Supabase’siz, soxta serverda 9 bosqichli to‘liq sikl: jazo tanlash → eslatma → 5 daqiqada o‘chishi → proof → muddat → −5 ball → reyting.

## Bilish kerak bo‘lgan cheklovlar

- **5 daqiqada o‘chish** soatlik tashqi scheduler qancha tez-tez chaqirishiga bog‘liq (mavjud soatlik eslatmalar bilan bir xil mexanizm). Scheduler har 5 daqiqada yoki tezroq chaqirsa, o‘chirish aniq ishlaydi.
- **Proof yuklash** mavjud `uploadToken` / `fileInfo` / `signedRead` / `deleteFile` Supabase funksiyalaridan foydalanadi. Ularning kodi repoda yo‘q, shuning uchun ular jazo vazifa kodlarini (`x1`…`x10`) qabul qilishi **haqiqiy muhitda** tekshirilishi kerak. Agar yuklashda xato chiqsa, shu funksiya vazifa kodini cheklayotgan bo‘ladi.
- Foydalanuvchi proof’ni Mini App’dan o‘chirsa, kanaldagi nusxa **saqlanib qoladi** («proof kanalda tursin» talabi bo‘yicha).
- Kunlik vazifani **kechikib** bajarish (o‘tgan kunni ochib) jazoni bekor qilmaydi — jazo yarim tundan keyin qat’iy beriladi.
- Bir kunda bir nechta kun o‘tkazib yuborilsa, har bir kun uchun alohida jazo (2 tadan) beriladi.
