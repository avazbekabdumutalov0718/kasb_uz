// WORDRUSH — Daily Speaking Topics (30 PDF packs)
// 30 kunlik sikl: har topic aniq 1 marta. CYCLE_START = 2026-11-08

export const SPEAKING_CYCLE_START = '2026-11-08';
export const SPEAKING_CHANNEL_ID = '-1004452119694';

export const SPEAKING_TOPICS = [
  { id: 1, file: "01_Home.pdf", en: "Home" },
  { id: 2, file: "02_Hometown_and_Cities.pdf", en: "Hometown and Cities" },
  { id: 3, file: "03_Work_or_Study.pdf", en: "Work or Study" },
  { id: 4, file: "04_Inspiring_People.pdf", en: "Inspiring People" },
  { id: 5, file: "05_Successful_People.pdf", en: "Successful People" },
  { id: 6, file: "06_Teachers_and_Education.pdf", en: "Teachers and Education" },
  { id: 7, file: "07_Friends.pdf", en: "Friends" },
  { id: 8, file: "08_Public_Figures.pdf", en: "Public Figures" },
  { id: 9, file: "09_Creativity_and_Art.pdf", en: "Creativity and Art" },
  { id: 10, file: "10_Hard_Work.pdf", en: "Hard Work" },
  { id: 11, file: "11_Travel_and_Holidays.pdf", en: "Travel and Holidays" },
  { id: 12, file: "12_Nature.pdf", en: "Nature" },
  { id: 13, file: "13_Historical_Buildings.pdf", en: "Historical Buildings" },
  { id: 14, file: "14_Restaurants_and_Eating_Out.pdf", en: "Restaurants and Eating Out" },
  { id: 15, file: "15_Change.pdf", en: "Change" },
  { id: 16, file: "16_Adapting_to_Something_New.pdf", en: "Adapting to Something New" },
  { id: 17, file: "17_Health_and_Fitness.pdf", en: "Health and Fitness" },
  { id: 18, file: "18_Happiness.pdf", en: "Happiness" },
  { id: 19, file: "19_Childhood.pdf", en: "Childhood" },
  { id: 20, file: "20_Achievements.pdf", en: "Achievements" },
  { id: 21, file: "21_Challenges.pdf", en: "Challenges" },
  { id: 22, file: "22_Festivals.pdf", en: "Festivals" },
  { id: 23, file: "23_Gifts.pdf", en: "Gifts" },
  { id: 24, file: "24_Technology.pdf", en: "Technology" },
  { id: 25, file: "25_Apps_and_Mobile_Phones.pdf", en: "Apps and Mobile Phones" },
  { id: 26, file: "26_Books_and_Reading.pdf", en: "Books and Reading" },
  { id: 27, file: "27_Films_and_Media.pdf", en: "Films and Media" },
  { id: 28, file: "28_Clothes.pdf", en: "Clothes" },
  { id: 29, file: "29_Learning_New_Skills.pdf", en: "Learning New Skills" },
  { id: 30, file: "30_Traditional_Food.pdf", en: "Traditional Food" },
];

const N = SPEAKING_TOPICS.length;

function daysBetween(startISO, dayISO) {
  const a = Date.parse(startISO + 'T00:00:00Z');
  const b = Date.parse(dayISO + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86400000);
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleForCycle(cycleId) {
  const arr = Array.from({ length: N }, (_, i) => i);
  const rnd = mulberry32((cycleId * 10007 + 91) >>> 0);
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

export function speakingIndexForDay(day) {
  const offset = daysBetween(SPEAKING_CYCLE_START, day);
  const cycleId = Math.floor(offset / N);
  const dayInCycle = ((offset % N) + N) % N;
  return shuffleForCycle(cycleId)[dayInCycle];
}

export function speakingForDay(day) {
  return SPEAKING_TOPICS[speakingIndexForDay(day)];
}
