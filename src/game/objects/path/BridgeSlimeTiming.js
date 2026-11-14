/**
 * Time for a contributor to flow into its complete, load-bearing shape.
 */
export const SLIME_BRIDGE_GROWTH_SECONDS = 3.6;

/**
 * Shared visual volume transfer. The donor retains its complementary share
 * until the full native admission interval has elapsed.
 * @param {number} age
 * @returns {number}
 */
export function slimeBridgeTransferProgress(age) {
  const progress = Math.max(0, Math.min(1, age / SLIME_BRIDGE_GROWTH_SECONDS));

  return progress * progress * (3 - 2 * progress);
}
