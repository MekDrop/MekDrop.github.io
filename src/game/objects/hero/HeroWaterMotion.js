export class HeroWaterMotion {
  static offsetAt(elapsed) {
    // Uneven attempts to lift the mouth clear, followed by longer, deeper dips.
    const breath = Math.sin(elapsed * 3.7);
    const struggle = Math.sin(elapsed * 6.3 + 0.8) * 0.026;
    const dip = Math.max(0, Math.sin(elapsed * 2.15 - 0.6));
    return breath * 0.064 + struggle - dip * dip * 0.085;
  }
}
