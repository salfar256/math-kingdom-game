/** Ekspor data menjadi berkas CSV yang dapat dibuka di Excel/Google Sheets. */

/** Bungkus satu sel CSV dengan aman (mencegah CSV injection). */
function escapeCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);

  // Cegah formula injection di Excel.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  if (/[",\n\r;]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Ubah array objek menjadi teks CSV.
 * @param {Array<object>} rows
 * @param {Array<{key: string, label: string}>} columns
 * @param {string} delimiter default ';' agar cocok dengan Excel lokal Indonesia
 */
export function toCsv(rows, columns, delimiter = ';') {
  const header = columns.map((c) => escapeCell(c.label)).join(delimiter);
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(delimiter)
  );
  return [header, ...body].join('\r\n');
}

/** Unduh teks CSV sebagai berkas. */
export function downloadCsv(filename, csvText) {
  // BOM agar Excel membaca UTF-8 dengan benar.
  const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

/** Kolom laporan kelas. */
export const CLASS_REPORT_COLUMNS = [
  { key: 'displayName',       label: 'Nama Siswa' },
  { key: 'level',             label: 'Level' },
  { key: 'xp',                label: 'XP' },
  { key: 'streak',            label: 'Streak (hari)' },
  { key: 'daysActive',        label: 'Hari Aktif' },
  { key: 'totalQuestions',    label: 'Total Soal' },
  { key: 'accuracyPercent',   label: 'Akurasi (%)' },
  { key: 'factsMastered',     label: 'Fakta Dikuasai' },
  { key: 'lastPracticeText',  label: 'Terakhir Latihan' }
];

/** Bangun & unduh laporan kelas. */
export function exportClassReport(className, students) {
  const csv = toCsv(students, CLASS_REPORT_COLUMNS);
  const safeName = String(className || 'kelas').replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || 'kelas';
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`laporan-${safeName}-${stamp}.csv`, csv);
}