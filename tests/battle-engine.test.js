/** Pengujian mesin pertarungan. */

import { describe, it, expect } from './test-framework.js';
import { BattleEngine, evaluateBossVictory } from '../js/game/battle-engine.js';
import { MODES, BATTLE_CONFIG, BOSS_CONFIG } from '../js/config/game-config.js';

describe('BattleEngine', () => {
  it('memulai dengan HP penuh', () => {
    const b = new BattleEngine({ characterId: 'adventurer', questionCount: 20 });
    expect(b.playerHp).toBe(b.playerMaxHp);
    expect(b.enemyHp).toBe(b.enemyMaxHp);
  });

  it('memberi HP lebih besar kepada Ksatria', () => {
    const ksatria = new BattleEngine({ characterId: 'knight', questionCount: 20 });
    const petualang = new BattleEngine({ characterId: 'adventurer', questionCount: 20 });
    expect(ksatria.playerMaxHp).toBeGreaterThan(petualang.playerMaxHp);
  });

  it('mengurangi HP musuh saat jawaban benar', () => {
    const b = new BattleEngine({ questionCount: 20 });
    const before = b.enemyHp;
    const result = b.applyAnswer({ correct: true, responseMs: 4000 });
    expect(b.enemyHp).toBeLessThan(before);
    expect(result.damageToEnemy).toBeGreaterThan(0);
  });

  it('memberi damage lebih besar untuk jawaban cepat', () => {
    const cepat = new BattleEngine({ questionCount: 20 });
    const lambat = new BattleEngine({ questionCount: 20 });

    const rCepat = cepat.applyAnswer({ correct: true, responseMs: 1200 });
    const rLambat = lambat.applyAnswer({ correct: true, responseMs: 6000 });

    expect(rCepat.damageToEnemy).toBeGreaterThan(rLambat.damageToEnemy);
    expect(rCepat.critical).toBeTruthy();
  });

  it('menambah damage seiring combo', () => {
    const b = new BattleEngine({ questionCount: 40 });
    const r1 = b.applyAnswer({ correct: true, responseMs: 5000 });
    for (let i = 0; i < 5; i++) b.applyAnswer({ correct: true, responseMs: 5000 });
    const r7 = b.applyAnswer({ correct: true, responseMs: 5000 });
    expect(r7.damageToEnemy).toBeGreaterThan(r1.damageToEnemy);
  });

  it('mengurangi HP pemain saat jawaban salah', () => {
    const b = new BattleEngine({ questionCount: 20 });
    const before = b.playerHp;
    b.applyAnswer({ correct: false, responseMs: 3000 });
    expect(b.playerHp).toBe(before - BATTLE_CONFIG.playerDamageOnWrong);
  });

  it('mereset combo saat jawaban salah', () => {
    const b = new BattleEngine({ questionCount: 20 });
    b.applyAnswer({ correct: true, responseMs: 2000 });
    b.applyAnswer({ correct: true, responseMs: 2000 });
    expect(b.combo).toBe(2);
    b.applyAnswer({ correct: false, responseMs: 3000 });
    expect(b.combo).toBe(0);
  });

  it('memulihkan HP saat siswa berhasil memperbaiki jawaban', () => {
    const b = new BattleEngine({ questionCount: 20 });
    b.applyAnswer({ correct: false, responseMs: 3000 });
    const hpSetelahSalah = b.playerHp;
    const result = b.applyAnswer({ correct: true, responseMs: 3000, isCorrection: true });
    expect(result.healed).toBeGreaterThan(0);
    expect(b.playerHp).toBeGreaterThan(hpSetelahSalah);
  });

  it('TIDAK membuat siswa langsung kalah setelah beberapa kesalahan', () => {
    const b = new BattleEngine({ questionCount: 20 });
    for (let i = 0; i < 5; i++) {
      const r = b.applyAnswer({ correct: false, responseMs: 3000 });
      expect(r.playerDown).toBeFalsy();
    }
    expect(b.playerHp).toBeGreaterThan(0);
  });

  it('masuk sesi pemulihan saat HP habis, bukan game over', () => {
    const b = new BattleEngine({ questionCount: 20 });
    let entered = false;
    for (let i = 0; i < 30 && !entered; i++) {
      const r = b.applyAnswer({ correct: false, responseMs: 3000 });
      if (r.enteredRecovery) entered = true;
    }
    expect(entered).toBeTruthy();
    expect(b.inRecovery).toBeTruthy();
    expect(b.recoveryRemaining).toBe(BATTLE_CONFIG.recoveryQuestionCount);
  });

  it('mengembalikan siswa ke pertarungan setelah pemulihan selesai', () => {
    const b = new BattleEngine({ questionCount: 20 });
    while (!b.inRecovery) b.applyAnswer({ correct: false, responseMs: 3000 });

    for (let i = 0; i < BATTLE_CONFIG.recoveryQuestionCount; i++) {
      b.applyAnswer({ correct: true, responseMs: 3000 });
    }

    expect(b.inRecovery).toBeFalsy();
    expect(b.playerHp).toBeGreaterThan(0);
  });

  it('menandai musuh kalah saat HP habis', () => {
    const b = new BattleEngine({ questionCount: 5 });
    let defeated = false;
    for (let i = 0; i < 50 && !defeated; i++) {
      const r = b.applyAnswer({ correct: true, responseMs: 1000 });
      if (r.enemyDefeated) defeated = true;
    }
    expect(defeated).toBeTruthy();
    expect(b.enemyHp).toBe(0);
  });

  it('memberi boss HP lebih besar daripada musuh biasa', () => {
    const boss = new BattleEngine({ mode: MODES.BOSS, bossId: 'boss-7', questionCount: 25 });
    const biasa = new BattleEngine({ mode: MODES.BATTLE, questionCount: 25 });
    expect(boss.enemyMaxHp).toBeGreaterThanOrEqual(biasa.enemyMaxHp);
    expect(boss.isBoss).toBeTruthy();
  });

  it('tidak mengganti boss dengan musuh lain', () => {
    const b = new BattleEngine({ mode: MODES.BOSS, bossId: 'boss-9', questionCount: 25 });
    const bossAwal = b.enemy.id;
    b.spawnNextEnemy();
    expect(b.enemy.id).toBe(bossAwal);
  });

  it('tidak pernah membuat HP negatif', () => {
    const b = new BattleEngine({ questionCount: 20 });
    for (let i = 0; i < 100; i++) {
      b.applyAnswer({ correct: false, responseMs: 3000 });
      expect(b.playerHp).toBeGreaterThanOrEqual(0);
      b.applyAnswer({ correct: true, responseMs: 1000 });
      expect(b.enemyHp).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('evaluateBossVictory', () => {
  it('menang bila semua syarat terpenuhi', () => {
    const r = evaluateBossVictory({ enemyHp: 0, accuracy: 0.9, wrong: 2 }, BOSS_CONFIG);
    expect(r.victory).toBeTruthy();
    expect(r.reasons).toHaveLength(0);
  });

  it('kalah bila HP boss belum habis', () => {
    const r = evaluateBossVictory({ enemyHp: 20, accuracy: 0.95, wrong: 1 }, BOSS_CONFIG);
    expect(r.victory).toBeFalsy();
  });

  it('kalah bila akurasi di bawah 85%', () => {
    const r = evaluateBossVictory({ enemyHp: 0, accuracy: 0.7, wrong: 3 }, BOSS_CONFIG);
    expect(r.victory).toBeFalsy();
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('kalah bila kesalahan melebihi batas', () => {
    const r = evaluateBossVictory(
      { enemyHp: 0, accuracy: 0.9, wrong: BOSS_CONFIG.maxWrong + 1 }, BOSS_CONFIG
    );
    expect(r.victory).toBeFalsy();
  });

  it('memberi alasan dalam bahasa Indonesia', () => {
    const r = evaluateBossVictory({ enemyHp: 10, accuracy: 0.5, wrong: 10 }, BOSS_CONFIG);
    expect(r.reasons.length).toBe(3);
    for (const reason of r.reasons) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(5);
    }
  });
});