/** Fungsi tanggal. Semua memakai zona waktu lokal perangkat siswa. */

/** Kunci hari YYYY-MM-DD berdasarkan waktu lokal. */
export function dayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Konversi berbagai bentuk timestamp Firestore/Date/number menjadi Date. */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value.toDate === 'function') {
    try { return value.toDate(); } catch { return null; }
  }
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  return null;
}

/** Milidetik dari sebuah timestamp apa pun; 0 jika tidak valid. */
export function toMillis(value) {
  const d = toDate(value);
  return d ? d.getTime() : 0;
}

/** Selisih hari kalender antara dua tanggal. */
export function daysBetween(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return 0;
  const ma = new Date(da.getFullYear(), da.getMonth(), da.getDate()).getTime();
  const mb = new Date(db.getFullYear(), db.getMonth(), db.getDate()).getTime();
  return Math.round((mb - ma) / 86400000);
}

/** Apakah dua waktu berada di hari kalender yang sama. */
export function isSameDay(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;
  return dayKey(da) === dayKey(db);
}

/** Apakah waktu tersebut hari ini. */
export function isToday(value) {
  return isSameDay(value, new Date());
}

/**
 * Hitung streak baru.
 * - Latihan di hari yang sama: streak tidak berubah.
 * - Latihan sehari setelahnya: streak + 1.
 * - Jeda lebih dari 1 hari: streak kembali ke 1.
 */
export function calculateStreak(lastPracticeAt, currentStreak = 0, now = new Date()) {
  const last = toDate(lastPracticeAt);
  if (!last) return 1;
  const diff = daysBetween(last, now);
  if (diff <= 0) return Math.max(1, currentStreak);
  if (diff === 1) return currentStreak + 1;
  return 1;
}

/** Format tanggal Indonesia, contoh: 23 Juli 2026. */
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function formatDateId(value) {
  const d = toDate(value);
  if (!d) return '-';
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/** Format tanggal + jam Indonesia. */
export function formatDateTimeId(value) {
  const d = toDate(value);
  if (!d) return '-';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDateId(d)}, ${hh}.${mm}`;
}

/** Teks relatif sederhana: "hari ini", "kemarin", "3 hari lalu". */
export function relativeDayId(value) {
  const d = toDate(value);
  if (!d) return 'belum pernah';
  const diff = daysBetween(d, new Date());
  if (diff <= 0) return 'hari ini';
  if (diff === 1) return 'kemarin';
  if (diff < 30) return `${diff} hari lalu`;
  return formatDateId(d);
}

/** Daftar kunci hari untuk N hari terakhir (lama ke baru). */
export function lastNDayKeys(n = 30, now = new Date()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

/** Tambah milidetik ke waktu sekarang, kembalikan Date. */
export function addMs(ms, from = new Date()) {
  return new Date(toMillis(from) + ms);
}