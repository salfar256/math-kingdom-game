/** Pengujian sistem skor, XP, level, dan lencana. */

import { describe, it, expect } from './test-framework.js';
import {
  calculatePoints, calculateSessionBonus, calculateSessionXp,
  xpForLevel, levelFromXp, checkBadges, motivationMessage
} from '../js/game/reward-engine.js';
import { SCORE_CONFIG } from '../js/config/game-config.js';
import { validateAnswer, validateNickname, validateClassCode, sanitizeText }
  from '../js/utils/validators.js';
import { calculateStreak, dayKey, daysBetween } from '../js/utils/date-utils.js';

describe('calculatePoints', () => {
  it('memberi 0 poin untuk jawaban salah', () => {
    const { points } = calculatePoints({ correct: false, responseMs: 1000 });
    expect(points).toBe(0);
  });

  it('memberi poin dasar untuk jawaban benar', () => {
    const { points } = calculatePoints({
      correct: true, responseMs: 5000, helpLevel: 2, combo: 0
    });
    expect(points).toBe(SCORE_CONFIG.correct);
  });

  it('memberi bonus untuk jawaban tanpa bantuan', () => {
    const dengan = calculatePoints({ correct: true, responseMs: 5000, helpLevel: 1, combo: 0 });
    const tanpa = calculatePoints({ correct: true, responseMs: 5000, helpLevel: 0, combo: 0 });
    expect(tanpa.points).toBe(dengan.points + SCORE_CONFIG.noHelpBonus);
  });

  it('memberi bonus untuk jawaban cepat', () => {
    const cepat = calculatePoints({ correct: true, responseMs: 1500, helpLevel: 0, combo: 0 });
    const lambat = calculatePoints({ correct: true, responseMs: 5000, helpLevel: 0, combo: 0 });
    expect(cepat.points).toBe(lambat.points + SCORE_CONFIG.fastBonus);
  });

  it('tidak memberi bonus kecepatan bila memakai bantuan', () => {
    const { points } = calculatePoints({
      correct: true, responseMs: 500, helpLevel: 1, combo: 0
    });
    expect(points).toBe(SCORE_CONFIG.correct);
  });

  it('memberi bonus untuk jawaban yang berhasil diperbaiki', () => {
    const { points } = calculatePoints({
      correct: true, responseMs: 5000, helpLevel: 2, isCorrection: true, combo: 0
    });
    expect(points).toBe(SCORE_CONFIG.correct + SCORE_CONFIG.correctionBonus);
  });

  it('menambah poin sesuai combo', () => {
    const tanpa = calculatePoints({ correct: true, responseMs: 5000, helpLevel: 2, combo: 0 });
    const dengan = calculatePoints({ correct: true, responseMs: 5000, helpLevel: 2, combo: 5 });
    expect(dengan.points).toBeGreaterThan(tanpa.points);
  });

  it('membatasi bonus combo pada nilai maksimum', () => {
    const c10 = calculatePoints({ correct: true, responseMs: 5000, helpLevel: 2, combo: 10 });
    const c50 = calculatePoints({ correct: true, responseMs: 5000, helpLevel: 2, combo: 50 });
    expect(c50.points).toBe(c10.points);
  });

  it('menyediakan rincian poin', () => {
    const { breakdown } = calculatePoints({
      correct: true, responseMs: 1000, helpLevel: 0, combo: 3
    });
    expect(breakdown.length).toBeGreaterThan(1);
  });
});

describe('calculateSessionBonus', () => {
  it('memberi bonus untuk akurasi 90% ke atas', () => {
    const { bonus } = calculateSessionBonus({ accuracy: 0.95, completedDaily: false });
    expect(bonus).toBe(SCORE_CONFIG.sessionAccuracyBonus);
  });

  it('tidak memberi bonus untuk akurasi di bawah ambang', () => {
    const { bonus } = calculateSessionBonus({ accuracy: 0.7, completedDaily: false });
    expect(bonus).toBe(0);
  });

  it('memberi bonus untuk target harian yang selesai', () => {
    const { bonus } = calculateSessionBonus({ accuracy: 0.5, completedDaily: true });
    expect(bonus).toBe(SCORE_CONFIG.dailyCompleteBonus);
  });
});

describe('Level & XP', () => {
  it('level 1 dimulai dari 0 XP', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelFromXp(0).level).toBe(1);
  });

  it('XP yang dibutuhkan naik seiring level', () => {
    const l2 = xpForLevel(2);
    const l3 = xpForLevel(3);
    const l4 = xpForLevel(4);
    expect(l3 - l2).toBeGreaterThan(l2 - xpForLevel(1));
    expect(l4 - l3).toBeGreaterThan(l3 - l2);
  });

  it('menghitung level dengan benar dari total XP', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(xpForLevel(5)).level).toBe(5);
    expect(levelFromXp(xpForLevel(5) - 1).level).toBe(4);
  });

  it('menghitung progres menuju level berikutnya', () => {
    const info = levelFromXp(xpForLevel(3) + 10);
    expect(info.level).toBe(3);
    expect(info.xpIntoLevel).toBe(10);
    expect(info.progress).toBeGreaterThan(0);
    expect(info.progress).toBeLessThan(1);
  });

  it('menangani XP negatif dengan aman', () => {
    expect(levelFromXp(-100).level).toBe(1);
  });

  it('menghitung XP sesi dengan benar', () => {
    const xp = calculateSessionXp({
      correct: 10, corrections: 2, newMastered: 1, newAutomatic: 0, completed: true
    });
    expect(xp).toBeGreaterThan(0);
  });

  it('memberi XP lebih besar untuk fakta otomatis daripada fakta dikuasai', () => {
    const mastered = calculateSessionXp({ correct: 0, newMastered: 1, completed: false });
    const automatic = calculateSessionXp({ correct: 0, newAutomatic: 1, completed: false });
    expect(automatic).toBeGreaterThan(mastered);
  });
});

describe('checkBadges', () => {
  it('memberi lencana sesi pertama', () => {
    const badges = checkBadges({ sessionsCompleted: 1 }, []);
    expect(badges.some((b) => b.id === 'first_session')).toBeTruthy();
  });

  it('tidak memberi lencana yang sudah dimiliki', () => {
    const badges = checkBadges({ sessionsCompleted: 5 }, ['first_session']);
    expect(badges.some((b) => b.id === 'first_session')).toBeFalsy();
  });

  it('memberi lencana streak sesuai tingkatan', () => {
    const badges = checkBadges({ streak: 7, sessionsCompleted: 10 }, ['first_session']);
    const ids = badges.map((b) => b.id);
    expect(ids).toContain('streak_3');
    expect(ids).toContain('streak_7');
    expect(ids.includes('streak_30')).toBeFalsy();
  });

  it('memberi lencana sesi sempurna hanya bila soal cukup banyak', () => {
    const sedikit = checkBadges({ sessionAccuracy: 1, sessionQuestions: 3 }, []);
    const banyak = checkBadges({ sessionAccuracy: 1, sessionQuestions: 20 }, []);
    expect(sedikit.some((b) => b.id === 'perfect_session')).toBeFalsy();
    expect(banyak.some((b) => b.id === 'perfect_session')).toBeTruthy();
  });
});

describe('motivationMessage', () => {
  it('selalu mengembalikan teks', () => {
    for (const acc of [0, 0.5, 0.75, 0.95, 1]) {
      const msg = motivationMessage(acc, 0);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it('tidak pernah memakai kata yang merendahkan', () => {
    const terlarang = ['bodoh', 'lambat', 'gagal', 'payah', 'buruk'];
    for (let i = 0; i < 50; i++) {
      const msg = motivationMessage(0.2, 0).toLowerCase();
      for (const kata of terlarang) {
        expect(msg.includes(kata)).toBeFalsy();
      }
    }
  });
});

describe('Validator', () => {
  it('menerima nama panggilan yang valid', () => {
    expect(validateNickname('Rani').valid).toBeTruthy();
    expect(validateNickname('Budi Santoso').valid).toBeTruthy();
    expect(validateNickname("D'Angelo").valid).toBeTruthy();
  });

  it('menolak nama yang terlalu pendek', () => {
    expect(validateNickname('A').valid).toBeFalsy();
    expect(validateNickname('').valid).toBeFalsy();
    expect(validateNickname('   ').valid).toBeFalsy();
  });

  it('menolak nama dengan karakter berbahaya', () => {
    expect(validateNickname('<script>').valid).toBeFalsy();
    expect(validateNickname('Budi<>').valid).toBeFalsy();
  });

  it('membersihkan karakter kontrol', () => {
    expect(sanitizeText('Budi\u0000Santoso')).toBe('BudiSantoso');
    expect(sanitizeText('  Budi   Santoso  ')).toBe('Budi Santoso');
  });

  it('mengubah kode kelas menjadi huruf besar', () => {
    const result = validateClassCode('abc123');
    expect(result.valid).toBeTruthy();
    expect(result.value).toBe('ABC123');
  });

  it('menolak kode kelas yang tidak valid', () => {
    expect(validateClassCode('AB').valid).toBeFalsy();
    expect(validateClassCode('ABC-123').valid).toBeFalsy();
    expect(validateClassCode('').valid).toBeFalsy();
  });

  it('memvalidasi jawaban dengan benar', () => {
    expect(validateAnswer('56').valid).toBeTruthy();
    expect(validateAnswer('56').value).toBe(56);
    expect(validateAnswer('').valid).toBeFalsy();
    expect(validateAnswer('  ').valid).toBeFalsy();
    expect(validateAnswer('-5').valid).toBeFalsy();
    expect(validateAnswer('abc').valid).toBeFalsy();
    expect(validateAnswer('5.5').valid).toBeFalsy();
    expect(validateAnswer('1000').valid).toBeFalsy();
  });
});

describe('Perhitungan streak', () => {
  it('memulai streak dari 1 untuk latihan pertama', () => {
    expect(calculateStreak(null, 0)).toBe(1);
  });

  it('tidak menambah streak untuk latihan di hari yang sama', () => {
    const pagi = new Date('2026-01-10T08:00:00');
    const sore = new Date('2026-01-10T18:00:00');
    expect(calculateStreak(pagi, 5, sore)).toBe(5);
  });

  it('menambah streak untuk latihan di hari berikutnya', () => {
    const kemarin = new Date('2026-01-10T20:00:00');
    const hariIni = new Date('2026-01-11T07:00:00');
    expect(calculateStreak(kemarin, 5, hariIni)).toBe(6);
  });

  it('mereset streak setelah jeda lebih dari satu hari', () => {
    const lama = new Date('2026-01-01T08:00:00');
    const sekarang = new Date('2026-01-10T08:00:00');
    expect(calculateStreak(lama, 20, sekarang)).toBe(1);
  });

  it('menghitung selisih hari kalender dengan benar', () => {
    expect(daysBetween('2026-01-01T23:00:00', '2026-01-02T01:00:00')).toBe(1);
    expect(daysBetween('2026-01-01T08:00:00', '2026-01-01T20:00:00')).toBe(0);
  });

  it('menghasilkan kunci hari dalam format YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});