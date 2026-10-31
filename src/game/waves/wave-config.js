/**
 * Host-owned prices and pacing; controller requests never supply prices or rewards.
 */
export const WAVE_CONFIG = {
  initialCoins: 5000,
  killReward: 50,
  breakReward: 10,
  maxActive: 12,
  maxQueued: 12,
  waveSize: 3,
  waveInterval: 20,
  firstWaveDelay: 5,
  offers: [{
    creature: "LatchSlug",
    cost: 15,
    spawnSeconds: 3,
  }],
};
