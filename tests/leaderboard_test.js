/** Pengujian papan peringkat. */

import { describe, it, expect } from './test-framework.js';
import {
  buildLeaderboard, getCategory, LEADERBOARD_CATEGORIES, encouragementFor
} from '../js/firebase/leaderboard-service.js';

function makeRoster() {
  return [
    { uid: 'u1', displayName: 'Andi',  daysActive: 20, accuracy: 92.5, factsMastered: 80, xp: 5000, level: 8, streak: 10, totalQuestions: 500, active: true },
    { uid: 'u2', displayName: 'Bella', daysActive: 25, accuracy: 88.0, factsMastered: 60, xp: 4200, level: 7, streak: 12, totalQuestions: 400, active: true },
    { uid: 'u3', displayName: 'Cita',  daysActive: 10, accuracy: 95.0, factsMastered: 40, xp: 2000, level: 5, streak: 3,  totalQuestions: 200, active: true },
    { uid: 'u4', displayName: 'Dodi',  daysActive: 5,  accuracy: 70.0, factsMastered: 15, xp: 800,  level: 3, streak: 1,  totalQuestions: 100, active: true },
    { uid: 'u5', displayName: 'Eka',   daysActive: 2,  accuracy: 60.0, factsMastered: 5,  xp: 200,  level: 2, streak: 1,  totalQuestions: 20,  active: true }
  ];
}

describe('Kategori papan peringkat', () => {
  it('menyediakan empat kategori', () => {
    expect(LEADERBOARD_CATEGORIES).toHaveLength(4);
  });

  it('memiliki kategori usaha, ketepatan, penguasaan, dan XP', () => {
    const ids = LEADERBOARD_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('effort');
    expect(ids).toContain('accuracy');
    expect(ids).toContain('mastery');
    expect(ids).toContain('xp');
  });

  it('mengembalikan kategori default untuk id yang tidak dikenal', () => {
    expect(getCategory('tidak-ada').id).toBe('effort');
  });
});

describe('buildLeaderboard', () => {
  it('mengurutkan papan usaha berdasarkan hari aktif', () => {
    const board = buildLeaderboard(makeRoster(), 'effort', 'u1');
    expect(board.entries[0].displayName).toBe('Bella');   // 25 hari
    expect(board.entries[1].displayName).toBe('Andi');    // 20 hari
  });

  it('mengurutkan papan XP berdasarkan XP', () => {
    const board = buildLeaderboard(makeRoster(), 'xp', 'u1');
    expect(board.entries[0].displayName).toBe('Andi');    // 5000 XP
  });

  it('mengurutkan papan penguasaan berdasarkan fakta dikuasai', () => {
    const board = buildLeaderboard(makeRoster(), 'mastery', 'u3');
    expect(board.entries[0].displayName).toBe('Andi');    // 80 fakta
  });

  it('memungkinkan siswa yang lambat unggul di papan usaha', () => {
    // Bella kalah di XP tetapi menang di usaha.
    const xpBoard = buildLeaderboard(makeRoster(), 'xp', 'u2');
    const effortBoard = buildLeaderboard(makeRoster(), 'effort', 'u2');

    const bellaXpRank = xpBoard.entries.find((e) => e.uid === 'u2').rank;
    const bellaEffortRank = effortBoard.entries.find((e) => e.uid === 'u2').rank;

    expect(bellaEffortRank).toBeLessThan(bellaXpRank);
  });

  it('menandai siswa yang sedang melihat papan', () => {
    const board = buildLeaderboard(makeRoster(), 'effort', 'u3');
    const cita = board.entries.find((e) => e.uid === 'u3');
    expect(cita.isMe).toBeTruthy();
    expect(board.me.uid).toBe('u3');
  });

  it('membatasi tampilan pada sepuluh teratas', () => {
    const banyak = [];
    for (let i = 0; i < 30; i++) {
      banyak.push({
        uid: `u${i}`, displayName: `Siswa ${i}`,
        daysActive: 30 - i, accuracy: 80, factsMastered: 10,
        xp: 100, level: 1, streak: 1, totalQuestions: 100, active: true
      });
    }
    const board = buildLeaderboard(banyak, 'effort', 'u29');
    expect(board.entries).toHaveLength(10);
    expect(board.totalRanked).toBe(30);
  });

  it('tetap menampilkan posisi siswa meski di luar sepuluh besar', () => {
    const banyak = [];
    for (let i = 0; i < 30; i++) {
      banyak.push({
        uid: `u${i}`, displayName: `Siswa ${i}`,
        daysActive: 30 - i, accuracy: 80, factsMastered: 10,
        xp: 100, level: 1, streak: 1, totalQuestions: 100, active: true
      });
    }
    const board = buildLeaderboard(banyak, 'effort', 'u25');
    expect(board.me).toBeTruthy();
    expect(board.me.rank).toBeGreaterThan(10);
  });

  it('menyamarkan nama siswa yang menyembunyikan diri', () => {
    const roster = makeRoster();
    roster[0].hideFromLeaderboard = true;
    const board = buildLeaderboard(roster, 'xp', 'u2');
    const andi = board.entries.find((e) => e.uid === 'u1');
    expect(andi.displayName).toBe('Petualang Misterius');
  });

  it('tetap menampilkan nama asli kepada siswa itu sendiri', () => {
    const roster = makeRoster();
    roster[0].hideFromLeaderboard = true;
    const board = buildLeaderboard(roster, 'xp', 'u1');
    const andi = board.entries.find((e) => e.uid === 'u1');
    expect(andi.displayName).toBe('Andi');
  });

  it('mengecualikan siswa dengan soal terlalu sedikit dari papan ketepatan', () => {
    // Eka baru 20 soal, di bawah ambang 30.
    const board = buildLeaderboard(makeRoster(), 'accuracy', 'u1');
    expect(board.entries.some((e) => e.uid === 'u5')).toBeFalsy();
  });

  it('tetap menyertakan siswa itu sendiri meski soalnya sedikit', () => {
    const board = buildLeaderboard(makeRoster(), 'accuracy', 'u5');
    expect(board.me).toBeTruthy();
    expect(board.me.uid).toBe('u5');
  });

  it('mengabaikan siswa yang tidak aktif', () => {
    const roster = makeRoster();
    roster[0].active = false;
    const board = buildLeaderboard(roster, 'xp', 'u2');
    expect(board.entries.some((e) => e.uid === 'u1')).toBeFalsy();
  });

  it('memberi peringkat yang sama untuk nilai yang seri', () => {
    const roster = [
      { uid: 'a', displayName: 'A', daysActive: 10, xp: 100, level: 1, streak: 1, accuracy: 80, factsMastered: 10, totalQuestions: 100, active: true },
      { uid: 'b', displayName: 'B', daysActive: 10, xp: 100, level: 1, streak: 1, accuracy: 80, factsMastered: 10, totalQuestions: 100, active: true }
    ];
    const board = buildLeaderboard(roster, 'effort', 'a');
    expect(board.entries[0].rank).toBe(board.entries[1].rank);
  });

  it('menangani papan kosong dengan aman', () => {
    const board = buildLeaderboard([], 'effort', 'u1');
    expect(board.entries).toHaveLength(0);
    expect(board.me).toBeNull();
  });

  it('memformat nilai sesuai kategori', () => {
    const effort = buildLeaderboard(makeRoster(), 'effort', 'u1');
    expect(effort.entries[0].valueText).toContain('hari');

    const mastery = buildLeaderboard(makeRoster(), 'mastery', 'u1');
    expect(mastery.entries[0].valueText).toContain('fakta');

    const xp = buildLeaderboard(makeRoster(), 'xp', 'u1');
    expect(xp.entries[0].valueText).toContain('XP');
  });
});

describe('encouragementFor', () => {
  it('memberi pesan berbeda untuk peringkat pertama', () => {
    const msg = encouragementFor({ rank: 1 }, 20);
    expect(msg.length).toBeGreaterThan(0);
  });

  it('tidak pernah merendahkan siswa peringkat bawah', () => {
    const terlarang = ['terakhir', 'paling bawah', 'kalah', 'buruk', 'gagal'];
    const msg = encouragementFor({ rank: 30 }, 30).toLowerCase();
    for (const kata of terlarang) {
      expect(msg.includes(kata)).toBeFalsy();
    }
  });

  it('memberi arahan untuk siswa yang belum masuk papan', () => {
    const msg = encouragementFor(null, 10);
    expect(msg.length).toBeGreaterThan(0);
  });
});