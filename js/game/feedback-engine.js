/**
 * Bantuan bertingkat & penjelasan jawaban salah.
 * Semua teks dalam bahasa Indonesia.
 *
 * Tingkatan bantuan:
 *   1. petunjuk kecil
 *   2. pola atau fakta terkait
 *   3. langkah penyelesaian
 *   4. jawaban lengkap
 */

import { OPERATIONS, OPERATION_SYMBOL } from '../config/game-config.js';
import { pickRandom } from '../utils/helpers.js';

/**
 * Ambil teks bantuan untuk sebuah soal.
 * @param {object} question
 * @param {number} level 1–4
 * @returns {{title: string, lines: string[]}}
 */
export function getHint(question, level = 1) {
  const lv = Math.max(1, Math.min(4, Number(level) || 1));
  switch (question.operation) {
    case OPERATIONS.ADDITION:       return additionHint(question, lv);
    case OPERATIONS.SUBTRACTION:    return subtractionHint(question, lv);
    case OPERATIONS.MULTIPLICATION: return multiplicationHint(question, lv);
    case OPERATIONS.DIVISION:       return divisionHint(question, lv);
    default:
      return { title: 'Bantuan', lines: ['Coba pikirkan pelan-pelan.'] };
  }
}

function additionHint(q, level) {
  const a = q.displayA ?? q.operandA;
  const b = q.displayB ?? q.operandB;
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const toTen = 10 - big;

  if (level === 1) {
    return {
      title: 'Petunjuk',
      lines: [`Mulailah dari angka yang lebih besar, yaitu ${big}, lalu tambahkan ${small}.`]
    };
  }
  if (level === 2) {
    if (toTen > 0 && toTen < small) {
      return {
        title: 'Pola: lewati sepuluh',
        lines: [
          `${big} butuh ${toTen} lagi untuk menjadi 10.`,
          `Pecah ${small} menjadi ${toTen} dan ${small - toTen}.`
        ]
      };
    }
    return {
      title: 'Pola',
      lines: [
        `Ingat pasangan yang membentuk 10: 1+9, 2+8, 3+7, 4+6, 5+5.`,
        `${a} ${OPERATION_SYMBOL.addition} ${b} dekat dengan salah satu pasangan itu.`
      ]
    };
  }
  if (level === 3) {
    if (toTen > 0 && toTen < small) {
      return {
        title: 'Langkah penyelesaian',
        lines: [
          `${big} + ${toTen} = 10`,
          `Sisa ${small} − ${toTen} = ${small - toTen}`,
          `10 + ${small - toTen} = ?`
        ]
      };
    }
    return {
      title: 'Langkah penyelesaian',
      lines: [`Hitung mundur dari ${big}, naik ${small} langkah.`]
    };
  }
  return {
    title: 'Jawaban',
    lines: [`${a} + ${b} = ${q.expectedAnswer}`]
  };
}

function subtractionHint(q, level) {
  const a = q.displayA ?? q.operandA;
  const b = q.displayB ?? q.operandB;
  const answer = q.expectedAnswer;

  if (level === 1) {
    return {
      title: 'Petunjuk',
      lines: [`Tanyakan pada dirimu: berapa yang harus ditambahkan ke ${b} agar menjadi ${a}?`]
    };
  }
  if (level === 2) {
    return {
      title: 'Fakta terkait',
      lines: [
        `Pengurangan adalah kebalikan penjumlahan.`,
        `${b} + ? = ${a}`
      ]
    };
  }
  if (level === 3) {
    const toTen = 10 - b;
    if (a > 10 && toTen > 0) {
      return {
        title: 'Langkah penyelesaian',
        lines: [
          `${b} + ${toTen} = 10`,
          `10 + ${a - 10} = ${a}`,
          `Jadi tambahannya ${toTen} + ${a - 10} = ?`
        ]
      };
    }
    return {
      title: 'Langkah penyelesaian',
      lines: [`Hitung naik dari ${b} sampai ${a}, lalu hitung berapa langkahnya.`]
    };
  }
  return {
    title: 'Jawaban',
    lines: [
      `${a} − ${b} = ${answer}`,
      `Periksa: ${b} + ${answer} = ${a}`
    ]
  };
}

function multiplicationHint(q, level) {
  const a = q.displayA ?? q.operandA;
  const b = q.displayB ?? q.operandB;
  const answer = q.expectedAnswer;

  if (level === 1) {
    return {
      title: 'Petunjuk',
      lines: [`${a} × ${b} berarti menjumlahkan ${a} sebanyak ${b} kali.`]
    };
  }

  if (level === 2) {
    if (a === 9 || b === 9) {
      const other = a === 9 ? b : a;
      return {
        title: 'Pola perkalian 9',
        lines: [
          `Kalikan dengan 10 lalu kurangi satu kelompok.`,
          `${other} × 10 = ${other * 10}`,
          `${other * 10} − ${other} = ?`
        ]
      };
    }
    if (a === 5 || b === 5) {
      const other = a === 5 ? b : a;
      return {
        title: 'Pola perkalian 5',
        lines: [
          `Setengah dari sepuluh kali lipat.`,
          `${other} × 10 = ${other * 10}, lalu bagi 2.`
        ]
      };
    }
    if (a === 4 || b === 4) {
      const other = a === 4 ? b : a;
      return {
        title: 'Pola perkalian 4',
        lines: [
          `Kalikan 2 dua kali.`,
          `${other} × 2 = ${other * 2}, lalu ${other * 2} × 2 = ?`
        ]
      };
    }
    const near = a - 1;
    return {
      title: 'Fakta terkait',
      lines: [
        `Gunakan fakta yang lebih mudah lalu tambahkan.`,
        `${near} × ${b} = ${near * b}`,
        `${near * b} + ${b} = ?`
      ]
    };
  }

  if (level === 3) {
    const near = a - 1;
    if (a === 9 || b === 9) {
      const other = a === 9 ? b : a;
      return {
        title: 'Langkah penyelesaian',
        lines: [
          `${other} × 10 = ${other * 10}`,
          `${other * 10} − ${other} = ${other * 9}`
        ]
      };
    }
    return {
      title: 'Langkah penyelesaian',
      lines: [
        `${a} × ${b} dapat dipikirkan sebagai:`,
        `${near} × ${b} + ${b}`,
        `${near * b} + ${b} = ${answer}`
      ]
    };
  }

  return {
    title: 'Jawaban',
    lines: [`${a} × ${b} = ${answer}`]
  };
}

function divisionHint(q, level) {
  const a = q.displayA ?? q.operandA;
  const b = q.displayB ?? q.operandB;
  const answer = q.expectedAnswer;

  if (level === 1) {
    return {
      title: 'Petunjuk',
      lines: [`Carilah angka yang jika dikali ${b} menghasilkan ${a}.`]
    };
  }
  if (level === 2) {
    return {
      title: 'Fakta terkait',
      lines: [
        `Pembagian adalah kebalikan perkalian.`,
        `${b} × ? = ${a}`
      ]
    };
  }
  if (level === 3) {
    return {
      title: 'Langkah penyelesaian',
      lines: [
        `${a} ÷ ${b} = ?`,
        `Carilah angka yang jika dikali ${b} menghasilkan ${a}.`,
        `${b} × ${answer} = ${a}`
      ]
    };
  }
  return {
    title: 'Jawaban',
    lines: [
      `${a} ÷ ${b} = ${answer}`,
      `Periksa: ${b} × ${answer} = ${a}`
    ]
  };
}

/** Penjelasan setelah jawaban salah (selalu menampilkan jawaban benar). */
export function explainMistake(question, givenAnswer) {
  const full = getHint(question, 4);
  const strategy = getHint(question, 3);
  const lines = [];

  if (givenAnswer !== null && givenAnswer !== undefined) {
    lines.push(`Jawabanmu: ${givenAnswer}.`);
  }
  lines.push(...full.lines);
  lines.push('');
  lines.push('Strategi:');
  lines.push(...strategy.lines);

  return { title: 'Mari kita lihat bersama', lines };
}

const CORRECT_FEEDBACK = [
  'Tepat sekali!', 'Benar!', 'Bagus!', 'Mantap!', 'Kena!', 'Hebat!'
];

const FAST_FEEDBACK = [
  'Cepat dan tepat!', 'Kilat!', 'Wow, cepat sekali!'
];

const WRONG_FEEDBACK = [
  'Belum tepat, tidak apa-apa.',
  'Hampir! Coba lihat caranya.',
  'Kita pelajari yang ini sebentar.'
];

export function quickFeedback(correct, responseMs = 0) {
  if (!correct) return pickRandom(WRONG_FEEDBACK);
  if (responseMs > 0 && responseMs < 2000) return pickRandom(FAST_FEEDBACK);
  return pickRandom(CORRECT_FEEDBACK);
}