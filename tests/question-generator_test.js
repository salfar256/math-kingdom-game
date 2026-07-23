/** Pengujian generator soal & pemeriksa jawaban. */

import { describe, it, expect } from './test-framework.js';
import {
  createFactId, normalizeFact, getFamilyId, getFactFamily,
  generateAllFacts, getAllFactsFor, generateQuestion, toQuestion,
  checkAnswer, computeAnswer, buildFact, generateFixAnswerQuestion,
  generateFactFamilyTask, matchesTarget
} from '../js/game/question-generator.js';
import { OPERATIONS } from '../js/config/game-config.js';

describe('createFactId & normalizeFact', () => {
  it('membuat ID sesuai format yang ditentukan', () => {
    expect(createFactId(OPERATIONS.MULTIPLICATION, 7, 8)).toBe('mul_7_8');
    expect(createFactId(OPERATIONS.DIVISION, 56, 7)).toBe('div_56_7');
    expect(createFactId(OPERATIONS.ADDITION, 7, 2)).toBe('add_2_7');
    expect(createFactId(OPERATIONS.SUBTRACTION, 9, 7)).toBe('sub_9_7');
  });

  it('menyamakan ID untuk fakta komutatif', () => {
    expect(createFactId(OPERATIONS.MULTIPLICATION, 7, 8))
      .toBe(createFactId(OPERATIONS.MULTIPLICATION, 8, 7));
    expect(createFactId(OPERATIONS.ADDITION, 3, 9))
      .toBe(createFactId(OPERATIONS.ADDITION, 9, 3));
  });

  it('tidak menyamakan ID untuk fakta non-komutatif', () => {
    expect(createFactId(OPERATIONS.SUBTRACTION, 9, 4))
      .toBe('sub_9_4');
    expect(createFactId(OPERATIONS.DIVISION, 24, 3))
      .toBe('div_24_3');
  });

  it('menormalisasi operand komutatif menjadi kecil-besar', () => {
    const n = normalizeFact(OPERATIONS.MULTIPLICATION, 9, 2);
    expect(n.operandA).toBe(2);
    expect(n.operandB).toBe(9);
  });

  it('menolak operasi yang tidak dikenal', () => {
    expect(() => createFactId('modulo', 5, 3)).toThrow();
  });
});

describe('Keluarga fakta', () => {
  it('mengelompokkan 6 x 8 dan 48 : 6 dalam keluarga yang sama', () => {
    const a = getFamilyId(OPERATIONS.MULTIPLICATION, 6, 8);
    const b = getFamilyId(OPERATIONS.DIVISION, 48, 6);
    const c = getFamilyId(OPERATIONS.DIVISION, 48, 8);
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('mengelompokkan 7 + 2 dan 9 - 7 dalam keluarga yang sama', () => {
    const a = getFamilyId(OPERATIONS.ADDITION, 7, 2);
    const b = getFamilyId(OPERATIONS.SUBTRACTION, 9, 7);
    const c = getFamilyId(OPERATIONS.SUBTRACTION, 9, 2);
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('menghasilkan empat anggota untuk keluarga perkalian', () => {
    const family = getFactFamily(OPERATIONS.MULTIPLICATION, 6, 8);
    expect(family).toHaveLength(4);
    const displays = family.map((f) => f.display).sort();
    expect(displays).toContain('6 × 8');
    expect(displays).toContain('8 × 6');
    expect(displays).toContain('48 ÷ 6');
    expect(displays).toContain('48 ÷ 8');
  });

  it('menghasilkan tiga anggota untuk keluarga kuadrat', () => {
    // 7 x 7 = 49 -> hanya 7x7 dan 49:7 (duplikat dibuang)
    const family = getFactFamily(OPERATIONS.MULTIPLICATION, 7, 7);
    expect(family.length).toBeLessThanOrEqual(3);
  });

  it('menghasilkan empat anggota untuk keluarga penjumlahan', () => {
    const family = getFactFamily(OPERATIONS.ADDITION, 7, 2);
    const displays = family.map((f) => f.display);
    expect(displays).toContain('7 + 2');
    expect(displays).toContain('2 + 7');
    expect(displays).toContain('9 − 7');
    expect(displays).toContain('9 − 2');
  });
});

describe('Generator penjumlahan', () => {
  const facts = generateAllFacts(OPERATIONS.ADDITION);

  it('menghasilkan 45 fakta unik (kombinasi 1-9)', () => {
    expect(facts).toHaveLength(45);
  });

  it('selalu memakai operand 1 sampai 9', () => {
    for (const f of facts) {
      expect(f.operandA).toBeGreaterThanOrEqual(1);
      expect(f.operandA).toBeLessThanOrEqual(9);
      expect(f.operandB).toBeGreaterThanOrEqual(1);
      expect(f.operandB).toBeLessThanOrEqual(9);
    }
  });

  it('menghasilkan jawaban yang benar', () => {
    for (const f of facts) {
      expect(f.answer).toBe(f.operandA + f.operandB);
    }
  });

  it('tidak memiliki ID duplikat', () => {
    const ids = new Set(facts.map((f) => f.factId));
    expect(ids.size).toBe(facts.length);
  });
});

describe('Generator pengurangan', () => {
  const facts = generateAllFacts(OPERATIONS.SUBTRACTION);

  it('tidak pernah menghasilkan hasil negatif', () => {
    for (const f of facts) {
      expect(f.answer).toBeGreaterThanOrEqual(0);
    }
  });

  it('selalu berasal dari keluarga fakta penjumlahan 1-9', () => {
    for (const f of facts) {
      // a - b = c, dengan b dan c keduanya 1-9
      expect(f.operandB).toBeGreaterThanOrEqual(1);
      expect(f.operandB).toBeLessThanOrEqual(9);
      expect(f.answer).toBeGreaterThanOrEqual(1);
      expect(f.answer).toBeLessThanOrEqual(9);
    }
  });

  it('menghasilkan jawaban yang benar', () => {
    for (const f of facts) {
      expect(f.answer).toBe(f.operandA - f.operandB);
    }
  });

  it('mencakup contoh 15 - 7 = 8', () => {
    const found = facts.find((f) => f.operandA === 15 && f.operandB === 7);
    expect(found).toBeTruthy();
    expect(found.answer).toBe(8);
  });
});

describe('Generator perkalian', () => {
  const facts = generateAllFacts(OPERATIONS.MULTIPLICATION);

  it('menghasilkan 45 fakta unik', () => {
    expect(facts).toHaveLength(45);
  });

  it('kedua faktor selalu 1 sampai 9', () => {
    for (const f of facts) {
      expect(f.operandA).toBeGreaterThanOrEqual(1);
      expect(f.operandA).toBeLessThanOrEqual(9);
      expect(f.operandB).toBeGreaterThanOrEqual(1);
      expect(f.operandB).toBeLessThanOrEqual(9);
    }
  });

  it('menghasilkan jawaban yang benar', () => {
    for (const f of facts) {
      expect(f.answer).toBe(f.operandA * f.operandB);
    }
  });
});

describe('Generator pembagian', () => {
  const facts = generateAllFacts(OPERATIONS.DIVISION);

  it('selalu menghasilkan bilangan bulat', () => {
    for (const f of facts) {
      expect(Number.isInteger(f.answer)).toBeTruthy();
    }
  });

  it('tidak pernah memiliki sisa', () => {
    for (const f of facts) {
      expect(f.operandA % f.operandB).toBe(0);
    }
  });

  it('tidak pernah membagi dengan nol', () => {
    for (const f of facts) {
      expect(f.operandB).toBeGreaterThan(0);
    }
  });

  it('pembagi dan hasil selalu 1 sampai 9', () => {
    for (const f of facts) {
      expect(f.operandB).toBeGreaterThanOrEqual(1);
      expect(f.operandB).toBeLessThanOrEqual(9);
      expect(f.answer).toBeGreaterThanOrEqual(1);
      expect(f.answer).toBeLessThanOrEqual(9);
    }
  });

  it('tidak pernah menghasilkan desimal', () => {
    for (const f of facts) {
      expect(f.answer % 1).toBe(0);
    }
  });

  it('mencakup contoh 56 : 7 = 8', () => {
    const found = facts.find((f) => f.operandA === 56 && f.operandB === 7);
    expect(found).toBeTruthy();
    expect(found.answer).toBe(8);
  });

  it('menolak pembagi nol pada computeAnswer', () => {
    expect(() => computeAnswer(OPERATIONS.DIVISION, 10, 0)).toThrow();
  });
});

describe('generateQuestion', () => {
  it('menghasilkan soal yang valid untuk setiap operasi', () => {
    for (const op of Object.values(OPERATIONS)) {
      const q = generateQuestion(op);
      expect(q).toBeTruthy();
      expect(q.operation).toBe(op);
      expect(typeof q.expectedAnswer).toBe('number');
      expect(q.displayedQuestion.length).toBeGreaterThan(0);
    }
  });

  it('menghormati angka fokus (targets)', () => {
    for (let i = 0; i < 30; i++) {
      const q = generateQuestion(OPERATIONS.MULTIPLICATION, { targets: [7] });
      const involves7 = q.operandA === 7 || q.operandB === 7;
      expect(involves7).toBeTruthy();
    }
  });

  it('menghasilkan soal pembagian yang selalu bulat', () => {
    for (let i = 0; i < 100; i++) {
      const q = generateQuestion(OPERATIONS.DIVISION);
      expect(Number.isInteger(q.expectedAnswer)).toBeTruthy();
      expect(q.operandB).toBeGreaterThan(0);
    }
  });

  it('menjaga factId tetap ternormalisasi meski urutan tampilan diacak', () => {
    const base = buildFact(OPERATIONS.MULTIPLICATION, 3, 8);
    for (let i = 0; i < 20; i++) {
      const q = toQuestion(base);
      expect(q.factId).toBe('mul_3_8');
      expect(q.expectedAnswer).toBe(24);
    }
  });
});

describe('checkAnswer', () => {
  const q = toQuestion(buildFact(OPERATIONS.MULTIPLICATION, 7, 8), { shuffleOrder: false });

  it('menerima angka yang benar', () => {
    expect(checkAnswer(q, '56').correct).toBeTruthy();
    expect(checkAnswer(q, 56).correct).toBeTruthy();
  });

  it('menolak angka yang salah', () => {
    expect(checkAnswer(q, '54').correct).toBeFalsy();
  });

  it('menolak input kosong', () => {
    expect(checkAnswer(q, '').correct).toBeFalsy();
    expect(checkAnswer(q, null).correct).toBeFalsy();
    expect(checkAnswer(q, undefined).correct).toBeFalsy();
  });

  it('menolak input yang hanya berisi spasi', () => {
    expect(checkAnswer(q, '   ').correct).toBeFalsy();
  });

  it('menerima angka benar dengan spasi di sekitarnya', () => {
    expect(checkAnswer(q, ' 56 ').correct).toBeTruthy();
  });

  it('menolak angka negatif', () => {
    expect(checkAnswer(q, '-56').correct).toBeFalsy();
  });

  it('menolak karakter bukan angka', () => {
    expect(checkAnswer(q, 'abc').correct).toBeFalsy();
    expect(checkAnswer(q, '5a').correct).toBeFalsy();
    expect(checkAnswer(q, '5.6').correct).toBeFalsy();
    expect(checkAnswer(q, '5,6').correct).toBeFalsy();
  });

  it('menolak angka lebih dari 3 digit', () => {
    expect(checkAnswer(q, '0056').correct).toBeFalsy();
  });

  it('selalu mengembalikan jawaban yang diharapkan', () => {
    expect(checkAnswer(q, 'salah').expected).toBe(56);
  });
});

describe('Mode Perbaiki Jawaban', () => {
  it('menandai dengan benar apakah jawaban yang ditampilkan salah', () => {
    for (let i = 0; i < 60; i++) {
      const q = generateFixAnswerQuestion(OPERATIONS.MULTIPLICATION);
      const actuallyCorrect = q.shownAnswer === q.expectedAnswer;
      expect(q.isShownCorrect).toBe(actuallyCorrect);
    }
  });

  it('tidak pernah menampilkan jawaban negatif', () => {
    for (let i = 0; i < 60; i++) {
      const q = generateFixAnswerQuestion(OPERATIONS.SUBTRACTION);
      expect(q.shownAnswer).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Tugas keluarga fakta', () => {
  it('menghasilkan tiga angka pembentuk keluarga', () => {
    const task = generateFactFamilyTask(OPERATIONS.MULTIPLICATION);
    expect(task.numbers).toHaveLength(3);
    const [a, b, c] = task.numbers;
    expect(a * b).toBe(c);
  });

  it('menghasilkan anggota yang seluruhnya valid', () => {
    const task = generateFactFamilyTask(OPERATIONS.DIVISION);
    for (const m of task.members) {
      expect(Number.isInteger(m.expectedAnswer)).toBeTruthy();
      expect(m.expectedAnswer).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('matchesTarget', () => {
  it('mengenali fakta yang melibatkan angka fokus', () => {
    const fact = buildFact(OPERATIONS.MULTIPLICATION, 7, 8);
    expect(matchesTarget(fact, [7])).toBeTruthy();
    expect(matchesTarget(fact, [8])).toBeTruthy();
    expect(matchesTarget(fact, [3])).toBeFalsy();
  });

  it('mengenali pembagi dan hasil pada pembagian', () => {
    const fact = buildFact(OPERATIONS.DIVISION, 56, 7);
    expect(matchesTarget(fact, [7])).toBeTruthy();  // pembagi
    expect(matchesTarget(fact, [8])).toBeTruthy();  // hasil
  });
});