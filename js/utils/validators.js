/**
 * Validasi & sanitasi input.
 * Semua pesan kesalahan dalam bahasa Indonesia dan ramah pengguna.
 */

/** Hapus karakter kontrol dan rapikan spasi. */
export function sanitizeText(value, maxLength = 100) {
  if (typeof value !== 'string') return '';
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validasi nama panggilan siswa.
 * @returns {{valid: boolean, value: string, error: string|null}}
 */
export function validateNickname(raw) {
  const value = sanitizeText(raw, 30);
  if (value.length === 0) {
    return { valid: false, value, error: 'Nama panggilan belum diisi.' };
  }
  if (value.length < 2) {
    return { valid: false, value, error: 'Nama panggilan minimal 2 karakter.' };
  }
  if (value.length > 30) {
    return { valid: false, value, error: 'Nama panggilan maksimal 30 karakter.' };
  }
  if (!/^[\p{L}\p{N} .'\-]+$/u.test(value)) {
    return {
      valid: false,
      value,
      error: 'Nama hanya boleh berisi huruf, angka, spasi, titik, tanda kutip, dan strip.'
    };
  }
  return { valid: true, value, error: null };
}

/** Validasi kode kelas: 4–10 karakter alfanumerik, disimpan huruf besar. */
/** PIN siswa: tepat 6 digit angka. */
export function validatePin(raw) {
  const value = String(raw || '').trim();
  if (!/^[0-9]{6}$/.test(value)) {
    return { valid: false, value, error: 'PIN harus tepat 6 angka.' };
  }
  return { valid: true, value, error: null };
}

export function validateClassCode(raw) {
  const value = sanitizeText(raw, 12).toUpperCase().replace(/\s/g, '');
  if (value.length === 0) {
    return { valid: false, value, error: 'Kode kelas belum diisi.' };
  }
  if (!/^[A-Z0-9]{4,10}$/.test(value)) {
    return {
      valid: false,
      value,
      error: 'Kode kelas terdiri dari 4–10 huruf atau angka.'
    };
  }
  return { valid: true, value, error: null };
}

/** Validasi nama kelas. */
export function validateClassName(raw) {
  const value = sanitizeText(raw, 60);
  if (value.length < 2) {
    return { valid: false, value, error: 'Nama kelas minimal 2 karakter.' };
  }
  return { valid: true, value, error: null };
}

/** Validasi email guru. */
export function validateEmail(raw) {
  const value = sanitizeText(raw, 120).toLowerCase();
  if (value.length === 0) {
    return { valid: false, value, error: 'Email belum diisi.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    return { valid: false, value, error: 'Format email tidak valid.' };
  }
  return { valid: true, value, error: null };
}

/** Validasi password guru (hanya panjang minimum; tidak pernah disimpan). */
export function validatePassword(raw) {
  const value = typeof raw === 'string' ? raw : '';
  if (value.length === 0) {
    return { valid: false, value, error: 'Kata sandi belum diisi.' };
  }
  if (value.length < 6) {
    return { valid: false, value, error: 'Kata sandi minimal 6 karakter.' };
  }
  return { valid: true, value, error: null };
}

/**
 * Validasi jawaban siswa.
 * Menolak: kosong, spasi saja, negatif, desimal, bukan angka.
 * @returns {{valid: boolean, value: number|null, error: string|null}}
 */
export function validateAnswer(raw) {
  if (raw === null || raw === undefined) {
    return { valid: false, value: null, error: 'Jawaban belum diisi.' };
  }
  const text = String(raw).trim();
  if (text.length === 0) {
    return { valid: false, value: null, error: 'Jawaban belum diisi.' };
  }
  if (!/^\d{1,3}$/.test(text)) {
    return {
      valid: false,
      value: null,
      error: 'Masukkan angka bulat positif (maksimal 3 digit).'
    };
  }
  const num = Number(text);
  if (!Number.isInteger(num) || num < 0 || num > 999) {
    return { valid: false, value: null, error: 'Jawaban harus antara 0 dan 999.' };
  }
  return { valid: true, value: num, error: null };
}

/** Ubah kode error Firebase menjadi pesan bahasa Indonesia. */
export function firebaseErrorMessage(error) {
  const code = (error && (error.code || error.message)) || '';

  const map = {
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/user-disabled': 'Akun ini dinonaktifkan. Hubungi administrator.',
    'auth/user-not-found': 'Email atau kata sandi salah.',
    'auth/wrong-password': 'Email atau kata sandi salah.',
    'auth/invalid-credential': 'Email atau kata sandi salah.',
    'auth/invalid-login-credentials': 'Email atau kata sandi salah.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
    'auth/network-request-failed': 'Koneksi internet bermasalah. Periksa jaringan Anda.',
    'auth/operation-not-allowed': 'Metode masuk ini belum diaktifkan di Firebase Console.',
    'auth/admin-restricted-operation': 'Masuk anonim belum diaktifkan di Firebase Console.',
    'permission-denied': 'Izin ditolak. Pastikan firestore.rules sudah dipasang dan akun guru terdaftar di koleksi "teachers" dengan active = true (lihat README bagian 7).',
    'unavailable': 'Layanan sedang tidak tersedia. Periksa koneksi internet Anda.',
    'not-found': 'Data tidak ditemukan.',
    'already-exists': 'Data sudah ada.',
    'failed-precondition': 'Firestore menolak permintaan (kemungkinan indeks belum ada). Pasang firestore.indexes.json atau coba lagi.',
    'resource-exhausted': 'Kuota layanan habis. Coba lagi nanti.',
    'deadline-exceeded': 'Permintaan terlalu lama. Periksa koneksi internet Anda.',
    'unauthenticated': 'Sesi Anda berakhir. Silakan masuk kembali.'
  };

  for (const key of Object.keys(map)) {
    if (code.includes(key)) return map[key];
  }
  return 'Terjadi kesalahan. Silakan coba lagi.';
}