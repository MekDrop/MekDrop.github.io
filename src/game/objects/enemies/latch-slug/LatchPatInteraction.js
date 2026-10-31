/**
 * Normal nearby E interaction; clicks use the same pat entry point.
 */
export class LatchPatInteraction {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} slug
   * @param {()=>void} onComplete
   */
  constructor(slug, onComplete) {
    this.slug = slug;
    this.onComplete = onComplete;
  }

  /**
   * @returns {boolean}
   */
  get canInteract() {
    return this.slug.affection.canPat;
  }

  /**
   * @returns {import("../../../GameContracts.js").InteractionDescription}
   */
  get description() {
    return {
      ...this.slug.position,
      id: this.slug.definition.id,
      labelKey: "game.interaction.pat_slime",
      showHealth: false,
    };
  }

  /**
   * @returns {boolean}
   */
  interact() {
    if (!this.canInteract) {
      return false;
    }
    const result = this.slug.pat();
    if (result) {
      this.onComplete?.();
    }
    return result;
  }
}
