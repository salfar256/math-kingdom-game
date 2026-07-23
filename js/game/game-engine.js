/**
 * Mesin utama: menjembatani data siswa, sesi, dan progres kerajaan.
 * Tidak menyentuh DOM sama sekali (agar mudah diuji).
 */

import {
  MODES, SESSION_CONFIG, KINGDOMS, KINGDOM_PROGRESS, BOSS_CONFIG,
  OPERATION_LIST, MASTERY_STATUS, THIRTY_DAY_PLAN, MIXED_TOWER
} from '../config/game-config.js';
import { SessionManager, buildMasterySummary } from './session-manager.js';
import { getAllFactsFor } from './question-generator.js';
import { isMastered, isWeak, factAccuracy } from './mastery-engine.js';
import { recommendPractice } from './adaptive-engine.js';
import { levelFromXp, checkBadges, motivationMessage } from './reward-engine.js';
import { loadAllFacts, getStudentProfile, upsertStudentProfile, updateClassRoster, getRecentSessions }
  from '../firebase/firestore-service.js';
import { calculateStreak, dayKey, toMillis, daysBetween } from '../utils/date-utils.js';
import { clamp, percent } from '../utils/helpers.js';
import { devLog } from '../firebase/firebase-app.js';

export class GameEngine {
  constructor(uid) {
    this.uid = uid;
    this.profile = null;
    this.factMap = new Map();
    this.classSettings = null;
    this.classId = '';
    this.session = null;
    this.loaded = false;
  }

  /** Muat profil & seluruh fakta. Dipanggil sekali saat halaman game dibuka. */
  async load() {
    const [profile, facts] = await Promise.all([
      getStudentProfile(this.uid),
      loadAllFacts(this.uid)
    ]);

    this.profile = profile || {
      displayName: 'Petualang',
      characterId: 'adventurer',
      activeClassId: '',
      level: 1, xp: 0, streak: 0,
      totalQuestions: 0, totalCorrect: 0, daysActive: 0,
      placementDone: false
    };
    this.factMap = facts;
    this.classId = this.profile.activeClassId || '';
    this.loaded = true;

    devLog(`GameEngine siap. ${this.factMap.size} fakta dimuat.`);
    return this.profile;
  }

  setClassSettings(settings) {
    this.classSettings = settings || null;
  }

  get enabledOperations() {
    const list = this.classSettings && Array.isArray(this.classSettings.enabledOperations)
      ? this.classSettings.enabledOperations.filter((op) => OPERATION_LIST.includes(op))
      : OPERATION_LIST;
    return list.length > 0 ? list : OPERATION_LIST;
  }

  get speedDurationMs() {
    const v = this.classSettings && Number(this.classSettings.speedDurationMs);
    return SESSION_CONFIG.speedDurationsMs.includes(v) ? v : SESSION_CONFIG.defaultSpeedMs;
  }

  get needsPlacement() {
    // Tes Awal dihapus dari alur game -- selalu false.
    return false;
  }

  /* ============ PROGRES KERAJAAN ============ */

  /**
   * Progres sebuah kerajaan.
   * @returns {{operation, total, mastered, percent, status, weakCount, bossUnlocked}}
   */
  getKingdomProgress(operation) {
    const allFacts = getAllFactsFor(operation);
    const total = allFacts.length;
    let mastered = 0;
    let weakCount = 0;
    let attempts = 0;
    let correct = 0;

    let practiced = 0;
    for (const base of allFacts) {
      const record = this.factMap.get(base.factId);
      if (!record) { weakCount += 1; continue; }
      if (isMastered(record)) mastered += 1;
      else if ((record.totalAttempts || 0) > 0) practiced += 1;
      if (!isMastered(record) && isWeak({ ...record, id: base.factId })) weakCount += 1;
      attempts += record.totalAttempts || 0;
      correct += record.correctAttempts || 0;
    }

    // Persentase responsif: fakta dikuasai bernilai penuh, fakta yang sudah
    // pernah dilatih bernilai 40% -- setiap pertarungan langsung menaikkan bar.
    const ratio = total > 0 ? (mastered + practiced * 0.4) / total : 0;
    return {
      operation,
      total,
      mastered,
      percent: Math.round(ratio * 100),
      ratio,
      weakCount,
      accuracy: attempts > 0 ? correct / attempts : 0,
      status: this.#kingdomStatus(operation, ratio),
      bossUnlocked: ratio >= BOSS_CONFIG.unlockMasteryPercent
    };
  }

  #kingdomStatus(operation, ratio) {
    if (!this.#isKingdomUnlocked(operation)) {
      const k = KINGDOMS.find((x) => x.id === operation);
      return `Terbuka di Level ${(k && k.requiredLevel) || 1}`;
    }
    if (ratio >= KINGDOM_PROGRESS.expertAt) return 'mahir';
    if (ratio >= KINGDOM_PROGRESS.masteredAt) return 'dikuasai';
    if (ratio >= KINGDOM_PROGRESS.learningAt) return 'sedang dipelajari';
    return 'terbuka';
  }

  /** Level pemain saat ini (dari XP profil). */
  get playerLevel() {
    return levelFromXp(this.profile ? this.profile.xp || 0 : 0).level;
  }

  /**
   * Kerajaan terbuka berdasarkan LEVEL pemain (requiredLevel di game-config).
   * Naik level lewat XP dari pertarungan mana pun membuka kerajaan berikutnya.
   */
  #isKingdomUnlocked(operation) {
    if (!this.enabledOperations.includes(operation)) return false;
    const k = KINGDOMS.find((x) => x.id === operation);
    const need = (k && k.requiredLevel) || 1;
    return this.playerLevel >= need;
  }

  /** Semua progres kerajaan + menara. */
  getAllProgress() {
    const kingdoms = KINGDOMS
      .filter((k) => this.enabledOperations.includes(k.id))
      .map((k) => ({ ...k, ...this.getKingdomProgress(k.id) }));

    const towerOpen = this.playerLevel >= (MIXED_TOWER.requiredLevel || 10);

    const towerRatio = kingdoms.length > 0
      ? kingdoms.reduce((sum, k) => sum + k.ratio, 0) / kingdoms.length
      : 0;

    return {
      kingdoms,
      tower: {
        ...MIXED_TOWER,
        unlocked: towerOpen,
        percent: Math.round(towerRatio * 100),
        ratio: towerRatio,
        status: towerOpen ? 'terbuka' : `Terbuka di Level ${MIXED_TOWER.requiredLevel || 10}`
      }
    };
  }

  /** Ringkasan penguasaan seluruh fakta. */
  getMasterySummary() {
    return buildMasterySummary(this.factMap);
  }

  /** Rekomendasi latihan berikutnya. */
  getRecommendations() {
    return recommendPractice(this.factMap);
  }

  /** Hari ke berapa dalam program 30 hari. */
  getProgramDay() {
    const created = toMillis(this.profile && this.profile.createdAt);
    if (!created) return 1;
    return clamp(daysBetween(created, new Date()) + 1, 1, 30);
  }

  getTodayPlan() {
    const day = this.getProgramDay();
    return THIRTY_DAY_PLAN.find((p) => p.day === day) || THIRTY_DAY_PLAN[THIRTY_DAY_PLAN.length - 1];
  }

  /* ============ SESI ============ */

  /**
   * Mulai sesi baru.
   * @param {object} options { mode, operation, targets, bossId }
   */
  startSession(options = {}) {
    const {
      mode = MODES.PRACTICE,
      operation = null,
      targets = null
    } = options;

    let operations;
    if (mode === MODES.MIXED || mode === MODES.PLACEMENT) {
      operations = this.enabledOperations;
    } else if (operation) {
      operations = [operation];
    } else {
      operations = this.enabledOperations;
    }

    const count = this.#questionCountFor(mode);

    this.session = new SessionManager({
      uid: this.uid,
      classId: this.classId,
      factMap: this.factMap,
      mode,
      operations,
      questionCount: count,
      targets,
      characterId: this.profile.characterId || 'adventurer',
      durationMs: mode === MODES.SPEED ? this.speedDurationMs : null
    });

    return this.session;
  }

  #questionCountFor(mode) {
    switch (mode) {
      case MODES.PLACEMENT: return SESSION_CONFIG.placementQuestions;
      case MODES.BOSS:      return SESSION_CONFIG.bossQuestions;
      case MODES.MIXED:     return SESSION_CONFIG.mixedQuestions;
      case MODES.BATTLE:    return SESSION_CONFIG.battleQuestions;
      case MODES.SPEED:     return 200; // dibatasi oleh waktu, bukan jumlah
      default:              return SESSION_CONFIG.practiceQuestions;
    }
  }

  /**
   * Selesaikan sesi: simpan ke Firestore, perbarui profil, hitung lencana.
   * @returns {Promise<object>} ringkasan lengkap untuk halaman hasil
   */
  async finishSession({ bossId = null, enemyHp = null } = {}) {
    if (!this.session) return null;

    const dailyTarget = (this.classSettings && this.classSettings.dailyTargetQuestions) || 40;
    const completedDaily = this.session.stats.total >= Math.min(dailyTarget, 20);
    const summary = this.session.buildSummary({ completedDaily });

    // Boss.
    let bossResult = null;
    if (this.session.mode === MODES.BOSS && enemyHp !== null) {
      bossResult = this.session.evaluateBoss(enemyHp);
    }

    // Simpan sesi + fakta.
    const persistResult = await this.session.persist(summary);

    // Perbarui profil siswa.
    const profileUpdate = await this.#updateProfileAfterSession(summary, bossResult);

    // Lencana.
    const mastery = this.getMasterySummary();
    const ownedBadges = Array.isArray(this.profile.badges) ? this.profile.badges : [];
    const newBadges = checkBadges({
      streak: profileUpdate.streak,
      sessionAccuracy: summary.accuracyRatio,
      sessionQuestions: summary.totalQuestions,
      sessionsCompleted: (this.profile.sessionsCompleted || 0) + 1,
      totalMastered: mastery.totalMastered,
      bossDefeated: bossResult && bossResult.victory ? bossId : null,
      speedCorrect: this.session.mode === MODES.SPEED ? summary.correct : 0,
      finalTestDone: false
    }, ownedBadges);

    if (newBadges.length > 0) {
      this.profile.badges = [...ownedBadges, ...newBadges.map((b) => b.id)];
      await upsertStudentProfile(this.uid, { badges: this.profile.badges })
        .catch(() => { /* tidak fatal */ });
    }

    const result = {
      ...summary,
      ...profileUpdate,
      bossResult,
      newBadges,
      mastery,
      recommendations: this.getRecommendations().slice(0, 3),
      motivation: motivationMessage(summary.accuracyRatio, summary.factsMastered),
      persistResult
    };

    this.session = null;
    return result;
  }

  async #updateProfileAfterSession(summary, bossResult) {
    const now = new Date();
    const p = this.profile;

    const newXp = (p.xp || 0) + summary.xpEarned;
    const levelInfo = levelFromXp(newXp);
    const previousLevel = levelFromXp(p.xp || 0).level;

    const streak = calculateStreak(p.lastPracticeAt, p.streak || 0, now);
    const todayKey = dayKey(now);
    const practiceDays = Array.isArray(p.practiceDays) ? p.practiceDays.slice(-90) : [];
    if (!practiceDays.includes(todayKey)) practiceDays.push(todayKey);

    const totalQuestions = (p.totalQuestions || 0) + summary.totalQuestions;
    const totalCorrect = (p.totalCorrect || 0) + summary.correct;
    const mastery = this.getMasterySummary();

    const patch = {
      xp: newXp,
      level: levelInfo.level,
      streak,
      lastPracticeAt: now,
      totalQuestions,
      totalCorrect,
      daysActive: practiceDays.length,
      practiceDays,
      sessionsCompleted: (p.sessionsCompleted || 0) + 1
    };

    if (summary.mode === MODES.PLACEMENT || this.needsPlacement) {
      patch.placementDone = true;
      patch.placementResult = {
        accuracy: summary.accuracy,
        correct: summary.correct,
        wrong: summary.wrong,
        skipped: summary.skipped,
        averageResponseMs: summary.averageResponseMs,
        takenAt: now
      };
    }

    if (bossResult && bossResult.victory) {
      const defeated = Array.isArray(p.bossesDefeated) ? p.bossesDefeated : [];
      patch.bossesDefeated = defeated;
    }

    Object.assign(this.profile, patch);

    // Simpan profil & roster (roster dipakai dashboard guru + leaderboard).
    const accuracyPercent = percent(totalCorrect, totalQuestions, 1);

    try {
      await upsertStudentProfile(this.uid, patch);
      if (this.classId) {
        await updateClassRoster(this.classId, this.uid, {
          displayName: p.displayName,
          characterId: p.characterId,
          active: true,
          level: levelInfo.level,
          xp: newXp,
          streak,
          lastPracticeAt: now,
          accuracy: accuracyPercent,
          factsMastered: mastery.totalMastered,
          totalQuestions,
          daysActive: practiceDays.length,
          hideFromLeaderboard: Boolean(p.hideFromLeaderboard)
        });
      }
    } catch (e) {
      devLog('Gagal memperbarui profil/roster:', e);
    }

    return {
      xp: newXp,
      level: levelInfo.level,
      levelUp: levelInfo.level > previousLevel,
      levelInfo,
      streak,
      totalQuestions,
      totalCorrect,
      accuracyOverall: accuracyPercent,
      daysActive: practiceDays.length
    };
  }

  /** Riwayat sesi untuk halaman profil. */
  async getHistory(n = 30) {
    try {
      return await getRecentSessions(this.uid, n);
    } catch {
      return [];
    }
  }

  /** Perbandingan tes awal vs kondisi sekarang. */
  getPlacementComparison() {
    const initial = this.profile && this.profile.placementResult;
    if (!initial) return null;

    const totalQ = this.profile.totalQuestions || 0;
    const totalC = this.profile.totalCorrect || 0;
    const currentAccuracy = totalQ > 0 ? percent(totalC, totalQ, 1) : 0;
    const mastery = this.getMasterySummary();

    return {
      initialAccuracy: initial.accuracy || 0,
      currentAccuracy,
      accuracyDelta: Math.round((currentAccuracy - (initial.accuracy || 0)) * 10) / 10,
      initialAvgMs: initial.averageResponseMs || 0,
      factsMastered: mastery.totalMastered,
      takenAt: initial.takenAt || null
    };
  }
}