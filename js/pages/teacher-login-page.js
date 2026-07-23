/**
 * Halaman guru: login + memuat dashboard setelah role terverifikasi.
 * Role guru diverifikasi lewat dokumen teachers/{uid} di Firestore,
 * tidak pernah dari URL atau localStorage.
 */

import { isFirebaseReady, getInitError, devError } from '../firebase/firebase-app.js';
import { signInTeacher, verifyTeacherRole, waitForAuth, signOut } from '../firebase/auth-service.js';
import { validateEmail, validatePassword, firebaseErrorMessage } from '../utils/validators.js';
import { initDashboard } from './teacher-dashboard-page.js';
import { showLoading, hideLoading, watchConnection } from '../ui/loading.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/helpers.js';

let isSubmitting = false;

async function init() {
  watchConnection();

  if (!isFirebaseReady()) {
    showLoginError((getInitError() && getInitError().message) || 'Firebase belum dikonfigurasi.');
    $('#btn-login').disabled = true;
    return;
  }

  $('#teacher-form').addEventListener('submit', handleLogin);
  $('#btn-toggle-password').addEventListener('click', togglePassword);
  $('#btn-teacher-logout').addEventListener('click', handleLogout);

  // Cek sesi guru yang masih aktif.
  showLoading('Memeriksa sesi…');
  const user = await waitForAuth();
  if (user && !user.isAnonymous) {
    const teacher = await verifyTeacherRole();
    if (teacher) {
      hideLoading();
      await enterDashboard(teacher);
      return;
    }
    await signOut();
  }
  hideLoading();
}

async function handleLogin(event) {
  event.preventDefault();
  if (isSubmitting) return;

  clearErrors();

  const emailCheck = validateEmail($('#email').value);
  const passCheck = validatePassword($('#password').value);

  let hasError = false;
  if (!emailCheck.valid) { setFieldError('email', emailCheck.error); hasError = true; }
  if (!passCheck.valid) { setFieldError('password', passCheck.error); hasError = true; }
  if (hasError) return;

  isSubmitting = true;
  $('#btn-login').disabled = true;
  showLoading('Memeriksa akun…');

  try {
    const teacher = await signInTeacher(emailCheck.value, passCheck.value);
    hideLoading();
    await enterDashboard(teacher);
  } catch (error) {
    hideLoading();
    devError('Login guru gagal:', error);

    if (error.code === 'app/not-a-teacher') {
      showLoginError(
        'Akun ini belum terdaftar sebagai guru. Hubungi administrator untuk mengaktifkannya.'
      );
    } else {
      showLoginError(firebaseErrorMessage(error));
    }
  } finally {
    isSubmitting = false;
    $('#btn-login').disabled = false;
    $('#password').value = '';
  }
}

async function enterDashboard(teacher) {
  $('#screen-login').hidden = true;
  $('#screen-dashboard').hidden = false;
  $('#teacher-name').textContent =
    teacher.profile.displayName || teacher.profile.email || 'Guru';
  await initDashboard(teacher);
}

function togglePassword() {
  const input = $('#password');
  const btn = $('#btn-toggle-password');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.setAttribute('aria-pressed', String(!showing));
  btn.setAttribute('aria-label', showing ? 'Tampilkan kata sandi' : 'Sembunyikan kata sandi');
  btn.textContent = showing ? '👁️' : '🙈';
}

async function handleLogout() {
  await signOut();
  toast.info('Anda telah keluar.');
  location.href = './index.html';
}

function setFieldError(field, message) {
  const node = $(`#${field}-error`);
  const input = $(`#${field}`);
  if (node) { node.textContent = message; node.hidden = false; }
  if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
}

function clearErrors() {
  for (const id of ['email', 'password']) {
    const node = $(`#${id}-error`);
    if (node) { node.textContent = ''; node.hidden = true; }
    const input = $(`#${id}`);
    if (input) input.removeAttribute('aria-invalid');
  }
  const box = $('#login-error');
  if (box) { box.textContent = ''; box.hidden = true; }
}

function showLoginError(message) {
  const box = $('#login-error');
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}