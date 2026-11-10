/**
 * Backtest script for model calibration
 * Compares predictions against actual match outcomes
 * Usage: node scripts/backtest.js
 */

import { makeSeed, simulate, pairModel, stats } from "../frontend/src/lib/model.js";

function brierScore(predictions, outcomes) {
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    const predicted = predictions[i];
    const actual = outcomes[i];
    sum += (predicted - actual) ** 2;
  }
  return sum / predictions.length;
}

function accuracyRate(predictions, outcomes) {
  let correct = 0;
  for (let i = 0; i < predictions.length; i++) {
    const predicted = predictions[i] >= 0.5 ? 1 : 0;
    const actual = outcomes[i];
    if (predicted === actual) correct++;
  }
  return correct / predictions.length;
}

function runBacktest() {
  console.log("Running backtest...");
  const db = makeSeed();

  // Simple backtest: simulate some matches and compare against themselves
  // In production, this would load real match data from FTCScout/FIRST
  const teams = db.teams.slice(0, 8);
  const predictions = [];
  const outcomes = [];

  for (let i = 0; i < 10; i++) {
    const [a, b, c, d] = teams.map((t) => t.id);
    const result = simulate(db, [a, b, c, d], 1000, { seed: i });
    if (result) {
      predictions.push(result.winPct / 100);
      // For backtest without real data, use the same prediction as "outcome"
      // In production, this would be actual match result (1 for win, 0 for loss)
      outcomes.push(result.winPct / 100);
    }
  }

  const brier = brierScore(predictions, outcomes);
  const accuracy = accuracyRate(predictions, outcomes);

  console.log("\n=== Backtest Results ===");
  console.log(`Simulations: ${predictions.length}`);
  console.log(`Brier Score: ${brier.toFixed(4)} (lower is better, 0 = perfect)`);
  console.log(`Accuracy: ${(accuracy * 100).toFixed(2)}%`);
  console.log("\nNote: This is a placeholder backtest using demo data.");
  console.log("Production backtest would load real match results from FTCScout/FIRST API.");
}

runBacktest();
