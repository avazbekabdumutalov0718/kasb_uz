// WORDRUSH — Daily Writing Topics (30)
// Har kuni 00:00 (Asia/Tashkent) da kanalga 1 ta topic.
// 30 kunlik sikl: har bir topic aniq 1 marta chiqadi, hech biri qolib ketmaydi.
// Har yangi 30 kunlik blokda tartib qayta aralashtiriladi (seed = sikl raqami).

export const WRITING_TOPICS = [
  { id: 1, en: 'Education', uz: 'Ta\u2019lim', ideas: ['Online learning', 'Free university education', 'Useful school subjects'] },
  { id: 2, en: 'Technology', uz: 'Texnologiya', ideas: ['Social media', 'Robots and AI taking jobs', 'Children and screen time'] },
  { id: 3, en: 'Government', uz: 'Hukumat va davlat xarajatlari', ideas: ['Taxes and public money', 'What to spend money on', 'Laws and rules'] },
  { id: 4, en: 'Society', uz: 'Jamiyat', ideas: ['Gap between rich and poor', 'Ageing population', 'Helping others (volunteering)'] },
  { id: 5, en: 'Health', uz: 'Sog\u2018liq', ideas: ['Healthy lifestyle', 'Free public healthcare', 'Stress and mental health'] },
  { id: 6, en: 'Space', uz: 'Koinot', ideas: ['Is space research worth it?', 'Space tourism', 'Living on Mars'] },
  { id: 7, en: 'Crime & Punishment', uz: 'Jinoyat va jazo', ideas: ['Prison or education?', 'Young criminals', 'Longer prison sentences'] },
  { id: 8, en: 'Environment', uz: 'Atrof-muhit', ideas: ['Climate change', 'Plastic waste', 'Clean (renewable) energy'] },
  { id: 9, en: 'Advertising', uz: 'Reklama', ideas: ['Adverts aimed at children', 'Ads for unhealthy food', 'Do ads make us buy more?'] },
  { id: 10, en: 'Tourism', uz: 'Turizm', ideas: ['Good and bad sides of tourism', 'Tourists and local people', 'Protecting historic places'] },
  { id: 11, en: 'Media & News', uz: 'OAV va yangiliklar', ideas: ['Fake news', 'Celebrities as role models', 'Bad news on TV'] },
  { id: 12, en: 'Work & Jobs', uz: 'Ish va bandlik', ideas: ['Working from home', 'Work-life balance', 'Money vs job satisfaction'] },
  { id: 13, en: 'Family & Children', uz: 'Oila va bolalar', ideas: ['Both parents working', 'Caring for old parents', 'Strict or free upbringing'] },
  { id: 14, en: 'Globalisation', uz: 'Globallashuv', ideas: ['Losing local culture', 'English as a world language', 'Big international companies'] },
  { id: 15, en: 'Cities & Transport', uz: 'Shaharlar va transport', ideas: ['Traffic jams', 'Public transport vs cars', 'Moving from village to city'] },
  { id: 16, en: 'Culture & Art', uz: 'Madaniyat va san\u2019at', ideas: ['Keeping old traditions', 'Free museums', 'Paying for art and music'] },
  { id: 17, en: 'Animals & Nature', uz: 'Hayvonlar va tabiat', ideas: ['Zoos: good or bad?', 'Testing medicine on animals', 'Saving rare animals'] },
  { id: 18, en: 'Sport', uz: 'Sport', ideas: ['Huge pay of top players', 'Sport lessons at school', 'Hosting big events (World Cup)'] },
  { id: 19, en: 'Shopping', uz: 'Xarid qilish', ideas: ['Buying more than we need', 'Online vs shop buying', 'Expensive brand names'] },
  { id: 20, en: 'Housing & Buildings', uz: 'Uy-joy va binolar', ideas: ['High house prices', 'Old vs modern buildings', 'Living in flats or houses'] },
  { id: 21, en: 'Food & Diet', uz: 'Oziq-ovqat va ovqatlanish', ideas: ['Fast food vs home cooking', 'Vegetarian diets', 'Sugar and public health'] },
  { id: 22, en: 'Science & Research', uz: 'Fan va tadqiqot', ideas: ['Government funding for science', 'Ethics in research', 'Science in everyday life'] },
  { id: 23, en: 'Language & Communication', uz: 'Til va muloqot', ideas: ['Learning foreign languages', 'Emoji and modern communication', 'Preserving minority languages'] },
  { id: 24, en: 'Personal Development', uz: 'Shaxsiy rivojlanish', ideas: ['Lifelong learning', 'Soft skills vs hard skills', 'Role of failure in success'] },
  { id: 25, en: 'Ethics & Morality', uz: 'Axloq va odob', ideas: ['Honesty in public life', 'Animal rights', 'Should laws follow morals?'] },
  { id: 26, en: 'Energy & Natural Resources', uz: 'Energiya va tabiiy resurslar', ideas: ['Oil dependence', 'Renewable energy transition', 'Who owns natural resources?'] },
  { id: 27, en: 'Water & Oceans', uz: 'Suv va okeanlar', ideas: ['Clean drinking water', 'Ocean pollution', 'Who should protect the seas?'] },
  { id: 28, en: 'Fashion & Clothing', uz: 'Moda va kiyim-kechak', ideas: ['Fast fashion problems', 'School uniforms', 'Judging people by clothes'] },
  { id: 29, en: 'Public Services', uz: 'Davlat xizmatlari', ideas: ['Free healthcare and education', 'Quality of public transport', 'Should public services be private?'] },
  { id: 30, en: 'Volunteering & Charity', uz: 'Ko\u2018ngillilik va xayriya', ideas: ['Should volunteering be required?', 'Local vs international charities', 'Helping people vs giving money'] }
];

// Sikl boshlanish sanasi (Toshkent). 8-noyabr 2026 = 1-kun.
export const CYCLE_START = '2026-11-08';
const N = WRITING_TOPICS.length; // 30

function daysBetween(startISO, dayISO) {
  const a = Date.parse(startISO + 'T00:00:00Z');
  const b = Date.parse(dayISO + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86400000);
}

/** Mulberry32 — barqaror pseudo-random */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Berilgan sikl uchun 0..29 indekslarining aralashmasi (har topic aniq 1 marta). */
function shuffleForCycle(cycleId) {
  const arr = Array.from({ length: N }, (_, i) => i);
  const rnd = mulberry32((cycleId * 10007 + 17) >>> 0);
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Kun bo'yicha topic indeksi.
 * - Har 30 kunda barcha 30 topic aniq 1 marta.
 * - Hech qaysi topic qolib ketmaydi.
 * - Har yangi 30 kunlik blokda tartib boshqacha.
 */
export function topicIndexForDay(day) {
  const offset = daysBetween(CYCLE_START, day);
  // floorDiv: manfiy offset uchun ham to'g'ri ishlaydi
  const cycleId = Math.floor(offset / N);
  const dayInCycle = ((offset % N) + N) % N;
  const order = shuffleForCycle(cycleId);
  return order[dayInCycle];
}

export function topicForDay(day) {
  return WRITING_TOPICS[topicIndexForDay(day)];
}

/** Debug: berilgan sikldagi 30 kun tartibi */
export function previewCycle(cycleId = 0) {
  const order = shuffleForCycle(cycleId);
  return order.map((idx, dayInCycle) => ({
    dayInCycle: dayInCycle + 1,
    topic: WRITING_TOPICS[idx]
  }));
}
