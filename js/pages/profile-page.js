/** Halaman profil siswa: statistik, peta fakta, lencana, riwayat 30 hari. */

import { isFirebaseReady, devError } from '../firebase/firebase-app.js';
import { waitForAuth } from '../firebase/auth-service.js';
import { GameEngine } from '../game/game-engine.js';
import {
  CHARACTERS, BADGES, OPERATION_LIST, OPERATION_LABEL,
  OPERATION_SYMBOL, MASTERY_STATUS, MASTERY_LABEL
} from '../config/game-config.js';
import { levelFromXp } from '../game/reward-engine.js';
import { getAllFactsFor } from '../game/question-generator.js';
import { showLoading, hideLoading, watchConnection } from '../ui/loading.js';
import { toast } from '../ui/toast.js';
import { el, $, clearNode, show, formatMs, percent } from '../utils/helpers.js';
import { createIcon, createIdleSprite } from '../asset-manifest.js';
import { lastNDayKeys, dayKey, formatDateId } from '../utils/date-utils.js';

let engine = null;

/** Peta lencana ke ikon aset (selaras dengan game-page). */
function badgeIcon(id) {
  if (id.startsWith('streak_')) return ['effects', 'fire'];
  if (id.startsWith('facts_') || id === 'graduate') return ['icons', 'book'];
  if (id.startsWith('boss_')) return ['icons', 'sword'];
  if (id === 'speed_demon') return ['icons', 'gem'];
  return ['icons', 'star'];
}

async function init() {
  watchConnection();

  if (!isFirebaseReady()) {
    toast.error('Firebase belum dikonfigurasi.');
    location.href = './index.html';
    return;
  }

  showLoading('Memuat profil…');

  const user = await waitForAuth();
  if (!user) {
    hideLoading();
    location.href = './student.html';
    return;
  }

  engine = new GameEngine(user.uid);
  try {
    await engine.load();
  } catch (e) {
    devError('Gagal memuat profil:', e);
    hideLoading();
    toast.error('Gagal memuat data. Periksa koneksi internet.');
    return;
  }

  hideLoading();

  renderHeader();
  renderStats();
  renderOperationProgress();
  renderComparison();
  renderHistory();
  renderFactMap();
  renderBadges();
}

function renderHeader() {
  const p = engine.profile;
  const char = CHARACTERS.find((c) => c.id === p.characterId) || CHARACTERS[0];
  const levelInfo = levelFromXp(p.xp || 0);

  const box = $('#profile-header');
  clearNode(box);

  box.appendChild(el('div', { className: 'row', style: { gap: '16px' } }, [
    createIdleSprite('characters', char.asset || char.id, { size: 72, alt: char.name }),
    el('div', { style: { flex: '1' } }, [
      el('h2', { text: p.displayName || 'Petualang', style: { marginBottom: '4px' } }),
      el('p', { className: 'text-sm text-muted', text: `${char.name} · Level ${levelInfo.level}` }),
      el('div', { className: 'progress progress--primary' }, [
        el('div', { className: 'progress__fill', style: { width: `${Math.round(levelInfo.progress * 100)}%` } })
      ]),
      el('p', {
        className: 'text-xs text-muted',
        style: { marginTop: '6px', marginBottom: '0' },
        text: `${levelInfo.xpIntoLevel} / ${levelInfo.xpForNext} XP menuju level ${levelInfo.level + 1}`
      })
    ])
  ]));
}

function renderStats() {
  const p = engine.profile;
  const mastery = engine.getMasterySummary();
  const totalQ = p.totalQuestions || 0;
  const totalC = p.totalCorrect || 0;

  let sumMs = 0, msCount = 0;
  for (const fact of engine.factMap.values()) {
    if (fact.averageResponseMs > 0) { sumMs += fact.averageResponseMs; msCount += 1; }
  }
  const avgMs = msCount > 0 ? Math.round(sumMs / msCount) : 0;

  const stats = [
    { label: 'Total XP', value: (p.xp || 0).toLocaleString('id-ID') },
    { label: 'Streak', value: `${p.streak || 0} hari` },
    { label: 'Hari aktif', value: p.daysActive || 0 },
    { label: 'Total soal', value: totalQ.toLocaleString('id-ID') },
    { label: 'Akurasi', value: `${percent(totalC, totalQ, 1)}%` },
    { label: 'Kecepatan rata-rata', value: formatMs(avgMs) },
    { label: 'Fakta dikuasai', value: mastery.totalMastered },
    { label: 'Fakta otomatis', value: mastery.counts.automatic }
  ];

  const grid = $('#profile-stats');
  clearNode(grid);
  for (const s of stats) {
    grid.appendChild(el('div', { className: 'stat' }, [
      el('span', { className: 'stat__value', text: String(s.value) }),
      el('span', { className: 'stat__label', text: s.label })
    ]));
  }
}

function renderOperationProgress() {
  const box = $('#op-progress');
  clearNode(box);

  for (const op of OPERATION_LIST) {
    const progress = engine.getKingdomProgress(op);
    box.appendChild(el('div', { className: 'op-progress' }, [
      el('div', { className: 'op-progress__head' }, [
        el('span', { className: 'op-progress__name', text: OPERATION_LABEL[op] }),
        el('span', {
          className: 'text-muted',
          text: `${progress.mastered}/${progress.total} (${progress.percent}%)`
        })
      ]),
      el('div', { className: 'progress' }, [
        el('div', { className: 'progress__fill', style: { width: `${progress.percent}%` } })
      ])
    ]));
  }
}

function renderComparison() {
  const cmp = engine.getPlacementComparison();
  if (!cmp) return;

  show($('#compare-section'), true);
  const box = $('#compare-box');
  clearNode(box);

  const delta = cmp.accuracyDelta;
  const arrow = delta > 0 ? '+' : delta < 0 ? '\u2212' : '\u00b1';

  box.appendChild(el('div', { className: 'stat-grid' }, [
    el('div', { className: 'stat' }, [
      el('span', { className: 'stat__value', text: `${cmp.initialAccuracy}%` }),
      el('span', { className: 'stat__label', text: 'Tes awal' })
    ]),
    el('div', { className: 'stat' }, [
      el('span', { className: 'stat__value', text: `${cmp.currentAccuracy}%` }),
      el('span', { className: 'stat__label', text: 'Sekarang' })
    ]),
    el('div', { className: 'stat' }, [
      el('span', { className: 'stat__value', text: `${arrow}${Math.abs(delta)}` }),
      el('span', { className: 'stat__label', text: 'Perubahan' })
    ])
  ]));

  box.appendChild(el('p', {
    className: 'text-sm text-muted',
    style: { marginTop: '12px', marginBottom: '0' },
    text: delta > 0
      ? `Kamu berkembang sejak tes awal pada ${formatDateId(cmp.takenAt)}. Terus pertahankan!`
      : 'Kamu sedang membangun dasar yang kuat. Teruskan latihan harianmu.'
  }));
}

function renderHistory() {
  const p = engine.profile;
  const practiceDays = Array.isArray(p.practiceDays) ? new Set(p.practiceDays) : new Set();
  const keys = lastNDayKeys(30);

  const strip = $('#history-strip');
  clearNode(strip);

  let activeCount = 0;
  for (const key of keys) {
    const active = practiceDays.has(key);
    if (active) activeCount += 1;
    strip.appendChild(el('span', {
      className: `history-cell ${active ? 'is-active' : ''}`,
      attrs: { title: key, 'aria-label': `${key}: ${active ? 'berlatih' : 'tidak berlatih'}` }
    }));
  }

  $('#history-note').textContent =
    `${activeCount} dari 30 hari terakhir kamu berlatih. Kotak hijau berarti kamu hadir hari itu.`;
}

function renderFactMap() {
  const box = $('#factmap-box');
  clearNode(box);

  // Legenda.
  const legend = el('div', { className: 'row' });
  const legendItems = [
    { status: MASTERY_STATUS.UNSEEN, label: 'Belum dipelajari' },
    { status: MASTERY_STATUS.LEARNING, label: 'Sedang belajar' },
    { status: MASTERY_STATUS.DEVELOPING, label: 'Berkembang' },
    { status: MASTERY_STATUS.MASTERED, label: 'Dikuasai' },
    { status: MASTERY_STATUS.AUTOMATIC, label: 'Otomatis' }
  ];
  for (const item of legendItems) {
    legend.appendChild(el('span', { className: 'row', style: { gap: '6px' } }, [
      el('span', {
        className: `fact-map__cell fact-map__cell--${item.status}`,
        style: { width: '14px', height: '14px', display: 'inline-block' },
        attrs: { 'aria-hidden': 'true' }
      }),
      el('span', { className: 'text-xs text-muted', text: item.label })
    ]));
  }
  box.appendChild(legend);

  // Satu peta per operasi komutatif (perkalian & penjumlahan).
  for (const op of [OPERATION_LIST[0], OPERATION_LIST[2]]) {
    box.appendChild(el('h3', { text: `${OPERATION_LABEL[op]} (${OPERATION_SYMBOL[op]})` }));
    box.appendChild(buildFactGrid(op));
  }
}

function buildFactGrid(operation) {
  const grid = el('div', { className: 'fact-map' });

  // Baris header.
  grid.appendChild(el('span', { className: 'fact-map__cell fact-map__cell--header', text: OPERATION_SYMBOL[operation] }));
  for (let b = 1; b <= 9; b++) {
    grid.appendChild(el('span', { className: 'fact-map__cell fact-map__cell--header', text: String(b) }));
  }

  const facts = getAllFactsFor(operation);
  const byKey = new Map(facts.map((f) => [`${Math.min(f.operandA, f.operandB)}_${Math.max(f.operandA, f.operandB)}`, f]));

  for (let a = 1; a <= 9; a++) {
    grid.appendChild(el('span', { className: 'fact-map__cell fact-map__cell--header', text: String(a) }));
    for (let b = 1; b <= 9; b++) {
      const key = `${Math.min(a, b)}_${Math.max(a, b)}`;
      const base = byKey.get(key);
      const record = base ? engine.factMap.get(base.factId) : null;
      const status = record ? record.status : MASTERY_STATUS.UNSEEN;

      grid.appendChild(el('span', {
        className: `fact-map__cell fact-map__cell--${status}`,
        attrs: {
          title: `${a} ${OPERATION_SYMBOL[operation]} ${b} — ${MASTERY_LABEL[status] || status}`,
          'aria-label': `${a} ${OPERATION_SYMBOL[operation]} ${b}, ${MASTERY_LABEL[status] || status}`
        }
      }));
    }
  }

  return grid;
}

function renderBadges() {
  const owned = new Set(Array.isArray(engine.profile.badges) ? engine.profile.badges : []);
  const grid = $('#badge-grid');
  clearNode(grid);

  for (const badge of BADGES) {
    const has = owned.has(badge.id);
    grid.appendChild(el('div', {
      className: `badge-item ${has ? '' : 'is-locked'}`,
      attrs: { title: badge.desc, 'aria-label': `${badge.name}: ${has ? 'diperoleh' : 'belum diperoleh'}` }
    }, [
      el('span', { className: 'badge-item__emoji', attrs: { 'aria-hidden': 'true' } },
        [createIcon(...badgeIcon(badge.id), { size: 28 })]),
      el('span', { className: 'badge-item__name', text: badge.name })
    ]));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}