/**
 * Artwork subjects grouped by the rooms in which their content belongs.
 * Selection is stable for a placement seed and independent of other furnishings.
 */
export class PaintingCatalog {
  /**
   * @returns {string[]}
   */
  static get arrivalSubjects() {
    return ["vestibule", "castle-gate", "stone-bridge", "trading-harbor", "hill-windmill",
      "mountain-pass", "vineyard", "forest-road", "river-falls", "coastal-tower"];
  }

  /**
   * @returns {string[]}
   */
  static get bedroomSubjects() {
    return ["royal-bedroom", "sunrise-lake", "apple-orchard", "rose-garden", "water-lilies",
      "fruit-and-jug", "starry-hills", "winter-cottage", "lavender-field", "royal-crown"];
  }

  /**
   * @returns {string[]}
   */
  static get subjects() {
    return [...this.arrivalSubjects, ...this.bedroomSubjects];
  }

  /**
   * Public arrival spaces use travel and estate subjects; private chambers use
   * peaceful landscapes, gardens and royal still lifes.
   * @param {string} context
   * @param {string|number} seed
   * @returns {string}
   */
  static select(context, seed) {
    const subjects = context === "royal-bedroom" ? this.bedroomSubjects : this.arrivalSubjects;
    let hash = 2166136261;
    for (const character of `${context}:${seed}`) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    }

    return subjects[hash % subjects.length];
  }
}
