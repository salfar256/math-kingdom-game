/**
 * Dashboard guru: daftar kelas, progres siswa, detail, pengaturan, ekspor CSV.
 * Semua data diambil dari roster ringkas agar hemat biaya Firestore.
 */

import {
  getTeacherClasses, createClass, getClassStudents, updateClassName,
  updateClassSettings, deleteClass, getStudentDetail, removeStudentFromClass
} from '../firebase/class-service.js';
import { resetStudentProgress } from '../firebase/firestore-service.js';
import { summarizeMastery, summarizeProgressByOperation, factAccuracy } from '../game/mastery-engine.js';
import {
  OPERATION_LIST, OPERATION_LABEL, SESSION_CONFIG, MASTERY_LABEL
} from '../config/game-config.js';
import { exportClassReport } from '../utils/csv-export.js';
import { showModal, confirmDialog, confirmWithTyping, promptDialog } from '../ui/modal.js';
import { showLoading, hideLoading } from '../ui/loading.js';
import { toast } from '../ui/toast.js';
import { validateClassName, firebaseErrorMessage } from '../utils/validators.js';
import { el, $, clearNode, show, percent, debounce } from '../utils/helpers.js';
import { relativeDayId, isToday, toDate, formatDateId } from '../utils/date-utils.js';
import { devError } from '../firebase/firebase-app.js';

const dash = {
  teacher: null,
  classes: [],
  activeClassId: null,
  students: [],
  filters: { search: '', operation: 'all', sortBy: 'displayName' }
};

/** Dipanggil oleh teacher-login-page setelah role terverifikasi. */
export async function initDashboard(teacher) {
  dash.teacher = teacher;

  bindEvents();
  await loadClasses();
}

function bindEvents() {
  $('#btn-new-class').addEventListener('click', handleCreateClass);
  $('#btn-first-class').addEventListener('click', handleCreateClass);
  $('#btn-copy-code').addEventListener('click', handleCopyCode);
  $('#btn-rename-class').addEventListener('click', handleRenameClass);
  $('#btn-delete-class').addEventListener('click', handleDeleteClass);
  $('#btn-class-settings').addEventListener('click', handleClassSettings);
  $('#btn-export').addEventListener('click', handleExport);

  $('#search-student').addEventListener('input', debounce((e) => {
    dash.filters.search = e.target.value.trim().toLowerCase();
    renderStudents();
  }, 200));

  $('#filter-operation').addEventListener('change', (e) => {
    dash.filters.operation = e.target.value;
    renderStudents();
  });

  $('#sort-by').addEventListener('change', (e) => {
    dash.filters.sortBy = e.target.value;
    renderStudents();
  });
}

/* ============ KELAS ============ */

async function loadClasses() {
  showLoading('Memuat kelas…');
  try {
    dash.classes = await getTeacherClasses(dash.teacher.uid);
    renderClassTabs();

    if (dash.classes.length === 0) {
      show($('#no-class'), true);
      show($('#class-content'), false);
    } else {
      show($('#no-class'), false);
      await selectClass(dash.activeClassId || dash.classes[0].id);
    }
  } catch (e) {
    devError('Gagal memuat kelas:', e);
    toast.error(firebaseErrorMessage(e));
  } finally {
    hideLoading();
  }
}

function renderClassTabs() {
  const tabs = $('#class-tabs');
  clearNode(tabs);

  for (const c of dash.classes) {
    const btn = el('button', {
      className: 'class-tab',
      text: c.name,
      attrs: {
        type: 'button', role: 'tab',
        'aria-selected': String(c.id === dash.activeClassId)
      }
    });
    btn.addEventListener('click', () => selectClass(c.id));
    tabs.appendChild(btn);
  }
}

async function selectClass(classId) {
  dash.activeClassId = classId;
  renderClassTabs();

  const klass = dash.classes.find((c) => c.id === classId);
  if (!klass) return;

  show($('#class-content'), true);
  $('#class-code').textContent = klass.classCode || '------';

  showLoading('Memuat data siswa…');
  try {
    dash.students = await getClassStudents(classId);
    renderClassStats();
    renderStudents();
    renderInactive();
  } catch (e) {
    devError('Gagal memuat siswa:', e);
    toast.error(firebaseErrorMessage(e));
  } finally {
    hideLoading();
  }
}

async function handleCreateClass() {
  const name = await promptDialog('Kelas Baru', 'Nama kelas', 'Kelas 7A');
  if (name === null) return;

  const check = validateClassName(name);
  if (!check.valid) { toast.error(check.error); return; }

  showLoading('Membuat kelas…');
  try {
    const created = await createClass(dash.teacher.uid, check.value);
    toast.success(`Kelas dibuat. Kode: ${created.classCode}`);
    dash.activeClassId = created.id;
    await loadClasses();
  } catch (e) {
    devError('Gagal membuat kelas:', e);
    toast.error(firebaseErrorMessage(e));
  } finally {
    hideLoading();
  }
}

async function handleRenameClass() {
  const klass = currentClass();
  if (!klass) return;

  const name = await promptDialog('Ubah Nama Kelas', 'Nama kelas', klass.name);
  if (name === null) return;

  const check = validateClassName(name);
  if (!check.valid) { toast.error(check.error); return; }

  try {
    await updateClassName(klass.id, check.value);
    klass.name = check.value;
    renderClassTabs();
    toast.success('Nama kelas diperbarui.');
  } catch (e) {
    toast.error(firebaseErrorMessage(e));
  }
}

async function handleDeleteClass() {
  const klass = currentClass();
  if (!klass) return;

  const first = await confirmDialog(
    'Hapus kelas?',
    [
      `Kelas "${klass.name}" akan dihapus beserta daftar siswanya.`,
      'Progres masing-masing siswa tidak ikut terhapus, tetapi mereka tidak lagi terhubung ke kelas ini.'
    ],
    { confirmText: 'Lanjut', danger: true }
  );
  if (!first) return;

  const confirmed = await confirmWithTyping(
    'Konfirmasi Terakhir',
    ['Tindakan ini tidak dapat dibatalkan.'],
    'HAPUS'
  );
  if (!confirmed) { toast.info('Penghapusan dibatalkan.'); return; }

  showLoading('Menghapus kelas…');
  try {
    await deleteClass(klass.id, klass.classCode);
    dash.activeClassId = null;
    toast.success('Kelas dihapus.');
    await loadClasses();
  } catch (e) {
    toast.error(firebaseErrorMessage(e));
  } finally {
    hideLoading();
  }
}

async function handleCopyCode() {
  const klass = currentClass();
  if (!klass) return;
  try {
    await navigator.clipboard.writeText(klass.classCode);
    toast.success('Kode kelas disalin.');
  } catch {
    toast.info(`Kode kelas: ${klass.classCode}`);
  }
}

/* ============ PENGATURAN KELAS ============ */

async function handleClassSettings() {
  const klass = currentClass();
  if (!klass) return;

  const settings = klass.settings || {};
  const content = el('div', { className: 'stack' });

  // Operasi aktif.
  content.appendChild(el('h3', { text: 'Operasi yang diaktifkan' }));
  const opBoxes = {};
  for (const op of OPERATION_LIST) {
    const enabled = !Array.isArray(settings.enabledOperations) ||
      settings.enabledOperations.includes(op);
    const cb = el('input', {
      attrs: { type: 'checkbox', id: `op-${op}`, checked: enabled ? 'checked' : null }
    });
    cb.checked = enabled;
    opBoxes[op] = cb;
    content.appendChild(el('label', {
      className: 'row',
      attrs: { for: `op-${op}` },
      style: { gap: '8px', cursor: 'pointer' }
    }, [cb, el('span', { text: OPERATION_LABEL[op] })]));
  }

  // Durasi mode cepat.
  content.appendChild(el('h3', { text: 'Durasi mode kecepatan' }));
  const durationSelect = el('select', { className: 'select', attrs: { id: 'speed-duration' } });
  for (const ms of SESSION_CONFIG.speedDurationsMs) {
    const opt = el('option', { text: `${ms / 1000} detik`, attrs: { value: String(ms) } });
    if (Number(settings.speedDurationMs || SESSION_CONFIG.defaultSpeedMs) === ms) opt.selected = true;
    durationSelect.appendChild(opt);
  }
  content.appendChild(durationSelect);

  // Target harian.
  content.appendChild(el('h3', { text: 'Target soal per hari' }));
  const targetInput = el('input', {
    className: 'input',
    attrs: { type: 'number', min: '10', max: '200', step: '5' }
  });
  targetInput.value = String(settings.dailyTargetQuestions || 40);
  content.appendChild(targetInput);

  // Leaderboard.
  content.appendChild(el('h3', { text: 'Papan peringkat kelas' }));
  const lbCheckbox = el('input', { attrs: { type: 'checkbox', id: 'lb-enabled' } });
  lbCheckbox.checked = settings.leaderboardEnabled !== false;
  content.appendChild(el('label', {
    className: 'row',
    attrs: { for: 'lb-enabled' },
    style: { gap: '8px', cursor: 'pointer' }
  }, [lbCheckbox, el('span', { text: 'Aktifkan papan peringkat untuk siswa' })]));
  content.appendChild(el('p', {
    className: 'text-xs text-muted mb-0',
    text: 'Papan peringkat hanya menampilkan sepuluh teratas dalam kelas ini, ' +
          'dengan empat kategori (usaha, ketepatan, fakta dikuasai, XP). ' +
          'Siswa dapat menyembunyikan namanya sendiri.'
  }));

  const choice = await showModal({
    title: `Pengaturan ${klass.name}`,
    content,
    buttons: [
      { id: 'cancel', text: 'Batal', variant: 'secondary' },
      { id: 'save', text: 'Simpan', variant: 'primary' }
    ]
  });

  if (choice !== 'save') return;

  const enabledOperations = OPERATION_LIST.filter((op) => opBoxes[op].checked);
  if (enabledOperations.length === 0) {
    toast.error('Minimal satu operasi harus diaktifkan.');
    return;
  }

  const newSettings = {
    ...settings,
    enabledOperations,
    speedDurationMs: Number(durationSelect.value),
    dailyTargetQuestions: Math.max(10, Math.min(200, Number(targetInput.value) || 40)),
    leaderboardEnabled: lbCheckbox.checked
  };

  try {
    await updateClassSettings(klass.id, newSettings);
    klass.settings = newSettings;
    toast.success('Pengaturan disimpan.');
  } catch (e) {
    toast.error(firebaseErrorMessage(e));
  }
}

/* ============ STATISTIK KELAS ============ */

function renderClassStats() {
  const grid = $('#class-stats');
  clearNode(grid);

  const students = dash.students;
  const total = students.length;
  const activeToday = students.filter((s) => isToday(s.lastPracticeAt)).length;

  const withData = students.filter((s) => (s.totalQuestions || 0) > 0);
  const avgAccuracy = withData.length > 0
    ? Math.round(withData.reduce((sum, s) => sum + (s.accuracy || 0), 0) / withData.length)
    : 0;
  const avgMastered = total > 0
    ? Math.round(students.reduce((sum, s) => sum + (s.factsMastered || 0), 0) / total)
    : 0;

  const stats = [
    { label: 'Jumlah siswa', value: total },
    { label: 'Aktif hari ini', value: activeToday },
    { label: 'Rata-rata akurasi', value: `${avgAccuracy}%` },
    { label: 'Rata-rata fakta', value: avgMastered }
  ];

  for (const s of stats) {
    grid.appendChild(el('div', { className: 'stat' }, [
      el('span', { className: 'stat__value', text: String(s.value) }),
      el('span', { className: 'stat__label', text: s.label })
    ]));
  }
}

/* ============ TABEL SISWA ============ */

function filteredStudents() {
  const { search, sortBy } = dash.filters;

  let list = dash.students.slice();

  if (search) {
    list = list.filter((s) =>
      String(s.displayName || '').toLowerCase().includes(search)
    );
  }

  list.sort((a, b) => {
    if (sortBy === 'displayName') {
      return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'id');
    }
    if (sortBy === 'lastPracticeAt') {
      const at = toDate(a.lastPracticeAt);
      const bt = toDate(b.lastPracticeAt);
      return (bt ? bt.getTime() : 0) - (at ? at.getTime() : 0);
    }
    return Number(b[sortBy] || 0) - Number(a[sortBy] || 0);
  });

  return list;
}

function renderStudents() {
  const tbody = $('#students-tbody');
  clearNode(tbody);

  const list = filteredStudents();
  show($('#students-empty'), list.length === 0);

  for (const s of list) {
    const tr = el('tr');

    tr.appendChild(el('td', { text: s.displayName || 'Tanpa nama' }));
    tr.appendChild(el('td', { className: 'num', text: String(s.level || 1) }));
    tr.appendChild(el('td', { className: 'num', text: `${Math.round(s.accuracy || 0)}%` }));
    tr.appendChild(el('td', { className: 'num', text: String(s.factsMastered || 0) }));
    tr.appendChild(el('td', { className: 'num', text: String(s.daysActive || 0) }));
    tr.appendChild(el('td', { className: 'num', text: `${s.streak || 0}` }));
    tr.appendChild(el('td', { text: relativeDayId(s.lastPracticeAt) }));

    const actions = el('td');
    actions.appendChild(el('button', {
      className: 'btn btn--sm btn--ghost',
      text: 'Detail',
      attrs: { type: 'button' },
      on: { click: () => openStudentDetail(s) }
    }));
    tr.appendChild(actions);

    tbody.appendChild(tr);
  }
}

function renderInactive() {
  const list = $('#inactive-list');
  clearNode(list);

  const inactive = dash.students.filter((s) => !isToday(s.lastPracticeAt));

  if (inactive.length === 0) {
    list.appendChild(el('p', {
      className: 'text-sm text-muted mb-0',
      text: 'Semua siswa sudah berlatih hari ini. Bagus sekali!'
    }));
    return;
  }

  for (const s of inactive) {
    list.appendChild(el('span', {
      className: 'chip chip--muted',
      text: `${s.displayName} · ${relativeDayId(s.lastPracticeAt)}`
    }));
  }
}

/* ============ DETAIL SISWA ============ */

async function openStudentDetail(student) {
  showLoading('Memuat detail siswa…');

  let detail = null;
  try {
    detail = await getStudentDetail(student.uid);
  } catch (e) {
    devError('Gagal memuat detail siswa:', e);
  }
  hideLoading();

  if (!detail) {
    toast.error('Detail siswa belum dapat dimuat.');
    return;
  }

  const factMap = new Map(detail.facts.map((f) => [f.id, f]));
  const mastery = summarizeMastery(factMap);
  // Progres per operasi memakai skema TOTAL POOL TETAP -- identik dengan
  // yang dilihat siswa di layar peta/profilnya sendiri (mis. "12/90"),
  // bukan hanya menghitung fakta yang pernah dicoba sebagai penyebut.
  const opProgress = summarizeProgressByOperation(factMap, OPERATION_LIST);
  const content = el('div', { className: 'stack' });

  // Ringkasan.
  const grid = el('div', { className: 'stat-grid' });
  const summaryStats = [
    { label: 'Level', value: student.level || 1 },
    { label: 'Akurasi', value: `${Math.round(student.accuracy || 0)}%` },
    { label: 'Fakta dikuasai', value: mastery.totalMastered },
    { label: 'Hari aktif', value: student.daysActive || 0 }
  ];
  for (const s of summaryStats) {
    grid.appendChild(el('div', { className: 'stat' }, [
      el('span', { className: 'stat__value', text: String(s.value) }),
      el('span', { className: 'stat__label', text: s.label })
    ]));
  }
  content.appendChild(grid);

  // Progres per operasi.
  content.appendChild(el('h3', { text: 'Progres per Operasi' }));
  for (const op of OPERATION_LIST) {
    if (dash.filters.operation !== 'all' && dash.filters.operation !== op) continue;
    const b = opProgress[op] || { total: 0, points: 0, mastered: 0, factCount: 0, accuracy: 0, averageResponseMs: 0 };
    const pct = b.total > 0 ? Math.round((b.points / b.total) * 100) : 0;

    content.appendChild(el('div', { className: 'op-progress' }, [
      el('div', { className: 'op-progress__head' }, [
        el('span', { className: 'op-progress__name', text: OPERATION_LABEL[op] }),
        el('span', {
          className: 'text-muted',
          text: `${b.points}/${b.total} poin (${b.mastered}/${b.factCount} hitungan) · akurasi ${Math.round(b.accuracy * 100)}%`
        })
      ]),
      el('div', { className: 'progress' }, [
        el('div', { className: 'progress__fill', style: { width: `${pct}%` } })
      ])
    ]));
  }

  // Fakta paling sering salah.
  const worst = detail.facts
    .filter((f) => (f.wrongAttempts || 0) > 0)
    .sort((a, b) => (b.wrongAttempts || 0) - (a.wrongAttempts || 0))
    .slice(0, 12);

  if (worst.length > 0) {
    content.appendChild(el('h3', { text: 'Fakta Paling Sering Salah' }));
    const pills = el('div', { className: 'fact-list' });
    for (const f of worst) {
      const symbol = { addition: '+', subtraction: '−', multiplication: '×', division: '÷' }[f.operation] || '?';
      pills.appendChild(el('span', {
        className: 'fact-pill fact-pill--weak',
        text: `${f.operandA} ${symbol} ${f.operandB} (salah ${f.wrongAttempts}×)`
      }));
    }
    content.appendChild(pills);
  }

  // Tes awal vs sekarang.
  const placement = detail.profile.placementResult;
  if (placement) {
    content.appendChild(el('h3', { text: 'Tes Awal vs Sekarang' }));
    const totalQ = detail.profile.totalQuestions || 0;
    const totalC = detail.profile.totalCorrect || 0;
    const nowAcc = percent(totalC, totalQ, 1);
    const delta = Math.round((nowAcc - (placement.accuracy || 0)) * 10) / 10;

    content.appendChild(el('p', {
      className: 'text-sm mb-0',
      text: `Tes awal ${placement.accuracy || 0}% (${formatDateId(placement.takenAt)}) → sekarang ${nowAcc}% ` +
            `(${delta >= 0 ? '+' : ''}${delta} poin).`
    }));
  }

  const choice = await showModal({
    title: `${student.displayName}`,
    content,
    buttons: [
      { id: 'remove', text: 'Hapus Siswa', variant: 'danger' },
      { id: 'reset', text: 'Reset Progres', variant: 'ghost' },
      { id: 'close', text: 'Tutup', variant: 'primary' }
    ]
  });

  if (choice === 'reset') await handleResetStudent(student);
  if (choice === 'remove') await handleRemoveStudent(student);
}

async function handleRemoveStudent(student) {
  const confirmed = await confirmWithTyping(
    `Hapus ${student.displayName} dari kelas ini?`,
    [
      'Siswa akan dikeluarkan dari kelas dan hilang dari daftar serta papan peringkat.',
      'Akun dan progres belajarnya TIDAK dihapus; ia dapat bergabung kembali dengan kode kelas.',
    ],
    'HAPUS'
  );
  if (!confirmed) { toast.info('Penghapusan dibatalkan.'); return; }

  showLoading('Menghapus siswa dari kelas\u2026');
  try {
    await removeStudentFromClass(dash.activeClassId, student.uid);
    toast.success(`${student.displayName} dihapus dari kelas.`);
    await selectClass(dash.activeClassId);
  } catch (e) {
    devError('Hapus siswa gagal:', e);
    toast.error(firebaseErrorMessage(e));
  } finally {
    hideLoading();
  }
}

async function handleResetStudent(student) {
  const confirmed = await confirmWithTyping(
    `Reset progres ${student.displayName}?`,
    [
      'Seluruh riwayat fakta dan sesi siswa ini akan dihapus permanen.',
      'Tindakan ini tidak dapat dibatalkan.'
    ],
    'RESET'
  );
  if (!confirmed) { toast.info('Reset dibatalkan.'); return; }

  showLoading('Mereset progres…');
  try {
    await resetStudentProgress(student.uid);
    toast.success(`Progres ${student.displayName} telah direset.`);
    await selectClass(dash.activeClassId);
  } catch (e) {
    devError('Reset gagal:', e);
    toast.error(firebaseErrorMessage(e));
  } finally {
    hideLoading();
  }
}

/* ============ EKSPOR ============ */

function handleExport() {
  const klass = currentClass();
  if (!klass) return;

  const rows = filteredStudents().map((s) => ({
    displayName: s.displayName || '',
    level: s.level || 1,
    xp: s.xp || 0,
    streak: s.streak || 0,
    daysActive: s.daysActive || 0,
    totalQuestions: s.totalQuestions || 0,
    accuracyPercent: Math.round(s.accuracy || 0),
    factsMastered: s.factsMastered || 0,
    lastPracticeText: relativeDayId(s.lastPracticeAt)
  }));

  if (rows.length === 0) { toast.info('Tidak ada data untuk diekspor.'); return; }

  exportClassReport(klass.name, rows);
  toast.success('Laporan CSV diunduh.');
}

function currentClass() {
  return dash.classes.find((c) => c.id === dash.activeClassId) || null;
}