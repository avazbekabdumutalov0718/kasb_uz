// WORDRUSH — Daily Writing Topics (30)
// Har kuni 00:00 (Asia/Tashkent) da kanalga 1 ta random topic yuboriladi.
// Deterministik: bir kunda bir xil topic (kun asosida seed).

export const WRITING_TOPICS = [
  {
    id: 1,
    en: 'Education',
    uz: 'Ta\u2019lim',
    ideas: ['Online learning', 'Free university education', 'Useful school subjects']
  },
  {
    id: 2,
    en: 'Technology',
    uz: 'Texnologiya',
    ideas: ['Social media', 'Robots and AI taking jobs', 'Children and screen time']
  },
  {
    id: 3,
    en: 'Government',
    uz: 'Hukumat va davlat xarajatlari',
    ideas: ['Taxes and public money', 'What to spend money on', 'Laws and rules']
  },
  {
    id: 4,
    en: 'Society',
    uz: 'Jamiyat',
    ideas: ['Gap between rich and poor', 'Ageing population', 'Helping others (volunteering)']
  },
  {
    id: 5,
    en: 'Health',
    uz: 'Sog\u2018liq',
    ideas: ['Healthy lifestyle', 'Free public healthcare', 'Stress and mental health']
  },
  {
    id: 6,
    en: 'Space',
    uz: 'Koinot',
    ideas: ['Is space research worth it?', 'Space tourism', 'Living on Mars']
  },
  {
    id: 7,
    en: 'Crime & Punishment',
    uz: 'Jinoyat va jazo',
    ideas: ['Prison or education?', 'Young criminals', 'Longer prison sentences']
  },
  {
    id: 8,
    en: 'Environment',
    uz: 'Atrof-muhit',
    ideas: ['Climate change', 'Plastic waste', 'Clean (renewable) energy']
  },
  {
    id: 9,
    en: 'Advertising',
    uz: 'Reklama',
    ideas: ['Adverts aimed at children', 'Ads for unhealthy food', 'Do ads make us buy more?']
  },
  {
    id: 10,
    en: 'Tourism',
    uz: 'Turizm',
    ideas: ['Good and bad sides of tourism', 'Tourists and local people', 'Protecting historic places']
  },
  {
    id: 11,
    en: 'Media & News',
    uz: 'OAV va yangiliklar',
    ideas: ['Fake news', 'Celebrities as role models', 'Bad news on TV']
  },
  {
    id: 12,
    en: 'Work & Jobs',
    uz: 'Ish va bandlik',
    ideas: ['Working from home', 'Work-life balance', 'Money vs job satisfaction']
  },
  {
    id: 13,
    en: 'Family & Children',
    uz: 'Oila va bolalar',
    ideas: ['Both parents working', 'Caring for old parents', 'Strict or free upbringing']
  },
  {
    id: 14,
    en: 'Globalisation',
    uz: 'Globallashuv',
    ideas: ['Losing local culture', 'English as a world language', 'Big international companies']
  },
  {
    id: 15,
    en: 'Cities & Transport',
    uz: 'Shaharlar va transport',
    ideas: ['Traffic jams', 'Public transport vs cars', 'Moving from village to city']
  },
  {
    id: 16,
    en: 'Culture & Art',
    uz: 'Madaniyat va san\u2019at',
    ideas: ['Keeping old traditions', 'Free museums', 'Paying for art and music']
  },
  {
    id: 17,
    en: 'Animals & Nature',
    uz: 'Hayvonlar va tabiat',
    ideas: ['Zoos: good or bad?', 'Testing medicine on animals', 'Saving rare animals']
  },
  {
    id: 18,
    en: 'Sport',
    uz: 'Sport',
    ideas: ['Huge pay of top players', 'Sport lessons at school', 'Hosting big events (World Cup)']
  },
  {
    id: 19,
    en: 'Shopping',
    uz: 'Xarid qilish',
    ideas: ['Buying more than we need', 'Online vs shop buying', 'Expensive brand names']
  },
  {
    id: 20,
    en: 'Housing & Buildings',
    uz: 'Uy-joy va binolar',
    ideas: ['High house prices', 'Old vs modern buildings', 'Living in flats or houses']
  },
  {
    id: 21,
    en: 'Food & Diet',
    uz: 'Oziq-ovqat va ovqatlanish',
    ideas: ['Fast food vs home cooking', 'Vegetarian diets', 'Sugar and public health']
  },
  {
    id: 22,
    en: 'Science & Research',
    uz: 'Fan va tadqiqot',
    ideas: ['Government funding for science', 'Ethics in research', 'Science in everyday life']
  },
  {
    id: 23,
    en: 'Language & Communication',
    uz: 'Til va muloqot',
    ideas: ['Learning foreign languages', 'Emoji and modern communication', 'Preserving minority languages']
  },
  {
    id: 24,
    en: 'Personal Development',
    uz: 'Shaxsiy rivojlanish',
    ideas: ['Lifelong learning', 'Soft skills vs hard skills', 'Role of failure in success']
  },
  {
    id: 25,
    en: 'Ethics & Morality',
    uz: 'Axloq va odob',
    ideas: ['Honesty in public life', 'Animal rights', 'Should laws follow morals?']
  },
  {
    id: 26,
    en: 'Energy & Natural Resources',
    uz: 'Energiya va tabiiy resurslar',
    ideas: ['Oil dependence', 'Renewable energy transition', 'Who owns natural resources?']
  },
  {
    id: 27,
    en: 'Water & Oceans',
    uz: 'Suv va okeanlar',
    ideas: ['Clean drinking water', 'Ocean pollution', 'Who should protect the seas?']
  },
  {
    id: 28,
    en: 'Fashion & Clothing',
    uz: 'Moda va kiyim-kechak',
    ideas: ['Fast fashion problems', 'School uniforms', 'Judging people by clothes']
  },
  {
    id: 29,
    en: 'Public Services',
    uz: 'Davlat xizmatlari',
    ideas: ['Free healthcare and education', 'Quality of public transport', 'Should public services be private?']
  },
  {
    id: 30,
    en: 'Volunteering & Charity',
    uz: 'Ko\u2018ngillilik va xayriya',
    ideas: ['Should volunteering be required?', 'Local vs international charities', 'Helping people vs giving money']
  }
];

/** Kun bo\u2018yicha barqaror indeksi (0..29). Bir kunda doim bir xil topic. */
export function topicIndexForDay(day) {
  let h = 0;
  const s = String(day || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h % WRITING_TOPICS.length;
}

export function topicForDay(day) {
  return WRITING_TOPICS[topicIndexForDay(day)];
}
