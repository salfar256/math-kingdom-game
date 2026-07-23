/**
 * Halaman masuk siswa.
 * Alur: validasi input -> masuk anonim -> cari kelas -> daftar -> ke game.
 */

import { isFirebaseReady, getInitError, devError } from '../firebase/firebase-app.js';
import { signInStudent, waitForAuth } from '../firebase/auth-service.js';
import { findClassByCode, enrollStudent } from '../firebase/class-service.js';
import { getStudentProfile } from '../firebase/firestore-service.js';
import { CHARACTERS, STORAGE_KEYS } from '../config/game-config.js';
import { validateNickname, validateClassCode, firebaseErrorMessage } from '../utils/validators.js';
import { el, $, safeStorage } from '../utils/helpers.js';
import { createSafeSprite } from '../asset-manifest.js';
import { showLoading, hideLoading, watchConnection } from '../ui/loading.js';
import { toast } from '../ui/toast.js';
import { soundManager } from '../ui/sound-manager.js';

let selectedCharacter = 'adventurer';
let isSubmitting = false;

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

  $('#classcode').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
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

  let hasError = false;
  if (!nameCheck.valid) { setFieldError('nickname', nameCheck.error); hasError = true; }
  if (!codeCheck.valid) { setFieldError('classcode', codeCheck.error); hasError = true; }
  if (hasError) return;

  isSubmitting = true;
  const btn = $('#btn-start');
  btn.disabled = true;
  showLoading('Menghubungkan…');

  try {
    const uid = await signInStudent();

    showLoading('Mencari kelas…');
    const klass = await findClassByCode(codeCheck.value);

    if (!klass) {
      setFieldError('classcode', 'Kode kelas tidak ditemukan. Periksa kembali kodenya.');
      return;
    }
    if (klass.active === false) {
      setFieldError('classcode', 'Kelas ini sudah tidak aktif. Hubungi gurumu.');
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

    const profile = await getStudentProfile(uid);
    const needsPlacement = !profile || profile.placementDone !== true;

    toast.success(`Selamat datang, ${nameCheck.value}!`);
    location.href = needsPlacement ? './game.html?mode=placement' : './game.html';

  } catch (error) {
    devError('Login siswa gagal:', error);
    showGlobalError(firebaseErrorMessage(error));
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
  for (const id of ['nickname', 'classcode', 'character']) {
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