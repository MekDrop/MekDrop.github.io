export class GroundCoverCollectible {
  #id;
  #variant;
  #category;
  #labelKey;
  #icon;
  #modelUrl;
  #interactionRadius;
  #position;
  #onCollect;
  #onHide;
  #createHeldItem;
  #collected = false;

  constructor({
    id,
    variant,
    category,
    labelKey,
    icon,
    modelUrl,
    interactionRadius = 0,
    position,
    onCollect,
    onHide,
    createHeldItem = () => null,
  }) {
    this.#id = id;
    this.#variant = variant;
    this.#category = category;
    this.#labelKey = labelKey;
    this.#icon = icon;
    this.#modelUrl = modelUrl;
    this.#interactionRadius = interactionRadius;
    this.#position = position;
    this.#onCollect = onCollect;
    this.#onHide = onHide;
    this.#createHeldItem = createHeldItem;
  }

  get canInteract() {
    return !this.#collected;
  }

  get position() {
    return this.#position;
  }

  get category() {
    return this.#category;
  }

  get interactionRadius() {
    return this.#interactionRadius;
  }

  get interactionLabelKey() {
    return `game.interaction.collect_${this.#category}`;
  }

  createHeldItem() {
    return this.#createHeldItem();
  }

  describe() {
    return {
      id: this.#id,
      x: this.#position.x,
      y: this.#position.y,
      z: this.#position.z,
      labelKey: this.interactionLabelKey,
    };
  }

  collect() {
    if (!this.canInteract) {
      return false;
    }

    const accepted = this.#onCollect({
      id: this.#id,
      variant: this.#variant,
      category: this.#category,
      labelKey: this.#labelKey,
      icon: this.#icon,
      modelUrl: this.#modelUrl,
    });
    if (!accepted) {
      return false;
    }

    this.#collected = true;
    this.#onHide();
    return true;
  }
}
