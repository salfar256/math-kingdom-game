/**
 * Pembuat soal & identitas fakta.
 *
 * Aturan wajib:
 * - Penjumlahan  : kedua operand 1–9.
 * - Pengurangan  : diturunkan dari keluarga fakta penjumlahan, hasil >= 0.
 * - Perkalian    : kedua faktor 1–9.
 * - Pembagian    : diturunkan dari fakta perkalian; selalu bilangan bulat,
 *                  pembagi tidak pernah nol, hasil 1–9.
 */

import { OPERATIONS, OPERATION_SYMBOL } from '../config/game-config.js';
import { randInt, pickRandom, shuffle } from '../utils/helpers.js';

const OP_PREFIX = {
  [OPERATIONS.ADDITION]: 'add',
  [OPERATIONS.SUBTRACTION]: 'sub',
  [OPERATIONS.MULTIPLICATION]: 'mul',
  [OPERATIONS.DIVISION]: 'div'
};

/**
 * ID fakta konsisten, contoh: mul_7_8, div_56_7, add_7_2, sub_9_7.
 * Untuk penjumlahan & perkalian, operand dinormalisasi (kecil dulu)
 * supaya 7×8 dan 8×7 memiliki ID yang sama.
 */
export function createFactId(operation, a, b) {
  const prefix = OP_PREFIX[operation];
  if (!prefix) throw new Error(`Operasi tidak dikenal: ${operation}`);
  const { operandA, operandB } = normalizeFact(operation, a, b);
  return `${prefix}_${operandA}_${operandB}`;
}

/**
 * Normalisasi operand.
 * - Komutatif (+, ×): urutkan menaik.
 * - Non-komutatif (−, ÷): dibiarkan apa adanya.
 */
export function normalizeFact(operation, a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (operation === OPERATIONS.ADDITION || operation === OPERATIONS.MULTIPLICATION) {
    return { operandA: Math.min(na, nb), operandB: Math.max(na, nb) };
  }
  return { operandA: na, operandB: nb };
}

/**
 * ID keluarga fakta.
 * - add/sub  : fam_as_{kecil}_{besar} berdasarkan dua addend.
 * - mul/div  : fam_md_{kecil}_{besar} berdasarkan dua faktor.
 */
export function getFamilyId(operation, a, b) {
  const na = Number(a);
  const nb = Number(b);

  if (operation === OPERATIONS.ADDITION) {
    const lo = Math.min(na, nb), hi = Math.max(na, nb);
    return `fam_as_${lo}_${hi}`;
  }
  if (operation === OPERATIONS.SUBTRACTION) {
    // a - b = c  ->  addend-nya adalah b dan c
    const c = na - nb;
    const lo = Math.min(nb, c), hi = Math.max(nb, c);
    return `fam_as_${lo}_${hi}`;
  }
  if (operation === OPERATIONS.MULTIPLICATION) {
    const lo = Math.min(na, nb), hi = Math.max(na, nb);
    return `fam_md_${lo}_${hi}`;
  }
  if (operation === OPERATIONS.DIVISION) {
    // a ÷ b = c  ->  faktornya adalah b dan c
    const c = na / nb;
    const lo = Math.min(nb, c), hi = Math.max(nb, c);
    return `fam_md_${lo}_${hi}`;
  }
  return 'fam_unknown';
}

/**
 * Seluruh anggota sebuah keluarga fakta.
 * @returns {Array<{operation, operandA, operandB, answer, display}>}
 */
export function getFactFamily(operation, a, b) {
  const na = Number(a);
  const nb = Number(b);

  if (operation === OPERATIONS.ADDITION || operation === OPERATIONS.SUBTRACTION) {
    let x, y;
    if (operation === OPERATIONS.ADDITION) {
      x = na; y = nb;
    } else {
      x = nb; y = na - nb;   // a - b = y  => addend b dan y
    }
    const sum = x + y;
    const members = [
      buildFact(OPERATIONS.ADDITION, x, y),
      buildFact(OPERATIONS.ADDITION, y, x),
      buildFact(OPERATIONS.SUBTRACTION, sum, x),
      buildFact(OPERATIONS.SUBTRACTION, sum, y)
    ];
    return dedupeMembers(members);
  }

  let f1, f2;
  if (operation === OPERATIONS.MULTIPLICATION) {
    f1 = na; f2 = nb;
  } else {
    f1 = nb; f2 = na / nb;   // a ÷ b = f2 => faktor b dan f2
  }
  const product = f1 * f2;
  const members = [
    buildFact(OPERATIONS.MULTIPLICATION, f1, f2),
    buildFact(OPERATIONS.MULTIPLICATION, f2, f1),
    buildFact(OPERATIONS.DIVISION, product, f1),
    buildFact(OPERATIONS.DIVISION, product, f2)
  ];
  return dedupeMembers(members);
}

function dedupeMembers(members) {
  const seen = new Set();
  const out = [];
  for (const m of members) {
    const key = `${m.operation}|${m.operandA}|${m.operandB}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

/** Hitung jawaban sebuah operasi. */
export function computeAnswer(operation, a, b) {
  const na = Number(a);
  const nb = Number(b);
  switch (operation) {
    case OPERATIONS.ADDITION:       return na + nb;
    case OPERATIONS.SUBTRACTION:    return na - nb;
    case OPERATIONS.MULTIPLICATION: return na * nb;
    case OPERATIONS.DIVISION:
      if (nb === 0) throw new Error('Pembagi tidak boleh nol.');
      return na / nb;
    default:
      throw new Error(`Operasi tidak dikenal: ${operation}`);
  }
}

/** Bentuk objek fakta lengkap. */
export function buildFact(operation, a, b) {
  const na = Number(a);
  const nb = Number(b);
  const answer = computeAnswer(operation, na, nb);
  return {
    factId: createFactId(operation, na, nb),
    familyId: getFamilyId(operation, na, nb),
    operation,
    operandA: na,
    operandB: nb,
    answer,
    display: `${na} ${OPERATION_SYMBOL[operation]} ${nb}`
  };
}

/**
 * Daftar semua fakta dasar untuk satu operasi (1–9).
 * @returns {Array<object>}
 */
export function generateAllFacts(operation) {
  const out = [];

  if (operation === OPERATIONS.ADDITION) {
    for (let a = 1; a <= 9; a++) {
      for (let b = a; b <= 9; b++) out.push(buildFact(OPERATIONS.ADDITION, a, b));
    }
    return out;
  }

  if (operation === OPERATIONS.SUBTRACTION) {
    // Diturunkan dari keluarga penjumlahan: (a+b) - a = b, hasil selalu >= 0.
    const seen = new Set();
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 9; b++) {
        const sum = a + b;
        for (const sub of [buildFact(OPERATIONS.SUBTRACTION, sum, a),
                           buildFact(OPERATIONS.SUBTRACTION, sum, b)]) {
          if (seen.has(sub.factId)) continue;
          seen.add(sub.factId);
          out.push(sub);
        }
      }
    }
    return out;
  }

  if (operation === OPERATIONS.MULTIPLICATION) {
    for (let a = 1; a <= 9; a++) {
      for (let b = a; b <= 9; b++) out.push(buildFact(OPERATIONS.MULTIPLICATION, a, b));
    }
    return out;
  }

  if (operation === OPERATIONS.DIVISION) {
    const seen = new Set();
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 9; b++) {
        const product = a * b;
        for (const div of [buildFact(OPERATIONS.DIVISION, product, a),
                           buildFact(OPERATIONS.DIVISION, product, b)]) {
          if (seen.has(div.factId)) continue;
          seen.add(div.factId);
          out.push(div);
        }
      }
    }
    return out;
  }

  return out;
}

/** Cache daftar fakta agar tidak dibangun berulang kali. */
const FACT_CACHE = new Map();

export function getAllFactsFor(operation) {
  if (!FACT_CACHE.has(operation)) {
    FACT_CACHE.set(operation, generateAllFacts(operation));
  }
  return FACT_CACHE.get(operation);
}

/** Seluruh fakta dari daftar operasi. */
export function getFactPool(operations = []) {
  const pool = [];
  for (const op of operations) pool.push(...getAllFactsFor(op));
  return pool;
}

/**
 * Buat satu soal acak.
 * @param {string} operation
 * @param {{targets?: number[]}} options targets = angka fokus (mis. tabel 7)
 */
export function generateQuestion(operation, options = {}) {
  const { targets = null } = options;
  let pool = getAllFactsFor(operation);

  if (Array.isArray(targets) && targets.length > 0) {
    const filtered = pool.filter((f) => matchesTarget(f, targets));
    if (filtered.length > 0) pool = filtered;
  }

  const fact = pickRandom(pool);
  return toQuestion(fact);
}

/** Apakah sebuah fakta melibatkan salah satu angka fokus. */
export function matchesTarget(fact, targets) {
  const set = new Set(targets.map(Number));
  const { operation, operandA, operandB, answer } = fact;
  if (operation === OPERATIONS.ADDITION || operation === OPERATIONS.MULTIPLICATION) {
    return set.has(operandA) || set.has(operandB);
  }
  if (operation === OPERATIONS.SUBTRACTION) {
    return set.has(operandB) || set.has(answer);
  }
  // pembagian: pembagi atau hasil
  return set.has(operandB) || set.has(answer);
}

/**
 * Ubah fakta menjadi soal siap tampil.
 * Untuk fakta komutatif, urutan tampilan diacak agar siswa terbiasa keduanya,
 * tetapi factId tetap ternormalisasi.
 */
export function toQuestion(fact, { shuffleOrder = true } = {}) {
  if (!fact) return null;
  let a = fact.operandA;
  let b = fact.operandB;

  const commutative =
    fact.operation === OPERATIONS.ADDITION ||
    fact.operation === OPERATIONS.MULTIPLICATION;

  if (shuffleOrder && commutative && Math.random() < 0.5) {
    [a, b] = [b, a];
  }

  return {
    factId: fact.factId,
    familyId: fact.familyId,
    operation: fact.operation,
    operandA: fact.operandA,
    operandB: fact.operandB,
    displayA: a,
    displayB: b,
    symbol: OPERATION_SYMBOL[fact.operation],
    displayedQuestion: `${a} ${OPERATION_SYMBOL[fact.operation]} ${b}`,
    expectedAnswer: fact.answer,
    answer: fact.answer
  };
}

/**
 * Periksa jawaban siswa.
 * @returns {{correct: boolean, expected: number, given: number|null}}
 */
export function checkAnswer(question, rawAnswer) {
  if (!question) return { correct: false, expected: null, given: null };

  const text = String(rawAnswer ?? '').trim();
  if (text.length === 0 || !/^\d{1,3}$/.test(text)) {
    return { correct: false, expected: question.expectedAnswer, given: null };
  }
  const given = Number(text);
  return {
    correct: given === question.expectedAnswer,
    expected: question.expectedAnswer,
    given
  };
}

/**
 * Soal mode "Perbaiki Jawaban": menampilkan jawaban yang mungkin salah.
 * @returns {object} soal + properti shownAnswer & isShownCorrect
 */
export function generateFixAnswerQuestion(operation, options = {}) {
  const q = generateQuestion(operation, options);
  const makeWrong = Math.random() < 0.6;

  let shown = q.expectedAnswer;
  if (makeWrong) {
    const deltas = shuffle([-2, -1, 1, 2, 3, -3]);
    for (const d of deltas) {
      const candidate = q.expectedAnswer + d;
      if (candidate >= 0 && candidate !== q.expectedAnswer) { shown = candidate; break; }
    }
    if (shown === q.expectedAnswer) shown = q.expectedAnswer + 1;
  }

  return { ...q, shownAnswer: shown, isShownCorrect: shown === q.expectedAnswer };
}

/** Soal keluarga fakta: satu keluarga dengan 3–4 anggota untuk dilengkapi. */
export function generateFactFamilyTask(operation, options = {}) {
  const seed = generateQuestion(operation, options);
  const members = getFactFamily(seed.operation, seed.operandA, seed.operandB);
  const numbers = deriveFamilyNumbers(seed);
  return {
    familyId: seed.familyId,
    numbers,
    members: members.map((m) => toQuestion(m, { shuffleOrder: false }))
  };
}

/** Tiga angka pembentuk keluarga, contoh: 6, 8, 48. */
export function deriveFamilyNumbers(q) {
  const { operation, operandA, operandB, expectedAnswer } = q;
  if (operation === OPERATIONS.ADDITION) return [operandA, operandB, expectedAnswer];
  if (operation === OPERATIONS.MULTIPLICATION) return [operandA, operandB, expectedAnswer];
  if (operation === OPERATIONS.SUBTRACTION) return [operandB, expectedAnswer, operandA];
  return [operandB, expectedAnswer, operandA]; // pembagian
}