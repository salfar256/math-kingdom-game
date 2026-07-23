/**
 * Halaman masuk siswa.
 * Alur: validasi input -> masuk anonim -> cari kelas -> daftar -> ke game.
 */

import { isFirebaseReady, getInitError, devError } from '../firebase/firebase-app.js';
import {
  registerStudentAccount, loginStudentAccount, waitForAuth, getCurrentUser
} from '../firebase/auth-service.js';
import { findClassByCode, enrollStudent } from '../firebase/class-service.js';
import { getStudentProfile } from '../firebase/firestore-service.js';
import { CHARACTERS, STORAGE_KEYS } from '../config/game-config.js';
import { validateNickname, validateClassCode, validatePin, firebaseErrorMessage } from '../utils/validators.js';
import { el, $, safeStorage } from '../utils/helpers.js';
import { createSafeSprite } from '../asset-manifest.js';
import { showLoading, hideLoading, watchConnection } from '../ui/loading.js';
import { toast } from '../ui/toast.js';
import { soundManager } from '../ui/sound-manager.js';

let selectedCharacter = 'adventurer';
let isSubmitting = false;
let authMode = 'register'; // 'register' | 'login'

function init() {
  watchConnection();

  if (!isFirebaseReady()) {
    showGlobalError(
      (getInitError() && getInitError().message) ||
      'Firebase belum dikonfigurasi. Hubungi gurumu.'
    );
    const btn = $('#btn-start');
    if (btn) btn.disabled = true;
    return;
  }

  renderCharacters();
  restoreLastLogin();

  const form = $('#student-form');
  form.addEventListener('submit', handleSubmit);

  $('#tab-register').addEventListener('click', () => setAuthMode('register'));
  $('#tab-login').addEventListener('click', () => setAuthMode('login'));

  offerResume();

  $('#classcode').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
}

function setAuthMode(mode) {
  authMode = mode;
  $('#tab-register').setAttribute('aria-selected', String(mode === 'register'));
  $('#tab-login').setAttribute('aria-selected', String(mode === 'login'));
  $('#character-fieldset').hidden = mode === 'login';
  $('#pin-hint').hidden = mode === 'login';
  $('#btn-start').innerHTML = mode === 'login'
    ? 'Masuk ke Akunku'
    : '<img class="icon-img" src="./assets/icons/sword.png" width="18" height="18" alt="" aria-hidden="true"> Mulai Petualangan';
  clearErrors();
}

/** Bila sesi siswa masih aktif, tawarkan lanjut tanpa mengetik ulang. */
async function offerResume() {
  try {
    const user = await waitForAuth();
    if (!user || user.isAnonymous) return;
    const profile = await getStudentProfile(user.uid);
    if (!profile || !profile.activeClassId) return;
    $('#resume-name').textContent = profile.displayName || 'Petualang';
    $('#resume-box').hidden = false;
    $('#btn-resume').addEventListener('click', () => {
      soundManager.click();
      location.href = './game.html';
    });
  } catch { /* diam: kotak lanjutkan tidak muncul */ }
}

function renderCharacters() {
  const grid = $('#character-grid');
  if (!grid) return;

  for (const char of CHARACTERS) {
    const btn = el('button', {
      className: 'character-option',
      attrs: {
        type: 'button',
        'aria-pressed': String(char.id === selectedCharacter),
        'data-char': char.id
      }
    }, [
      createSafeSprite('characters', char.asset || char.id, { size: 44, alt: '' }),
      el('span', { className: 'character-option__name', text: char.name }),
      el('span', { className: 'character-option__desc', text: char.desc })
    ]);

    btn.addEventListener('click', () => {
      soundManager.click();
      selectedCharacter = char.id;
      for (const node of grid.querySelectorAll('.character-option')) {
        node.setAttribute('aria-pressed', String(node.dataset.char === char.id));
      }
    });

    grid.appendChild(btn);
  }
}

function restoreLastLogin() {
  const last = safeStorage.get(STORAGE_KEYS.lastStudent, null);
  if (!last || typeof last !== 'object') return;

  if (typeof last.displayName === 'string') $('#nickname').value = last.displayName;
  if (typeof last.classCode === 'string') $('#classcode').value = last.classCode;
  if (typeof last.characterId === 'string' &&
      CHARACTERS.some((c) => c.id === last.characterId)) {
    selectedCharacter = last.characterId;
    const grid = $('#character-grid');
    for (const node of grid.querySelectorAll('.character-option')) {
      node.setAttribute('aria-pressed', String(node.dataset.char === selectedCharacter));
    }
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return;

  clearErrors();

  const nameCheck = validateNickname($('#nickname').value);
  const codeCheck = validateClassCode($('#classcode').value);
  const pinCheck = validatePin($('#pin').value);

  let hasError = false;
  if (!nameCheck.valid) { setFieldError('nickname', nameCheck.error); hasError = true; }
  if (!codeCheck.valid) { setFieldError('classcode', codeCheck.error); hasError = true; }
  if (!pinCheck.valid) { setFieldError('pin', pinCheck.error); hasError = true; }
  if (hasError) return;

  isSubmitting = true;
  const btn = $('#btn-start');
  btn.disabled = true;
  showLoading('Menghubungkan…');

  try {
    if (authMode === 'login') {
      // ===== MASUK KE AKUN YANG SUDAH ADA =====
      const uid = await loginStudentAccount(nameCheck.value, codeCheck.value, pinCheck.value);

      safeStorage.set(STORAGE_KEYS.lastStudent, {
        displayName: nameCheck.value,
        classCode: codeCheck.value,
        characterId: selectedCharacter
      });

      toast.success(`Selamat datang kembali, ${nameCheck.value}!`);
      location.href = './game.html';
      return;
    }

    // ===== AKUN BARU =====
    // PENTING: harus masuk (sign-in) dulu sebelum mencari kode kelas, karena
    // rule Firestore classCodes mewajibkan pengguna sudah terautentikasi
    // (isSignedIn()) -- mencari kode kelas sebelum sign-in selalu ditolak
    // dengan "Missing or insufficient permissions".
    showLoading('Membuat akunmu…');
    const uid = await registerStudentAccount(nameCheck.value, codeCheck.value, pinCheck.value);

    showLoading('Mencari kelas…');
    const klass = await findClassByCode(codeCheck.value);

    if (!klass || klass.active === false) {
      // Kode kelas ternyata tidak valid -- batalkan akun yang baru dibuat
      // supaya tidak menyisakan akun "yatim" tanpa kelas.
      try {
        const u = getCurrentUser();
        if (u) await u.delete();
      } catch { /* pembersihan gagal tidak fatal */ }

      setFieldError('classcode',
        !klass ? 'Kode kelas tidak ditemukan. Periksa kembali kodenya.'
               : 'Kelas ini sudah tidak aktif. Hubungi gurumu.');
      return;
    }

    showLoading('Menyiapkan petualanganmu…');
    await enrollStudent(uid, klass.id, {
      displayName: nameCheck.value,
      characterId: selectedCharacter
    });

    safeStorage.set(STORAGE_KEYS.lastStudent, {
      displayName: nameCheck.value,
      classCode: codeCheck.value,
      characterId: selectedCharacter
    });

    toast.success(`Selamat datang, ${nameCheck.value}!`);
    location.href = './game.html';

  } catch (error) {
    devError('Login siswa gagal:', error);
    if (error && error.code === 'auth/email-already-in-use') {
      setFieldError('nickname',
        'Nama ini sudah dipakai di kelas ini. Pilih tab "Sudah Punya Akun" untuk masuk, atau pakai nama lain.');
    } else if (error && (error.code === 'auth/invalid-credential' ||
               error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found')) {
      showGlobalError('Nama, kode kelas, atau PIN tidak cocok. Periksa kembali, lalu coba lagi.');
    } else {
      showGlobalError(firebaseErrorMessage(error));
    }
  } finally {
    hideLoading();
    isSubmitting = false;
    btn.disabled = false;
  }
}

function setFieldError(field, message) {
  const node = $(`#${field}-error`);
  const input = $(`#${field}`);
  if (node) { node.textContent = message; node.hidden = false; }
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
}

function clearErrors() {
  for (const id of ['nickname', 'classcode', 'pin', 'character']) {
    const node = $(`#${id}-error`);
    if (node) { node.textContent = ''; node.hidden = true; }
    const input = $(`#${id}`);
    if (input) input.removeAttribute('aria-invalid');
  }
  const g = $('#global-error');
  if (g) { g.textContent = ''; g.hidden = true; }
}

function showGlobalError(message) {
  const box = $('#global-error');
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}