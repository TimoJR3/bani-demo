import { icon, esc, rub, duration, mskToday, addDays, weekday, wdShort, dayNum, monShort, dateLabel, slugFromPath, api, applyBrand, STATUS, toast } from './common.js';

const slug = slugFromPath();
const API = `/api/b/${slug}`;
const MY_KEY = `zapis:${slug}:my`;
const app = document.getElementById('app');

const state = {
  cfg: null,
  cart: new Map(), // id -> qty
  step: 1, // 1 услуги, 2 время, 3 контакты, 4 готово
  date: null,
  time: null,
  slots: null, // null = загрузка, [] = нет мест
  form: { name: '', phone: '', address: '', comment: '', consent: false },
  errors: {},
  formError: '',
  sending: false,
  booking: null, // результат или сохранённая запись
};

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  render();
});

// ---------- расчёты ----------
function services() {
  return state.cfg.services || [];
}
function totals() {
  let sum = 0;
  let dur = 0;
  for (const s of services()) {
    const q = state.cart.get(s.id) || 0;
    sum += s.price * q;
    dur += s.duration * q;
  }
  const min = Number(state.cfg.minOrder) || 0;
  return { sum, dur, total: sum ? Math.max(sum, min) : 0, belowMin: sum > 0 && sum < min };
}
function schedule() {
  const s = state.cfg.schedule || {};
  return {
    workDays: s.workDays || [1, 2, 3, 4, 5, 6, 0],
    daysAhead: s.daysAhead || 14,
    daysOff: s.daysOff || [],
  };
}
function days() {
  const sch = schedule();
  const today = mskToday();
  return Array.from({ length: sch.daysAhead }, (_, i) => {
    const d = addDays(today, i);
    return { d, open: sch.workDays.includes(weekday(d)) && !sch.daysOff.includes(d) };
  });
}

// ---------- отрисовка ----------
function hero() {
  const c = state.cfg;
  const meta = [];
  if (c.phone) meta.push(`<a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${icon('phone')}${esc(c.phone)}</a>`);
  if (c.mode === 'onsite' && c.workArea) meta.push(`<span>${icon('pin')}${esc(c.workArea)}</span>`);
  else if (c.address) meta.push(`<span>${icon('pin')}${esc(c.address)}</span>`);
  return `<header class="hero"><div class="hero-in">
    <h1>${esc(c.name)}</h1>
    ${c.tagline ? `<p>${esc(c.tagline)}</p>` : ''}
    ${meta.length ? `<div class="hero-meta">${meta.join('')}</div>` : ''}
  </div></header>`;
}

function progress() {
  return `<div class="steps" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${state.step >= i ? 'on' : ''}"></i>`).join('')}</div>`;
}

function stepTitle(text, back) {
  return `<div class="step-title">
    ${back ? `<button class="icon-btn" data-act="back" aria-label="Назад">${icon('back')}</button>` : ''}
    <h2>${text}</h2></div>`;
}

function serviceCard(s) {
  const q = state.cart.get(s.id) || 0;
  const pic = s.photo ? `<img src="${esc(s.photo)}" alt="" loading="lazy">` : icon(s.icon || 'sparkles');
  const priceLine = `${rub(s.price)}${s.unit ? ` <small>за ${esc(s.unit)}</small>` : ''} <small>· ${duration(s.duration)}</small>`;
  let control;
  if (!s.unit) {
    control = `<button class="add ${q ? 'on' : ''}" data-act="toggle" data-id="${esc(s.id)}" aria-pressed="${q ? 'true' : 'false'}" aria-label="${q ? 'Убрать' : 'Добавить'}: ${esc(s.title)}">${icon(q ? 'check' : 'plus')}</button>`;
  } else if (!q) {
    control = `<button class="add" data-act="inc" data-id="${esc(s.id)}" aria-label="Добавить: ${esc(s.title)}">${icon('plus')}</button>`;
  } else {
    control = `<div class="qty">
      <button data-act="dec" data-id="${esc(s.id)}" aria-label="Меньше">${icon('minus')}</button>
      <output aria-label="Количество">${q}</output>
      <button data-act="inc" data-id="${esc(s.id)}" aria-label="Больше" ${q >= (s.maxQty || 20) ? 'disabled' : ''}>${icon('plus')}</button>
    </div>`;
  }
  return `<div class="svc ${q ? 'on' : ''}">
    <div class="svc-ic">${pic}</div>
    <div><h3>${esc(s.title)}</h3>${s.description ? `<p>${esc(s.description)}</p>` : ''}<div class="price">${priceLine}</div></div>
    ${control}
  </div>`;
}

function myBookingBanner() {
  const b = state.booking;
  if (!b || state.step !== 1) return '';
  if (b.status === 'cancelled' || b.status === 'done' || b.date < mskToday()) return '';
  const st = STATUS[b.status];
  return `<button class="mybooking" data-act="show-my">
    ${icon('clock')}
    <div><b>Ваша запись: ${esc(dateLabel(b.date))}, ${esc(b.time)}</b><br><span class="badge ${st.cls}">${st.label}</span></div>
    ${icon('back', 'ic flip')}
  </button>`;
}

function viewServices() {
  const t = totals();
  const min = Number(state.cfg.minOrder) || 0;
  return `${hero()}<main class="wrap">
    ${myBookingBanner()}
    ${progress()}
    ${stepTitle('Что нужно сделать?')}
    ${min ? `<p class="note" style="margin:-4px 0 12px">Минимальный заказ — ${rub(min)}</p>` : ''}
    <div class="list">${services().map(serviceCard).join('')}</div>
    <p class="note" style="margin-top:20px"><a href="privacy">Политика обработки персональных данных</a></p>
  </main>
  <div class="bar"><div class="bar-in">
    <div class="bar-sum">${t.sum ? `<b>${rub(t.total)}</b><span>${t.belowMin ? `минимальный заказ · ` : ''}≈ ${duration(t.dur)}</span>` : `<b>Выберите услуги</b><span>Цена посчитается сразу</span>`}</div>
    <button class="btn" data-act="to-time" ${t.sum ? '' : 'disabled'}>Выбрать время</button>
  </div></div>`;
}

function viewTime() {
  const t = totals();
  const ds = days();
  let slotsHtml;
  if (!state.date) slotsHtml = `<div class="empty">Выберите день</div>`;
  else if (state.slots === null) slotsHtml = `<div class="slots">${'<div class="skeleton"></div>'.repeat(8)}</div>`;
  else if (!state.slots.length) slotsHtml = `<div class="empty">На этот день свободного времени нет. Попробуйте другой день.</div>`;
  else
    slotsHtml = `<div class="slots" role="group" aria-label="Свободное время">${state.slots
      .map((s) => `<button class="slot ${state.time === s ? 'on' : ''}" data-act="time" data-v="${s}" aria-pressed="${state.time === s}">${s}</button>`)
      .join('')}</div>`;
  return `<main class="wrap" style="padding-top:8px">
    ${progress()}
    ${stepTitle(state.cfg.mode === 'onsite' ? 'Когда приехать?' : 'Когда вам удобно?', true)}
    <div class="days" role="group" aria-label="День">${ds
      .map(
        ({ d, open }) =>
          `<button class="day ${state.date === d ? 'on' : ''}" data-act="date" data-v="${d}" ${open ? '' : 'disabled'} aria-pressed="${state.date === d}" aria-label="${esc(dateLabel(d))}">
            <small>${wdShort(d)}</small><b>${dayNum(d)}</b><small>${monShort(d)}</small></button>`
      )
      .join('')}</div>
    ${slotsHtml}
    <p class="note">Займёт примерно ${duration(t.dur)}${state.cfg.mode === 'onsite' ? '. Время — когда мастер приедет к вам.' : '.'}</p>
  </main>
  <div class="bar"><div class="bar-in">
    <div class="bar-sum"><b>${rub(t.total)}</b><span>${state.time ? `${esc(dateLabel(state.date))}, ${state.time}` : 'Выберите время'}</span></div>
    <button class="btn" data-act="to-form" ${state.time ? '' : 'disabled'}>Далее</button>
  </div></div>`;
}

function summaryList(items, total) {
  return `<ul class="summary">${items
    .map((i) => `<li><span>${esc(i.title)}${i.unit ? ` × ${i.qty} ${esc(i.unit)}` : ''}</span><span>${rub(i.price * i.qty)}</span></li>`)
    .join('')}<li><span>Итого</span><span>${rub(total)}</span></li></ul>`;
}

function cartItems() {
  return services()
    .filter((s) => state.cart.get(s.id))
    .map((s) => ({ id: s.id, title: s.title, unit: s.unit, qty: state.cart.get(s.id), price: s.price }));
}

function field(name, label, attrs, hint = '') {
  const err = state.errors[name];
  const v = esc(state.form[name]);
  const input = attrs.textarea
    ? `<textarea id="f-${name}" name="${name}" ${attrs.extra || ''}>${v}</textarea>`
    : `<input id="f-${name}" name="${name}" value="${v}" ${attrs.extra || ''}>`;
  return `<label class="field ${err ? 'bad' : ''}" for="f-${name}"><span>${label}</span>${input}
    ${err ? `<div class="err" id="e-${name}">${esc(err)}</div>` : hint ? `<div class="hint">${hint}</div>` : ''}</label>`;
}

function viewForm() {
  const t = totals();
  const onsite = state.cfg.mode === 'onsite';
  return `<main class="wrap" style="padding-top:8px">
    ${progress()}
    ${stepTitle('Ваши контакты', true)}
    <form id="form" class="panel" novalidate>
      ${state.formError ? `<div class="form-error" role="alert">${esc(state.formError)}</div>` : ''}
      ${field('name', 'Имя', { extra: 'autocomplete="name" required maxlength="60"' })}
      ${field('phone', 'Телефон', { extra: 'type="tel" inputmode="tel" autocomplete="tel" required placeholder="+7 900 000-00-00"' }, 'Позвоним или напишем, чтобы подтвердить запись')}
      ${onsite ? field('address', 'Адрес', { extra: 'autocomplete="street-address" required maxlength="200" placeholder="Улица, дом, квартира"' }) : ''}
      ${field('comment', 'Комментарий', { textarea: true, extra: `maxlength="500" placeholder="${onsite ? 'Например: этаж, домофон, есть ли пятна' : 'Например: марка и модель авто'}"` })}
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label class="check"><input type="checkbox" name="consent" ${state.form.consent ? 'checked' : ''}>
        <span>Согласен на обработку персональных данных по <a href="privacy" target="_blank" rel="noopener">политике</a></span></label>
      ${state.errors.consent ? `<div class="err" id="e-consent">${esc(state.errors.consent)}</div>` : ''}
    </form>
    <div class="panel" style="margin-top:12px">
      <b>${esc(dateLabel(state.date))}, ${state.time}</b>
      ${summaryList(cartItems(), t.total)}
      ${t.belowMin ? `<p class="note">Сумма поднята до минимального заказа.</p>` : ''}
      <p class="note">Оплата после выполнения работы. Цена предварительная — мастер уточнит её при подтверждении.</p>
    </div>
  </main>
  <div class="bar"><div class="bar-in">
    <div class="bar-sum"><b>${rub(t.total)}</b><span>${esc(dateLabel(state.date))}, ${state.time}</span></div>
    <button class="btn" data-act="submit" ${state.sending ? 'disabled' : ''}>${state.sending ? 'Отправляем…' : 'Записаться'}</button>
  </div></div>`;
}

function installHint() {
  if (matchMedia('(display-mode: standalone)').matches) return '';
  if (installPrompt) return `<button class="btn ghost block install" data-act="install">Добавить на главный экран</button>`;
  if (/iphone|ipad/i.test(navigator.userAgent)) return `<p class="note install">Чтобы записываться в одно касание, нажмите «Поделиться» → «На экран „Домой“».</p>`;
  return '';
}

function viewDone() {
  const b = state.booking;
  const st = STATUS[b.status] || STATUS.new;
  const canCancel = (b.status === 'new' || b.status === 'confirmed') && b.date >= mskToday();
  const phone = state.cfg.phone;
  const fresh = state.step === 4;
  return `${hero()}<main class="wrap">
    <div class="done">
      <div class="big">${icon(b.status === 'cancelled' ? 'x' : 'check')}</div>
      <h2>${fresh ? 'Заявка отправлена' : 'Ваша запись'}</h2>
      <p style="margin:0 0 8px"><b>${esc(dateLabel(b.date))}, ${esc(b.time)}</b></p>
      <span class="badge ${st.cls}">${st.label}</span>
      ${fresh ? `<p class="muted" style="margin-top:12px">Мы свяжемся с вами, чтобы подтвердить. Статус обновится на этой странице.</p>` : ''}
    </div>
    <div class="panel">${summaryList(b.items, b.total)}
      ${b.address ? `<p class="note">Адрес: ${esc(b.address)}</p>` : ''}</div>
    <div style="display:grid;gap:10px;margin-top:16px">
      ${phone ? `<a class="btn ghost block" href="tel:${esc(phone.replace(/[^\d+]/g, ''))}">${icon('phone')}Позвонить</a>` : ''}
      ${canCancel ? `<button class="btn danger block" data-act="cancel">Отменить запись</button>` : ''}
      <button class="btn ghost block" data-act="new">Новая запись</button>
    </div>
    ${installHint()}
  </main>`;
}

let delegated = false; // режим «залы» рисует своя страница rooms.js

function render() {
  if (!state.cfg || delegated) return;
  const view = { 1: viewServices, 2: viewTime, 3: viewForm, 4: viewDone, 5: viewDone }[state.step];
  app.innerHTML = view();
}

// ---------- действия ----------
async function loadSlots() {
  state.slots = null;
  state.time = null;
  render();
  const d = state.date;
  try {
    const r = await api(`${API}/slots?date=${d}&duration=${totals().dur}`);
    if (state.date === d) state.slots = r.slots;
  } catch (e) {
    state.slots = [];
    toast(e.message);
  }
  render();
}

function go(step) {
  state.step = step;
  render();
  window.scrollTo({ top: 0 });
}

function validate() {
  const f = state.form;
  const e = {};
  if (f.name.trim().length < 2) e.name = 'Укажите имя';
  const digits = f.phone.replace(/\D/g, '');
  if (!(digits.length === 10 || (digits.length === 11 && /^[78]/.test(digits)))) e.phone = 'Проверьте номер: +7 и 10 цифр';
  if (state.cfg.mode === 'onsite' && f.address.trim().length < 5) e.address = 'Укажите адрес';
  if (!f.consent) e.consent = 'Без согласия мы не сможем принять заявку';
  state.errors = e;
  return Object.keys(e).length === 0;
}

async function submit() {
  if (state.sending) return;
  state.formError = '';
  if (!validate()) {
    render();
    const first = Object.keys(state.errors)[0];
    document.querySelector(`[name="${first}"]`)?.focus();
    return;
  }
  state.sending = true;
  render();
  try {
    const hp = document.querySelector('[name=website]')?.value || '';
    const b = await api(`${API}/bookings`, {
      method: 'POST',
      body: JSON.stringify({
        items: [...state.cart].map(([id, qty]) => ({ id, qty })),
        date: state.date,
        time: state.time,
        ...state.form,
        website: hp,
      }),
    });
    try {
      localStorage.setItem(MY_KEY, JSON.stringify({ id: b.id, t: b.token }));
    } catch {}
    state.booking = b;
    state.cart.clear();
    go(4);
  } catch (e) {
    state.formError = e.message;
    if (e.status === 409) {
      state.step = 2;
      loadSlots();
      toast(e.message);
    }
  } finally {
    state.sending = false;
    render();
  }
}

async function refreshMy() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(MY_KEY) || 'null');
  } catch {}
  if (!saved) return;
  try {
    state.booking = await api(`${API}/bookings/${saved.id}?t=${encodeURIComponent(saved.t)}`);
    state.booking.token = saved.t;
  } catch (e) {
    if (e.status === 404) {
      try { localStorage.removeItem(MY_KEY); } catch {}
    }
  }
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  const svc = id && services().find((s) => s.id === id);
  switch (act) {
    case 'toggle':
      state.cart.get(id) ? state.cart.delete(id) : state.cart.set(id, 1);
      render();
      break;
    case 'inc':
      state.cart.set(id, Math.min((state.cart.get(id) || 0) + 1, (svc && svc.maxQty) || 20));
      render();
      break;
    case 'dec': {
      const q = (state.cart.get(id) || 0) - 1;
      q > 0 ? state.cart.set(id, q) : state.cart.delete(id);
      render();
      break;
    }
    case 'to-time':
      go(2);
      if (!state.date) {
        const first = days().find((d) => d.open);
        if (first) state.date = first.d;
      }
      if (state.date) loadSlots();
      break;
    case 'date':
      state.date = el.dataset.v;
      loadSlots();
      break;
    case 'time':
      state.time = el.dataset.v;
      render();
      break;
    case 'to-form':
      go(3);
      break;
    case 'back':
      go(state.step - 1);
      break;
    case 'submit':
      submit();
      break;
    case 'show-my':
      go(5);
      refreshMy().then(render);
      break;
    case 'new':
      state.date = null;
      state.time = null;
      state.slots = null;
      go(1);
      break;
    case 'cancel': {
      if (!confirm('Отменить запись?')) return;
      try {
        const b = state.booking;
        state.booking = { ...(await api(`${API}/bookings/${b.id}/cancel?t=${encodeURIComponent(b.token)}`, { method: 'POST' })), token: b.token };
        toast('Запись отменена');
        render();
      } catch (e) {
        toast(e.message);
      }
      break;
    }
    case 'install':
      if (installPrompt) {
        installPrompt.prompt();
        installPrompt = null;
        render();
      }
      break;
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.closest('#form') || !(el.name in state.form)) return;
  state.form[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  if (state.errors[el.name] && (el.type !== 'checkbox' || el.checked)) {
    delete state.errors[el.name];
    el.closest('.field')?.classList.remove('bad');
    el.closest('.field')?.querySelector('.err')?.remove();
    document.getElementById('e-' + el.name)?.remove();
  }
});

// ---------- старт ----------
(async function init() {
  if (!slug) {
    app.innerHTML = '<div class="wrap"><p>Страница не найдена.</p></div>';
    return;
  }
  try {
    state.cfg = await api(`${API}/config`);
  } catch (e) {
    app.innerHTML = `<div class="wrap"><p style="padding-top:40px">${esc(e.message)}. <a href="">Обновить</a></p></div>`;
    return;
  }
  document.title = `${state.cfg.name} — онлайн-запись`;
  applyBrand(state.cfg);
  if (state.cfg.mode === 'rooms') {
    delegated = true;
    const { startRooms } = await import('./rooms.js');
    startRooms(state.cfg, { slug, API, MY_KEY, app });
    if (!document.querySelector('meta[name="zapis-slug"]') && 'serviceWorker' in navigator) navigator.serviceWorker.register(`/b/${slug}/sw.js`, { scope: `/b/${slug}/` }).catch(() => {});
    return;
  }
  await refreshMy();
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(`/b/${slug}/sw.js`, { scope: `/b/${slug}/` }).catch(() => {});
})();
