/**
 * Seluruh path aset berada di satu tempat.
 * Semua path RELATIF (diawali "./") supaya bekerja pada GitHub Pages
 * yang dilayani dari subfolder: https://user.github.io/nama-repo/
 *
 * Jika sebuah aset belum tersedia, game TIDAK boleh error.
 * Gunakan resolveImage() / safeImage() yang menyediakan fallback.
 */

export const ASSET_BASE = './assets';

export const ASSETS = {
  backgrounds: {
    'addition-kingdom':       `${ASSET_BASE}/backgrounds/addition-kingdom.png`,
    'subtraction-kingdom':    `${ASSET_BASE}/backgrounds/subtraction-kingdom.png`,
    'multiplication-kingdom': `${ASSET_BASE}/backgrounds/multiplication-kingdom.png`,
    'division-kingdom':       `${ASSET_BASE}/backgrounds/division-kingdom.png`,
    'mixed-tower':            `${ASSET_BASE}/backgrounds/mixed-tower.png`
  },
  kingdoms: {
    addition:       `${ASSET_BASE}/kingdoms/addition.png`,
    subtraction:    `${ASSET_BASE}/kingdoms/subtraction.png`,
    multiplication: `${ASSET_BASE}/kingdoms/multiplication.png`,
    division:       `${ASSET_BASE}/kingdoms/division.png`
  },
  idle: {
    adventurer:     `${ASSET_BASE}/idle/adventurer.png`,
    knight:         `${ASSET_BASE}/idle/knight.png`,
    mage:           `${ASSET_BASE}/idle/mage.png`,
    archer:         `${ASSET_BASE}/idle/archer.png`,
    slime:          `${ASSET_BASE}/idle/slime.png`,
    goblin:         `${ASSET_BASE}/idle/goblin.png`,
    skeleton:       `${ASSET_BASE}/idle/skeleton.png`,
    orc:            `${ASSET_BASE}/idle/orc.png`,
    'dark-mage':    `${ASSET_BASE}/idle/dark-mage.png`,
    'shadow-ninja': `${ASSET_BASE}/idle/shadow-ninja.png`,
    'boss-6':       `${ASSET_BASE}/idle/boss-6.png`,
    'boss-7':       `${ASSET_BASE}/idle/boss-7.png`,
    'boss-8':       `${ASSET_BASE}/idle/boss-8.png`,
    'boss-9':       `${ASSET_BASE}/idle/boss-9.png`,
    'mixed-boss':   `${ASSET_BASE}/idle/mixed-boss.png`
  },
  ui: {
    'main-menu': `${ASSET_BASE}/ui/main-menu.png`,
    story:       `${ASSET_BASE}/ui/story.png`
  },
  characters: {
    leader:     `${ASSET_BASE}/characters/leader.png`,
    adventurer: `${ASSET_BASE}/characters/adventurer.png`,
    knight:     `${ASSET_BASE}/characters/knight.png`,
    mage:       `${ASSET_BASE}/characters/mage.png`,
    archer:     `${ASSET_BASE}/characters/archer.png`,
    healer:     `${ASSET_BASE}/characters/healer.png`
  },
  enemies: {
    slime:          `${ASSET_BASE}/enemies/slime.png`,
    skeleton:       `${ASSET_BASE}/enemies/skeleton.png`,
    goblin:         `${ASSET_BASE}/enemies/goblin.png`,
    'dark-mage':    `${ASSET_BASE}/enemies/dark-mage.png`,
    orc:            `${ASSET_BASE}/enemies/orc.png`,
    'shadow-ninja': `${ASSET_BASE}/enemies/shadow-ninja.png`
  },
  bosses: {
    'boss-6':     `${ASSET_BASE}/bosses/boss-6.png`,
    'boss-7':     `${ASSET_BASE}/bosses/boss-7.png`,
    'boss-8':     `${ASSET_BASE}/bosses/boss-8.png`,
    'boss-9':     `${ASSET_BASE}/bosses/boss-9.png`,
    'mixed-boss': `${ASSET_BASE}/bosses/mixed-boss.png`
  },
  effects: {
    correct: `${ASSET_BASE}/effects/correct.png`,
    wrong:   `${ASSET_BASE}/effects/wrong.png`,
    attack:  `${ASSET_BASE}/effects/attack.png`,
    fire:    `${ASSET_BASE}/effects/fire.png`,
    ice:     `${ASSET_BASE}/effects/ice.png`,
    heal:    `${ASSET_BASE}/effects/heal.png`,
    smoke:   `${ASSET_BASE}/effects/smoke.png`
  },
  icons: {
    addition:       `${ASSET_BASE}/icons/addition.png`,
    subtraction:    `${ASSET_BASE}/icons/subtraction.png`,
    multiplication: `${ASSET_BASE}/icons/multiplication.png`,
    division:       `${ASSET_BASE}/icons/division.png`,
    heart:          `${ASSET_BASE}/icons/heart.png`,
    coin:           `${ASSET_BASE}/icons/coin.png`,
    star:           `${ASSET_BASE}/icons/star.png`,
    chest:          `${ASSET_BASE}/icons/chest.png`,
    shield:         `${ASSET_BASE}/icons/shield.png`,
    sword:          `${ASSET_BASE}/icons/sword.png`,
    book:           `${ASSET_BASE}/icons/book.png`,
    settings:       `${ASSET_BASE}/icons/settings.png`
  },
  audio: {
    correct:    `${ASSET_BASE}/audio/correct.mp3`,
    wrong:      `${ASSET_BASE}/audio/wrong.mp3`,
    attack:     `${ASSET_BASE}/audio/attack.mp3`,
    victory:    `${ASSET_BASE}/audio/victory.mp3`,
    defeat:     `${ASSET_BASE}/audio/defeat.mp3`,
    click:      `${ASSET_BASE}/audio/click.mp3`,
    background: `${ASSET_BASE}/audio/background.mp3`
  }
};

/** Fallback emoji per kategori & kunci, dipakai bila gambar gagal dimuat. */
export const FALLBACK_EMOJI = {
  kingdoms: {
    addition: '➕', subtraction: '➖', multiplication: '✖️', division: '➗'
  },
  backgrounds: {
    'addition-kingdom': '🏰',
    'subtraction-kingdom': '🏜️',
    'multiplication-kingdom': '🌋',
    'division-kingdom': '🌊',
    'mixed-tower': '🗼'
  },
  characters: {
    leader: '👑', adventurer: '🧑‍🌾', knight: '🛡️',
    mage: '🧙', archer: '🏹', healer: '💚'
  },
  enemies: {
    slime: '🟢', skeleton: '💀', goblin: '👺',
    'dark-mage': '🧟', orc: '👹', 'shadow-ninja': '🥷'
  },
  bosses: {
    'boss-6': '👑', 'boss-7': '👑', 'boss-8': '👑',
    'boss-9': '👑', 'mixed-boss': '🗿'
  },
  effects: {
    correct: '✨', wrong: '💢', attack: '💥',
    fire: '🔥', ice: '❄️', heal: '💚', smoke: '💨'
  },
  icons: {
    addition: '➕', subtraction: '➖', multiplication: '✖️', division: '➗',
    heart: '❤️', coin: '🪙', star: '⭐', chest: '📦',
    shield: '🛡️', sword: '⚔️', book: '📘', settings: '⚙️'
  }
};

/** Ambil path aset. Mengembalikan null jika tidak terdaftar. */
export function getAssetPath(category, key) {
  const group = ASSETS[category];
  if (!group) return null;
  return group[key] || null;
}

export function getFallbackEmoji(category, key) {
  const group = FALLBACK_EMOJI[category];
  if (!group) return '❔';
  return group[key] || '❔';
}

/**
 * Membuat elemen gambar pixel yang aman:
 * jika file tidak ada, otomatis diganti dengan emoji fallback.
 *
 * @returns {HTMLElement} <span> pembungkus
 */
export function createSafeSprite(category, key, { size = 64, alt = '', className = '' } = {}) {
  const wrap = document.createElement('span');
  wrap.className = `sprite ${className}`.trim();
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;
  wrap.style.fontSize = `${Math.round(size * 0.8)}px`;
  wrap.style.lineHeight = `${size}px`;

  const path = getAssetPath(category, key);
  const emoji = getFallbackEmoji(category, key);

  if (!path) {
    wrap.textContent = emoji;
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', alt || key);
    return wrap;
  }

  const img = document.createElement('img');
  img.src = path;
  img.alt = alt || key;
  img.width = size;
  img.height = size;
  img.className = 'pixel-img';
  img.decoding = 'async';
  img.loading = 'lazy';

  img.addEventListener('error', () => {
    wrap.textContent = emoji;
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', alt || key);
  }, { once: true });

  wrap.appendChild(img);
  return wrap;
}

/**
 * Menerapkan background pixel ke sebuah elemen dengan pengecekan keberadaan.
 * Jika gambar gagal dimuat, elemen tetap memakai warna latar CSS.
 */
export function applySafeBackground(el, key) {
  const path = getAssetPath('backgrounds', key);
  if (!el || !path) return;
  const probe = new Image();
  probe.onload = () => {
    el.style.backgroundImage = `url("${path}")`;
    el.classList.add('has-bg-image');
  };
  probe.onerror = () => {
    el.classList.add('no-bg-image');
  };
  probe.src = path;
}

/* =====================================================================
 * ANIMASI IDLE
 * Setiap berkas di ASSETS.idle adalah strip horizontal 4 frame
 * (1024 x 256; tiap frame 256 x 256). Frame dimainkan lewat CSS
 * (kelas .idle-sprite, keyframes idle-play di css/game.css).
 * ===================================================================== */

export const IDLE_FRAME_COUNT = 4;

/**
 * Membuat sprite beranimasi idle dengan fallback bertingkat:
 * strip idle → gambar statis → emoji.
 *
 * @param {'characters'|'enemies'|'bosses'} staticCategory kategori gambar statis
 * @param {string} key   kunci aset (mis. 'knight', 'slime', 'boss-6')
 * @param {object} opts  { size, alt, className }
 * @returns {HTMLElement}
 */
export function createIdleSprite(staticCategory, key, { size = 96, alt = '', className = '' } = {}) {
  const wrap = document.createElement('span');
  wrap.className = `sprite idle-wrap ${className}`.trim();
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;
  wrap.style.fontSize = `${Math.round(size * 0.8)}px`;
  wrap.style.lineHeight = `${size}px`;
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', alt || key);

  const emoji = getFallbackEmoji(staticCategory, key);
  const idlePath = getAssetPath('idle', key);
  const staticPath = getAssetPath(staticCategory, key);

  const useEmoji = () => { wrap.textContent = emoji; };

  const useStatic = () => {
    if (!staticPath) { useEmoji(); return; }
    const img = document.createElement('img');
    img.src = staticPath;
    img.alt = '';
    img.width = size;
    img.height = size;
    img.className = 'pixel-img';
    img.decoding = 'async';
    img.addEventListener('error', () => { img.remove(); useEmoji(); }, { once: true });
    wrap.textContent = '';
    wrap.appendChild(img);
  };

  if (!idlePath) { useStatic(); return wrap; }

  const probe = new Image();
  probe.onload = () => {
    const node = document.createElement('span');
    node.className = 'idle-sprite';
    node.style.setProperty('--idle-size', `${size}px`);
    node.style.backgroundImage = `url("${idlePath}")`;
    wrap.textContent = '';
    wrap.appendChild(node);
  };
  probe.onerror = useStatic;
  probe.src = idlePath;

  return wrap;
}

/**
 * Ganti isi sebuah node dengan sprite idle (dipakai arena pertarungan).
 */
export function mountIdleSprite(node, staticCategory, key, { size = 96, alt = '' } = {}) {
  if (!node) return;
  node.textContent = '';
  node.appendChild(createIdleSprite(staticCategory, key, { size, alt }));
}
