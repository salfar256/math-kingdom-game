/**
 * Seluruh nilai ambang batas, bobot, dan parameter permainan.
 * Semua di satu tempat supaya mudah diubah tanpa menyentuh logika.
 */

export const OPERATIONS = {
  ADDITION: 'addition',
  SUBTRACTION: 'subtraction',
  MULTIPLICATION: 'multiplication',
  DIVISION: 'division'
};

export const OPERATION_LIST = [
  OPERATIONS.ADDITION,
  OPERATIONS.SUBTRACTION,
  OPERATIONS.MULTIPLICATION,
  OPERATIONS.DIVISION
];

export const OPERATION_SYMBOL = {
  [OPERATIONS.ADDITION]: '+',
  [OPERATIONS.SUBTRACTION]: '−',
  [OPERATIONS.MULTIPLICATION]: '×',
  [OPERATIONS.DIVISION]: '÷'
};

export const OPERATION_LABEL = {
  [OPERATIONS.ADDITION]: 'Penjumlahan',
  [OPERATIONS.SUBTRACTION]: 'Pengurangan',
  [OPERATIONS.MULTIPLICATION]: 'Perkalian',
  [OPERATIONS.DIVISION]: 'Pembagian'
};

export const KINGDOMS = [
  {
    id: OPERATIONS.ADDITION,
    name: 'Kerajaan Penjumlahan',
    shortName: 'Penjumlahan',
    symbol: '+',
    emoji: '➕',
    background: 'addition-kingdom',
    icon: 'addition',
    order: 1
  },
  {
    id: OPERATIONS.SUBTRACTION,
    name: 'Kerajaan Pengurangan',
    shortName: 'Pengurangan',
    symbol: '−',
    emoji: '➖',
    background: 'subtraction-kingdom',
    icon: 'subtraction',
    order: 2
  },
  {
    id: OPERATIONS.MULTIPLICATION,
    name: 'Kerajaan Perkalian',
    shortName: 'Perkalian',
    symbol: '×',
    emoji: '✖️',
    background: 'multiplication-kingdom',
    icon: 'multiplication',
    order: 3
  },
  {
    id: OPERATIONS.DIVISION,
    name: 'Kerajaan Pembagian',
    shortName: 'Pembagian',
    symbol: '÷',
    emoji: '➗',
    background: 'division-kingdom',
    icon: 'division',
    order: 4
  }
];

export const MIXED_TOWER = {
  id: 'mixed',
  name: 'Menara Operasi Campuran',
  shortName: 'Menara Campuran',
  emoji: '🗼',
  background: 'mixed-tower',
  icon: 'star',
  order: 5
};

export const MASTERY_STATUS = {
  UNSEEN: 'unseen',
  LEARNING: 'learning',
  DEVELOPING: 'developing',
  MASTERED: 'mastered',
  AUTOMATIC: 'automatic',
  NEEDS_REVIEW: 'needs_review'
};

export const MASTERY_LABEL = {
  unseen: 'Belum dipelajari',
  learning: 'Sedang belajar',
  developing: 'Berkembang',
  mastered: 'Dikuasai',
  automatic: 'Otomatis',
  needs_review: 'Perlu diulang'
};

/** Ambang batas penguasaan. Semua dapat diubah. */
export const MASTERY_CONFIG = {
  // -> mastered
  masteredMinCorrect: 3,
  masteredMinAccuracy: 0.80,
  masteredMinSessions: 2,
  masteredMaxAvgMs: 8000,

  // -> automatic
  automaticMinCorrect: 5,
  automaticMinDays: 3,
  automaticMinAccuracy: 0.90,
  automaticMaxAvgMs: 3000,

  // -> developing
  developingMinCorrect: 2,
  developingMinAccuracy: 0.60,

  // turun status
  demoteConsecutiveWrong: 2,
  demoteSlowFactor: 2.2,        // avg baru > 2.2x avg lama => melambat

  // bantuan
  helpCorrectWeight: 0.4        // jawaban benar dengan bantuan dihitung 0.4
};

/** Interval pengulangan berjeda (dalam milidetik). */
export const SPACED_INTERVALS_MS = {
  wrong: 0,                       // ulangi dalam sesi ini
  correctedInSession: 0,          // ulangi di akhir sesi
  learning: 1 * 24 * 60 * 60 * 1000,
  developing: 1 * 24 * 60 * 60 * 1000,
  mastered: 3 * 24 * 60 * 60 * 1000,
  automatic: 7 * 24 * 60 * 60 * 1000,
  needs_review: 1 * 24 * 60 * 60 * 1000
};

/** Antrean koreksi dalam sesi: soal salah muncul lagi setelah N soal. */
export const CORRECTION_QUEUE = {
  minGap: 3,
  maxGap: 5,
  endOfSessionRetest: true
};

/** Komposisi soal per sesi. */
export const SESSION_MIX = {
  weak: 0.60,
  review: 0.25,
  mastered: 0.15
};

/** Bobot penghitungan prioritas fakta. */
export const PRIORITY_WEIGHTS = {
  error: 40,
  slowness: 20,
  staleness: 20,
  retention: 15,
  teacherAssignment: 30,
  unseen: 25,
  recentlyShownPenalty: -60
};

export const SCORE_CONFIG = {
  correct: 10,
  noHelpBonus: 2,
  fastBonus: 3,
  fastThresholdMs: 3000,
  correctionBonus: 5,
  comboStep: 1,
  comboMax: 10,
  sessionAccuracyBonus: 20,
  sessionAccuracyThreshold: 0.90,
  dailyCompleteBonus: 25
};

export const XP_CONFIG = {
  perCorrect: 5,
  perCorrection: 3,
  perNewMastered: 20,
  perNewAutomatic: 30,
  sessionComplete: 15,
  levelBase: 100,       // XP untuk naik ke level 2
  levelGrowth: 1.25     // pengali tiap level
};

export const BATTLE_CONFIG = {
  playerMaxHp: 100,
  enemyBaseHp: 60,
  bossBaseHp: 160,
  playerDamageOnWrong: 8,
  healOnCorrection: 5,
  baseDamage: 12,
  fastDamageBonus: 8,
  fastDamageThresholdMs: 3000,
  comboDamageBonus: 2,
  recoveryQuestionCount: 5
};

export const MODES = {
  PRACTICE: 'practice',
  BATTLE: 'battle',
  SPEED: 'speed',
  BOSS: 'boss',
  FACT_FAMILY: 'fact_family',
  FIX_ANSWER: 'fix_answer',
  MIXED: 'mixed',
  PLACEMENT: 'placement'
};

export const MODE_LABEL = {
  practice: 'Latihan',
  battle: 'Pertarungan',
  speed: 'Kecepatan',
  boss: 'Boss',
  fact_family: 'Keluarga Fakta',
  fix_answer: 'Perbaiki Jawaban',
  mixed: 'Operasi Campuran',
  placement: 'Tes Awal'
};

export const SESSION_CONFIG = {
  practiceQuestions: 20,
  battleQuestions: 20,
  bossQuestions: 25,
  mixedQuestions: 20,
  placementQuestions: 40,
  speedDurationsMs: [30000, 45000, 60000, 90000],
  defaultSpeedMs: 30000,
  autoAdvanceCorrectMs: 700,
  autoAdvanceWrongMs: 2600,
  maxAnswerLength: 3
};

/** Syarat menang boss. */
export const BOSS_CONFIG = {
  minAccuracy: 0.85,
  maxWrong: 6,
  unlockMasteryPercent: 0.5   // kerajaan harus 50% dikuasai
};

/** Ambang status kerajaan pada peta. */
export const KINGDOM_PROGRESS = {
  learningAt: 0.05,
  masteredAt: 0.60,
  expertAt: 0.90
};

export const CHARACTERS = [
  { id: 'adventurer', name: 'Petualang', emoji: '🧑‍🌾', asset: 'adventurer', desc: 'Seimbang dan tangguh.' },
  { id: 'knight',     name: 'Ksatria',   emoji: '🛡️',   asset: 'knight',     desc: 'HP lebih besar.' },
  { id: 'mage',       name: 'Penyihir',  emoji: '🧙',    asset: 'mage',       desc: 'Serangan kuat.' },
  { id: 'archer',     name: 'Pemanah',   emoji: '🏹',    asset: 'archer',     desc: 'Cepat dan akurat.' },
  { id: 'healer',     name: 'Tabib',     emoji: '💚',    asset: 'healer',     desc: 'Pemulihan lebih baik.' },
  { id: 'leader',     name: 'Pemimpin',  emoji: '👑',    asset: 'leader',     desc: 'Bonus combo.' }
];

export const CHARACTER_BONUS = {
  adventurer: { hp: 0,  damage: 0, heal: 0, combo: 0 },
  knight:     { hp: 30, damage: 0, heal: 0, combo: 0 },
  mage:       { hp: -10, damage: 5, heal: 0, combo: 0 },
  archer:     { hp: 0,  damage: 3, heal: 0, combo: 1 },
  healer:     { hp: 10, damage: -2, heal: 5, combo: 0 },
  leader:     { hp: 0,  damage: 0, heal: 0, combo: 2 }
};

export const ENEMIES = [
  { id: 'slime',        name: 'Slime',        emoji: '🟢', asset: 'slime' },
  { id: 'goblin',       name: 'Goblin',       emoji: '👺', asset: 'goblin' },
  { id: 'skeleton',     name: 'Kerangka',     emoji: '💀', asset: 'skeleton' },
  { id: 'orc',          name: 'Orc',          emoji: '👹', asset: 'orc' },
  { id: 'dark-mage',    name: 'Penyihir Hitam', emoji: '🧟', asset: 'dark-mage' },
  { id: 'shadow-ninja', name: 'Ninja Bayangan', emoji: '🥷', asset: 'shadow-ninja' }
];

export const BOSSES = [
  { id: 'boss-6', name: 'Raja Enam',   emoji: '👑', asset: 'boss-6', focus: 6 },
  { id: 'boss-7', name: 'Raja Tujuh',  emoji: '👑', asset: 'boss-7', focus: 7 },
  { id: 'boss-8', name: 'Raja Delapan',emoji: '👑', asset: 'boss-8', focus: 8 },
  { id: 'boss-9', name: 'Raja Sembilan',emoji: '👑', asset: 'boss-9', focus: 9 },
  { id: 'mixed-boss', name: 'Penguasa Menara', emoji: '🗿', asset: 'mixed-boss', focus: null }
];

export const BADGES = [
  { id: 'first_session',  name: 'Langkah Pertama',   emoji: '🌱', desc: 'Menyelesaikan sesi pertama.' },
  { id: 'streak_3',       name: 'Api Kecil',         emoji: '🔥', desc: 'Latihan 3 hari berturut-turut.' },
  { id: 'streak_7',       name: 'Api Besar',         emoji: '🔥', desc: 'Latihan 7 hari berturut-turut.' },
  { id: 'streak_30',      name: 'Api Abadi',         emoji: '🏆', desc: 'Latihan 30 hari berturut-turut.' },
  { id: 'accuracy_90',    name: 'Mata Tajam',        emoji: '🎯', desc: 'Akurasi sesi 90% atau lebih.' },
  { id: 'perfect_session',name: 'Sempurna',          emoji: '⭐', desc: 'Satu sesi tanpa kesalahan.' },
  { id: 'facts_25',       name: 'Pengumpul Fakta',   emoji: '📗', desc: 'Menguasai 25 fakta.' },
  { id: 'facts_100',      name: 'Ahli Fakta',        emoji: '📘', desc: 'Menguasai 100 fakta.' },
  { id: 'facts_250',      name: 'Master Fakta',      emoji: '📙', desc: 'Menguasai 250 fakta.' },
  { id: 'boss_6',         name: 'Penakluk Enam',     emoji: '⚔️', desc: 'Mengalahkan Raja Enam.' },
  { id: 'boss_7',         name: 'Penakluk Tujuh',    emoji: '⚔️', desc: 'Mengalahkan Raja Tujuh.' },
  { id: 'boss_8',         name: 'Penakluk Delapan',  emoji: '⚔️', desc: 'Mengalahkan Raja Delapan.' },
  { id: 'boss_9',         name: 'Penakluk Sembilan', emoji: '⚔️', desc: 'Mengalahkan Raja Sembilan.' },
  { id: 'speed_demon',    name: 'Secepat Kilat',     emoji: '⚡', desc: '20 benar dalam mode kecepatan.' },
  { id: 'graduate',       name: 'Lulusan Kerajaan',  emoji: '🎓', desc: 'Menyelesaikan tes akhir.' }
];

export const MOTIVATION_MESSAGES = {
  excellent: [
    'Luar biasa! Kamu makin cepat dan tepat.',
    'Hebat! Banyak fakta baru yang kamu kuasai hari ini.',
    'Kerja bagus! Terus pertahankan ritme ini.'
  ],
  good: [
    'Bagus! Sedikit lagi menuju penguasaan penuh.',
    'Kamu berkembang. Latihan besok akan lebih mudah.',
    'Terus maju! Fakta yang sulit mulai kamu kuasai.'
  ],
  needsWork: [
    'Tidak apa-apa. Setiap kesalahan adalah latihan.',
    'Fokus pada beberapa fakta dulu, nanti pasti bisa.',
    'Pelan-pelan saja. Yang penting kamu terus berlatih.'
  ]
};

/** Rencana 30 hari. */
export const THIRTY_DAY_PLAN = [
  { day: 1,  title: 'Tes Awal', focus: 'placement', ops: OPERATION_LIST, note: 'Mengukur kemampuan awal.' },
  { day: 2,  title: 'Penjumlahan Dasar', focus: 'addition', ops: [OPERATIONS.ADDITION], targets: [1,2,3] },
  { day: 3,  title: 'Pasangan Sepuluh', focus: 'addition', ops: [OPERATIONS.ADDITION], targets: [4,5,6] },
  { day: 4,  title: 'Penjumlahan Lanjut', focus: 'addition', ops: [OPERATIONS.ADDITION], targets: [7,8,9] },
  { day: 5,  title: 'Pengurangan Dasar', focus: 'subtraction', ops: [OPERATIONS.SUBTRACTION], targets: [1,2,3] },
  { day: 6,  title: 'Pengurangan Lanjut', focus: 'subtraction', ops: [OPERATIONS.SUBTRACTION], targets: [4,5,6,7] },
  { day: 7,  title: 'Keluarga Fakta + / −', focus: 'family', ops: [OPERATIONS.ADDITION, OPERATIONS.SUBTRACTION] },
  { day: 8,  title: 'Perkalian 1 dan 2', focus: 'multiplication', ops: [OPERATIONS.MULTIPLICATION], targets: [1,2] },
  { day: 9,  title: 'Perkalian 5', focus: 'multiplication', ops: [OPERATIONS.MULTIPLICATION], targets: [5] },
  { day: 10, title: 'Perkalian 9', focus: 'multiplication', ops: [OPERATIONS.MULTIPLICATION], targets: [9] },
  { day: 11, title: 'Pembagian oleh 1, 2, 5', focus: 'division', ops: [OPERATIONS.DIVISION], targets: [1,2,5] },
  { day: 12, title: 'Pembagian oleh 9', focus: 'division', ops: [OPERATIONS.DIVISION], targets: [9] },
  { day: 13, title: 'Keluarga Fakta × / ÷', focus: 'family', ops: [OPERATIONS.MULTIPLICATION, OPERATIONS.DIVISION] },
  { day: 14, title: 'Ulangan Minggu 2', focus: 'review', ops: OPERATION_LIST },
  { day: 15, title: 'Perkalian 3', focus: 'multiplication', ops: [OPERATIONS.MULTIPLICATION], targets: [3] },
  { day: 16, title: 'Perkalian 4', focus: 'multiplication', ops: [OPERATIONS.MULTIPLICATION], targets: [4] },
  { day: 17, title: 'Perkalian 6', focus: 'multiplication', ops: [OPERATIONS.MULTIPLICATION], targets: [6] },
  { day: 18, title: 'Perkalian 7', focus: 'multiplication', ops: [OPERATIONS.MULTIPLICATION], targets: [7] },
  { day: 19, title: 'Perkalian 8', focus: 'multiplication', ops: [OPERATIONS.MULTIPLICATION], targets: [8] },
  { day: 20, title: 'Pembagian Sulit', focus: 'division', ops: [OPERATIONS.DIVISION], targets: [6,7,8] },
  { day: 21, title: 'Ulangan Minggu 3', focus: 'review', ops: OPERATION_LIST },
  { day: 22, title: 'Operasi Campuran', focus: 'mixed', ops: OPERATION_LIST },
  { day: 23, title: 'Keluarga Fakta Campuran', focus: 'family', ops: OPERATION_LIST },
  { day: 24, title: 'Fakta Sulit', focus: 'hard', ops: OPERATION_LIST },
  { day: 25, title: 'Tes Kecepatan', focus: 'speed', ops: OPERATION_LIST },
  { day: 26, title: 'Pengulangan Adaptif', focus: 'review', ops: OPERATION_LIST },
  { day: 27, title: 'Boss Kerajaan', focus: 'boss', ops: OPERATION_LIST },
  { day: 28, title: 'Remedial Otomatis', focus: 'remedial', ops: OPERATION_LIST },
  { day: 29, title: 'Tantangan Seluruh Kerajaan', focus: 'mixed', ops: OPERATION_LIST },
  { day: 30, title: 'Tes Akhir', focus: 'final', ops: OPERATION_LIST }
];

export const STORAGE_KEYS = {
  volume: 'mk_volume',
  muted: 'mk_muted',
  reduceMotion: 'mk_reduce_motion',
  syncQueue: 'mk_sync_queue',
  lastStudent: 'mk_last_student'
};

export const UI_CONFIG = {
  toastDurationMs: 3200,
  defaultVolume: 0.6
};