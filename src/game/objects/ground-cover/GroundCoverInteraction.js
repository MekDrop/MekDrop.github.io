export class GroundCoverInteraction {
  #collectible;
  #hero;
  #tool;
  #onChange;
  #onComplete;

  constructor({ collectible, hero, tool, onChange, onComplete }) {
    this.#collectible = collectible;
    this.#hero = hero;
    this.#tool = tool;
    this.#onChange = onChange;
    this.#onComplete = onComplete;
  }

  get canInteract() {
    return this.#collectible.canInteract && !this.#hero.isCollecting;
  }

  get description() {
    return this.#collectible.describe();
  }

  interact() {
    if (!this.canInteract) {
      return false;
    }

    const started = this.#hero.collectGroundCover(
      this.#collectible.category,
      {
        targetPosition: this.#collectible.position,
        targetRadius: this.#collectible.interactionRadius,
        tool: this.#tool,
        heldItem: this.#collectible.createHeldItem(),
        onImpact: () => this.#collectible.collect(),
        onComplete: this.#onComplete,
      },
    );
    if (started) {
      this.#onChange?.();
    }
    return started;
  }
}
