/**
 * Pengelola suara.
 * - Audio hanya diputar setelah interaksi pengguna pertama.
 * - Dapat dimatikan & volumenya diatur.
 * - Tidak pernah melempar error bila file audio belum tersedia.
 */

import { ASSETS } from '../asset-manifest.js';
import { STORAGE_KEYS, UI_CONFIG } from '../config/game-config.js';
import { safeStorage, clamp } from '../utils/helpers.js';

class SoundManager {
  constructor() {
    this.volume = clamp(
      Number(safeStorage.get(STORAGE_KEYS.volume, UI_CONFIG.defaultVolume)),
      0, 1
    );
    this.muted = Boolean(safeStorage.get(STORAGE_KEYS.muted, false));
    this.unlocked = false;
    this.buffers = new Map();
    this.lastPlayed = new Map();
    this.bgm = null;
    this.bgmWanted = false;
    this.bgmTrack = 'background';   // trek yang DIINGINKAN
    this.bgmCurrentKey = null;      // trek yang SEDANG dimuat

    this.#installUnlockListener();
    this.#installGlobalClickSound();
  }

  #installUnlockListener() {
    const unlock = () => {
      this.unlocked = true;
      if (this.bgmWanted) this.playBackground(this.bgmTrack);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  /**
   * Bunyi klik OTOMATIS untuk semua tombol & pilihan (item 3).
   *
   * Dipasang sekali sebagai listener di document, memakai event delegation.
   * Cara ini menangkap juga elemen yang dibuat dinamis oleh JS (kartu mode,
   * tombol keypad, pilihan ganda, tombol modal, dll) -- jauh lebih andal
   * daripada menambahkan soundManager.click() satu per satu di puluhan
   * tempat, yang pasti ada yang terlewat.
   */
  #installGlobalClickSound() {
    const SELECTOR = [
      'button', '[role="button"]', 'a.btn', 'a.menu-hotspot',
      '.keypad__key', '.choice-btn', '.kingdom-card', '.card--clickable',
      '.character-option', '.class-tab', '.mode-tab'
    ].join(',');

    document.addEventListener('click', (e) => {
      const target = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
      if (!target || target.disabled) return;
      // Lewati kontrol yang bukan aksi (mis. slider volume).
      if (target.dataset && target.dataset.noClickSound === 'true') return;
      this.click();
    }, { capture: true });
  }

  #getAudio(key) {
    if (this.buffers.has(key)) return this.buffers.get(key);
    const src = ASSETS.audio[key];
    if (!src) { this.buffers.set(key, null); return null; }

    const audio = new Audio();
    audio.src = src;
    audio.preload = 'auto';
    audio.addEventListener('error', () => this.buffers.set(key, null), { once: true });
    this.buffers.set(key, audio);
    return audio;
  }

  /** Putar efek suara. Aman dipanggil kapan saja. */
  play(key, { throttleMs = 60 } = {}) {
    if (this.muted || !this.unlocked) return;

    const now = Date.now();
    const last = this.lastPlayed.get(key) || 0;
    if (now - last < throttleMs) return;
    this.lastPlayed.set(key, now);

    const base = this.#getAudio(key);
    if (!base) return;

    try {
      const node = base.cloneNode(true);
      node.volume = this.volume;
      const p = node.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* diabaikan: audio tidak wajib */
    }
  }

  // Throttle 120ms: cukup lama untuk menyatukan panggilan manual
  // soundManager.click() dengan listener klik global (agar tidak bunyi
  // ganda), tapi masih responsif untuk ketukan keypad yang cepat.
  click()   { this.play('click', { throttleMs: 120 }); }
  correct() { this.play('correct'); }
  wrong()   { this.play('wrong'); }
  attack()  { this.play('attack'); }
  victory() { this.play('victory', { throttleMs: 500 }); }
  defeat()  { this.play('defeat', { throttleMs: 500 }); }
  sessionComplete() { this.play('sessionComplete', { throttleMs: 800 }); }

  /**
   * Putar musik latar.
   * @param {string} trackKey kunci di ASSETS.audio -- mis. 'background'
   *   (umum semua halaman), 'bgmBattle', 'bgmBoss', 'bgmProfile'.
   * Memanggil ulang dengan trek yang SAMA tidak memulai ulang lagu,
   * sehingga musik tetap mengalir saat berpindah layar dalam konteks sama.
   */
  playBackground(trackKey = 'background') {
    this.bgmWanted = true;
    this.bgmTrack = trackKey;
    if (this.muted || !this.unlocked) return;

    // Trek berbeda -> hentikan yang lama, siapkan yang baru.
    if (this.bgm && this.bgmCurrentKey !== trackKey) {
      try { this.bgm.pause(); } catch { /* abaikan */ }
      this.bgm = null;
    }

    if (!this.bgm) {
      const src = ASSETS.audio[trackKey] || ASSETS.audio.background;
      if (!src) return;
      this.bgm = new Audio();
      this.bgm.src = src;
      this.bgm.loop = true;
      this.bgmCurrentKey = trackKey;
      this.bgm.addEventListener('error', () => { this.bgm = null; }, { once: true });
    }

    if (!this.bgm) return;
    this.bgm.volume = this.volume * 0.35;
    if (this.bgm.paused) {
      const p = this.bgm.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  }

  stopBackground() {
    this.bgmWanted = false;
    if (!this.bgm) return;
    try { this.bgm.pause(); this.bgm.currentTime = 0; } catch { /* abaikan */ }
    this.bgm = null;
    this.bgmCurrentKey = null;
  }

  setVolume(value) {
    this.volume = clamp(Number(value) || 0, 0, 1);
    safeStorage.set(STORAGE_KEYS.volume, this.volume);
    if (this.bgm) this.bgm.volume = this.volume * 0.35;
  }

  getVolume() { return this.volume; }

  setMuted(value) {
    this.muted = Boolean(value);
    safeStorage.set(STORAGE_KEYS.muted, this.muted);
    if (this.muted) this.stopBackgroundKeepWanted();
    else if (this.bgmWanted) this.playBackground(this.bgmTrack);
  }

  stopBackgroundKeepWanted() {
    if (!this.bgm) return;
    try { this.bgm.pause(); } catch { /* abaikan */ }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted() { return this.muted; }
}

export const soundManager = new SoundManager();