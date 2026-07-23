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

    this.#installUnlockListener();
  }

  #installUnlockListener() {
    const unlock = () => {
      this.unlocked = true;
      if (this.bgmWanted) this.playBackground();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
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

  click()   { this.play('click', { throttleMs: 40 }); }
  correct() { this.play('correct'); }
  wrong()   { this.play('wrong'); }
  attack()  { this.play('attack'); }
  victory() { this.play('victory', { throttleMs: 500 }); }
  defeat()  { this.play('defeat', { throttleMs: 500 }); }

  playBackground() {
    this.bgmWanted = true;
    if (this.muted || !this.unlocked) return;
    if (!this.bgm) {
      const src = ASSETS.audio.background;
      if (!src) return;
      this.bgm = new Audio();
      this.bgm.src = src;
      this.bgm.loop = true;
      this.bgm.addEventListener('error', () => { this.bgm = null; }, { once: true });
    }
    if (!this.bgm) return;
    this.bgm.volume = this.volume * 0.35;
    const p = this.bgm.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  stopBackground() {
    this.bgmWanted = false;
    if (!this.bgm) return;
    try { this.bgm.pause(); this.bgm.currentTime = 0; } catch { /* abaikan */ }
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
    else if (this.bgmWanted) this.playBackground();
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