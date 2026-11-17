/* WORDRUSH · JAZO (Punishment) — vazifalar katalogi va sozlamalar.
   Brauzer (classic <script>) ham, server (import '../punish-tasks.js') ham shu faylni ishlatadi.
   Jazo qoidalarini o'zgartirmoqchi bo'lsangiz — faqat shu faylni tahrirlang.

   QOIDALAR
   - Kunlik MAJBURIY bo'limlar (Reading, Writing, Speaking, Listening, Sunday Mock) to'liq
     bajarilmasa, keyingi kuni 10 ta jazo vazifasidan 2 tasi AVTOMATIK tanlanadi.
   - "Extra" bo'limi majburiy emas — u bajarilmasa jazo berilmaydi (optionalGroups).
   - Jazo berilgandan boshlab soatiga bir marta eslatma yuboriladi (5 daqiqadan so'ng o'chadi).
   - deadlineDays kun ichida bajarilmasa — oldingi to'plagan ballaridan penaltyPoints ayiriladi.
   - Yuklangan proof'lar kanalda va Mini App'da saqlanib qoladi (o'chirilmaydi). */
(function (root) {
  'use strict';

  var CONFIG = {
    count: 2,                    // nechta jazo vazifasi avtomatik tanlanadi
    deadlineDays: 3,             // jazo berilgan kundan boshlab necha kun muddat (shu kun ham hisobda)
    penaltyPoints: 5,            // muddatda bajarilmasa ayriladigan ball
    tempMinutes: 5,              // soatlik eslatma necha daqiqadan keyin o'chadi
    from: '2026-11-17',          // shu kundan boshlab bajarilmagan kunlar jazoga olinadi (env: PUNISH_FROM)
    optionalGroups: ['extra'],   // majburiy bo'lmagan bo'limlar (tasks-plan.js dagi group id)
    remindAfterPenalty: true,    // ball ayrilgandan keyin ham, bajarilmaguncha eslatma davom etadi
    remindFromHour: 0,           // eslatma soatlari (Asia/Tashkent). 0–23 = 24 soat
    remindToHour: 23
  };

  var TEXT = {
    header: 'ENGLISH HOMEWORK – EXTRA TASKS',
    intro: 'If a student fails to complete their homework, they must complete one or more of the following tasks.',
    note: 'Important: All tasks must be completed carefully. Quality matters more than speed!'
  };

  var TASKS = [
    { id: 'x1', no: 1, icon: '📚', title: 'Vocabulary & Synonyms',
      en: 'Find 3 synonyms for each of 15 English words and write their Uzbek translations.' },
    { id: 'x2', no: 2, icon: '🔗', title: 'Phrasal Verbs',
      en: 'Learn 25 phrasal verbs and write one example sentence for each.' },
    { id: 'x3', no: 3, icon: '🎙', title: 'Speaking Challenge',
      en: 'Speak only English for 3 minutes without switching to Uzbek.' },
    { id: 'x4', no: 4, icon: '🎬', title: 'Film Review',
      en: 'Choose a film and give a 3-minute review in English.' },
    { id: 'x5', no: 5, icon: '🔄', title: 'Active & Passive Voice',
      en: 'Transform 30 sentences from active voice into passive voice.' },
    { id: 'x6', no: 6, icon: '🧩', title: 'Conditional Sentences',
      en: 'Write 20 sentences using different types of conditional structures.' },
    { id: 'x7', no: 7, icon: '🧵', title: 'Relative Clauses',
      en: 'Write 15 complex sentences using relative clauses.' },
    { id: 'x8', no: 8, icon: '💬', title: 'Reported Speech',
      en: 'Change 25 sentences from direct speech into reported speech.' },
    { id: 'x9', no: 9, icon: '✍️', title: 'Writing Challenge',
      en: 'Write a 200-word essay describing your typical day.' },
    { id: 'x10', no: 10, icon: '👨‍🏫', title: 'Grammar Teacher Challenge',
      en: 'Choose one grammar topic, prepare a complete lesson and teach it to the class.',
      requirementsTitle: 'Requirements for the Grammar Lesson:',
      requirements: [
        'Explain the grammar rule.',
        'Give the sentence structure.',
        'Provide 10 example sentences.',
        'Explain common mistakes.',
        'Prepare 10 exercises for classmates.',
        'Check and explain the answers.'
      ] }
  ];

  var BY_ID = {};
  TASKS.forEach(function (t) { BY_ID[t.id] = t; });

  root.WRPunish = {
    CONFIG: CONFIG,
    TEXT: TEXT,
    TASKS: TASKS,
    has: function (id) { return Object.prototype.hasOwnProperty.call(BY_ID, String(id || '')); },
    get: function (id) { return BY_ID[String(id || '')] || null; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
