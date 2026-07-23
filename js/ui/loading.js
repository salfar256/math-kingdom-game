/** Overlay pemuatan layar penuh, indikator status sinkron, dan pemantauan koneksi. */

import { el } from '../utils/helpers.js';

let overlay = null;
let messageNode = null;
let syncBadge = null;
let showCount = 0;

function ensureOverlay() {
  if (overlay && document.body.contains(overlay)) return overlay;

  messageNode = el('p', { className: 'loading-overlay__text', text: 'Memuat…' });

  overlay = el('div', {
    className: 'loading-overlay',
    attrs: { role: 'status', 'aria-live': 'polite' }
  }, [
    el('div', { className: 'loading-overlay__spinner', attrs: { 'aria-hidden': 'true' } }),
    messageNode
  ]);

  document.body.appendChild(overlay);
  return overlay;
}

/** Tampilkan overlay pemuatan dengan pesan tertentu. Panggilan bertumpuk aman. */
export function showLoading(message = 'Memuat…') {
  const root = ensureOverlay();
  messageNode.textContent = message;
  showCount += 1;
  root.classList.add('is-visible');
  root.hidden = false;
}

/** Sembunyikan overlay pemuatan. Hanya benar-benar hilang saat semua panggilan selesai. */
export function hideLoading() {
  if (showCount > 0) showCount -= 1;
  if (showCount > 0) return;
  if (!overlay) return;
  overlay.classList.remove('is-visible');
  overlay.hidden = true;
}

function ensureSyncBadge() {
  if (syncBadge && document.body.contains(syncBadge)) return syncBadge;
  syncBadge = el('div', {
    className: 'sync-badge',
    attrs: { role: 'status', 'aria-live': 'polite' }
  });
  document.body.appendChild(syncBadge);
  return syncBadge;
}

/**
 * Perbarui indikator status sinkronisasi data ke server.
 * @param {'saving'|'saved'|'error'|'offline'} status
 */
export function setSyncStatus(status) {
  const badge = ensureSyncBadge();
  const labels = {
    saving: '💾 Menyimpan…',
    saved: '✅ Tersimpan',
    error: '⚠️ Gagal menyimpan',
    offline: '📡 Offline'
  };

  badge.textContent = labels[status] || '';
  badge.className = `sync-badge sync-badge--${status}`;
  badge.hidden = false;

  if (status === 'saved') {
    setTimeout(() => {
      if (badge.classList.contains('sync-badge--saved')) badge.hidden = true;
    }, 2000);
  }
}

/** Pantau status koneksi online/offline dan perbarui badge secara otomatis. */
export function watchConnection() {
  const update = () => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
    } else if (syncBadge && syncBadge.classList.contains('sync-badge--offline')) {
      syncBadge.hidden = true;
    }
  };

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
