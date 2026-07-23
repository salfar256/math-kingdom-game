/**
 * Mesin pertarungan — SISTEM HATI.
 *
 * - Pemain 3 hati, musuh 5 hati, boss 15 hati.
 * - Setiap damage mengurangi tepat 1 hati.
 * - Jawaban benar: musuh -1 hati. Salah / kehabisan waktu: pemain -1 hati.
 * - Pertarungan biasa selesai setelah 2 musuh dikalahkan (menang)
 *   atau hati pemain habis (kalah). Boss: 1 boss dengan 15 hati.
 */

import {
  BATTLE_CONFIG, ENEMIES, BOSSES, MODES
} from '../config/game-config.js';
import { clamp, pickRandom } from '../utils/helpers.js';

export class BattleEngine {
  /** @param {object} options { characterId, mode, enemyId, bossId } */
  constructor(options = {}) {
    const { characterId = 'adventurer', mode = MODES.BATTLE, enemyId = null, bossId = null } = options;

    this.characterId = characterId;
    this.mode = mode;

    this.playerMaxHp = BATTLE_CONFIG.playerHearts;
    this.playerHp = this.playerMaxHp;

    this.isBoss = mode === MODES.BOSS || Boolean(bossId);
    this.enemy = this.isBoss
      ? (BOSSES.find((b) => b.id === bossId) || pickRandom(BOSSES))
      : (ENEMIES.find((e) => e.id === enemyId) || pickRandom(ENEMIES));

    this.enemyMaxHp = this.isBoss ? BATTLE_CONFIG.bossHearts : BATTLE_CONFIG.enemyHearts;
    this.enemyHp = this.enemyMaxHp;

    this.enemiesToDefeat = this.isBoss ? 1 : BATTLE_CONFIG.enemiesPerBattle;
    this.defeatedCount = 0;

    this.combo = 0;
    this.maxCombo = 0;
  }

  /**
   * Proses satu jawaban (atau kehabisan waktu: correct=false).
   * @returns {object} efek pertarungan
   */
  applyAnswer({ correct, responseMs = 0 }) {
    const result = {
      damageToEnemy: 0,
      damageToPlayer: 0,
      combo: this.combo,
      enemyDefeated: false,
      playerDown: false,
      battleWon: false,
      critical: false
    };

    if (correct) {
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (responseMs > 0 && responseMs < BATTLE_CONFIG.fastDamageThresholdMs) {
        result.critical = true;
      }

      this.enemyHp = clamp(this.enemyHp - 1, 0, this.enemyMaxHp);
      result.damageToEnemy = 1;

      if (this.enemyHp <= 0) {
        result.enemyDefeated = true;
        this.defeatedCount += 1;
        if (this.defeatedCount >= this.enemiesToDefeat) result.battleWon = true;
      }
    } else {
      this.combo = 0;
      this.playerHp = clamp(this.playerHp - 1, 0, this.playerMaxHp);
      result.damageToPlayer = 1;
      if (this.playerHp <= 0) result.playerDown = true;
    }

    result.combo = this.combo;
    return result;
  }

  /** Munculkan musuh berikutnya (pertarungan biasa). */
  spawnNextEnemy() {
    if (this.isBoss) return this.enemy;
    const others = ENEMIES.filter((e) => e.id !== this.enemy.id);
    this.enemy = pickRandom(others.length ? others : ENEMIES);
    this.enemyMaxHp = BATTLE_CONFIG.enemyHearts;
    this.enemyHp = this.enemyMaxHp;
    return this.enemy;
  }

  /** Pertarungan sudah selesai? */
  get isOver() {
    return this.playerHp <= 0 || this.defeatedCount >= this.enemiesToDefeat;
  }

  get isVictory() {
    return this.defeatedCount >= this.enemiesToDefeat && this.playerHp > 0;
  }

  get playerHpPercent() { return clamp(this.playerHp / this.playerMaxHp, 0, 1); }
  get enemyHpPercent()  { return clamp(this.enemyHp / this.enemyMaxHp, 0, 1); }

  getState() {
    return {
      playerHp: this.playerHp,
      playerMaxHp: this.playerMaxHp,
      enemyHp: this.enemyHp,
      enemyMaxHp: this.enemyMaxHp,
      enemy: this.enemy,
      combo: this.combo,
      maxCombo: this.maxCombo,
      defeatedCount: this.defeatedCount,
      enemiesToDefeat: this.enemiesToDefeat,
      isBoss: this.isBoss,
      isOver: this.isOver,
      isVictory: this.isVictory
    };
  }
}

/** Kemenangan boss: cukup kalahkan boss (hati pemain masih tersisa). */
export function evaluateBossVictory({ enemyHp, playerHp = 1 }) {
  const reasons = [];
  if (enemyHp > 0) reasons.push('Hati boss belum habis.');
  if (playerHp <= 0) reasons.push('Hatimu habis lebih dulu.');
  return { victory: reasons.length === 0, reasons };
}
