/** Pengujian mesin penguasaan. */

import { describe, it, expect } from './test-framework.js';
import {
  createEmptyFactRecord, updateFactMastery, evaluateStatus,
  scheduleNextReview, isDue, isWeak, isMastered, factAccuracy,
  summarizeMastery
} from '../js/game/mastery-engine.js';
import { MASTERY_STATUS, MASTERY_CONFIG } from '../js/config/game-config.js';
import { buildFact, toQuestion } from '../js/game/question-generator.js';
import { OPERATIONS } from '../js/config/game-config.js';

function makeQuestion(a = 7, b = 8, op = OPERATIONS.MULTIPLICATION) {
  return toQuestion(buildFact(op, a, b), { shuffleOrder: false });
}

/** Jawab benar n kali, masing-masing pada sesi & hari yang berbeda. */
function answerCorrectly(fact, times, { responseMs = 2000, dayOffset = 0, helpLevel = 0 } = {}) {
  let current = fact;
  const base = new Date('2026-01-01T08:00:00');
  for (let i = 0; i < times; i++) {
    const now = new Date(base.getTime() + (i + dayOffset) * 86400000);
    const result = updateFactMastery(current, {
      correct: true, responseMs, helpLevel, sessionId: `ses_${i}`, now
    });
    current = result.fact;
  }
  return current;
}

describe('createEmptyFactRecord', () => {
  it('membuat rekaman dengan status unseen', () => {
    const record = createEmptyFactRecord(makeQuestion());
    expect(record.status).toBe(MASTERY_STATUS.UNSEEN);
    expect(record.totalAttempts).toBe(0);
    expect(record.correctAttempts).toBe(0);
    expect(record.id).toBe('mul_7_8');
  });

  it('menyimpan jawaban fakta dengan benar', () => {
    const record = createEmptyFactRecord(makeQuestion(6, 9));
    expect(record.answer).toBe(54);
  });
});

describe('Aturan penguasaan', () => {
  it('SATU jawaban benar TIDAK langsung membuat fakta dikuasai', () => {
    const fact = createEmptyFactRecord(makeQuestion());
    const result = updateFactMastery(fact, {
      correct: true, responseMs: 1200, helpLevel: 0,
      sessionId: 'ses_1', now: new Date()
    });
    expect(result.fact.status).toBe(MASTERY_STATUS.LEARNING);
    expect(result.newlyMastered).toBeFalsy();
  });

  it('LIMA jawaban benar dalam SATU sesi tidak membuat fakta otomatis', () => {
    let fact = createEmptyFactRecord(makeQuestion());
    const now = new Date('2026-01-01T08:00:00');

    for (let i = 0; i < 5; i++) {
      const result = updateFactMastery(fact, {
        correct: true, responseMs: 1000, helpLevel: 0,
        sessionId: 'ses_sama', now: new Date(now.getTime() + i * 10000)
      });
      fact = result.fact;
    }

    // Hanya 1 hari & 1 sesi -> belum boleh otomatis.
    expect(fact.status).toBe(MASTERY_STATUS.DEVELOPING);
    expect(fact.daysPracticed).toBe(1);
    expect(fact.sessionsSeen).toBe(1);
  });

  it('membutuhkan sesi berbeda untuk mencapai mastered', () => {
    const fact = answerCorrectly(createEmptyFactRecord(makeQuestion()), 3, { responseMs: 4000 });
    expect(fact.sessionsSeen).toBeGreaterThanOrEqual(MASTERY_CONFIG.masteredMinSessions);
    expect(fact.status).toBe(MASTERY_STATUS.MASTERED);
  });

  it('membutuhkan hari berbeda dan waktu cepat untuk mencapai automatic', () => {
    const fact = answerCorrectly(createEmptyFactRecord(makeQuestion()), 5, { responseMs: 1500 });
    expect(fact.daysPracticed).toBeGreaterThanOrEqual(MASTERY_CONFIG.automaticMinDays);
    expect(fact.averageResponseMs).toBeLessThanOrEqual(MASTERY_CONFIG.automaticMaxAvgMs);
    expect(fact.status).toBe(MASTERY_STATUS.AUTOMATIC);
  });

  it('TIDAK mencapai automatic bila jawabannya lambat', () => {
    const fact = answerCorrectly(createEmptyFactRecord(makeQuestion()), 6, { responseMs: 6000 });
    expect(fact.status).toBe(MASTERY_STATUS.MASTERED);
  });
});

describe('Penggunaan bantuan', () => {
  it('jawaban dengan bantuan dihitung lebih kecil daripada jawaban mandiri', () => {
    const withHelp = answerCorrectly(
      createEmptyFactRecord(makeQuestion()), 3, { helpLevel: 2, responseMs: 2000 }
    );
    const without = answerCorrectly(
      createEmptyFactRecord(makeQuestion()), 3, { helpLevel: 0, responseMs: 2000 }
    );
    expect(withHelp.correctAttempts).toBeLessThan(without.correctAttempts);
  });

  it('tidak menaikkan consecutiveCorrect bila memakai bantuan', () => {
    const fact = createEmptyFactRecord(makeQuestion());
    const result = updateFactMastery(fact, {
      correct: true, responseMs: 2000, helpLevel: 3,
      sessionId: 'ses_1', now: new Date()
    });
    expect(result.fact.consecutiveCorrect).toBe(0);
    expect(result.fact.helpUsedCount).toBe(1);
  });

  it('tidak menghitung waktu jawaban berbantuan ke rata-rata', () => {
    const fact = createEmptyFactRecord(makeQuestion());
    const result = updateFactMastery(fact, {
      correct: true, responseMs: 500, helpLevel: 1,
      sessionId: 'ses_1', now: new Date()
    });
    expect(result.fact.averageResponseMs).toBe(0);
  });
});

describe('Penurunan status', () => {
  it('menurunkan fakta ke needs_review setelah salah berulang', () => {
    let fact = answerCorrectly(createEmptyFactRecord(makeQuestion()), 5, { responseMs: 1500 });
    expect(fact.status).toBe(MASTERY_STATUS.AUTOMATIC);

    const now = new Date('2026-02-01T08:00:00');
    let r = updateFactMastery(fact, { correct: false, responseMs: 5000, helpLevel: 0, sessionId: 's', now });
    r = updateFactMastery(r.fact, { correct: false, responseMs: 5000, helpLevel: 0, sessionId: 's', now });

    expect(r.fact.status).toBe(MASTERY_STATUS.NEEDS_REVIEW);
  });

  it('menurunkan automatic menjadi mastered setelah satu kesalahan', () => {
    const fact = answerCorrectly(createEmptyFactRecord(makeQuestion()), 5, { responseMs: 1500 });
    const r = updateFactMastery(fact, {
      correct: false, responseMs: 4000, helpLevel: 0,
      sessionId: 'baru', now: new Date('2026-02-01T08:00:00')
    });
    expect(r.fact.status).toBe(MASTERY_STATUS.MASTERED);
  });

  it('menurunkan status bila waktu jawab melambat drastis', () => {
    const fact = answerCorrectly(createEmptyFactRecord(makeQuestion()), 5, { responseMs: 1200 });
    expect(fact.status).toBe(MASTERY_STATUS.AUTOMATIC);

    const r = updateFactMastery(fact, {
      correct: true, responseMs: 1200 * 3, helpLevel: 0,
      sessionId: 'lambat', now: new Date('2026-02-10T08:00:00')
    });
    expect(r.fact.status).toBe(MASTERY_STATUS.NEEDS_REVIEW);
  });

  it('mereset consecutiveCorrect saat salah', () => {
    let fact = answerCorrectly(createEmptyFactRecord(makeQuestion()), 3);
    expect(fact.consecutiveCorrect).toBeGreaterThan(0);
    const r = updateFactMastery(fact, {
      correct: false, responseMs: 3000, helpLevel: 0, sessionId: 's', now: new Date()
    });
    expect(r.fact.consecutiveCorrect).toBe(0);
    expect(r.fact.consecutiveWrong).toBe(1);
  });
});

describe('Penjadwalan pengulangan', () => {
  it('menjadwalkan pengulangan segera setelah jawaban salah', () => {
    const fact = createEmptyFactRecord(makeQuestion());
    const now = new Date('2026-01-01T08:00:00');
    const next = scheduleNextReview({ ...fact, status: MASTERY_STATUS.LEARNING }, { correct: false, now });
    expect(next.getTime()).toBeLessThanOrEqual(now.getTime() + 1000);
  });

  it('menjadwalkan fakta mastered 3 hari kemudian', () => {
    const now = new Date('2026-01-01T08:00:00');
    const next = scheduleNextReview({ status: MASTERY_STATUS.MASTERED }, { correct: true, now });
    const days = (next.getTime() - now.getTime()) / 86400000;
    expect(Math.round(days)).toBe(3);
  });

  it('menjadwalkan fakta automatic 7 hari kemudian', () => {
    const now = new Date('2026-01-01T08:00:00');
    const next = scheduleNextReview({ status: MASTERY_STATUS.AUTOMATIC }, { correct: true, now });
    const days = (next.getTime() - now.getTime()) / 86400000;
    expect(Math.round(days)).toBe(7);
  });

  it('menandai fakta yang belum pernah dijadwalkan sebagai jatuh tempo', () => {
    expect(isDue({ nextReviewAt: null })).toBeTruthy();
  });

  it('menandai fakta yang jadwalnya belum tiba sebagai belum jatuh tempo', () => {
    const besok = new Date(Date.now() + 86400000);
    expect(isDue({ nextReviewAt: besok })).toBeFalsy();
  });
});

describe('Fungsi bantu status', () => {
  it('mengenali fakta lemah', () => {
    expect(isWeak({ status: MASTERY_STATUS.UNSEEN })).toBeTruthy();
    expect(isWeak({ status: MASTERY_STATUS.LEARNING })).toBeTruthy();
    expect(isWeak({ status: MASTERY_STATUS.NEEDS_REVIEW })).toBeTruthy();
    expect(isWeak({ status: MASTERY_STATUS.AUTOMATIC })).toBeFalsy();
  });

  it('mengenali fakta yang sudah dikuasai', () => {
    expect(isMastered({ status: MASTERY_STATUS.MASTERED })).toBeTruthy();
    expect(isMastered({ status: MASTERY_STATUS.AUTOMATIC })).toBeTruthy();
    expect(isMastered({ status: MASTERY_STATUS.LEARNING })).toBeFalsy();
  });

  it('menghitung akurasi fakta dengan benar', () => {
    expect(factAccuracy({ totalAttempts: 10, correctAttempts: 8 })).toBe(0.8);
    expect(factAccuracy({ totalAttempts: 0, correctAttempts: 0 })).toBe(0);
    expect(factAccuracy(null)).toBe(0);
  });
});

describe('summarizeMastery', () => {
  it('menghitung ringkasan per operasi', () => {
    const map = new Map();
    map.set('mul_7_8', {
      operation: OPERATIONS.MULTIPLICATION, status: MASTERY_STATUS.MASTERED,
      totalAttempts: 10, correctAttempts: 9, averageResponseMs: 2000
    });
    map.set('mul_6_9', {
      operation: OPERATIONS.MULTIPLICATION, status: MASTERY_STATUS.LEARNING,
      totalAttempts: 4, correctAttempts: 2, averageResponseMs: 5000
    });
    map.set('add_2_3', {
      operation: OPERATIONS.ADDITION, status: MASTERY_STATUS.AUTOMATIC,
      totalAttempts: 8, correctAttempts: 8, averageResponseMs: 1200
    });

    const summary = summarizeMastery(map);
    expect(summary.totalMastered).toBe(2);
    expect(summary.counts.mastered).toBe(1);
    expect(summary.counts.automatic).toBe(1);
    expect(summary.counts.learning).toBe(1);
    expect(summary.byOperation.multiplication.total).toBe(2);
    expect(summary.byOperation.multiplication.mastered).toBe(1);
  });
});