/* WORDRUSH · yagona kunlik reja.
   Brauzer (classic <script>) ham, server (import '../tasks-plan.js') ham shu faylni ishlatadi.
   Reja o'zgarsa — faqat shu faylni tahrirlang.

   Qoida:
   - Dushanba / Chorshanba / Juma  -> DAY 1  (Reading · Writing · Vocab)
   - Seshanba / Payshanba / Shanba -> DAY 2  (Speaking · Listening · Vocab)
   - Yakshanba                     -> SUNDAY (Full mock + Review)
   - START sanasidan oldingi kunlarda vazifa yo'q (eski progress ko'rinmaydi). */
(function (root) {
  'use strict';

  var START = '2026-11-15';

  var T = function (id, title, min) { return [id, title, min]; };
  var G = function (id, name, icon, tasks) {
    return { id: id, name: name, label: name.toUpperCase(), icon: icon, tasks: tasks };
  };

  function build(def) {
    var tasks = [];
    def.groups.forEach(function (g) { g.tasks.forEach(function (t) { tasks.push(t); }); });
    def.tasks = tasks;
    def.total = tasks.length;
    return def;
  }

  var DAY1 = build({
    kind: 'day1', label: 'DAY 1', title: 'Reading · Writing · Vocab', emoji: '📖',
    groups: [
      G('reading', 'Reading', '▤', [
        T('r1', '4 ELS mini passages', 40),
        T('r2', '1 passage + analysis + 20+ vocab', 45),
        T('r3', 'Article', 25)
      ]),
      G('writing', 'Writing', '✎', [
        T('r4', 'Essay analysis · learn new vocab · at least 2 grammar structures', 50),
        T('l1', 'Write essay · Task 1–2', 60),
        T('l2', 'Learn topic collection', 30),
        T('l3', 'Learn types of questions', 25)
      ]),
      G('extra', 'Extra', '✦', [
        T('s1', 'Listening podcast · learn something new', 30),
        T('s2', 'Speaking with AI or partner', 30),
        T('s3', 'Learn new topic collection', 30),
        T('s4', 'Speed listening', 20)
      ])
    ]
  });

  var DAY2 = build({
    kind: 'day2', label: 'DAY 2', title: 'Speaking · Listening · Vocab', emoji: '🎧',
    groups: [
      G('speaking', 'Speaking', '🎙', [
        T('s5', 'Full mock', 20),
        T('s6', 'Learn topic collection', 30),
        T('w1', 'Speaking with AI or partner', 30),
        T('w2', 'Learn at least 2 structures', 20),
        T('w3', 'Shadowing', 20),
        T('g1', 'Record and speak about something that happened during the day', 10)
      ]),
      G('listening', 'Listening', '♫', [
        T('p1', 'Listening · 2 parts', 45),
        T('p2', 'Listen to a podcast · learn vocab', 30),
        T('p3', 'Speed listening', 20)
      ]),
      G('extra', 'Extra', '✦', [
        T('p4', 'Read an article', 25),
        T('p5', 'Essay analysis', 30)
      ])
    ]
  });

  var SUNDAY = build({
    kind: 'sunday', label: 'SUNDAY', title: 'Full Mock · Review', emoji: '🏁',
    groups: [
      G('sunday', 'Mock & Review', '🏁', [
        T('r1', 'Full mock and analysis', 180),
        T('r2', 'Review all tasks', 60)
      ])
    ]
  });

  var NONE = build({
    kind: 'none', label: '—', title: 'Reja hali boshlanmagan', emoji: '⏳', groups: []
  });

  var ALL = [].concat(DAY1.tasks, DAY2.tasks, SUNDAY.tasks);
  // Vazifa kodlari (r1, l1, s1 ...) eski tizim bilan mos; bir xil kod turli kun turlarida qayta ishlatiladi,
  // shuning uchun qidiruv kun turiga qarab bajariladi.
  var BY_KIND = {}, KNOWN = {};
  [DAY1, DAY2, SUNDAY].forEach(function (p) {
    BY_KIND[p.kind] = {};
    p.groups.forEach(function (g) {
      g.tasks.forEach(function (t) {
        var info = { id: t[0], title: t[1], minutes: t[2], group: g.id, groupName: g.name, kind: p.kind };
        BY_KIND[p.kind][t[0]] = info;
        if (!KNOWN[t[0]]) KNOWN[t[0]] = info;
      });
    });
  });
  function lookup(id, day) {
    id = String(id || '');
    if (day) { var p = forDay(day); if (BY_KIND[p.kind] && BY_KIND[p.kind][id]) return BY_KIND[p.kind][id]; }
    return KNOWN[id] || null;
  }

  function weekday(day) { return new Date(day + 'T12:00:00Z').getUTCDay(); } // 0 = yakshanba

  function forDay(day) {
    day = String(day || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < START) return NONE;
    var w = weekday(day);
    if (w === 0) return SUNDAY;
    return w % 2 === 1 ? DAY1 : DAY2; // 1,3,5 = DAY 1 · 2,4,6 = DAY 2
  }

  root.WRPlan = {
    START: START,
    forDay: forDay,
    all: ALL,
    kinds: { day1: DAY1, day2: DAY2, sunday: SUNDAY, none: NONE },
    has: function (id) { return Object.prototype.hasOwnProperty.call(KNOWN, String(id || '')); },
    info: function (id, day) { return lookup(id, day); },
    titleOf: function (id, day) { var x = lookup(id, day); return x ? x.title : ''; },
    minutesOf: function (id, day) { var x = lookup(id, day); return x ? x.minutes : 0; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
