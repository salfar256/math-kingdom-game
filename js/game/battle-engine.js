/**
 * Mesin pertarungan: HP, damage, combo, dan sesi pemulihan.
 *
 * Prinsip: game mendukung belajar, bukan menghukum.
 * - Siswa tidak langsung kalah karena beberapa kesalahan.
 * - HP habis -> sesi pemulihan berisi soal mudah, lalu lanjut.
 */

import {
  BATTLE_CONFIG, CHARACTER_BONUS, ENEMIES, BOSSES, MODES
} from '../config/game-config.js';
import { clamp, pickRandom } from '../utils/helpers.js';

export class BattleEngine {
  /**
   * @param {object} options { characterId, mode, enemyId, bossId, questionCount }
   */
  constructor(options = {}) {
    const {
      characterId = 'adventurer',
      mode = MODES.BATTLE,
      enemyId = null,
      bossId = null,
      questionCount = 20
    } = options;

    const bonus = CHARACTER_BONUS[characterId] || CHARACTER_BONUS.adventurer;

    this.characterId = characterId;
    this.mode = mode;
    this.bonus = bonus;

    this.playerMaxHp = Math.max(40, BATTLE_CONFIG.playerMaxHp + bonus.hp);
    this.playerHp = this.playerMaxHp;

    this.isBoss = mode === MODES.BOSS || Boolean(bossId);
    this.enemy = this.isBoss
      ? (BOSSES.find((b) => b.id === bossId) || pickRandom(BOSSES))
      : (ENEMIES.find((e) => e.id === enemyId) || pickRandom(ENEMIES));

    const baseHp = this.isBoss ? BATTLE_CONFIG.bossBaseHp : BATTLE_CONFIG.enemyBaseHp;
    // Skala HP musuh agar habis mendekati akhir sesi bila siswa menjawab benar.
    this.enemyMaxHp = Math.max(
      baseHp,
      Math.round(questionCount * BATTLE_CONFIG.baseDamage * 0.85)
    );
    this.enemyHp = this.enemyMaxHp;

    this.combo = 0;
    this.maxCombo = 0;
    this.inRecovery = false;
    this.recoveryRemaining = 0;
    this.defeatedCount = 0;
  }

  /**
   * Proses satu jawaban.
   * @returns {object} ringkasan efek pertarungan
   */
  applyAnswer({ correct, responseMs = 0, isCorrection = false }) {
    const result = {
      damageToEnemy: 0,
      damageToPlayer: 0,
      healed: 0,
      combo: this.combo,
      enemyDefeated: false,
      playerDown: false,
      enteredRecovery: false,
      critical: false
    };

    if (this.inRecovery) {
      return this.applyRecoveryAnswer(correct, result);
    }

    if (correct) {
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      let damage = BATTLE_CONFIG.baseDamage + this.bonus.damage;

      if (responseMs > 0 && responseMs < BATTLE_CONFIG.fastDamageThresholdMs) {
        damage += BATTLE_CONFIG.fastDamageBonus;
        result.critical = true;
      }
      damage += Math.min(this.combo, 10) * BATTLE_CONFIG.comboDamageBonus;

      if (isCorrection) {
        const heal = BATTLE_CONFIG.healOnCorrection + this.bonus.heal;
        const before = this.playerHp;
        this.playerHp = clamp(this.playerHp + heal, 0, this.playerMaxHp);
        result.healed = this.playerHp - before;
      }

      damage = Math.max(1, Math.round(damage));
      this.enemyHp = clamp(this.enemyHp - damage, 0, this.enemyMaxHp);
      result.damageToEnemy = damage;

      if (this.enemyHp <= 0) {
        result.enemyDefeated = true;
        this.defeatedCount += 1;
      }
    } else {
      this.combo = 0;
      const damage = BATTLE_CONFIG.playerDamageOnWrong;
      this.playerHp = clamp(this.playerHp - damage, 0, this.playerMaxHp);
      result.damageToPlayer = damage;

      if (this.playerHp <= 0) {
        this.enterRecovery();
        result.playerDown = true;
        result.enteredRecovery = true;
      }
    }

    result.combo = this.combo;
    return result;
  }

  /** Masuk mode pemulihan: soal mudah, tanpa hukuman. */
  enterRecovery() {
    this.inRecovery = true;
    this.recoveryRemaining = BATTLE_CONFIG.recoveryQuestionCount;
    this.combo = 0;
  }

  applyRecoveryAnswer(correct, result) {
    if (correct) {
      this.recoveryRemaining -= 1;
      const heal = Math.ceil(this.playerMaxHp / BATTLE_CONFIG.recoveryQuestionCount);
      const before = this.playerHp;
      this.playerHp = clamp(this.playerHp + heal, 0, this.playerMaxHp);
      result.healed = this.playerHp - before;
    }
    if (this.recoveryRemaining <= 0) {
      this.inRecovery = false;
      this.playerHp = Math.max(this.playerHp, Math.round(this.playerMaxHp * 0.5));
      result.recoveryComplete = true;
    }
    result.recoveryRemaining = this.recoveryRemaining;
    return result;
  }

  /** Munculkan musuh baru setelah musuh sebelumnya kalah. */
  spawnNextEnemy() {
    if (this.isBoss) return this.enemy;
    this.enemy = pickRandom(ENEMIES);
    this.enemyMaxHp = Math.round(this.enemyMaxHp * 1.1);
    this.enemyHp = this.enemyMaxHp;
    return this.enemy;
  }

  get playerHpPercent() {
    return clamp(this.playerHp / this.playerMaxHp, 0, 1);
  }

  get enemyHpPercent() {
    return clamp(this.enemyHp / this.enemyMaxHp, 0, 1);
  }

  getState() {
    return {
      playerHp: this.playerHp,
      playerMaxHp: this.playerMaxHp,
      enemyHp: this.enemyHp,
      enemyMaxHp: this.enemyMaxHp,
      enemy: this.enemy,
      combo: this.combo,
      maxCombo: this.maxCombo,
      inRecovery: this.inRecovery,
      recoveryRemaining: this.recoveryRemaining,
      defeatedCount: this.defeatedCount,
      isBoss: this.isBoss
    };
  }
}

/**
 * Evaluasi kemenangan boss.
 * Syarat: HP boss habis, akurasi >= 85%, kesalahan tidak melebihi batas.
 */
export function evaluateBossVictory({ enemyHp, accuracy, wrong }, config) {
  const reasons = [];
  if (enemyHp > 0) reasons.push('HP boss belum habis.');
  if (accuracy < config.minAccuracy) {
    reasons.push(`Akurasi minimal ${Math.round(config.minAccuracy * 100)}%.`);
  }
  if (wrong > config.maxWrong) {
    reasons.push(`Kesalahan tidak boleh lebih dari ${config.maxWrong}.`);
  }
  return { victory: reasons.length === 0, reasons };
}