// WORDRUSH Reading Lab: one-day trial data (03 November 2026, Asia/Tashkent).
// Every passage has exactly 30 whitespace-delimited English words and uses all six target expressions.
export const trialDay='2026-11-03';
export const vocabulary=[
 {term:'drift off',uz:'bilmasdan uxlab qolmoq',definition:'To fall asleep without intending to.',example:'I sometimes drift off while reading late at night.'},
 {term:'drowsiness',uz:'uyquchanlik',definition:'A feeling of being sleepy and tired.',example:'Drowsiness can reduce concentration during lessons.'},
 {term:'in the face of',uz:'...ga qaramay',definition:'Despite a difficult situation or challenge.',example:'In the face of pressure, she remained calm.'},
 {term:'take your lead from',uz:'...dan o‘rnak olmoq',definition:'To follow someone’s example or guidance.',example:'Take your lead from experienced teachers.'},
 {term:'inedible',uz:'yeyishga yaroqsiz',definition:'Not suitable or safe to eat.',example:'Some wild mushrooms are inedible.'},
 {term:'digestible',uz:'oson hazm bo‘ladigan',definition:'Easy for your body to break down as food.',example:'A light soup is usually easily digestible.'}
];
export const passages=[
 {title:'The Science of Productive Breaks',
  text:'In the face of drowsiness, office workers drift off unexpectedly. Take your lead from sleep researchers: choose digestible meals, avoid inedible snacks, and protect concentration through sensible breaks and routines.',
  question:'What do researchers encourage?',
  choices:['Skipping every break','Healthy meals and sensible breaks','Working without sleep'],correct:1,
  blank:'Office workers sometimes ____ unexpectedly.',blankTerm:'drift off'},
 {title:'Concentration in the Classroom',
  text:'Students may drift off during lectures when drowsiness accumulates. In the face of demanding schedules, take your lead from experienced tutors: prepare digestible meals, discard inedible food, and prioritize sleep.',
  question:'What is a suggested response to demanding schedules?',
  choices:['Prioritize sleep','Eat unsafe food','Avoid asking tutors'],correct:0,
  blank:'Students may ____ during lectures.',blankTerm:'drift off'},
 {title:'A Healthier Workplace',
  text:'In the face of workplace drowsiness, employees sometimes drift off. Take your lead from evidence-based managers: offer brief rests, provide digestible lunches, remove inedible items, and establish safer daily routines.',
  question:'Which workplace measure is mentioned?',
  choices:['Longer shifts without breaks','Removing edible food','Offering brief rests'],correct:2,
  blank:'Managers should remove ____ items.',blankTerm:'inedible'},
 {title:'Survival in Remote Environments',
  text:'Explorers might drift off as drowsiness increases. In the face of extreme conditions, take your lead from trained guides: pack digestible provisions, identify inedible plants, and rest before total exhaustion.',
  question:'What should explorers identify?',
  choices:['Inedible plants','Only expensive equipment','Nearby universities'],correct:0,
  blank:'Explorers should pack ____ provisions.',blankTerm:'digestible'},
 {title:'Preventing Fatigue Behind the Wheel',
  text:'In the face of chronic drowsiness, drivers could drift off without warning. Take your lead from safety specialists: rest regularly, choose digestible meals, avoid inedible products, and monitor fatigue carefully.',
  question:'What is the main safety advice?',
  choices:['Ignore exhaustion','Monitor fatigue and rest regularly','Drive for longer hours'],correct:1,
  blank:'Drivers may ____ without warning.',blankTerm:'drift off'}
];
export const vocabularyCheck=()=>{
 const terms=vocabulary.map(x=>x.term.toLowerCase());
 return passages.every(p=>p.text.trim().split(/\s+/).length===30 && terms.every(t=>p.text.toLowerCase().includes(t)));
};
