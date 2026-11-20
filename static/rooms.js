// Страница брони для бань и саун (mode: "rooms"): клиент выбирает зал, часы и число гостей,
// сразу видит цену, затем свободное время. Шапка — живая 3D-сцена парной (scene3d.js).
import { icon, esc, rub, mskToday, addDays, weekday, wdShort, dayNum, monShort, dateLabel, api, STATUS, toast } from './common.js';

const SCENE_LABEL = { classic: 'Финская сауна', wood: 'Баня на дровах', pool: 'С бассейном', hammam: 'Хаммам' };

export function startRooms(cfg, { slug, API, MY_KEY, app }) {
  const rooms = cfg.rooms || [];
  const extras = cfg.services || [];
  const st = {
    step: 1,
    room: null,
    hours: 2,
    guests: 2,
    extras: new Map(),
    date: null,
    time: null,
    slots: null,
    form: { name: '', phone: '', comment: '', consent: false },
    errors: {},
    formError: '',
    sending: false,
    booking: null,
  };
  let scene = null;

  // ---------- правила и цена (повторяют расчёт на сервере) ----------
  const rules = (r) => {
    const minHours = Math.max(1, Math.floor(r.minHours || 2));
    const capacity = Math.max(1, Math.floor(r.capacity || 1));
    return {
      minHours,
      maxHours: Math.max(minHours, Math.min(24, Math.floor(r.maxHours || 12))),
      capacity,
      guestsIncluded: Math.min(capacity, Math.max(1, Math.floor(r.guestsIncluded || capacity))),
      extraGuestPrice: Math.max(0, Math.round(r.extraGuestPrice || 0)),
    };
  };
  const roomById = (id) => rooms.find((r) => r.id === id);
  function quote() {
    const r = roomById(st.room);
    if (!r) return null;
    const ru = rules(r);
    const lines = [{ title: r.title, qty: st.hours, unit: 'ч', price: r.pricePerHour }];
    let total = r.pricePerHour * st.hours;
    const extra = Math.max(0, st.guests - ru.guestsIncluded);
    if (extra && ru.extraGuestPrice) {
      lines.push({ title: `Гости сверх ${ru.guestsIncluded}`, qty: extra * st.hours, unit: 'чел·ч', price: ru.extraGuestPrice });
      total += extra * st.hours * ru.extraGuestPrice;
    }
    for (const s of extras) {
      const q = st.extras.get(s.id);
      if (!q) continue;
      lines.push({ title: s.title, qty: q, unit: s.unit || null, price: s.price });
      total += s.price * q;
    }
    const min = Number(cfg.minOrder) || 0;
    return { lines, total: Math.max(total, min) };
  }
  const endTime = (t, h) => {
    const [hh, mm] = t.split(':').map(Number);
    const m = (hh * 60 + mm + h * 60) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };
  const hoursWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'час' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'часа' : 'часов');
  const guestsWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'гость' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'гостя' : 'гостей');

  function sched() {
    const s = cfg.schedule || {};
    return { workDays: s.workDays || [0, 1, 2, 3, 4, 5, 6], daysAhead: s.daysAhead || 14, daysOff: s.daysOff || [], open: s.open || '09:00', close: s.close || '21:00' };
  }
  function days() {
    const s = sched();
    const today = mskToday();
    return Array.from({ length: s.daysAhead }, (_, i) => {
      const d = addDays(today, i);
      return { d, open: s.workDays.includes(weekday(d)) && !s.daysOff.includes(d) };
    });
  }
  const hoursLabel = () => {
    const s = sched();
    return s.open === '00:00' && s.close === '24:00' ? 'Круглосуточно' : `${s.open}–${s.close}`;
  };

  // ---------- каркас: 3D-шапка создаётся один раз ----------
  const firstScene = (rooms[0] && rooms[0].scene) || 'classic';
  const meta = [];
  if (cfg.phone) meta.push(`<a href="tel:${esc(cfg.phone.replace(/[^\d+]/g, ''))}">${icon('phone')}${esc(cfg.phone)}</a>`);
  if (cfg.address) meta.push(`<span>${icon('pin')}${esc(cfg.address)}</span>`);
  meta.push(`<span>${icon('clock')}${hoursLabel()}</span>`);
  app.innerHTML = `
    <header class="r-hero r-v-${esc(firstScene)}" id="rhero">
      <canvas id="rscene" aria-hidden="true"></canvas>
      <div class="r-shade"></div>
      <div class="r-hero-in">
        <span class="r-kicker">${esc(cfg.kicker || 'Баня · сауна · бронь онлайн')}</span>
        <h1>${esc(cfg.name)}</h1>
        ${cfg.tagline ? `<p>${esc(cfg.tagline)}</p>` : ''}
        <div class="r-meta">${meta.join('')}</div>
        <button class="btn r-cta" data-r="to-rooms">Выбрать зал и время</button>
      </div>
    </header>
    <div id="rv"></div>`;
  const hero = document.getElementById('rhero');
  const rv = document.getElementById('rv');

  import('./scene3d.js')
    .then(({ mountScene }) => {
      scene = mountScene(document.getElementById('rscene'), { variant: firstScene, accent: (cfg.colors && cfg.colors.primary) || '#c9935a' });
      if (scene) hero.classList.add('r-3d');
    })
    .catch(() => {});

  function setScene(v) {
    hero.className = hero.className.replace(/r-v-\w+/, 'r-v-' + v);
    scene && scene.setVariant(v);
  }

  // ---------- шаги ----------
  function progress() {
    return `<div class="steps" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${st.step >= i ? 'on' : ''}"></i>`).join('')}</div>`;
  }
  function title(text, back) {
    return `<div class="step-title">${back ? `<button class="icon-btn" data-r="back" aria-label="Назад">${icon('back')}</button>` : ''}<h2>${text}</h2></div>`;
  }
  function stepper(kind, value, min, max, label) {
    return `<div class="r-stepper" role="group" aria-label="${label}">
      <button data-r="${kind}-dec" ${value <= min ? 'disabled' : ''} aria-label="Меньше">${icon('minus')}</button>
      <output>${value}</output>
      <button data-r="${kind}-inc" ${value >= max ? 'disabled' : ''} aria-label="Больше">${icon('plus')}</button></div>`;
  }

  function roomCard(r) {
    const ru = rules(r);
    const on = st.room === r.id;
    const chips = r.features || [];
    const extraNote = ru.extraGuestPrice && ru.guestsIncluded < ru.capacity
      ? `<p class="note">В цене до ${ru.guestsIncluded} гостей, каждый следующий +${rub(ru.extraGuestPrice)}/ч</p>` : '';
    return `<article class="r-room ${on ? 'on' : ''} r-v-${esc(r.scene || 'classic')}">
      <button class="r-room-head" data-r="room" data-id="${esc(r.id)}" aria-pressed="${on}">
        <div class="r-room-vis"><span>${esc(SCENE_LABEL[r.scene] || 'Зал')}</span></div>
        <div class="r-room-body">
          <h3>${esc(r.title)}</h3>
          ${r.description ? `<p>${esc(r.description)}</p>` : ''}
          <div class="r-chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
          <div class="r-room-foot"><b>${rub(r.pricePerHour)}<small>/час</small></b><span>до ${ru.capacity} ${guestsWord(ru.capacity)} · от ${ru.minHours} ${hoursWord(ru.minHours)}</span></div>
        </div>
      </button>
      ${on ? `<div class="r-room-cfg">
        <div class="r-row"><span>Сколько часов</span>${stepper('h', st.hours, ru.minHours, ru.maxHours, 'Часы')}</div>
        <div class="r-row"><span>Сколько гостей</span>${stepper('g', st.guests, 1, ru.capacity, 'Гости')}</div>
        ${extraNote}
      </div>` : ''}
    </article>`;
  }

  function extraCard(s) {
    const q = st.extras.get(s.id) || 0;
    const control = s.unit
      ? q
        ? `<div class="qty"><button data-r="x-dec" data-id="${esc(s.id)}" aria-label="Меньше">${icon('minus')}</button><output>${q}</output><button data-r="x-inc" data-id="${esc(s.id)}" aria-label="Больше">${icon('plus')}</button></div>`
        : `<button class="add" data-r="x-inc" data-id="${esc(s.id)}" aria-label="Добавить: ${esc(s.title)}">${icon('plus')}</button>`
      : `<button class="add ${q ? 'on' : ''}" data-r="x-toggle" data-id="${esc(s.id)}" aria-pressed="${!!q}" aria-label="${q ? 'Убрать' : 'Добавить'}: ${esc(s.title)}">${icon(q ? 'check' : 'plus')}</button>`;
    return `<div class="svc r-extra ${q ? 'on' : ''}"><div><h3>${esc(s.title)}</h3>${s.description ? `<p>${esc(s.description)}</p>` : ''}
      <div class="price">${rub(s.price)}${s.unit ? ` <small>за ${esc(s.unit)}</small>` : ''}</div></div>${control}</div>`;
  }

  function myBanner() {
    const b = st.booking;
    if (!b || st.step !== 1 || b.status === 'cancelled' || b.status === 'done' || b.date < mskToday()) return '';
    const s = STATUS[b.status];
    return `<button class="mybooking" data-r="show-my">${icon('clock')}<div><b>Ваша бронь: ${esc(dateLabel(b.date))}, ${esc(b.time)}</b><br><span class="badge ${s.cls}">${s.label}</span></div>${icon('back', 'ic flip')}</button>`;
  }

  function viewRooms() {
    const q = quote();
    return `<main class="wrap" id="rooms">
      ${cfg.demo ? `<div class="r-demo" role="note"><b>Демо для владельца.</b> Бронь здесь пробная: имя и телефон не сохраняются и никуда не отправляются.</div>` : ''}
      ${myBanner()}
      ${progress()}
      ${title('Выберите зал')}
      <div class="r-rooms">${rooms.map(roomCard).join('')}</div>
      ${extras.length ? `<h2 class="r-sub">Добавить к отдыху</h2><div class="list">${extras.map(extraCard).join('')}</div>` : ''}
      ${cfg.demo && cfg.demo.note ? `<p class="note" style="margin-top:20px">${esc(cfg.demo.note)}</p>` : ''}
      <p class="note" style="margin-top:12px"><a href="privacy">Политика обработки персональных данных</a></p>
    </main>
    <div class="bar"><div class="bar-in">
      <div class="bar-sum">${q ? `<b>${rub(q.total)}</b><span>${st.hours} ${hoursWord(st.hours)} · ${st.guests} ${guestsWord(st.guests)}</span>` : `<b>Выберите зал</b><span>Цена посчитается сразу</span>`}</div>
      <button class="btn" data-r="to-time" ${q ? '' : 'disabled'}>Выбрать время</button>
    </div></div>`;
  }

  function viewTime() {
    const q = quote();
    const r = roomById(st.room);
    let slots;
    if (!st.date) slots = `<div class="empty">Выберите день</div>`;
    else if (st.slots === null) slots = `<div class="slots">${'<div class="skeleton"></div>'.repeat(8)}</div>`;
    else if (!st.slots.length) slots = `<div class="empty">На этот день «${esc(r.title)}» на ${st.hours} ${hoursWord(st.hours)} занят. Попробуйте другой день или меньше часов.</div>`;
    else slots = `<div class="slots" role="group" aria-label="Время начала">${st.slots.map((s) => `<button class="slot ${st.time === s ? 'on' : ''}" data-r="time" data-v="${s}" aria-pressed="${st.time === s}">${s}</button>`).join('')}</div>`;
    return `<main class="wrap" style="padding-top:8px">
      ${progress()}
      ${title('Когда придёте?', true)}
      <div class="days" role="group" aria-label="День">${days().map(({ d, open }) => `<button class="day ${st.date === d ? 'on' : ''}" data-r="date" data-v="${d}" ${open ? '' : 'disabled'} aria-pressed="${st.date === d}" aria-label="${esc(dateLabel(d))}"><small>${wdShort(d)}</small><b>${dayNum(d)}</b><small>${monShort(d)}</small></button>`).join('')}</div>
      ${slots}
      <p class="note">${esc(r.title)}, ${st.hours} ${hoursWord(st.hours)}. ${st.time ? `Вы отдыхаете с ${st.time} до ${endTime(st.time, st.hours)}.` : 'Выберите время начала.'}</p>
    </main>
    <div class="bar"><div class="bar-in">
      <div class="bar-sum"><b>${rub(q.total)}</b><span>${st.time ? `${esc(dateLabel(st.date))}, ${st.time}–${endTime(st.time, st.hours)}` : 'Выберите время'}</span></div>
      <button class="btn" data-r="to-form" ${st.time ? '' : 'disabled'}>Далее</button>
    </div></div>`;
  }

  function summary(lines, total) {
    return `<ul class="summary">${lines.map((i) => `<li><span>${esc(i.title)}${i.unit ? ` × ${i.qty} ${esc(i.unit)}` : ''}</span><span>${rub(i.price * i.qty)}</span></li>`).join('')}<li><span>Итого</span><span>${rub(total)}</span></li></ul>`;
  }
  function field(name, label, extra, hint = '', textarea = false) {
    const err = st.errors[name];
    const v = esc(st.form[name]);
    const input = textarea ? `<textarea id="r-${name}" name="${name}" ${extra}>${v}</textarea>` : `<input id="r-${name}" name="${name}" value="${v}" ${extra}>`;
    return `<label class="field ${err ? 'bad' : ''}" for="r-${name}"><span>${label}</span>${input}${err ? `<div class="err">${esc(err)}</div>` : hint ? `<div class="hint">${hint}</div>` : ''}</label>`;
  }
  function viewForm() {
    const q = quote();
    const when = `${esc(dateLabel(st.date))}, ${st.time}–${endTime(st.time, st.hours)}`;
    return `<main class="wrap" style="padding-top:8px">
      ${progress()}
      ${title('Ваши контакты', true)}
      <form id="rform" class="panel" novalidate>
        ${st.formError ? `<div class="form-error" role="alert">${esc(st.formError)}</div>` : ''}
        ${field('name', 'Имя', 'autocomplete="name" required maxlength="60"')}
        ${field('phone', 'Телефон', 'type="tel" inputmode="tel" autocomplete="tel" required placeholder="+7 900 000-00-00"', 'Администратор позвонит или напишет, чтобы подтвердить бронь')}
        ${field('comment', 'Пожелания', 'maxlength="500" placeholder="Например: день рождения, нужен банщик к 20:00"', '', true)}
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <label class="check"><input type="checkbox" name="consent" ${st.form.consent ? 'checked' : ''}><span>Согласен на обработку персональных данных по <a href="privacy" target="_blank" rel="noopener">политике</a></span></label>
        ${st.errors.consent ? `<div class="err">${esc(st.errors.consent)}</div>` : ''}
      </form>
      <div class="panel" style="margin-top:12px"><b>${when}</b> · ${st.guests} ${guestsWord(st.guests)}${summary(q.lines, q.total)}
        <p class="note">${cfg.demo ? 'Это демо: заявка пробная, данные не сохраняются.' : 'Оплата на месте. Бронь станет окончательной после подтверждения администратором.'}</p></div>
    </main>
    <div class="bar"><div class="bar-in">
      <div class="bar-sum"><b>${rub(q.total)}</b><span>${when}</span></div>
      <button class="btn" data-r="submit" ${st.sending ? 'disabled' : ''}>${st.sending ? 'Отправляем…' : 'Забронировать'}</button>
    </div></div>`;
  }

  function viewDone() {
    const b = st.booking;
    const s = STATUS[b.status] || STATUS.new;
    const canCancel = (b.status === 'new' || b.status === 'confirmed') && b.date >= mskToday();
    const fresh = st.step === 4;
    return `<main class="wrap">
      <div class="done"><div class="big">${icon(b.status === 'cancelled' ? 'x' : 'check')}</div>
        <h2>${fresh ? 'Бронь отправлена' : 'Ваша бронь'}</h2>
        <p style="margin:0 0 8px"><b>${esc(dateLabel(b.date))}, ${esc(b.time)}${b.hours ? `–${endTime(b.time, b.hours)}` : ''}</b>${b.roomTitle ? `<br>${esc(b.roomTitle)}${b.guests ? `, ${b.guests} ${guestsWord(b.guests)}` : ''}` : ''}</p>
        <span class="badge ${s.cls}">${s.label}</span>
        ${fresh ? `<p class="muted" style="margin-top:12px">Администратор свяжется с вами, чтобы подтвердить. Статус обновится на этой странице.</p>` : ''}</div>
      <div class="panel">${summary(b.items, b.total)}</div>
      <div style="display:grid;gap:10px;margin-top:16px">
        ${cfg.phone ? `<a class="btn ghost block" href="tel:${esc(cfg.phone.replace(/[^\d+]/g, ''))}">${icon('phone')}Позвонить</a>` : ''}
        ${canCancel ? `<button class="btn danger block" data-r="cancel">Отменить бронь</button>` : ''}
        <button class="btn ghost block" data-r="new">Новая бронь</button>
      </div>
    </main>`;
  }

  function render() {
    hero.classList.toggle('compact', st.step === 2 || st.step === 3);
    rv.innerHTML = { 1: viewRooms, 2: viewTime, 3: viewForm, 4: viewDone, 5: viewDone }[st.step]();
  }
  function go(step) {
    st.step = step;
    render();
    window.scrollTo({ top: step === 1 ? 0 : 0 });
  }

  async function loadSlots() {
    st.slots = null;
    st.time = null;
    render();
    const d = st.date;
    try {
      const r = await api(`${API}/slots?date=${d}&duration=${st.hours * 60}&room=${encodeURIComponent(st.room)}`);
      if (st.date === d) st.slots = r.slots;
    } catch (e) {
      st.slots = [];
      toast(e.message);
    }
    render();
  }

  function validate() {
    const f = st.form;
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Укажите имя';
    const d = f.phone.replace(/\D/g, '');
    if (!(d.length === 10 || (d.length === 11 && /^[78]/.test(d)))) e.phone = 'Проверьте номер: +7 и 10 цифр';
    if (!f.consent) e.consent = 'Без согласия мы не сможем принять бронь';
    st.errors = e;
    return !Object.keys(e).length;
  }

  async function submit() {
    if (st.sending) return;
    st.formError = '';
    if (!validate()) {
      render();
      document.querySelector(`#rform [name="${Object.keys(st.errors)[0]}"]`)?.focus();
      return;
    }
    st.sending = true;
    render();
    try {
      const b = await api(`${API}/bookings`, {
        method: 'POST',
        body: JSON.stringify({
          room: st.room, hours: st.hours, guests: st.guests,
          items: [...st.extras].map(([id, qty]) => ({ id, qty })),
          date: st.date, time: st.time,
          name: st.form.name, phone: st.form.phone, comment: st.form.comment, consent: st.form.consent,
          website: document.querySelector('#rform [name=website]')?.value || '',
        }),
      });
      try { localStorage.setItem(MY_KEY, JSON.stringify({ id: b.id, t: b.token })); } catch {}
      st.booking = b;
      st.extras.clear();
      go(4);
    } catch (e) {
      st.formError = e.message;
      if (e.status === 409) {
        st.step = 2;
        loadSlots();
        toast(e.message);
      }
    } finally {
      st.sending = false;
      render();
    }
  }

  async function refreshMy() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(MY_KEY) || 'null'); } catch {}
    if (!saved) return;
    try {
      st.booking = await api(`${API}/bookings/${saved.id}?t=${encodeURIComponent(saved.t)}`);
      st.booking.token = saved.t;
    } catch (e) {
      if (e.status === 404) try { localStorage.removeItem(MY_KEY); } catch {}
    }
  }

  function pickRoom(id) {
    const r = roomById(id);
    if (!r) return;
    const ru = rules(r);
    if (st.room !== id) {
      st.room = id;
      st.hours = Math.min(Math.max(st.hours, ru.minHours), ru.maxHours);
      st.guests = Math.min(Math.max(st.guests, 1), ru.capacity);
      st.date = null;
      st.time = null;
      setScene(r.scene || 'classic');
    }
    render();
  }

  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-r]');
    if (!el) return;
    const act = el.dataset.r;
    const id = el.dataset.id;
    const r = roomById(st.room);
    const ru = r && rules(r);
    const ex = id && extras.find((s) => s.id === id);
    switch (act) {
      case 'to-rooms':
        if (st.step !== 1) go(1);
        document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'room': pickRoom(id); break;
      case 'h-inc': st.hours = Math.min(st.hours + 1, ru.maxHours); render(); break;
      case 'h-dec': st.hours = Math.max(st.hours - 1, ru.minHours); render(); break;
      case 'g-inc': st.guests = Math.min(st.guests + 1, ru.capacity); render(); break;
      case 'g-dec': st.guests = Math.max(st.guests - 1, 1); render(); break;
      case 'x-toggle': st.extras.get(id) ? st.extras.delete(id) : st.extras.set(id, 1); render(); break;
      case 'x-inc': st.extras.set(id, Math.min((st.extras.get(id) || 0) + 1, (ex && ex.maxQty) || 20)); render(); break;
      case 'x-dec': { const q = (st.extras.get(id) || 0) - 1; q > 0 ? st.extras.set(id, q) : st.extras.delete(id); render(); break; }
      case 'to-time':
        go(2);
        if (!st.date) st.date = (days().find((d) => d.open) || {}).d || null;
        if (st.date) loadSlots();
        break;
      case 'date': st.date = el.dataset.v; loadSlots(); break;
      case 'time': st.time = el.dataset.v; render(); break;
      case 'to-form': go(3); break;
      case 'back': go(st.step - 1); break;
      case 'submit': submit(); break;
      case 'show-my': go(5); refreshMy().then(render); break;
      case 'new': st.date = null; st.time = null; st.slots = null; go(1); break;
      case 'cancel': {
        if (!confirm('Отменить бронь?')) return;
        try {
          const b = st.booking;
          st.booking = { ...(await api(`${API}/bookings/${b.id}/cancel?t=${encodeURIComponent(b.token)}`, { method: 'POST' })), token: b.token };
          toast('Бронь отменена');
          render();
        } catch (e) { toast(e.message); }
        break;
      }
    }
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (!el.closest('#rform') || !(el.name in st.form)) return;
    st.form[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    if (st.errors[el.name]) {
      delete st.errors[el.name];
      el.closest('.field')?.classList.remove('bad');
      el.closest('.field')?.querySelector('.err')?.remove();
    }
  });

  refreshMy().then(render);
  render();
}
