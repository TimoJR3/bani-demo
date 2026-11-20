// Демо без сервера: отвечает на запросы страницы прямо в браузере.
// Настройки бизнеса берутся из config.json рядом со страницей, пробные брони живут
// только в localStorage этого браузера и никуда не отправляются.
// Логика повторяет server.js (расписание, занятость залов, цена).

const MSK = 180;
const now = () => {
  const d = new Date(Date.now() + MSK * 60000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
};
const addDays = (s, n) => {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const toHHMM = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

let cfgPromise = null;
const config = () => (cfgPromise ||= fetch('config.json', { cache: 'no-cache' }).then((r) => r.json()));

function store(slug) {
  const key = `zapis-demo:${slug}:bookings`;
  return {
    all() { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } },
    save(list) { try { localStorage.setItem(key, JSON.stringify(list)); } catch {} },
  };
}

function sched(cfg) {
  const s = cfg.schedule || {};
  return {
    workDays: s.workDays || [0, 1, 2, 3, 4, 5, 6], open: s.open || '09:00', close: s.close || '21:00',
    step: Math.max(15, Number(s.step) || 30), daysAhead: Math.min(60, Math.max(1, Number(s.daysAhead) || 14)),
    capacity: Math.max(1, Number(s.capacity) || 1), leadMinutes: Math.max(0, Number(s.leadMinutes) || 60),
    bufferMinutes: Math.max(0, Number(s.bufferMinutes) || 0), daysOff: s.daysOff || [],
  };
}

function freeSlots(cfg, bookings, date, duration, room) {
  const sch = sched(cfg);
  const n = now();
  if (date < n.date || date > addDays(n.date, sch.daysAhead - 1)) return [];
  if (!sch.workDays.includes(weekday(date)) || sch.daysOff.includes(date)) return [];
  if (cfg.mode === 'rooms') {
    bookings = bookings.filter((b) => b.room === room);
    sch.capacity = 1;
  }
  const same = bookings.filter((b) => b.date === date && b.status !== 'cancelled');
  const busy = duration + sch.bufferMinutes;
  const out = [];
  for (let t = toMin(sch.open); t + duration <= toMin(sch.close); t += sch.step) {
    if (date === n.date && t < n.minutes + sch.leadMinutes) continue;
    const overlap = same.filter((b) => { const s = toMin(b.time); return s < t + busy && t < s + b.duration + sch.bufferMinutes; }).length;
    if (overlap < sch.capacity) out.push(toHHMM(t));
  }
  return out;
}

function err(status, message) {
  return Object.assign(new Error(message), { status });
}

function price(cfg, body) {
  const byId = new Map((cfg.services || []).map((s) => [s.id, s]));
  const lines = [];
  let total = 0;
  let duration = 0;
  let extra = {};
  if (cfg.mode === 'rooms') {
    const r = (cfg.rooms || []).find((x) => x.id === body.room);
    if (!r) throw err(400, 'Выберите зал');
    const hours = Math.floor(Number(body.hours));
    const guests = Math.floor(Number(body.guests));
    const cap = Math.max(1, r.capacity || 1);
    const inc = Math.min(cap, Math.max(1, r.guestsIncluded || cap));
    lines.push({ id: r.id, title: r.title, qty: hours, unit: 'ч', price: r.pricePerHour });
    total += r.pricePerHour * hours;
    const over = Math.max(0, guests - inc);
    if (over && r.extraGuestPrice) {
      lines.push({ id: 'guests', title: `Гости сверх ${inc}`, qty: over * hours, unit: 'чел·ч', price: r.extraGuestPrice });
      total += over * hours * r.extraGuestPrice;
    }
    duration = hours * 60;
    extra = { room: r.id, roomTitle: r.title, guests, hours };
  }
  for (const it of body.items || []) {
    const s = byId.get(it.id);
    if (!s) continue;
    const qty = s.unit ? Math.max(1, Math.floor(Number(it.qty) || 1)) : 1;
    lines.push({ id: s.id, title: s.title, qty, unit: s.unit || null, price: s.price });
    total += s.price * qty;
    if (cfg.mode !== 'rooms') duration += s.duration * qty;
  }
  return { lines, total: Math.max(total, Number(cfg.minOrder) || 0), subtotal: total, duration, extra };
}

export async function mockApi(path, opts = {}) {
  const m = /\/api\/b\/([a-z0-9-]+)\/(.+)$/.exec(path.split('?')[0]);
  if (!m) throw err(404, 'Не найдено');
  const [, slug, rest] = m;
  const url = new URL(path, location.href);
  const cfg = await config();
  const db = store(slug);
  const method = (opts.method || 'GET').toUpperCase();

  if (rest === 'config') return cfg;
  if (rest === 'slots') {
    const date = url.searchParams.get('date');
    return { date, slots: freeSlots(cfg, db.all(), date, Number(url.searchParams.get('duration')), url.searchParams.get('room')) };
  }
  if (rest === 'bookings' && method === 'POST') {
    const body = JSON.parse(opts.body || '{}');
    if (body.consent !== true) throw err(400, 'Нужно согласие на обработку персональных данных');
    const p = price(cfg, body);
    const list = db.all();
    if (!freeSlots(cfg, list, body.date, p.duration, p.extra.room).includes(body.time)) throw err(409, 'Это время только что заняли, выберите другое');
    const b = {
      id: Math.random().toString(16).slice(2, 12).padEnd(10, '0'),
      token: Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(), status: 'new', date: body.date, time: body.time, duration: p.duration,
      ...p.extra, items: p.lines, subtotal: p.subtotal, total: p.total,
      // имя и телефон в демо не сохраняем даже в браузере
      name: 'Демо-гость', phone: '+70000000000', address: '', comment: '',
    };
    list.push(b);
    db.save(list);
    return b;
  }
  const bm = /^bookings\/([a-z0-9]+)(\/cancel)?$/.exec(rest);
  if (bm) {
    const list = db.all();
    const b = list.find((x) => x.id === bm[1] && x.token === url.searchParams.get('t'));
    if (!b) throw err(404, 'Запись не найдена');
    if (bm[2] && method === 'POST' && (b.status === 'new' || b.status === 'confirmed')) {
      b.status = 'cancelled';
      db.save(list);
    }
    return b;
  }
  throw err(404, 'В демо этот раздел недоступен');
}
