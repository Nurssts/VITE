/**
 * BIOBUZZ Competition Game Rules Configuration
 * Source: BIOBUZZ Competition Manual TU05
 * Season: 2026-2027
 *
 * All point values and thresholds are from the official game manual.
 * Do not change these values without referencing the manual.
 */

export const gameConfig = {
  season: "2026-2027",
  points: {
    // Autonomous period
    autoLeave: 3,        // Points for leaving the autonomous starting zone
    autoPark: 5,         // Points for parking in the alliance parking zone
    autoHiveTip: 20,     // Points per TIP placed in HIVE during auto

    // Teleop period
    teleopHiveTip: 20,   // Points per TIP placed in HIVE during teleop
    cellItem: 2,         // Points per CELL element placed
    ownedFlowerItem: 2,  // Points per FLOWER item owned at end of match
    bottomNectar: 5,     // Points per bottom NECTAR harvested
    gardenItem: 1,       // Points per GARDEN item placed
    teleopPark: 5,       // Points for parking in the alliance parking zone at end of match

    // Penalties
    penalty: 5,          // Points deducted per penalty
  },
  thresholds: {
    // Profile thresholds for role classification
    autoThreshold: 30,   // Auto score threshold for AUTO_HIVE role
    hiveThreshold: 60,    // Hive score threshold for HIVE specialist
    flowerThreshold: 35,  // Flower score threshold for FLOWER specialist
  },
  synergy: {
    // Synergy weights for pairModel calculation
    coverWeight: 0.42,           // Weight for overall coverage
    hiveFlowerWeight: 0.22,      // Weight for HIVE/FLOWER complementarity
    complementWeight: 0.08,      // Weight for complementary skills
    stabilityWeight: 0.16,      // Weight for consistency/stability
    dataFactorWeight: 14,       // Weight for data completeness
    dnfPenaltyWeight: 18,        // Penalty for DNF reliability
    collisionPenaltyWeight: 0.12, // Penalty for autonomous collision risk
  },
  collision: {
    hitDiv: 220,                 // Collision probability divisor
    hitLossBase: 18,             // Base collision penalty
    hitLossVar: 12,              // Variable collision penalty (0-12)
  },
  monteCarlo: {
    defaultIterations: 1000,     // Default number of simulation runs
    confidenceInterval: 0.95,   // Confidence interval percentage
    seedPrecision: 4294967296,   // Seed precision (2^32)
  },
};

export default gameConfig;
