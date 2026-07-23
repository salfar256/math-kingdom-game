/**
 * Papan peringkat kelas.
 *
 * Prinsip (mengikuti bagian 12 spesifikasi):
 * - Hanya dalam satu kelas, tidak pernah global.
 * - Empat kategori, sehingga siswa yang lambat tetap dapat unggul lewat usaha.
 * - Hanya 10 teratas yang ditampilkan; posisi siswa sendiri selalu terlihat.
 * - Siswa dapat menyembunyikan diri (hideFromLeaderboard).
 * - Tidak ada peringkat terbawah, tidak ada label negatif.
 * - Data diambil dari roster ringkas, bukan dari data pribadi siswa lain.
 */

import {
  collection, getDocs, doc, getDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { getDb, devError } from './firebase-app.js';

export const LEADERBOARD_CATEGORIES = [
  {
    id: 'effort',
    name: 'Papan Usaha',
    emoji: '🔥',
    description: 'Siapa yang paling rajin berlatih.',
    metricLabel: 'Hari aktif',
    sortKey: 'daysActive',
    tieKey: 'streak',
    format: (v) => `${v || 0} hari`
  },
  {
    id: 'accuracy',
    name: 'Papan Ketepatan',
    emoji: '🎯',
    description: 'Siapa yang paling teliti menjawab.',
    metricLabel: 'Akurasi',
    sortKey: 'accuracy',
    tieKey: 'totalQuestions',
    minQuestions: 30,
    format: (v) => `${Number(v || 0).toFixed(1).replace('.', ',')}%`
  },
  {
    id: 'mastery',
    name: 'Papan Fakta Dikuasai',
    emoji: '📗',
    description: 'Siapa yang paling banyak menguasai fakta.',
    metricLabel: 'Fakta',
    sortKey: 'factsMastered',
    tieKey: 'accuracy',
    format: (v) => `${v || 0} fakta`
  },
  {
    id: 'xp',
    name: 'Papan Petualang',
    emoji: '⭐',
    description: 'Total pengalaman yang terkumpul.',
    metricLabel: 'XP',
    sortKey: 'xp',
    tieKey: 'level',
    format: (v) => `${Number(v || 0).toLocaleString('id-ID')} XP`
  }
];

export function getCategory(id) {
  return LEADERBOARD_CATEGORIES.find((c) => c.id === id) || LEADERBOARD_CATEGORIES[0];
}

/**
 * Ambil roster kelas untuk leaderboard.
 * @returns {Promise<Array<object>>}
 */
export async function fetchClassRoster(classId) {
  if (!classId) return [];
  try {
    const snap = await getDocs(collection(getDb(), 'classes', classId, 'students'));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    devError('fetchClassRoster gagal:', e);
    throw e;
  }
}

/** Apakah leaderboard diaktifkan untuk kelas ini. */
export async function isLeaderboardEnabled(classId) {
  if (!classId) return false;
  try {
    const snap = await getDoc(doc(getDb(), 'classes', classId));
    if (!snap.exists()) return false;
    const settings = snap.data().settings || {};
    return settings.leaderboardEnabled !== false; // default aktif
  } catch {
    return false;
  }
}

/**
 * Bangun papan peringkat.
 *
 * @param {Array<object>} roster
 * @param {string} categoryId
 * @param {string} currentUid
 * @param {number} topN
 * @returns {{
 *   category: object,
 *   entries: Array<object>,
 *   me: object|null,
 *   totalRanked: number,
 *   excludedForMinimum: boolean
 * }}
 */
export function buildLeaderboard(roster, categoryId, currentUid, topN = 10) {
  const category = getCategory(categoryId);

  // Saring: hanya siswa aktif, dan yang tidak menyembunyikan diri.
  // Siswa itu sendiri selalu ikut dihitung agar tahu posisinya.
  let pool = roster.filter((s) => s.active !== false);

  if (category.minQuestions) {
    pool = pool.filter(
      (s) => (s.totalQuestions || 0) >= category.minQuestions || s.uid === currentUid
    );
  }

  const sorted = pool.slice().sort((a, b) => {
    const av = Number(a[category.sortKey] || 0);
    const bv = Number(b[category.sortKey] || 0);
    if (bv !== av) return bv - av;
    const at = Number(a[category.tieKey] || 0);
    const bt = Number(b[category.tieKey] || 0);
    if (bt !== at) return bt - at;
    return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'id');
  });

  // Peringkat dengan penanganan nilai seri (peringkat sama).
  let lastValue = null;
  let lastRank = 0;
  const ranked = sorted.map((s, i) => {
    const value = Number(s[category.sortKey] || 0);
    const rank = value === lastValue ? lastRank : i + 1;
    lastValue = value;
    lastRank = rank;
    return {
      uid: s.uid,
      rank,
      displayName: s.displayName || 'Petualang',
      characterId: s.characterId || 'adventurer',
      value,
      valueText: category.format(value),
      level: s.level || 1,
      isMe: s.uid === currentUid,
      hidden: Boolean(s.hideFromLeaderboard)
    };
  });

  const me = ranked.find((r) => r.isMe) || null;

  // Hanya 10 teratas ditampilkan; yang menyembunyikan diri disamarkan.
  const entries = ranked.slice(0, topN).map((r) => ({
    ...r,
    displayName: r.hidden && !r.isMe ? 'Petualang Misterius' : r.displayName
  }));

  const excludedForMinimum = Boolean(
    category.minQuestions && me &&
    (roster.find((s) => s.uid === currentUid) || {}).totalQuestions < category.minQuestions
  );

  return {
    category,
    entries,
    me,
    totalRanked: ranked.length,
    excludedForMinimum
  };
}

/** Ubah preferensi anonim siswa pada papan peringkat. */
export async function setLeaderboardVisibility(classId, uid, hidden) {
  if (!classId || !uid) return;
  await updateDoc(doc(getDb(), 'classes', classId, 'students', uid), {
    hideFromLeaderboard: Boolean(hidden)
  });
}

/** Pesan penyemangat berdasarkan posisi, tidak pernah merendahkan. */
export function encouragementFor(me, totalRanked) {
  if (!me) return 'Selesaikan satu sesi latihan untuk masuk papan peringkat.';
  if (me.rank === 1) return 'Kamu di puncak papan ini. Pertahankan!';
  if (me.rank <= 3) return 'Tiga besar! Sedikit lagi menuju puncak.';
  if (me.rank <= 10) return 'Kamu masuk sepuluh besar. Kerja bagus!';
  const ahead = me.rank - 10;
  return `Kamu di peringkat ${me.rank} dari ${totalRanked}. Tinggal ${ahead} langkah menuju sepuluh besar.`;
}