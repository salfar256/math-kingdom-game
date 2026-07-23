/** Pengujian mesin adaptif. */

import { describe, it, expect } from './test-framework.js';
import {
  calculateFactPriority, selectAdaptiveQuestions, CorrectionQueue, recommendPractice
} from '../js/game/adaptive-engine.js';
import { MASTERY_STATUS, OPERATIONS, PRIORITY_WEIGHTS } from '../js/config/game-config.js';
import { getAllFactsFor } from '../js/game/question-generator.js';

const NOW = Date.now();
const HARI = 86400000;

function makeFact(overrides = {}) {
  return {
    id: 'mul_7_8',
    operation: OPERATIONS.MULTIPLICATION,
    operandA: 7, operandB: 8, answer: 56,
    status: MASTERY_STATUS.DEVELOPING,
    totalAttempts: 10, correctAttempts: 8, wrongAttempts: 2,
    consecutiveCorrect: 1, consecutiveWrong: 0,
    averageResponseMs: 3000, daysPracticed: 2,
    lastSeenAt: new Date(NOW - HARI),
    nextReviewAt: new Date(NOW - 1000),
    ...overrides
  };
}

describe('calculateFactPriority', () => {
  it('memberi prioritas lebih tinggi pada fakta yang sering salah', () => {
    const buruk = makeFact({ totalAttempts: 10, correctAttempts: 3, id: 'a' });
    const baik = makeFact({ totalAttempts: 10, correctAttempts: 9, id: 'b' });

    const pBuruk = calculateFactPriority(buruk, { now: NOW });
    const pBaik = calculateFactPriority(baik, { now: NOW });

    expect(pBuruk).toBeGreaterThan(pBaik);
  });

  it('memberi prioritas lebih tinggi pada fakta yang dijawab lambat', () => {
    const lambat = makeFact({ averageResponseMs: 8000, id: 'a' });
    const cepat = makeFact({ averageResponseMs: 1200, id: 'b' });

    expect(calculateFactPriority(lambat, { now: NOW }))
      .toBeGreaterThan(calculateFactPriority(cepat, { now: NOW }));
  });

  it('memberi prioritas lebih tinggi pada fakta yang lama tidak muncul', () => {
    const lama = makeFact({ lastSeenAt: new Date(NOW - 10 * HARI), id: 'a' });
    const baru = makeFact({ lastSeenAt: new Date(NOW - 1000), id: 'b' });

    expect(calculateFactPriority(lama, { now: NOW }))
      .toBeGreaterThan(calculateFactPriority(baru, { now: NOW }));
  });

  it('memberi prioritas tinggi pada fakta yang belum pernah dikerjakan', () => {
    const priority = calculateFactPriority(null, { now: NOW });
    expect(priority).toBe(PRIORITY_WEIGHTS.unseen);
  });

  it('menaikkan prioritas untuk fakta yang ditugaskan guru', () => {
    const fact = makeFact({ id: 'mul_7_8' });
    const tanpa = calculateFactPriority(fact, { now: NOW });
    const dengan = calculateFactPriority(fact, {
      now: NOW, assignedFactIds: new Set(['mul_7_8'])
    });
    expect(dengan).toBeGreaterThan(tanpa);
  });

  it('menurunkan prioritas fakta yang baru saja muncul', () => {
    const fact = makeFact({ id: 'mul_7_8' });
    const normal = calculateFactPriority(fact, { now: NOW });
    const barusaja = calculateFactPriority(fact, {
      now: NOW, recentFactIds: new Set(['mul_7_8'])
    });
    expect(barusaja).toBeLessThan(normal);
  });

  it('memberi prioritas rendah pada fakta otomatis yang belum jatuh tempo', () => {
    const otomatis = makeFact({
      status: MASTERY_STATUS.AUTOMATIC,
      totalAttempts: 20, correctAttempts: 20,
      averageResponseMs: 1200,
      nextReviewAt: new Date(NOW + 5 * HARI),
      id: 'a'
    });
    const belajar = makeFact({
      status: MASTERY_STATUS.LEARNING,
      totalAttempts: 4, correctAttempts: 1,
      id: 'b'
    });
    expect(calculateFactPriority(otomatis, { now: NOW }))
      .toBeLessThan(calculateFactPriority(belajar, { now: NOW }));
  });

  it('tetap memberi prioritas pada fakta otomatis yang sudah jatuh tempo', () => {
    const jatuhTempo = makeFact({
      status: MASTERY_STATUS.AUTOMATIC,
      nextReviewAt: new Date(NOW - 3 * HARI),
      lastSeenAt: new Date(NOW - 10 * HARI),
      id: 'a'
    });
    expect(calculateFactPriority(jatuhTempo, { now: NOW })).toBeGreaterThan(0);
  });
});

describe('selectAdaptiveQuestions', () => {
  it('menghasilkan jumlah soal yang diminta', () => {
    const questions = selectAdaptiveQuestions({
      factMap: new Map(),
      operations: [OPERATIONS.MULTIPLICATION],
      count: 20
    });
    expect(questions).toHaveLength(20);
  });

  it('menghasilkan soal untuk siswa baru tanpa riwayat', () => {
    const questions = selectAdaptiveQuestions({
      factMap: new Map(),
      operations: [OPERATIONS.ADDITION],
      count: 15
    });
    expect(questions).toHaveLength(15);
    for (const q of questions) {
      expect(q.operation).toBe(OPERATIONS.ADDITION);
    }
  });

  it('memasukkan fakta lemah lebih banyak daripada fakta yang dikuasai', () => {
    const factMap = new Map();
    const facts = getAllFactsFor(OPERATIONS.MULTIPLICATION);

    // Sebagian besar dikuasai, hanya 5 yang lemah.
    facts.forEach((f, i) => {
      factMap.set(f.factId, {
        ...f, id: f.factId,
        status: i < 5 ? MASTERY_STATUS.NEEDS_REVIEW : MASTERY_STATUS.AUTOMATIC,
        totalAttempts: 10,
        correctAttempts: i < 5 ? 3 : 10,
        averageResponseMs: i < 5 ? 7000 : 1200,
        daysPracticed: 5,
        lastSeenAt: new Date(NOW - HARI),
        nextReviewAt: new Date(NOW + 5 * HARI)
      });
    });

    const questions = selectAdaptiveQuestions({
      factMap,
      operations: [OPERATIONS.MULTIPLICATION],
      count: 20
    });

    const weakIds = new Set(facts.slice(0, 5).map((f) => f.factId));
    const weakCount = questions.filter((q) => weakIds.has(q.factId)).length;

    // Semua 5 fakta lemah harus muncul.
    expect(weakCount).toBeGreaterThanOrEqual(5);
  });

  it('memunculkan fakta yang sudah jatuh tempo', () => {
    const factMap = new Map();
    const facts = getAllFactsFor(OPERATIONS.DIVISION).slice(0, 20);

    facts.forEach((f, i) => {
      factMap.set(f.factId, {
        ...f, id: f.factId,
        status: MASTERY_STATUS.MASTERED,
        totalAttempts: 10, correctAttempts: 9,
        averageResponseMs: 2500, daysPracticed: 3,
        lastSeenAt: new Date(NOW - 5 * HARI),
        // Hanya 3 fakta pertama yang jatuh tempo.
        nextReviewAt: i < 3 ? new Date(NOW - HARI) : new Date(NOW + 3 * HARI)
      });
    });

    const questions = selectAdaptiveQuestions({
      factMap, operations: [OPERATIONS.DIVISION], count: 20
    });

    const dueIds = new Set(facts.slice(0, 3).map((f) => f.factId));
    const dueCount = questions.filter((q) => dueIds.has(q.factId)).length;
    expect(dueCount).toBeGreaterThanOrEqual(1);
  });

  it('tidak memunculkan satu fakta terus-menerus tanpa jeda', () => {
    const questions = selectAdaptiveQuestions({
      factMap: new Map(),
      operations: [OPERATIONS.MULTIPLICATION],
      count: 30
    });

    let adjacentRepeats = 0;
    for (let i = 1; i < questions.length; i++) {
      if (questions[i].factId === questions[i - 1].factId) adjacentRepeats += 1;
    }
    expect(adjacentRepeats).toBe(0);
  });

  it('menghormati angka fokus bila tersedia cukup fakta', () => {
    const questions = selectAdaptiveQuestions({
      factMap: new Map(),
      operations: [OPERATIONS.MULTIPLICATION],
      count: 12,
      targets: [7]
    });

    const involving7 = questions.filter(
      (q) => q.operandA === 7 || q.operandB === 7 || q.answer === 7
    ).length;
    expect(involving7).toBeGreaterThanOrEqual(8);
  });

  it('mengembalikan array kosong bila tidak ada operasi', () => {
    const questions = selectAdaptiveQuestions({
      factMap: new Map(), operations: [], count: 10
    });
    expect(questions).toHaveLength(0);
  });
});

describe('CorrectionQueue', () => {
  it('memunculkan soal salah setelah 3 sampai 5 soal', () => {
    const queue = new CorrectionQueue();
    const q = { factId: 'mul_7_8', displayedQuestion: '7 × 8' };
    queue.add(q, 0);

    expect(queue.take(1)).toBeNull();
    expect(queue.take(2)).toBeNull();

    const taken = queue.take(5);
    expect(taken).toBeTruthy();
    expect(taken.factId).toBe('mul_7_8');
    expect(taken.isCorrection).toBeTruthy();
  });

  it('menandai soal yang diperbaiki untuk uji ulang akhir sesi', () => {
    const queue = new CorrectionQueue();
    queue.addEndOfSession({ factId: 'div_56_7' });
    const retests = queue.drainEndOfSession();
    expect(retests).toHaveLength(1);
    expect(retests[0].isRetest).toBeTruthy();
  });

  it('tidak menduplikasi uji ulang untuk fakta yang sama', () => {
    const queue = new CorrectionQueue();
    queue.addEndOfSession({ factId: 'div_56_7' });
    queue.addEndOfSession({ factId: 'div_56_7' });
    expect(queue.drainEndOfSession()).toHaveLength(1);
  });

  it('mengosongkan antrean setelah diambil', () => {
    const queue = new CorrectionQueue();
    queue.addEndOfSession({ factId: 'a' });
    queue.drainEndOfSession();
    expect(queue.drainEndOfSession()).toHaveLength(0);
  });

  it('melaporkan ukuran antrean dengan benar', () => {
    const queue = new CorrectionQueue();
    expect(queue.size).toBe(0);
    queue.add({ factId: 'a' }, 0);
    queue.add({ factId: 'b' }, 0);
    expect(queue.size).toBe(2);
  });
});

describe('recommendPractice', () => {
  it('mengurutkan rekomendasi berdasarkan jumlah fakta lemah', () => {
    const factMap = new Map();

    getAllFactsFor(OPERATIONS.MULTIPLICATION).slice(0, 15).forEach((f) => {
      factMap.set(f.factId, {
        ...f, id: f.factId, status: MASTERY_STATUS.NEEDS_REVIEW,
        totalAttempts: 5, correctAttempts: 1, lastSeenAt: new Date(NOW - HARI)
      });
    });

    getAllFactsFor(OPERATIONS.ADDITION).slice(0, 3).forEach((f) => {
      factMap.set(f.factId, {
        ...f, id: f.factId, status: MASTERY_STATUS.LEARNING,
        totalAttempts: 3, correctAttempts: 1, lastSeenAt: new Date(NOW - HARI)
      });
    });

    const recs = recommendPractice(factMap);
    expect(recs.length).toBeGreaterThanOrEqual(2);
    expect(recs[0].operation).toBe(OPERATIONS.MULTIPLICATION);
    expect(recs[0].count).toBeGreaterThan(recs[1].count);
  });

  it('tidak merekomendasikan fakta yang sudah dikuasai dan belum jatuh tempo', () => {
    const factMap = new Map();
    getAllFactsFor(OPERATIONS.ADDITION).slice(0, 10).forEach((f) => {
      factMap.set(f.factId, {
        ...f, id: f.factId, status: MASTERY_STATUS.AUTOMATIC,
        totalAttempts: 20, correctAttempts: 20,
        averageResponseMs: 1000, daysPracticed: 5,
        lastSeenAt: new Date(NOW - HARI),
        nextReviewAt: new Date(NOW + 7 * HARI)
      });
    });

    expect(recommendPractice(factMap)).toHaveLength(0);
  });
});