/** Notifikasi ringan di pojok layar. */

import { UI_CONFIG } from '../config/game-config.js';
import { el } from '../utils/helpers.js';
import { createIcon } from '../asset-manifest.js';

let container = null;

function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = el('div', {
    className: 'toast-container',
    attrs: { 'aria-live': 'polite', 'aria-atomic': 'false' }
  });
  document.body.appendChild(container);
  return container;
}

/**
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} type
 */
export function showToast(message, type = 'info', duration = UI_CONFIG.toastDurationMs) {
  const root = ensureContainer();
  const node = el('div', {
    className: `toast toast--${type}`,
    attrs: { role: type === 'error' ? 'alert' : 'status' }
  }, [
    el('span', { className: 'toast__icon', attrs: { 'aria-hidden': 'true' } }, [iconFor(type)]),
    el('span', { className: 'toast__text', text: message })
  ]);

  root.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));

  const remove = () => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 250);
  };
  const timer = setTimeout(remove, duration);
  node.addEventListener('click', () => { clearTimeout(timer); remove(); });

  return remove;
}

function iconFor(type) {
  switch (type) {
    case 'success': return createIcon('effects', 'correct', { size: 18 });
    case 'error':
    case 'warning': return createIcon('effects', 'wrong', { size: 18 });
    default:        return createIcon('effects', 'sparkle', { size: 18 });
  }
}

export const toast = {
  info:    (m, d) => showToast(m, 'info', d),
  success: (m, d) => showToast(m, 'success', d),
  error:   (m, d) => showToast(m, 'error', d),
  warning: (m, d) => showToast(m, 'warning', d)
};