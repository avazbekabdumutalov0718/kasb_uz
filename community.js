/* WORDRUSH visitor profile and public feedback.
   A profile is stored only in this browser. A name and band are published
   with a comment only when the visitor submits that comment. */
(() => {
  'use strict';
  const STORAGE_KEY = 'wordrush.visitor.v1';
  const LAST_POST_KEY = 'wordrush.feedback.lastPost';
  const BAND_VALUES = new Set([
    ...Array.from({ length: 19 }, (_, i) => (i / 2).toFixed(1)),
    'not-taken'
  ]);
  const $ = (selector) => document.querySelector(selector);
  let profile = null;
  let feedback = [];

  function readProfile() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (value && typeof value.name === 'string' &&
          value.name.trim().length >= 2 && BAND_VALUES.has(value.band)) {
        return { name: value.name.trim().slice(0, 40), band: value.band };
      }
    } catch {}
    return null;
  }

  function bandLabel(band) {
    return band === 'not-taken' ? 'Hali IELTS topshirmagan' : 'IELTS ' + band;
  }

  function createProfileModal() {
    const overlay = document.createElement('div');
    overlay.id = 'wrProfileOverlay';
    overlay.className = 'wr-entry-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="wr-entry-card" role="dialog" aria-modal="true" aria-labelledby="wrEntryHeading">
        <div class="wr-entry-top"><span class="wr-entry-logo">W<span>↗</span></span><span>WORDRUSH / WELCOME</span></div>
        <span class="section-kicker">YOUR LEARNING IDENTITY</span>
        <h2 id="wrEntryHeading">Avval tanishib olaylik<span>.</span></h2>
        <p>WORDRUSH’ga kirish uchun ismingiz va hozirgi IELTS overall band score’ingizni kiriting. Keyin xohlagan vaqtda ularni o‘zgartira olasiz.</p>
        <form id="wrProfileForm" autocomplete="on">
          <label for="wrVisitorName">ISMINGIZ <span>REQUIRED</span></label>
          <input id="wrVisitorName" type="text" name="name" autocomplete="given-name" minlength="2" maxlength="40" placeholder="Masalan, Avazbek" required>
          <label for="wrVisitorBand">IELTS OVERALL BAND SCORE <span>REQUIRED</span></label>
          <select id="wrVisitorBand" name="band" required><option value="">Band score’ni tanlang</option></select>
          <div class="wr-entry-actions"><button type="submit" class="wr-primary">WORDRUSH’ga kirish ↗</button><button type="button" id="wrProfileCancel" class="wr-secondary" hidden>Bekor qilish</button></div>
          <p class="wr-entry-privacy">🔒 Ism va ball ushbu brauzerda saqlanadi. Fikr yozsangiz, ular fikringiz bilan birga hammaga ko‘rinadi. Kiritilgan ball tasdiqlanmagan.</p>
          <p id="wrProfileError" class="wr-form-status" role="status"></p>
        </form>
      </div>`;
    document.body.append(overlay);
    const select = overlay.querySelector('#wrVisitorBand');
    for (let i = 18; i >= 0; i--) {
      const score = (i / 2).toFixed(1);
      const option = document.createElement('option');
      option.value = score;
      option.textContent = 'IELTS ' + score;
      select.append(option);
    }
    const notTaken = document.createElement('option');
    notTaken.value = 'not-taken';
    notTaken.textContent = 'Hali IELTS topshirmaganman';
    select.append(notTaken);
    overlay.querySelector('#wrProfileForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = overlay.querySelector('#wrVisitorName').value.trim().replace(/\s+/g, ' ');
      const band = select.value;
      if (name.length < 2 || name.length > 40 || !BAND_VALUES.has(band)) {
        overlay.querySelector('#wrProfileError').textContent = 'Ism va IELTS band score’ni to‘g‘ri kiriting.';
        return;
      }
      profile = { name, band };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch {}
      closeProfileModal();
      updateProfileButton();
      updateFeedbackIdentity();
    });
    overlay.querySelector('#wrProfileCancel').addEventListener('click', closeProfileModal);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && profile && !overlay.hidden) closeProfileModal();
    });
  }

  function showProfileModal() {
    const overlay = $('#wrProfileOverlay');
    overlay.hidden = false;
    document.documentElement.classList.add('wr-profile-locked');
    overlay.querySelector('#wrVisitorName').value = profile?.name || '';
    overlay.querySelector('#wrVisitorBand').value = profile?.band || '';
    overlay.querySelector('#wrProfileCancel').hidden = !profile;
    overlay.querySelector('#wrProfileError').textContent = '';
    requestAnimationFrame(() => overlay.querySelector('#wrVisitorName').focus());
  }

  function closeProfileModal() {
    if (!profile) return;
    $('#wrProfileOverlay').hidden = true;
    document.documentElement.classList.remove('wr-profile-locked');
  }

  function updateProfileButton() {
    const button = $('#wrProfileButton');
    if (!button) return;
    button.querySelector('.profile-avatar').textContent = (profile?.name || 'W').charAt(0).toLocaleUpperCase();
    button.querySelector('.wr-profile-name').textContent = profile?.name || 'WORDRUSH';
    button.querySelector('.wr-profile-band').textContent = profile ? ' · ' + bandLabel(profile.band) : '';
  }

  function installProfileButton() {
    const original = $('.profile-pill');
    if (!original) return;
    const button = document.createElement('button');
    button.id = 'wrProfileButton';
    button.type = 'button';
    button.className = 'profile-pill wr-profile-pill';
    button.title = 'Ism va IELTS band score’ni o‘zgartirish';
    button.innerHTML = '<span class="profile-avatar">W</span><span class="wr-profile-name">WORDRUSH</span><span class="wr-profile-band"></span><span class="online-dot"></span>';
    original.replaceWith(button);
    button.addEventListener('click', showProfileModal);
    updateProfileButton();
  }

  function updateFeedbackIdentity() {
    const element = $('#wrFeedbackIdentity');
    if (element) element.textContent = profile
      ? profile.name + ' · ' + bandLabel(profile.band)
      : 'Ism va IELTS ball kiritilmagan';
  }

  function createText(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function renderFeedback() {
    const list = $('#wrFeedbackList');
    if (!list) return;
    list.replaceChildren();
    const count = $('#wrFeedbackCount');
    if (count) count.textContent = feedback.length + ' TA FIKR';
    if (!feedback.length) {
      list.append(createText('p', 'wr-feedback-empty', 'Hali fikr yo‘q. Birinchi bo‘lib o‘z fikringizni qoldiring!'));
      return;
    }
    for (const item of feedback) {
      const card = document.createElement('article');
      card.className = 'wr-feedback-card';
      const head = document.createElement('div');
      head.className = 'wr-feedback-card-head';
      head.append(createText('span', 'wr-feedback-avatar', (item.name || '?').charAt(0).toLocaleUpperCase()));
      const info = document.createElement('div');
      info.className = 'wr-feedback-author';
      info.append(createText('strong', '', item.name || 'Guest'));
      info.append(createText('small', '', bandLabel(item.band)));
      head.append(info);
      const time = new Date(item.createdAt);
      if (Number.isFinite(time.getTime())) {
        head.append(createText('time', 'wr-feedback-date', time.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' })));
      }
      card.append(head, createText('p', 'wr-feedback-message', item.message || ''));
      list.append(card);
    }
  }

  async function refreshFeedback() {
    const status = $('#wrFeedbackStatus');
    if (!status) return;
    status.textContent = 'Fikrlar yuklanmoqda…';
    try {
      const response = await fetch('/api/feedback', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fikrlarni yuklab bo‘lmadi.');
      feedback = Array.isArray(data.feedback) ? data.feedback : [];
      renderFeedback();
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message || 'Fikrlar vaqtincha yuklanmadi.';
    }
  }

  function installFeedback() {
    const form = $('#wrFeedbackForm');
    if (!form) return;
    updateFeedbackIdentity();
    refreshFeedback();
    $('#wrFeedbackReload')?.addEventListener('click', refreshFeedback);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!profile) { showProfileModal(); return; }
      const status = $('#wrFeedbackSubmitStatus');
      const button = form.querySelector('button[type="submit"]');
      const message = $('#wrFeedbackMessage').value.trim();
      if (message.length < 10 || message.length > 800) {
        status.textContent = 'Kamida 10, ko‘pi bilan 800 ta belgi yozing.';
        return;
      }
      let last = 0;
      try { last = Number(localStorage.getItem(LAST_POST_KEY) || 0); } catch {}
      if (Date.now() - last < 30000) {
        status.textContent = 'Keyingi fikrdan oldin 30 soniya kuting.';
        return;
      }
      button.disabled = true;
      status.textContent = 'Fikringiz saqlanmoqda…';
      try {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: profile.name, band: profile.band, message, website: form.elements.website.value })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Fikrni yuborib bo‘lmadi.');
        feedback = [data.feedback, ...feedback.filter(x => x.id !== data.feedback.id)].slice(0, 40);
        renderFeedback();
        $('#wrFeedbackMessage').value = '';
        try { localStorage.setItem(LAST_POST_KEY, String(Date.now())); } catch {}
        status.textContent = '✓ Rahmat! Fikringiz barcha tashrif buyuruvchilarga ko‘rinadi.';
      } catch (error) {
        status.textContent = error.message || 'Fikr yuborishda xato yuz berdi.';
      } finally {
        button.disabled = false;
      }
    });
  }

  profile = readProfile();
  createProfileModal();
  installProfileButton();
  installFeedback();
  if (!profile) showProfileModal();
})();
