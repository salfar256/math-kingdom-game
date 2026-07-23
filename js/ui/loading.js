/**
 * Overlay pemuatan, indikator status sinkronisasi, dan pemantau koneksi.
 * Tidak bergantung pada Firebase. Semua elemen dibuat sekali dan dipakai ulang.
 */

import { toast } from './toast.js';

let overlay = null;
let overlayText = null;
let syncBadge = null;
let connectionWatched = false;

function ensureOverlay() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.hidden = true;
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:900',
    'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
    'gap:12px', 'background:rgba(9,13,24,0.78)', 'backdrop-filter:blur(2px)'
  ].join(';');

  const spinner = document.createElement('div');
  spinner.className = 'loading-overlay__spinner';
  spinner.setAttribute('aria-hidden', 'true');
  spinner.style.cssText = [
    'width:44px', 'height:44px', 'border-radius:50%',
    'border:4px solid rgba(255,255,255,0.2)', 'border-top-color:#ffffff',
    'animation:loading-spin 0.8s linear infinite'
  ].join(';');

  overlayText = document.createElement('div');
  overlayText.style.cssText = 'color:#fff;font-size:15px;text-align:center;padding:0 24px;';

  if (!document.getElementById('loading-overlay-style')) {
    const style = document.createElement('style');
    style.id = 'loading-overlay-style';
    style.textContent =
      '@keyframes loading-spin { to { transform: rotate(360deg); } }' +
      '.reduce-motion .loading-overlay__spinner { animation: none; }';
    document.head.appendChild(style);
  }

  overlay.appendChild(spinner);
  overlay.appendChild(overlayText);
  document.body.appendChild(overlay);
}

/** Tampilkan overlay pemuatan dengan pesan. */
export function showLoading(message = 'Memuat…') {
  ensureOverlay();
  overlayText.textContent = message;
  overlay.hidden = false;
}

/** Sembunyikan overlay pemuatan. */
export function hideLoading() {
  if (overlay) overlay.hidden = true;
}

const SYNC_LABELS = {
  saving: { text: 'Menyimpan\u2026', bg: '#3b4a68' },
  saved: { text: 'Tersimpan', bg: '#1f6f43' },
  error: { text: 'Gagal menyimpan \u2014 akan dicoba lagi', bg: '#8a3b2b' },
  queued: { text: 'Menunggu koneksi', bg: '#6a5a1f' }
};

/**
 * Tampilkan status sinkronisasi kecil di sudut layar.
 * Status: 'saving' | 'saved' | 'error' | 'queued'
 */
export function setSyncStatus(status) {
  const info = SYNC_LABELS[status];
  if (!info) return;

  if (!syncBadge) {
    syncBadge = document.createElement('div');
    syncBadge.setAttribute('role', 'status');
    syncBadge.style.cssText = [
      'position:fixed', 'right:12px', 'bottom:12px', 'z-index:800',
      'padding:6px 12px', 'border-radius:999px', 'color:#fff',
      'font-size:12px', 'box-shadow:0 2px 8px rgba(0,0,0,0.35)',
      'transition:opacity 0.3s ease'
    ].join(';');
    document.body.appendChild(syncBadge);
  }

  syncBadge.textContent = info.text;
  syncBadge.style.background = info.bg;
  syncBadge.style.opacity = '1';
  syncBadge.hidden = false;

  clearTimeout(syncBadge._timer);
  if (status === 'saved') {
    syncBadge._timer = setTimeout(() => { syncBadge.style.opacity = '0'; }, 2500);
  }
}

/** Pantau koneksi dan beri tahu pengguna saat luring/daring kembali. */
export function watchConnection() {
  if (connectionWatched) return;
  connectionWatched = true;

  window.addEventListener('offline', () => {
    toast.warning('Koneksi terputus. Hasil latihan disimpan di perangkat dulu.');
    setSyncStatus('queued');
  });

  window.addEventListener('online', () => {
    toast.success('Koneksi kembali. Data akan disinkronkan.');
  });

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setSyncStatus('queued');
  }
}
