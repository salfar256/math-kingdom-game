/** Skor, XP, level, dan lencana. */

import {
  SCORE_CONFIG, XP_CONFIG, BADGES, MOTIVATION_MESSAGES, CHARACTER_BONUS
} from '../config/game-config.js';
import { pickRandom, clamp } from '../utils/helpers.js';

/**
 * Hitung poin untuk satu jawaban.
 * @returns {{points: number, breakdown: Array<{label: string, value: number}>}}
 */
export function calculatePoints({
  correct,
  responseMs = 0,
  helpLevel = 0,
  isCorrection = false,
  combo = 0,
  characterId = 'adventurer'
}) {
  const breakdown = [];
  if (!correct) return { points: 0, breakdown };

  const S = SCORE_CONFIG;
  let points = S.correct;
  breakdown.push({ label: 'Jawaban benar', value: S.correct });

  if (helpLevel === 0) {
    points += S.noHelpBonus;
    breakdown.push({ label: 'Tanpa bantuan', value: S.noHelpBonus });
  }

  if (helpLevel === 0 && responseMs > 0 && responseMs < S.fastThresholdMs) {
    points += S.fastBonus;
    breakdown.push({ label: 'Cepat', value: S.fastBonus });
  }

  if (isCorrection) {
    points += S.correctionBonus;
    breakdown.push({ label: 'Berhasil memperbaiki', value: S.correctionBonus });
  }

  const comboBonusRate = (CHARACTER_BONUS[characterId] || {}).combo || 0;
  const comboBonus = Math.min(combo, S.comboMax) * (S.comboStep + comboBonusRate);
  if (comboBonus > 0) {
    points += comboBonus;
    breakdown.push({ label: `Combo ×${combo}`, value: comboBonus });
  }

  return { points: Math.round(points), breakdown };
}

/** Bonus akhir sesi. */
export function calculateSessionBonus({ accuracy, completedDaily = false }) {
  const S = SCORE_CONFIG;
  let bonus = 0;
  const breakdown = [];

  if (accuracy >= S.sessionAccuracyThreshold) {
    bonus += S.sessionAccuracyBonus;
    breakdown.push({ label: 'Akurasi tinggi', value: S.sessionAccuracyBonus });
  }
  if (completedDaily) {
    bonus += S.dailyCompleteBonus;
    breakdown.push({ label: 'Target harian selesai', value: S.dailyCompleteBonus });
  }
  return { bonus, breakdown };
}

/** Hitung XP satu sesi. */
export function calculateSessionXp({
  correct = 0,
  corrections = 0,
  newMastered = 0,
  newAutomatic = 0,
  completed = true
}) {
  const X = XP_CONFIG;
  let xp = 0;
  xp += correct * X.perCorrect;
  xp += corrections * X.perCorrection;
  xp += newMastered * X.perNewMastered;
  xp += newAutomatic * X.perNewAutomatic;
  if (completed) xp += X.sessionComplete;
  return Math.round(xp);
}

/** XP kumulatif yang dibutuhkan untuk mencapai sebuah level. */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  let total = 0;
  let need = XP_CONFIG.levelBase;
  for (let i = 2; i <= level; i++) {
    total += Math.round(need);
    need *= XP_CONFIG.levelGrowth;
  }
  return total;
}

/**
 * Hitung level dari total XP.
 * @returns {{level: number, xpIntoLevel: number, xpForNext: number, progress: number}}
 */
export function levelFromXp(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  while (level < 200 && xpForLevel(level + 1) <= xp) level += 1;

  const currentFloor = xpForLevel(level);
  const nextFloor = xpForLevel(level + 1);
  const xpIntoLevel = xp - currentFloor;
  const xpForNext = Math.max(1, nextFloor - currentFloor);

  return {
    level,
    xpIntoLevel,
    xpForNext,
    progress: clamp(xpIntoLevel / xpForNext, 0, 1)
  };
}

/**
 * Tentukan lencana yang baru diperoleh.
 * @param {object} stats { streak, sessionAccuracy, sessionWrong, totalMastered, sessionsCompleted, bossDefeated, speedCorrect, finalTestDone }
 * @param {string[]} owned lencana yang sudah dimiliki
 * @returns {Array<object>} lencana baru
 */
export function checkBadges(stats, owned = []) {
  const ownedSet = new Set(owned);
  const earned = [];

  const award = (id) => {
    if (ownedSet.has(id)) return;
    const badge = BADGES.find((b) => b.id === id);
    if (badge) { earned.push(badge); ownedSet.add(id); }
  };

  if ((stats.sessionsCompleted || 0) >= 1) award('first_session');
  if ((stats.streak || 0) >= 3) award('streak_3');
  if ((stats.streak || 0) >= 7) award('streak_7');
  if ((stats.streak || 0) >= 30) award('streak_30');
  if ((stats.sessionAccuracy || 0) >= 0.9) award('accuracy_90');
  if ((stats.sessionAccuracy || 0) >= 1 && (stats.sessionQuestions || 0) >= 10) {
    award('perfect_session');
  }
  if ((stats.totalMastered || 0) >= 25) award('facts_25');
  if ((stats.totalMastered || 0) >= 100) award('facts_100');
  if ((stats.totalMastered || 0) >= 250) award('facts_250');
  if (stats.bossDefeated) award(`boss_${String(stats.bossDefeated).replace('boss-', '')}`);
  if ((stats.speedCorrect || 0) >= 20) award('speed_demon');
  if (stats.finalTestDone) award('graduate');

  return earned;
}

/** Pesan motivasi berdasarkan hasil sesi. */
export function motivationMessage(accuracy, newMastered = 0) {
  if (accuracy >= 0.9 || newMastered >= 5) return pickRandom(MOTIVATION_MESSAGES.excellent);
  if (accuracy >= 0.7) return pickRandom(MOTIVATION_MESSAGES.good);
  return pickRandom(MOTIVATION_MESSAGES.needsWork);
}