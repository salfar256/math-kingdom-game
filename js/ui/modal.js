/** Dialog modal dengan fokus terkunci & dukungan keyboard. */

import { el, clearNode } from '../utils/helpers.js';

let activeModal = null;
let lastFocused = null;

/**
 * Tampilkan modal.
 * @param {object} options { title, lines, buttons, dismissible, content }
 * @returns {Promise<string|null>} id tombol yang ditekan
 */
export function showModal({
  title = '',
  lines = [],
  buttons = [{ id: 'ok', text: 'OK', variant: 'primary' }],
  dismissible = true,
  content = null
} = {}) {
  closeModal();
  lastFocused = document.activeElement;

  return new Promise((resolve) => {
    const body = el('div', { className: 'modal__body' });
    for (const line of lines) {
      body.appendChild(el('p', { className: 'modal__line', text: line }));
    }
    if (content instanceof Node) body.appendChild(content);

    const footer = el('div', { className: 'modal__footer' });
    const buttonNodes = [];

    for (const btn of buttons) {
      const node = el('button', {
        className: `btn btn--${btn.variant || 'secondary'}`,
        text: btn.text,
        attrs: { type: 'button' },
        on: { click: () => finish(btn.id) }
      });
      footer.appendChild(node);
      buttonNodes.push(node);
    }

    const dialog = el('div', {
      className: 'modal__dialog',
      attrs: {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title || 'Dialog'
      }
    }, [
      title ? el('h2', { className: 'modal__title', text: title }) : null,
      body,
      footer
    ]);

    const backdrop = el('div', { className: 'modal-backdrop' }, [dialog]);

    function onKeyDown(e) {
      if (e.key === 'Escape' && dismissible) {
        e.preventDefault();
        finish(null);
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }

    function finish(id) {
      document.removeEventListener('keydown', onKeyDown, true);
      backdrop.remove();
      activeModal = null;
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
      resolve(id);
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && dismissible) finish(null);
    });

    document.addEventListener('keydown', onKeyDown, true);
    document.body.appendChild(backdrop);
    activeModal = { backdrop, finish };

    const focusTarget = buttonNodes[buttonNodes.length - 1] || dialog;
    requestAnimationFrame(() => focusTarget.focus());
  });
}

export function closeModal() {
  if (activeModal) activeModal.finish(null);
}

/** Dialog konfirmasi sederhana. @returns {Promise<boolean>} */
export async function confirmDialog(title, message, {
  confirmText = 'Ya, lanjutkan',
  cancelText = 'Batal',
  danger = false
} = {}) {
  const id = await showModal({
    title,
    lines: Array.isArray(message) ? message : [message],
    buttons: [
      { id: 'cancel', text: cancelText, variant: 'secondary' },
      { id: 'confirm', text: confirmText, variant: danger ? 'danger' : 'primary' }
    ]
  });
  return id === 'confirm';
}

/**
 * Konfirmasi berlapis: pengguna harus mengetik teks tertentu.
 * Dipakai untuk aksi berbahaya seperti menghapus kelas.
 */
export async function confirmWithTyping(title, message, requiredText) {
  const input = el('input', {
    className: 'input',
    attrs: {
      type: 'text',
      'aria-label': `Ketik ${requiredText} untuk konfirmasi`,
      placeholder: requiredText,
      autocomplete: 'off'
    }
  });

  const wrapper = el('div', { className: 'modal__typing' }, [
    el('label', { className: 'label', text: `Ketik "${requiredText}" untuk melanjutkan:` }),
    input
  ]);

  const id = await showModal({
    title,
    lines: Array.isArray(message) ? message : [message],
    content: wrapper,
    buttons: [
      { id: 'cancel', text: 'Batal', variant: 'secondary' },
      { id: 'confirm', text: 'Hapus permanen', variant: 'danger' }
    ]
  });

  return id === 'confirm' && input.value.trim() === requiredText;
}

/** Dialog input teks. @returns {Promise<string|null>} */
export async function promptDialog(title, label, defaultValue = '') {
  const input = el('input', {
    className: 'input',
    attrs: { type: 'text', 'aria-label': label, value: defaultValue, autocomplete: 'off' }
  });
  input.value = defaultValue;

  const wrapper = el('div', {}, [
    el('label', { className: 'label', text: label }),
    input
  ]);

  const id = await showModal({
    title,
    content: wrapper,
    buttons: [
      { id: 'cancel', text: 'Batal', variant: 'secondary' },
      { id: 'ok', text: 'Simpan', variant: 'primary' }
    ]
  });

  return id === 'ok' ? input.value.trim() : null;
}