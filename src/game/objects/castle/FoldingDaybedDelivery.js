/**
 * Set the folded daybed down before opening; close it before lifting for pickup.
 */
export class FoldingDaybedDelivery {
  /**
   * @param {number} progress Delivery progress, or reversed pickup progress.
   * @returns {{placement:number,unfold:number}}
   */
  static pose(progress) {
    const clamp = Math.max(0, Math.min(1, progress));
    const placement = Math.min(1, clamp / 0.35);
    const unfold = Math.max(0, (clamp - 0.35) / 0.65);

    return {
      placement: placement * placement * (3 - 2 * placement),
      unfold: unfold * unfold * (3 - 2 * unfold),
    };
  }
}
