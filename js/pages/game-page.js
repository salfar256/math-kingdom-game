/**
 * Halaman game: peta kerajaan, pilih mode, arena, hasil, leaderboard.
 * Semua layar berada dalam satu halaman agar transisi cepat dan
 * data siswa cukup dimuat sekali.
 */

import { isFirebaseReady, getInitError, devError, devLog } from '../firebase/firebase-app.js';
import { waitForAuth, signOut, getCurrentUid } from '../firebase/auth-service.js';
import { GameEngine } from '../game/game-engine.js';
import { flushSyncQueue } from '../game/session-manager.js';
import {
  MODES, MODE_LABEL, KINGDOMS, OPERATION_LABEL, CHARACTERS, ENEMIES,
  SESSION_CONFIG, BOSSES, MASTERY_LABEL, MASTERY_STATUS
} from '../config/game-config.js';
import { BattleEngine } from '../game/battle-engine.js';
import { getHint, explainMistake, quickFeedback } from '../game/feedback-engine.js';
import {
  fetchClassRoster, buildLeaderboard, isLeaderboardEnabled,
  setLeaderboardVisibility, LEADERBOARD_CATEGORIES, encouragementFor
} from '../firebase/leaderboard-service.js';
import { getDb } from '../firebase/firebase-app.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { applySafeBackground } from '../asset-manifest.js';
import { showModal, confirmDialog } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { showLoading, hideLoading, setSyncStatus, watchConnection } from '../ui/loading.js';
import { soundManager } from '../ui/sound-manager.js';
import { animationManager } from '../ui/animation-manager.js';
import { el, $, clearNode, show, getQueryParam, formatDuration, formatMs, percent } from '../utils/helpers.js';
import { relativeDayId } from '../utils/date-utils.js';

/* ============ STATE ============ */

const state = {
  uid: null,
  engine: null,
  session: null,
  battle: null,
  answer: '',
  timerId: null,
  timerEndsAt: 0,
  advanceTimeout: null,
  lastSessionOptions: null,
  lastResult: null,
  className: '',
  leaderboardCategory: 'effort',
  leaderboardHidden: false,
  isSubmitting: false
};

const SCREENS = ['screen-map', 'screen-mode', 'screen-arena', 'screen-result', 'screen-leaderboard'];

function showScreen(id) {
  for (const s of SCREENS) show($(`#${s}`), s === id);
  window.scrollTo(0, 0);
}

/* ============ INISIALISASI ============ */

async function init() {
  watchConnection();

  if (!isFirebaseReady()) {
    await showModal({
      title: 'Firebase belum siap',
      lines: [(getInitError() && getInitError().message) || 'Konfigurasi Firebase belum lengkap.'],
      buttons: [{ id: 'ok', text: 'Kembali', variant: 'primary' }]
    });
    location.href = './index.html';
    return;
  }

  showLoading('Memuat petualanganmu…');

  const user = await waitForAuth();
  if (!user) {
    hideLoading();
    toast.error('Kamu belum masuk. Silakan masuk kembali.');
    location.href = './student.html';
    return;
  }

  state.uid = user.uid;
  state.engine = new GameEngine(user.uid);

  try {
    await state.engine.load();
  } catch (e) {
    devError('Gagal memuat data:', e);
    hideLoading();
    await showModal({
      title: 'Gagal memuat data',
      lines: ['Periksa koneksi internetmu, lalu coba lagi.'],
      buttons: [{ id: 'ok', text: 'Coba lagi', variant: 'primary' }]
    });
    location.reload();
    return;
  }

  if (!state.engine.profile.activeClassId) {
    hideLoading();
    toast.error('Kamu belum terdaftar di kelas mana pun.');
    location.href = './student.html';
    return;
  }

  await loadClassSettings();
  await trySyncPending();

  bindGlobalEvents();
  buildKeypad();
  updateSoundButtons();
  hideLoading();

  const requestedMode = getQueryParam('mode');
  if (requestedMode === 'placement' || state.engine.needsPlacement) {
    await startPlacementFlow();
  } else {
    renderMap();
    showScreen('screen-map');
  }
}

async function loadClassSettings() {
  const classId = state.engine.profile.activeClassId;
  if (!classId) return;
  try {
    const snap = await getDoc(doc(getDb(), 'classes', classId));
    if (snap.exists()) {
      const data = snap.data();
      state.className = data.name || '';
      state.engine.setClassSettings(data.settings || {});
    }
  } catch (e) {
    devLog('Pengaturan kelas tidak dapat dibaca, memakai default.', e);
  }
}

async function trySyncPending() {
  try {
    const { sent } = await flushSyncQueue(state.uid);
    if (sent > 0) {
      setSyncStatus('saved');
      toast.success(`${sent} sesi tertunda berhasil dikirim.`);
    }
  } catch { /* diabaikan */ }
}

function bindGlobalEvents() {
  $('#btn-logout').addEventListener('click', handleLogout);
  $('#btn-mode-back').addEventListener('click', () => { soundManager.click(); renderMap(); showScreen('screen-map'); });
  $('#btn-daily').addEventListener('click', startDailySession);
  $('#btn-leaderboard').addEventListener('click', openLeaderboard);
  $('#btn-lb-back').addEventListener('click', () => { soundManager.click(); showScreen('screen-map'); });
  $('#btn-lb-privacy').addEventListener('click', toggleLeaderboardPrivacy);

  $('#btn-help').addEventListener('click', handleHelp);
  $('#btn-skip').addEventListener('click', handleSkip);
  $('#btn-quit').addEventListener('click', handleQuit);
  $('#btn-pause').addEventListener('click', handlePause);

  $('#btn-result-map').addEventListener('click', () => { soundManager.click(); renderMap(); showScreen('screen-map'); });
  $('#btn-result-again').addEventListener('click', repeatSession);
  $('#btn-result-review').addEventListener('click', openReview);

  for (const id of ['#btn-sound-map', '#btn-sound-arena']) {
    $(id).addEventListener('click', () => {
      const muted = soundManager.toggleMuted();
      updateSoundButtons();
      if (!muted) soundManager.click();
    });
  }

  document.addEventListener('keydown', handleKeyboard);
  window.addEventListener('beforeunload', (e) => {
    if (state.session && !state.session.finished && state.session.stats.total > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function updateSoundButtons() {
  const muted = soundManager.isMuted();
  for (const id of ['#btn-sound-map', '#btn-sound-arena']) {
    const btn = $(id);
    if (!btn) continue;
    btn.textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', String(muted));
    btn.setAttribute('aria-label', muted ? 'Suara mati' : 'Suara hidup');
  }
}

async function handleLogout() {
  soundManager.click();
  const ok = await confirmDialog(
    'Keluar dari game?',
    'Progresmu sudah tersimpan. Kamu dapat masuk kembali kapan saja.',
    { confirmText: 'Ya, keluar' }
  );
  if (!ok) return;
  await signOut();
  location.href = './index.html';
}

/* ============ PETA KERAJAAN ============ */

function renderMap() {
  const engine = state.engine;
  const p = engine.profile;

  $('#map-greeting').textContent = `Halo, ${p.displayName || 'Petualang'}!`;

  const plan = engine.getTodayPlan();
  const day = engine.getProgramDay();
  $('#map-subtitle').textContent =
    `Hari ke-${day} dari 30 · ${state.className || 'Kelasmu'}`;
  $('#daily-title').textContent = `Latihan Hari Ini: ${plan.title}`;
  $('#daily-desc').textContent = plan.note ||
    `Fokus: ${(plan.ops || []).map((o) => OPERATION_LABEL[o] || o).join(', ')}`;

  renderMapStats();
  renderKingdoms();
  renderRecommendations();
}

function renderMapStats() {
  const engine = state.engine;
  const p = engine.profile;
  const mastery = engine.getMasterySummary();
  const grid = $('#map-stats');
  clearNode(grid);

  const stats = [
    { label: 'Level', value: p.level || 1 },
    { label: 'XP', value: (p.xp || 0).toLocaleString('id-ID') },
    { label: 'Streak', value: `${p.streak || 0} hari` },
    { label: 'Fakta dikuasai', value: mastery.totalMastered }
  ];

  for (const s of stats) {
    grid.appendChild(el('div', { className: 'stat' }, [
      el('span', { className: 'stat__value', text: String(s.value) }),
      el('span', { className: 'stat__label', text: s.label })
    ]));
  }
}

function renderKingdoms() {
  const grid = $('#kingdom-grid');
  clearNode(grid);

  const { kingdoms, tower } = state.engine.getAllProgress();

  for (const k of kingdoms) {
    const locked = k.status === 'terkunci';
    const card = el('button', {
      className: 'kingdom-card',
      attrs: {
        type: 'button',
        'data-op': k.id,
        disabled: locked ? 'disabled' : null,
        'aria-label': `${k.name}, ${k.percent} persen, status ${k.status}`
      }
    }, [
      el('div', { className: 'kingdom-card__head' }, [
        el('span', { className: 'kingdom-card__emoji', text: locked ? '🔒' : k.emoji, attrs: { 'aria-hidden': 'true' } }),
        el('div', {}, [
          el('div', { className: 'kingdom-card__title', text: k.shortName }),
          el('div', { className: 'kingdom-card__status text-muted', text: k.status })
        ])
      ]),
      el('div', { className: 'kingdom-card__footer' }, [
        el('div', { className: 'progress' }, [
          el('div', { className: 'progress__fill', style: { width: `${k.percent}%` } })
        ]),
        el('div', { className: 'text-xs text-muted', text: `${k.mastered} / ${k.total} fakta (${k.percent}%)` })
      ])
    ]);

    applySafeBackground(card, k.background);
    if (!locked) card.addEventListener('click', () => { soundManager.click(); openModeScreen(k); });
    grid.appendChild(card);
  }

  // Menara campuran.
  const towerCard = el('button', {
    className: 'kingdom-card',
    attrs: {
      type: 'button', 'data-op': 'mixed',
      disabled: tower.unlocked ? null : 'disabled',
      'aria-label': `${tower.name}, ${tower.unlocked ? 'terbuka' : 'terkunci'}`
    }
  }, [
    el('div', { className: 'kingdom-card__head' }, [
      el('span', { className: 'kingdom-card__emoji', text: tower.unlocked ? '🗼' : '🔒', attrs: { 'aria-hidden': 'true' } }),
      el('div', {}, [
        el('div', { className: 'kingdom-card__title', text: tower.shortName }),
        el('div', {
          className: 'kingdom-card__status text-muted',
          text: tower.unlocked ? 'terbuka' : 'Kuasai keempat kerajaan dulu'
        })
      ])
    ]),
    el('div', { className: 'kingdom-card__footer' }, [
      el('div', { className: 'progress progress--primary' }, [
        el('div', { className: 'progress__fill', style: { width: `${tower.percent}%` } })
      ]),
      el('div', { className: 'text-xs text-muted', text: `Rata-rata penguasaan ${tower.percent}%` })
    ])
  ]);

  applySafeBackground(towerCard, tower.background);
  if (tower.unlocked) {
    towerCard.addEventListener('click', () => {
      soundManager.click();
      startSession({ mode: MODES.MIXED, operation: null, title: tower.name });
    });
  }
  grid.appendChild(towerCard);
}

function renderRecommendations() {
  const recs = state.engine.getRecommendations().slice(0, 3);
  const section = $('#recommend-section');
  const list = $('#recommend-list');
  clearNode(list);

  if (recs.length === 0) { section.hidden = true; return; }
  section.hidden = false;

  for (const r of recs) {
    const card = el('div', { className: 'card row row--between' }, [
      el('div', {}, [
        el('strong', { text: OPERATION_LABEL[r.operation] || r.operation }),
        el('p', { className: 'text-sm text-muted mb-0', text: `${r.count} fakta perlu latihan. ${r.reason}` })
      ]),
      el('button', {
        className: 'btn btn--sm btn--primary',
        text: 'Latih',
        attrs: { type: 'button' },
        on: {
          click: () => {
            soundManager.click();
            startSession({
              mode: MODES.PRACTICE,
              operation: r.operation,
              title: `Latihan ${OPERATION_LABEL[r.operation]}`
            });
          }
        }
      })
    ]);
    list.appendChild(card);
  }
}

/* ============ PILIH MODE ============ */

function openModeScreen(kingdom) {
  $('#mode-title').textContent = kingdom.name;
  $('#mode-progress').textContent =
    `${kingdom.mastered} dari ${kingdom.total} fakta dikuasai (${kingdom.percent}%)`;

  const list = $('#mode-list');
  clearNode(list);

  const modes = [
    { mode: MODES.PRACTICE, emoji: '📖', name: 'Latihan', desc: 'Tanpa batas waktu. Bantuan tersedia.' },
    { mode: MODES.BATTLE,   emoji: '⚔️', name: 'Pertarungan', desc: 'Kalahkan musuh dengan jawaban benar.' },
    { mode: MODES.SPEED,    emoji: '⚡', name: `Kecepatan ${Math.round(state.engine.speedDurationMs / 1000)} detik`, desc: 'Jawab sebanyak mungkin dengan tepat.' },
    { mode: MODES.FACT_FAMILY, emoji: '👨‍👩‍👧', name: 'Keluarga Fakta', desc: 'Lengkapi empat fakta yang bersaudara.' },
    { mode: MODES.FIX_ANSWER,  emoji: '🔍', name: 'Perbaiki Jawaban', desc: 'Temukan jawaban yang salah, lalu betulkan.' }
  ];

  for (const m of modes) {
    list.appendChild(modeCard(m, kingdom));
  }

  // Boss.
  const boss = BOSSES.find((b) => b.focus === 7) || BOSSES[0];
  const bossCard = el('button', {
    className: 'card card--clickable row row--between',
    attrs: { type: 'button', disabled: kingdom.bossUnlocked ? null : 'disabled' }
  }, [
    el('div', {}, [
      el('strong', { text: `${kingdom.bossUnlocked ? '👑' : '🔒'} Boss ${kingdom.shortName}` }),
      el('p', {
        className: 'text-sm text-muted mb-0',
        text: kingdom.bossUnlocked
          ? 'Butuh akurasi minimal 85%. Kalahkan penjaga kerajaan.'
          : 'Terbuka setelah 50% fakta kerajaan ini dikuasai.'
      })
    ]),
    el('span', { text: '›', attrs: { 'aria-hidden': 'true' } })
  ]);

  if (kingdom.bossUnlocked) {
    bossCard.addEventListener('click', () => {
      soundManager.click();
      startSession({
        mode: MODES.BOSS,
        operation: kingdom.id,
        bossId: pickBossFor(kingdom),
        title: `Boss ${kingdom.shortName}`
      });
    });
  }
  list.appendChild(bossCard);

  showScreen('screen-mode');
}

function pickBossFor(kingdom) {
  // Boss mewakili fakta sulit: pilih berdasarkan angka terlemah siswa.
  const weakNumbers = [6, 7, 8, 9];
  let worst = 7;
  let worstScore = Infinity;

  for (const n of weakNumbers) {
    let attempts = 0, correct = 0;
    for (const fact of state.engine.factMap.values()) {
      if (fact.operation !== kingdom.id) continue;
      if (fact.operandA !== n && fact.operandB !== n && fact.answer !== n) continue;
      attempts += fact.totalAttempts || 0;
      correct += fact.correctAttempts || 0;
    }
    const acc = attempts > 0 ? correct / attempts : 0.5;
    if (acc < worstScore) { worstScore = acc; worst = n; }
  }
  return `boss-${worst}`;
}

function modeCard(m, kingdom) {
  const card = el('button', {
    className: 'card card--clickable row row--between',
    attrs: { type: 'button' }
  }, [
    el('div', {}, [
      el('strong', { text: `${m.emoji} ${m.name}` }),
      el('p', { className: 'text-sm text-muted mb-0', text: m.desc })
    ]),
    el('span', { text: '›', attrs: { 'aria-hidden': 'true' } })
  ]);

  card.addEventListener('click', () => {
    soundManager.click();
    startSession({ mode: m.mode, operation: kingdom.id, title: `${m.name} — ${kingdom.shortName}` });
  });
  return card;
}

/* ============ TES AWAL ============ */

async function startPlacementFlow() {
  await showModal({
    title: '📝 Tes Awal',
    lines: [
      'Sebelum bertualang, kita ukur dulu kemampuanmu saat ini.',
      'Ada sekitar 40 soal dari keempat operasi. Kerjakan sebisamu.',
      'Tes ini tidak dinilai dan tidak mengurangi HP. Kalau tidak tahu, tekan Lewati saja.',
      'Hasilnya dipakai untuk menyusun latihan yang pas untukmu.'
    ],
    buttons: [{ id: 'ok', text: 'Siap, mulai!', variant: 'primary' }],
    dismissible: false
  });

  startSession({ mode: MODES.PLACEMENT, operation: null, title: 'Tes Awal' });
}

/* ============ SESI & ARENA ============ */

function startDailySession() {
  soundManager.click();
  const plan = state.engine.getTodayPlan();
  const ops = (plan.ops || []).filter((o) => state.engine.enabledOperations.includes(o));

  if (plan.focus === 'placement') { startPlacementFlow(); return; }

  const operation = ops.length === 1 ? ops[0] : null;
  const mode = plan.focus === 'speed' ? MODES.SPEED
    : plan.focus === 'boss' ? MODES.BATTLE
    : ops.length > 1 ? MODES.MIXED
    : MODES.BATTLE;

  startSession({
    mode,
    operation,
    targets: plan.targets || null,
    title: `Latihan Hari Ini — ${plan.title}`
  });
}

function startSession(options) {
  state.lastSessionOptions = options;
  const { mode, operation, targets = null, bossId = null, title = '' } = options;

  const session = state.engine.startSession({ mode, operation, targets });
  if (!session || session.plannedCount === 0) {
    toast.error('Tidak ada soal yang tersedia untuk mode ini.');
    return;
  }

  state.session = session;
  state.battle = new BattleEngine({
    characterId: state.engine.profile.characterId,
    mode,
    bossId,
    questionCount: session.plannedCount
  });

  state.answer = '';
  state.isSubmitting = false;

  setupArenaChrome(title, mode, operation);
  showScreen('screen-arena');

  soundManager.playBackground();

  if (mode === MODES.SPEED) startTimer(state.engine.speedDurationMs);
  advanceQuestion();
}

function setupArenaChrome(title, mode, operation) {
  const p = state.engine.profile;
  const char = CHARACTERS.find((c) => c.id === p.characterId) || CHARACTERS[0];

  $('#player-sprite').textContent = char.emoji;
  $('#player-name').textContent = p.displayName || 'Kamu';

  const enemy = state.battle.enemy;
  $('#enemy-sprite').textContent = enemy.emoji;
  $('#enemy-name').textContent = enemy.name;

  const isPlacement = mode === MODES.PLACEMENT;
  show($('#btn-skip'), isPlacement);
  show($('#btn-help'), !isPlacement && mode !== MODES.SPEED);
  show($('#fighter-enemy'), !isPlacement);
  show($('#fighter-player'), !isPlacement);

  const bgKey = operation
    ? (KINGDOMS.find((k) => k.id === operation) || {}).background
    : 'mixed-tower';
  if (bgKey) applySafeBackground($('#screen-arena'), bgKey);

  updateHud();
  updateBattleBars();

  $('#hud-score').textContent = '0';
  $('#hud-correct').textContent = '0';
}

function advanceQuestion() {
  clearTimeout(state.advanceTimeout);
  hideHint();

  const q = state.session.nextQuestion();
  if (!q) { endSession(); return; }

  state.answer = '';
  state.isSubmitting = false;

  const display = $('#question-text');
  display.textContent = `${q.displayedQuestion} = ?`;
  display.setAttribute('aria-label', `${q.displayA} ${spokenSymbol(q.operation)} ${q.displayB} sama dengan berapa`);

  $('#answer-display').textContent = '_';
  $('#answer-display').className = 'answer-display';
  $('#feedback-line').textContent = '';
  $('#feedback-line').className = 'feedback-line';

  const total = state.session.mode === MODES.SPEED ? '∞' : state.session.plannedCount;
  $('#question-progress').textContent = q.isCorrection
    ? '🔁 Soal ulangan'
    : `Soal ${state.session.stats.total + 1} dari ${total}`;

  updateHud();
}

function spokenSymbol(operation) {
  return { addition: 'tambah', subtraction: 'kurang', multiplication: 'kali', division: 'bagi' }[operation] || '';
}

/* ---------- Input ---------- */

function buildKeypad() {
  const keypad = $('#keypad');
  clearNode(keypad);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

  for (const key of keys) {
    let className = 'keypad__key';
    let text = key;
    let label = `Angka ${key}`;

    if (key === 'del') { className += ' keypad__key--del'; text = '⌫'; label = 'Hapus'; }
    if (key === 'ok')  { className += ' keypad__key--ok';  text = 'OK'; label = 'Kirim jawaban'; }

    const btn = el('button', {
      className, text,
      attrs: { type: 'button', 'aria-label': label, 'data-key': key }
    });
    btn.addEventListener('click', () => handleKeyInput(key));
    keypad.appendChild(btn);
  }
}

function handleKeyInput(key) {
  if (!state.session || !state.session.isAwaitingAnswer) return;

  if (key === 'del') {
    soundManager.click();
    state.answer = state.answer.slice(0, -1);
  } else if (key === 'ok') {
    submitAnswer();
    return;
  } else if (/^\d$/.test(key)) {
    if (state.answer.length >= SESSION_CONFIG.maxAnswerLength) return;
    soundManager.click();
    state.answer += key;
  }
  renderAnswer();
}

function renderAnswer() {
  const node = $('#answer-display');
  node.textContent = state.answer.length > 0 ? state.answer : '_';
}

function handleKeyboard(e) {
  const arenaVisible = !$('#screen-arena').hidden;
  if (!arenaVisible) return;
  if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); handleKeyInput(e.key); return; }
  if (e.key === 'Backspace')  { e.preventDefault(); handleKeyInput('del'); return; }
  if (e.key === 'Enter')      { e.preventDefault(); handleKeyInput('ok'); return; }
  if (e.key === 'Escape')     { e.preventDefault(); handlePause(); }
}

/* ---------- Kirim jawaban ---------- */

function submitAnswer() {
  if (state.isSubmitting) return;
  if (!state.session || !state.session.isAwaitingAnswer) return;
  if (state.answer.length === 0) {
    $('#feedback-line').textContent = 'Masukkan jawabanmu dulu.';
    return;
  }

  state.isSubmitting = true;
  const outcome = state.session.submitAnswer(state.answer);
  if (!outcome) { state.isSubmitting = false; return; }

  const battleResult = state.battle.applyAnswer({
    correct: outcome.correct,
    responseMs: outcome.responseMs,
    isCorrection: outcome.isCorrection
  });

  renderOutcome(outcome, battleResult);
  updateHud();
  updateBattleBars();

  const delay = outcome.correct
    ? SESSION_CONFIG.autoAdvanceCorrectMs
    : SESSION_CONFIG.autoAdvanceWrongMs;

  state.advanceTimeout = setTimeout(() => {
    if (battleResult.enemyDefeated && !state.battle.isBoss) {
      const next = state.battle.spawnNextEnemy();
      $('#enemy-sprite').textContent = next.emoji;
      $('#enemy-name').textContent = next.name;
      updateBattleBars();
    }
    if (state.battle.isBoss && battleResult.enemyDefeated) { endSession(); return; }
    advanceQuestion();
  }, delay);
}

function renderOutcome(outcome, battleResult) {
  const answerNode = $('#answer-display');
  const feedback = $('#feedback-line');
  const stage = $('#arena-stage');

  if (outcome.correct) {
    answerNode.className = 'answer-display is-correct';
    feedback.className = 'feedback-line is-correct';
    feedback.textContent = `${quickFeedback(true, outcome.responseMs)} +${outcome.points} poin`;

    soundManager.correct();
    soundManager.attack();
    animationManager.attack($('#fighter-player'));
    animationManager.shake($('#fighter-enemy'));
    animationManager.flash(stage, 'correct');
    animationManager.floatText($('#fighter-enemy'), `-${battleResult.damageToEnemy}`, 'damage');

    if (battleResult.healed > 0) {
      animationManager.floatText($('#fighter-player'), `+${battleResult.healed}`, 'heal');
    }
    if (outcome.mastery && outcome.mastery.newlyMastered) {
      toast.success('Fakta baru dikuasai! 🎉');
    }
  } else {
    answerNode.className = 'answer-display is-wrong';
    feedback.className = 'feedback-line is-wrong';
    feedback.textContent = quickFeedback(false);

    soundManager.wrong();
    animationManager.shake($('#fighter-player'));
    animationManager.flash(stage, 'wrong');
    if (battleResult.damageToPlayer > 0) {
      animationManager.floatText($('#fighter-player'), `-${battleResult.damageToPlayer}`, 'damage');
    }

    showExplanation(outcome);

    if (battleResult.enteredRecovery) {
      toast.info('HP habis. Sesi pemulihan dimulai: soal akan lebih mudah.');
    }
  }

  renderCombo();
}

function showExplanation(outcome) {
  const info = explainMistake(outcome.question, outcome.given);
  const box = $('#hint-box');
  $('#hint-title').textContent = info.title;

  const lines = $('#hint-lines');
  clearNode(lines);
  for (const line of info.lines) {
    lines.appendChild(el('p', { className: 'hint-box__line', text: line }));
  }
  box.hidden = false;
}

function handleHelp() {
  if (!state.session || !state.session.isAwaitingAnswer) return;
  soundManager.click();

  const level = state.session.useHelp();
  const hint = getHint(state.session.currentQuestion, level);

  $('#hint-title').textContent = `${hint.title} (bantuan ${level}/4)`;
  const lines = $('#hint-lines');
  clearNode(lines);
  for (const line of hint.lines) {
    lines.appendChild(el('p', { className: 'hint-box__line', text: line }));
  }
  $('#hint-box').hidden = false;

  if (level >= 4) $('#btn-help').disabled = true;
}

function hideHint() {
  $('#hint-box').hidden = true;
  $('#btn-help').disabled = false;
}

function handleSkip() {
  if (!state.session || !state.session.isAwaitingAnswer) return;
  soundManager.click();
  state.session.skipQuestion();
  updateHud();
  advanceQuestion();
}

async function handleQuit() {
  soundManager.click();
  const answered = state.session ? state.session.stats.total : 0;

  if (answered === 0) {
    stopTimer();
    state.session = null;
    renderMap();
    showScreen('screen-map');
    return;
  }

  const ok = await confirmDialog(
    'Selesaikan sesi sekarang?',
    [`Kamu sudah menjawab ${answered} soal. Hasilnya akan tetap disimpan.`],
    { confirmText: 'Ya, selesaikan' }
  );
  if (ok) endSession();
}

async function handlePause() {
  if (!state.session) return;
  soundManager.click();
  const wasTimer = Boolean(state.timerId);
  if (wasTimer) stopTimer();

  const choice = await showModal({
    title: '⏸️ Jeda',
    lines: [
      `Soal dijawab: ${state.session.stats.total}`,
      `Benar: ${state.session.stats.correct}`,
      `Skor: ${state.session.stats.score}`
    ],
    buttons: [
      { id: 'quit', text: 'Selesaikan', variant: 'danger' },
      { id: 'resume', text: 'Lanjutkan', variant: 'primary' }
    ],
    dismissible: false
  });

  if (choice === 'quit') { endSession(); return; }
  if (wasTimer) startTimer(Math.max(1000, state.timerEndsAt - Date.now()));
}

/* ---------- HUD & bilah ---------- */

function updateHud() {
  if (!state.session) return;
  $('#hud-index').textContent = String(state.session.stats.total);
  $('#hud-score').textContent = String(state.session.stats.score);
  $('#hud-correct').textContent = String(state.session.stats.correct);
}

function updateBattleBars() {
  if (!state.battle) return;
  const s = state.battle.getState();

  $('#player-hp-bar').style.width = `${Math.round(state.battle.playerHpPercent * 100)}%`;
  $('#player-hp-text').textContent = `${s.playerHp} / ${s.playerMaxHp}`;
  $('#enemy-hp-bar').style.width = `${Math.round(state.battle.enemyHpPercent * 100)}%`;
  $('#enemy-hp-text').textContent = `${s.enemyHp} / ${s.enemyMaxHp}`;
}

function renderCombo() {
  const wrap = $('#combo-wrap');
  clearNode(wrap);
  const combo = state.session ? state.session.stats.combo : 0;
  if (combo >= 3) {
    wrap.appendChild(el('span', { className: 'combo-badge', text: `🔥 Combo ×${combo}` }));
  }
}

/* ---------- Timer ---------- */

function startTimer(durationMs) {
  stopTimer();
  state.timerEndsAt = Date.now() + durationMs;
  show($('#timer-bar'), true);
  show($('#hud-timer-wrap'), true);

  const total = durationMs;
  state.timerId = setInterval(() => {
    const remaining = Math.max(0, state.timerEndsAt - Date.now());
    const ratio = remaining / total;

    const fill = $('#timer-fill');
    fill.style.width = `${ratio * 100}%`;
    fill.classList.toggle('is-low', ratio < 0.25);
    $('#hud-timer').textContent = formatDuration(remaining);

    if (remaining <= 0) { stopTimer(); endSession(); }
  }, 200);
}

function stopTimer() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  show($('#timer-bar'), false);
  show($('#hud-timer-wrap'), false);
}

/* ============ HASIL SESI ============ */

async function endSession() {
  if (!state.session) return;
  clearTimeout(state.advanceTimeout);
  stopTimer();
  state.session.stop();

  showLoading('Menyimpan hasil…');
  setSyncStatus('saving');

  const bossId = state.battle && state.battle.isBoss ? state.battle.enemy.id : null;
  const enemyHp = state.battle ? state.battle.enemyHp : null;

  let result;
  try {
    result = await state.engine.finishSession({ bossId, enemyHp });
  } catch (e) {
    devError('finishSession gagal:', e);
    hideLoading();
    setSyncStatus('error');
    toast.error('Hasil belum tersimpan. Akan dicoba lagi nanti.');
    state.session = null;
    renderMap();
    showScreen('screen-map');
    return;
  }

  hideLoading();
  setSyncStatus(result.persistResult.saved ? 'saved' : 'error');
  if (!result.persistResult.saved) {
    toast.warning('Koneksi bermasalah. Hasil disimpan sementara dan akan dikirim otomatis.');
  }

  state.lastResult = result;
  state.session = null;

  if (result.accuracyRatio >= 0.8) soundManager.victory();
  else soundManager.defeat();

  renderResult(result);
  showScreen('screen-result');
}

function renderResult(r) {
  const boss = r.bossResult;
  const victory = boss ? boss.victory : r.accuracyRatio >= 0.7;

  $('#result-emoji').textContent = boss
    ? (victory ? '👑' : '🛡️')
    : (r.accuracyRatio >= 0.9 ? '🌟' : r.accuracyRatio >= 0.7 ? '🎉' : '💪');

  $('#result-title').textContent = boss
    ? (victory ? 'Boss Dikalahkan!' : 'Boss Belum Tumbang')
    : (r.mode === MODES.PLACEMENT ? 'Tes Awal Selesai' : 'Sesi Selesai');

  $('#result-message').textContent = r.motivation;

  // Statistik.
  const grid = $('#result-stats');
  clearNode(grid);
  const stats = [
    { label: 'Soal', value: r.totalQuestions },
    { label: 'Benar', value: r.correct },
    { label: 'Salah', value: r.wrong },
    { label: 'Akurasi', value: `${r.accuracy}%` },
    { label: 'Waktu rata-rata', value: formatMs(r.averageResponseMs) },
    { label: 'Skor', value: r.score },
    { label: 'XP', value: `+${r.xpEarned}` },
    { label: 'Combo tertinggi', value: `×${r.maxCombo}` }
  ];
  for (const s of stats) {
    grid.appendChild(el('div', { className: 'stat' }, [
      el('span', { className: 'stat__value', text: String(s.value) }),
      el('span', { className: 'stat__label', text: s.label })
    ]));
  }

  // Detail.
  const detail = $('#result-detail');
  clearNode(detail);

  if (r.levelUp) {
    detail.appendChild(el('div', { className: 'chip chip--primary', text: `🎊 Naik ke Level ${r.level}!` }));
  }

  if (boss && !victory) {
    detail.appendChild(el('h3', { text: 'Syarat yang belum terpenuhi' }));
    const ul = el('ul');
    for (const reason of boss.reasons) ul.appendChild(el('li', { text: reason }));
    detail.appendChild(ul);
    detail.appendChild(el('p', {
      className: 'text-sm text-muted',
      text: 'Berlatih lagi sebentar, lalu tantang boss ini kembali.'
    }));
  }

  if (r.factsMastered > 0) {
    detail.appendChild(el('h3', { text: `✅ Fakta baru dikuasai (${r.factsMastered})` }));
    detail.appendChild(factPills(r.newlyMasteredIds, 'mastered'));
  }

  if (r.weakFactIds && r.weakFactIds.length > 0) {
    detail.appendChild(el('h3', { text: 'Perlu dilatih lagi' }));
    detail.appendChild(factPills(r.weakFactIds, 'weak'));
  }

  if (r.newBadges && r.newBadges.length > 0) {
    detail.appendChild(el('h3', { text: '🏅 Lencana Baru' }));
    const row = el('div', { className: 'row' });
    for (const b of r.newBadges) {
      row.appendChild(el('span', { className: 'chip chip--primary', text: `${b.emoji} ${b.name}` }));
    }
    detail.appendChild(row);
  }

  if (r.mode === MODES.PLACEMENT) {
    detail.appendChild(el('h3', { text: 'Langkah Berikutnya' }));
    detail.appendChild(el('p', {
      className: 'text-sm text-muted mb-0',
      text: 'Berdasarkan tes ini, latihan harianmu sudah disusun otomatis. Buka peta kerajaan untuk memulai.'
    }));
  }
}

function factPills(factIds, variant) {
  const wrap = el('div', { className: 'fact-list' });
  for (const id of factIds.slice(0, 16)) {
    const fact = state.engine.factMap.get(id);
    if (!fact) continue;
    const symbol = { addition: '+', subtraction: '−', multiplication: '×', division: '÷' }[fact.operation] || '?';
    wrap.appendChild(el('span', {
      className: `fact-pill fact-pill--${variant}`,
      text: `${fact.operandA} ${symbol} ${fact.operandB} = ${fact.answer}`
    }));
  }
  return wrap;
}

function repeatSession() {
  soundManager.click();
  if (!state.lastSessionOptions) { renderMap(); showScreen('screen-map'); return; }
  startSession(state.lastSessionOptions);
}

function openReview() {
  soundManager.click();
  const r = state.lastResult;
  if (!r) return;

  const content = el('div', { className: 'stack' });
  const weak = (r.weakFactIds || []).slice(0, 8);

  if (weak.length === 0) {
    content.appendChild(el('p', { text: 'Tidak ada soal yang salah pada sesi ini. Luar biasa!' }));
  } else {
    for (const id of weak) {
      const fact = state.engine.factMap.get(id);
      if (!fact) continue;
      const q = {
        operation: fact.operation,
        operandA: fact.operandA,
        operandB: fact.operandB,
        displayA: fact.operandA,
        displayB: fact.operandB,
        expectedAnswer: fact.answer
      };
      const hint = getHint(q, 3);
      const box = el('div', { className: 'card' }, [
        el('strong', { text: `${fact.operandA} ${{ addition: '+', subtraction: '−', multiplication: '×', division: '÷' }[fact.operation]} ${fact.operandB} = ${fact.answer}` }),
        el('div', { className: 'text-sm text-muted', text: hint.title })
      ]);
      for (const line of hint.lines) {
        box.appendChild(el('p', { className: 'hint-box__line text-sm', text: line }));
      }
      content.appendChild(box);
    }
  }

  showModal({
    title: '📖 Pembahasan',
    content,
    buttons: [{ id: 'ok', text: 'Tutup', variant: 'primary' }]
  });
}

/* ============ LEADERBOARD ============ */

async function openLeaderboard() {
  soundManager.click();
  const classId = state.engine.profile.activeClassId;

  showLoading('Memuat papan peringkat…');
  try {
    const enabled = await isLeaderboardEnabled(classId);
    if (!enabled) {
      hideLoading();
      await showModal({
        title: 'Papan peringkat dimatikan',
        lines: ['Gurumu menonaktifkan papan peringkat untuk kelas ini.'],
        buttons: [{ id: 'ok', text: 'Mengerti', variant: 'primary' }]
      });
      return;
    }

    const roster = await fetchClassRoster(classId);
    const me = roster.find((s) => s.uid === state.uid);
    state.leaderboardHidden = Boolean(me && me.hideFromLeaderboard);
    state.leaderboardRoster = roster;

    hideLoading();
    $('#lb-class-name').textContent = state.className || 'Kelasmu';
    renderLeaderboardTabs();
    renderLeaderboard();
    updatePrivacyButton();
    showScreen('screen-leaderboard');

  } catch (e) {
    hideLoading();
    devError('Leaderboard gagal:', e);
    toast.error('Papan peringkat belum dapat dimuat. Coba lagi nanti.');
  }
}

function renderLeaderboardTabs() {
  const tabs = $('#lb-tabs');
  clearNode(tabs);

  for (const cat of LEADERBOARD_CATEGORIES) {
    const btn = el('button', {
      className: 'class-tab',
      text: `${cat.emoji} ${cat.name.replace('Papan ', '')}`,
      attrs: {
        type: 'button',
        role: 'tab',
        'aria-selected': String(cat.id === state.leaderboardCategory)
      }
    });
    btn.addEventListener('click', () => {
      soundManager.click();
      state.leaderboardCategory = cat.id;
      renderLeaderboardTabs();
      renderLeaderboard();
    });
    tabs.appendChild(btn);
  }
}

function renderLeaderboard() {
  const board = buildLeaderboard(
    state.leaderboardRoster || [],
    state.leaderboardCategory,
    state.uid
  );

  $('#lb-description').textContent = board.category.description;

  const list = $('#lb-list');
  clearNode(list);

  if (board.entries.length === 0) {
    list.appendChild(el('div', { className: 'empty-state' }, [
      el('span', { className: 'empty-state__icon', text: '🏅', attrs: { 'aria-hidden': 'true' } }),
      el('p', { className: 'mb-0', text: 'Belum ada yang masuk papan ini. Jadilah yang pertama!' })
    ]));
  }

  for (const entry of board.entries) {
    const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
    const char = CHARACTERS.find((c) => c.id === entry.characterId) || CHARACTERS[0];

    const row = el('div', {
      className: 'row row--between',
      style: entry.isMe
        ? { background: 'var(--color-panel-light)', borderRadius: '8px', padding: '8px' }
        : { padding: '8px' }
    }, [
      el('div', { className: 'row', style: { gap: '10px' } }, [
        el('span', { text: medal, style: { minWidth: '32px', fontWeight: '700' } }),
        el('span', { text: char.emoji, attrs: { 'aria-hidden': 'true' }, style: { fontSize: '22px' } }),
        el('div', {}, [
          el('div', { text: entry.displayName + (entry.isMe ? ' (kamu)' : ''), className: entry.isMe ? 'text-bold' : '' }),
          el('div', { className: 'text-xs text-muted', text: `Level ${entry.level}` })
        ])
      ]),
      el('strong', { text: entry.valueText })
    ]);

    list.appendChild(row);
  }

  // Posisi siswa sendiri bila di luar 10 besar.
  const meBox = $('#lb-me-box');
  clearNode(meBox);

  if (board.me && board.me.rank > board.entries.length) {
    meBox.hidden = false;
    meBox.appendChild(el('div', { className: 'row row--between' }, [
      el('div', {}, [
        el('strong', { text: `Peringkatmu: ${board.me.rank} dari ${board.totalRanked}` }),
        el('p', { className: 'text-sm text-muted mb-0', text: encouragementFor(board.me, board.totalRanked) })
      ]),
      el('strong', { text: board.me.valueText })
    ]));
  } else if (board.me) {
    meBox.hidden = false;
    meBox.appendChild(el('p', {
      className: 'text-sm text-muted mb-0',
      text: encouragementFor(board.me, board.totalRanked)
    }));
  } else {
    meBox.hidden = true;
  }
}

function updatePrivacyButton() {
  const btn = $('#btn-lb-privacy');
  btn.textContent = state.leaderboardHidden ? '🙈 Tersembunyi' : '👁️ Terlihat';
  btn.setAttribute('aria-pressed', String(!state.leaderboardHidden));
}

async function toggleLeaderboardPrivacy() {
  soundManager.click();
  const next = !state.leaderboardHidden;
  try {
    await setLeaderboardVisibility(state.engine.profile.activeClassId, state.uid, next);
    state.leaderboardHidden = next;
    state.engine.profile.hideFromLeaderboard = next;

    const me = (state.leaderboardRoster || []).find((s) => s.uid === state.uid);
    if (me) me.hideFromLeaderboard = next;

    updatePrivacyButton();
    renderLeaderboard();
    toast.success(next ? 'Namamu disembunyikan dari teman sekelas.' : 'Namamu kembali terlihat.');
  } catch (e) {
    devError('Gagal mengubah privasi leaderboard:', e);
    toast.error('Pengaturan belum tersimpan. Coba lagi.');
  }
}

/* ============ MULAI ============ */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}