/**
 * Animasi ringan. Menghormati preferensi "kurangi animasi"
 * dan prefers-reduced-motion dari sistem operasi.
 */

import { STORAGE_KEYS } from '../config/game-config.js';
import { safeStorage, el } from '../utils/helpers.js';

class AnimationManager {
  constructor() {
    this.userReduced = Boolean(safeStorage.get(STORAGE_KEYS.reduceMotion, false));
    this.systemReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.apply();
  }

  get reduced() {
    return this.userReduced || this.systemReduced;
  }

  setReduced(value) {
    this.userReduced = Boolean(value);
    safeStorage.set(STORAGE_KEYS.reduceMotion, this.userReduced);
    this.apply();
  }

  apply() {
    document.documentElement.classList.toggle('reduce-motion', this.reduced);
  }

  /** Getarkan elemen (misalnya saat menerima damage). */
  shake(node, duration = 320) {
    if (!node || this.reduced) return;
    node.classList.remove('anim-shake');
    void node.offsetWidth;
    node.classList.add('anim-shake');
    setTimeout(() => node.classList.remove('anim-shake'), duration);
  }

  /** Efek serangan pemain ke musuh. */
  attack(node, duration = 420) {
    if (!node || this.reduced) return;
    node.classList.remove('anim-attack');
    void node.offsetWidth;
    node.classList.add('anim-attack');
    setTimeout(() => node.classList.remove('anim-attack'), duration);
  }

  /** Denyut singkat (misalnya untuk skor bertambah). */
  pulse(node, duration = 400) {
    if (!node || this.reduced) return;
    node.classList.remove('anim-pulse');
    void node.offsetWidth;
    node.classList.add('anim-pulse');
    setTimeout(() => node.classList.remove('anim-pulse'), duration);
  }

  /** Angka melayang, contoh "+12". */
  floatText(container, text, variant = 'damage') {
    if (!container) return;
    const node = el('span', {
      className: `float-text float-text--${variant}`,
      text,
      attrs: { 'aria-hidden': 'true' }
    });
    container.appendChild(node);

    if (this.reduced) {
      setTimeout(() => node.remove(), 600);
      return;
    }
    requestAnimationFrame(() => node.classList.add('is-active'));
    setTimeout(() => node.remove(), 1100);
  }

  /** Kilatan warna pada layar arena. */
  flash(container, variant = 'correct') {
    if (!container || this.reduced) return;
    const node = el('div', {
      className: `screen-flash screen-flash--${variant}`,
      attrs: { 'aria-hidden': 'true' }
    });
    container.appendChild(node);
    requestAnimationFrame(() => node.classList.add('is-active'));
    setTimeout(() => node.remove(), 420);
  }
}

export const animationManager = new AnimationManager();