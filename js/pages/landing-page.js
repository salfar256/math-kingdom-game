/** Logika halaman depan: menu, dialog tentang game, pengaturan suara. */

import { isFirebaseReady, getInitError } from '../firebase/firebase-app.js';
import { showModal } from '../ui/modal.js';
import { soundManager } from '../ui/sound-manager.js';
import { animationManager } from '../ui/animation-manager.js';
import { el, $ } from '../utils/helpers.js';
import { watchConnection } from '../ui/loading.js';
import { getAssetPath } from '../asset-manifest.js';

function init() {
  watchConnection();
  showFirebaseWarningIfNeeded();

  const aboutBtn = $('#btn-about');
  const soundBtn = $('#btn-sound');
  const shopBtn = $('#btn-shop');

  // Bila gambar menu gagal dimuat, tampilkan tombol dalam mode teks.
  const frame = document.querySelector('.menu-frame');
  const menuPath = getAssetPath('ui', 'main-menu');
  if (frame && menuPath) {
    const probe = new Image();
    probe.onerror = () => frame.classList.add('no-image');
    probe.src = menuPath;
  }

  if (shopBtn) shopBtn.addEventListener('click', () => {
    soundManager.click();
    showModal({
      title: '📦 Toko',
      lines: [
        'Toko masih dibangun oleh para kurcaci kerajaan.',
        'Kumpulkan koin dan lencana dulu — fitur ini akan hadir pada pembaruan berikutnya.'
      ],
      buttons: [{ id: 'ok', text: 'Mengerti', variant: 'primary' }]
    });
  });

  if (aboutBtn) aboutBtn.addEventListener('click', () => {
    soundManager.click();
    openAbout();
  });

  if (soundBtn) soundBtn.addEventListener('click', () => {
    soundManager.click();
    openSoundSettings();
  });
}

function showFirebaseWarningIfNeeded() {
  if (isFirebaseReady()) return;
  const box = $('#firebase-warning');
  if (!box) return;
  const err = getInitError();
  box.textContent = err
    ? err.message
    : 'Firebase belum dikonfigurasi. Buka README untuk petunjuk pemasangan.';
  box.hidden = false;
}

function openAbout() {
  showModal({
    title: 'Tentang Game',
    lines: [
      'Pertarungan Empat Kerajaan Hitungan adalah latihan hitung dasar untuk siswa kelas 7 SMP.',
      'Kamu akan menaklukkan empat kerajaan: Penjumlahan, Pengurangan, Perkalian, dan Pembagian, dengan angka 1 sampai 9.',
      'Game ini mengingat soal yang belum kamu kuasai dan mengulangnya pada waktu yang tepat, agar kamu benar-benar hafal — bukan sekadar menebak.',
      'Latihan 10 sampai 15 menit setiap hari selama 30 hari sudah cukup.',
      'Yang paling penting bukan kecepatan, tetapi ketepatan. Kesalahan adalah bagian dari belajar.'
    ],
    buttons: [{ id: 'ok', text: 'Mengerti', variant: 'primary' }]
  });
}

function openSoundSettings() {
  const content = el('div', { className: 'stack' });

  // Volume
  const volumeLabel = el('label', {
    className: 'label',
    text: `Volume: ${Math.round(soundManager.getVolume() * 100)}%`,
    attrs: { for: 'volume-range' }
  });
  const volumeInput = el('input', {
    attrs: {
      type: 'range', id: 'volume-range',
      min: '0', max: '100', step: '5',
      value: String(Math.round(soundManager.getVolume() * 100))
    },
    on: {
      input: (e) => {
        const v = Number(e.target.value);
        soundManager.setVolume(v / 100);
        volumeLabel.textContent = `Volume: ${v}%`;
      }
    }
  });
  volumeInput.style.width = '100%';

  // Bisu
  const muteBtn = el('button', {
    className: 'btn btn--block',
    text: soundManager.isMuted() ? '🔇 Suara: Mati' : '🔊 Suara: Hidup',
    attrs: { type: 'button', 'aria-pressed': String(soundManager.isMuted()) }
  });
  muteBtn.addEventListener('click', () => {
    const muted = soundManager.toggleMuted();
    muteBtn.textContent = muted ? '🔇 Suara: Mati' : '🔊 Suara: Hidup';
    muteBtn.setAttribute('aria-pressed', String(muted));
    if (!muted) soundManager.click();
  });

  // Kurangi animasi
  const motionBtn = el('button', {
    className: 'btn btn--block',
    text: animationManager.userReduced ? '🐢 Animasi: Dikurangi' : '✨ Animasi: Normal',
    attrs: { type: 'button', 'aria-pressed': String(animationManager.userReduced) }
  });
  motionBtn.addEventListener('click', () => {
    const next = !animationManager.userReduced;
    animationManager.setReduced(next);
    motionBtn.textContent = next ? '🐢 Animasi: Dikurangi' : '✨ Animasi: Normal';
    motionBtn.setAttribute('aria-pressed', String(next));
  });

  content.appendChild(volumeLabel);
  content.appendChild(volumeInput);
  content.appendChild(muteBtn);
  content.appendChild(motionBtn);

  showModal({
    title: 'Pengaturan Suara & Tampilan',
    lines: ['Suara baru akan terdengar setelah kamu menyentuh layar atau menekan tombol.'],
    content,
    buttons: [{ id: 'ok', text: 'Selesai', variant: 'primary' }]
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}