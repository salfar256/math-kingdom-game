/** Fungsi bantu umum. Tidak bergantung pada Firebase maupun DOM khusus. */

/** Bilangan bulat acak inklusif. */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Ambil satu elemen acak dari array. */
export function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Acak urutan array (Fisher-Yates), mengembalikan array baru. */
export function shuffle(arr) {
  const out = Array.isArray(arr) ? arr.slice() : [];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Batasi nilai dalam rentang. */
export function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Pembulatan ke n desimal. */
export function round(value, decimals = 0) {
  const f = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Persentase 0–100 dengan pengaman pembagian nol. */
export function percent(part, total, decimals = 0) {
  if (!total || total <= 0) return 0;
  return round((part / total) * 100, decimals);
}

/** Buat ID acak sederhana (tidak untuk keperluan kriptografi). */
export function makeId(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

/** Buat kode kelas acak 6 karakter, tanpa huruf/angka yang mudah tertukar. */
export function makeClassCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** Tunggu n milidetik. */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Debounce sederhana. */
export function debounce(fn, wait = 250) {
  let t = null;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** Buat elemen DOM dengan aman (selalu textContent, tidak pernah innerHTML). */
export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  const { className, text, attrs, dataset, style, on } = options;

  if (className) node.className = className;
  if (typeof text === 'string' || typeof text === 'number') {
    node.textContent = String(text);
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      node.setAttribute(k, String(v));
    }
  }
  if (dataset) {
    for (const [k, v] of Object.entries(dataset)) node.dataset[k] = String(v);
  }
  if (style) Object.assign(node.style, style);
  if (on) {
    for (const [evt, handler] of Object.entries(on)) {
      node.addEventListener(evt, handler);
    }
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** Kosongkan sebuah elemen dengan aman. */
export function clearNode(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Query pendek. */
export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/** Tampilkan/sembunyikan elemen memakai atribut hidden. */
export function show(node, visible = true) {
  if (!node) return;
  node.hidden = !visible;
}

/** Ambil parameter dari query string dengan nilai default. */
export function getQueryParam(name, fallback = null) {
  const params = new URLSearchParams(location.search);
  const v = params.get(name);
  return v === null ? fallback : v;
}

/**
 * localStorage yang aman (tidak melempar error di mode privat / kuota penuh).
 * Nilai dari localStorage TIDAK boleh dipercaya untuk keputusan keamanan.
 */
export const safeStorage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
};

/** Format angka ribuan gaya Indonesia. */
export function formatNumber(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0';
  return n.toLocaleString('id-ID');
}

/** Format milidetik menjadi teks detik yang mudah dibaca. */
export function formatMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '-';
  return `${round(ms / 1000, 1).toString().replace('.', ',')} detik`;
}

/** Format durasi mm:ss. */
export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}