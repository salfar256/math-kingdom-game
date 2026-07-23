/** Uji mesin pertarungan — sistem hati. */
import { describe, it, expect } from './test-framework.js';
import { BattleEngine, evaluateBossVictory } from '../js/game/battle-engine.js';
import { MODES, BATTLE_CONFIG } from '../js/config/game-config.js';

describe('BattleEngine — hati awal', () => {
  it('pemain mulai dengan 3 hati penuh', () => {
    const b = new BattleEngine({ mode: MODES.BATTLE });
    expect(b.playerHp).toBe(BATTLE_CONFIG.playerHearts);
    expect(b.playerMaxHp).toBe(3);
  });

  it('musuh biasa punya 5 hati', () => {
    const b = new BattleEngine({ mode: MODES.BATTLE });
    expect(b.enemyMaxHp).toBe(BATTLE_CONFIG.enemyHearts);
  });

  it('boss punya 15 hati', () => {
    const b = new BattleEngine({ mode: MODES.BOSS });
    expect(b.enemyMaxHp).toBe(BATTLE_CONFIG.bossHearts);
    expect(b.isBoss).toBeTruthy();
  });
});

describe('BattleEngine — damage 1 hati', () => {
  it('jawaban benar mengurangi 1 hati musuh', () => {
    const b = new BattleEngine({ mode: MODES.BATTLE });
    const r = b.applyAnswer({ correct: true, responseMs: 3000 });
    expect(r.damageToEnemy).toBe(1);
    expect(b.enemyHp).toBe(BATTLE_CONFIG.enemyHearts - 1);
  });

  it('jawaban salah mengurangi 1 hati pemain', () => {
    const b = new BattleEngine({ mode: MODES.BATTLE });
    const r = b.applyAnswer({ correct: false });
    expect(r.damageToPlayer).toBe(1);
    expect(b.playerHp).toBe(BATTLE_CONFIG.playerHearts - 1);
  });

  it('3 kesalahan = pemain tumbang, pertarungan selesai', () => {
    const b = new BattleEngine({ mode: MODES.BATTLE });
    b.applyAnswer({ correct: false });
    b.applyAnswer({ correct: false });
    const r = b.applyAnswer({ correct: false });
    expect(r.playerDown).toBeTruthy();
    expect(b.isOver).toBeTruthy();
    expect(b.isVictory).toBeFalsy();
  });
});

describe('BattleEngine — alur kemenangan', () => {
  it('5 jawaban benar mengalahkan 1 musuh', () => {
    const b = new BattleEngine({ mode: MODES.BATTLE });
    let last;
    for (let i = 0; i < BATTLE_CONFIG.enemyHearts; i++) {
      last = b.applyAnswer({ correct: true, responseMs: 3000 });
    }
    expect(last.enemyDefeated).toBeTruthy();
    expect(b.defeatedCount).toBe(1);
    expect(b.isOver).toBeFalsy();
  });

  it('mengalahkan 2 musuh = menang', () => {
    const b = new BattleEngine({ mode: MODES.BATTLE });
    let last;
    for (let e = 0; e < BATTLE_CONFIG.enemiesPerBattle; e++) {
      for (let i = 0; i < BATTLE_CONFIG.enemyHearts; i++) {
        last = b.applyAnswer({ correct: true, responseMs: 3000 });
      }
      if (e < BATTLE_CONFIG.enemiesPerBattle - 1) b.spawnNextEnemy();
    }
    expect(last.battleWon).toBeTruthy();
    expect(b.isVictory).toBeTruthy();
    expect(b.isOver).toBeTruthy();
  });

  it('spawnNextEnemy memunculkan musuh baru 5 hati', () => {
    const b = new BattleEngine({ mode: MODES.BATTLE });
    for (let i = 0; i < BATTLE_CONFIG.enemyHearts; i++) b.applyAnswer({ correct: true });
    b.spawnNextEnemy();
    expect(b.enemyHp).toBe(BATTLE_CONFIG.enemyHearts);
  });

  it('boss kalah setelah 15 jawaban benar', () => {
    const b = new BattleEngine({ mode: MODES.BOSS });
    let last;
    for (let i = 0; i < BATTLE_CONFIG.bossHearts; i++) {
      last = b.applyAnswer({ correct: true, responseMs: 3000 });
    }
    expect(last.enemyDefeated).toBeTruthy();
    expect(last.battleWon).toBeTruthy();
  });
});

describe('BattleEngine — combo', () => {
  it('combo bertambah saat benar, nol saat salah', () => {
    const b = new BattleEngine({ mode: MODES.BATTLE });
    b.applyAnswer({ correct: true });
    b.applyAnswer({ correct: true });
    expect(b.combo).toBe(2);
    b.applyAnswer({ correct: false });
    expect(b.combo).toBe(0);
    expect(b.maxCombo).toBe(2);
  });

  it('jawaban cepat menandai critical', () => {
    const b = new BattleEngine({ mode: MODES.BATTLE });
    const r = b.applyAnswer({ correct: true, responseMs: 1500 });
    expect(r.critical).toBeTruthy();
  });
});

describe('evaluateBossVictory', () => {
  it('menang bila hati boss habis dan pemain masih hidup', () => {
    const r = evaluateBossVictory({ enemyHp: 0, playerHp: 2 });
    expect(r.victory).toBeTruthy();
  });

  it('kalah bila hati boss masih ada', () => {
    const r = evaluateBossVictory({ enemyHp: 3, playerHp: 2 });
    expect(r.victory).toBeFalsy();
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('kalah bila hati pemain habis', () => {
    const r = evaluateBossVictory({ enemyHp: 0, playerHp: 0 });
    expect(r.victory).toBeFalsy();
  });
});
