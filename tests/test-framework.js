/**
 * Kerangka pengujian minimal tanpa dependensi.
 * Berjalan langsung di peramban maupun di Node.
 */

const suites = [];
let currentSuite = null;

export function describe(name, fn) {
  currentSuite = { name, tests: [] };
  suites.push(currentSuite);
  fn();
  currentSuite = null;
}

export function it(name, fn) {
  if (!currentSuite) throw new Error('it() harus berada di dalam describe()');
  currentSuite.tests.push({ name, fn });
}

class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
  }
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new AssertionError(`Diharapkan ${format(expected)}, tetapi mendapat ${format(actual)}`);
      }
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new AssertionError(`Diharapkan ${b}, tetapi mendapat ${a}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new AssertionError(`Diharapkan nilai benar, mendapat ${format(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new AssertionError(`Diharapkan nilai salah, mendapat ${format(actual)}`);
    },
    toBeNull() {
      if (actual !== null) throw new AssertionError(`Diharapkan null, mendapat ${format(actual)}`);
    },
    toBeGreaterThan(n) {
      if (!(actual > n)) throw new AssertionError(`Diharapkan lebih besar dari ${n}, mendapat ${format(actual)}`);
    },
    toBeGreaterThanOrEqual(n) {
      if (!(actual >= n)) throw new AssertionError(`Diharapkan >= ${n}, mendapat ${format(actual)}`);
    },
    toBeLessThan(n) {
      if (!(actual < n)) throw new AssertionError(`Diharapkan lebih kecil dari ${n}, mendapat ${format(actual)}`);
    },
    toBeLessThanOrEqual(n) {
      if (!(actual <= n)) throw new AssertionError(`Diharapkan <= ${n}, mendapat ${format(actual)}`);
    },
    toContain(item) {
      const ok = Array.isArray(actual)
        ? actual.includes(item)
        : String(actual).includes(String(item));
      if (!ok) throw new AssertionError(`Diharapkan mengandung ${format(item)}`);
    },
    toHaveLength(n) {
      if (!actual || actual.length !== n) {
        throw new AssertionError(`Diharapkan panjang ${n}, mendapat ${actual ? actual.length : 'tidak ada'}`);
      }
    },
    toThrow() {
      let threw = false;
      try { actual(); } catch { threw = true; }
      if (!threw) throw new AssertionError('Diharapkan melempar error, tetapi tidak');
    },
    toBeInstanceOf(cls) {
      if (!(actual instanceof cls)) {
        throw new AssertionError(`Diharapkan instance dari ${cls.name}`);
      }
    }
  };
}

function format(v) {
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'object' && v !== null) {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

/**
 * Jalankan seluruh suite.
 * @param {Function|null} onResult callback per hasil (untuk tampilan HTML)
 */
export async function runAll(onResult = null) {
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const suite of suites) {
    if (onResult) onResult({ type: 'suite', name: suite.name });

    for (const test of suite.tests) {
      try {
        await test.fn();
        passed += 1;
        if (onResult) onResult({ type: 'pass', name: test.name, suite: suite.name });
      } catch (error) {
        failed += 1;
        failures.push({ suite: suite.name, test: test.name, message: error.message });
        if (onResult) {
          onResult({ type: 'fail', name: test.name, suite: suite.name, message: error.message });
        }
      }
    }
  }

  const summary = { passed, failed, total: passed + failed, failures };
  if (onResult) onResult({ type: 'summary', ...summary });
  return summary;
}

export function resetSuites() {
  suites.length = 0;
  currentSuite = null;
}