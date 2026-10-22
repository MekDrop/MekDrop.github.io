import { mushroomParts } from "./MushroomParts.js";

export class GroundCoverCollectible {
  /**
   *
    * @type {string}
   */
  #id;
  /**
   *
    * @type {string}
   */
  #variant;
  /**
   *
    * @type {number}
   */
  #category;
  /**
   *
    * @type {string}
   */
  #labelKey;
  /**
   *
    * @type {string}
   */
  #icon;
  /**
   *
    * @type {string}
   */
  #modelUrl;
  /**
   *
    * @type {number}
   */
  #interactionRadius;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #position;
  /**
   *
    * @type {(item: GroundCoverCollectible) => void}
   */
  #onCollect;
  /**
   *
    * @type {() => void}
   */
  #onHide;
  /**
   *
    * @type {() => void}
   */
  #onDestroy;
  /**
   *
    * @type {(options: {parent: import("playcanvas").Entity}) => import("./GroundCoverHeldItem.js").GroundCoverHeldItem}
   */
  #createHeldItem;
  /**
   *
    * @type {boolean}
   */
  #collected = false;

  /**
   * @type {number}
   */
  #partIndex = 0;

  /**
   * @type {(index: number) => import("playcanvas").Vec3}
   */
  #pickupPosition;


  /**
   *
   * @param {{id: string, variant: string, category: number, labelKey: string, icon: string, modelUrl: string, interactionRadius: number, position: {x: number, y: number, z: number}, onCollect: (item: GroundCoverCollectible) => void, onHide: () => void, onDestroy: () => void, createHeldItem: (options: {parent: import("playcanvas").Entity}) => import("./GroundCoverHeldItem.js").GroundCoverHeldItem}} options
   * @param {string} options.id
   * @param {string} options.variant
   * @param {number} options.category
   * @param {string} options.labelKey
   * @param {string} options.icon
   * @param {string} options.modelUrl
   * @param {number} options.interactionRadius
   * @param {{x: number, y: number, z: number}} options.position
   * @param {(item: GroundCoverCollectible) => void} options.onCollect
   * @param {(index: number) => import("playcanvas").Vec3} options.pickupPosition
   * @param {() => void} options.onHide
   * @param {() => void} options.onDestroy
   * @param {(options: {parent: import("playcanvas").Entity}) => import("./GroundCoverHeldItem.js").GroundCoverHeldItem} options.createHeldItem
   */
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
    onDestroy = onHide,
    createHeldItem = () => null,
    pickupPosition = () => position,
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
    this.#onDestroy = onDestroy;
    this.#createHeldItem = createHeldItem;
    this.#pickupPosition = pickupPosition;
  }

  /**
   *
    * @returns {boolean}
   */
  get canInteract() {
    return !this.#collected;
  }

  get position() {
    return this.#position;
  }

  /**
   * Current individual stalk position, including map rotation and scale.
   * @returns {import("playcanvas").Vec3}
   */
  get pickupPosition() {
    return this.#pickupPosition(this.#partIndex);
  }

  get category() {
    return this.#category;
  }

  get interactionRadius() {
    return this.#interactionRadius;
  }

  /**
   *
    * @returns {string}
   */
  get interactionLabelKey() {
    return `game.interaction.collect_${this.#category}`;
  }

  createHeldItem() {
    return this.#createHeldItem(this.#partIndex);
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
      id: `${this.#id}:${this.#partIndex}`,
      variant: this.#variant,
      category: this.#category,
      labelKey: this.#labelKey,
      icon: this.#icon,
      modelUrl: this.#modelUrl,
    });
    if (!accepted) {
      return false;
    }

    const index = this.#partIndex++;
    this.#collected = this.#partIndex >= mushroomParts(this.#variant).length;
    this.#onHide(index, this.#collected);

    return true;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} impact
   */
  destroy(impact) {
    if (!this.canInteract) {
      return;
    }
    this.#collected = true;
    this.#onDestroy(impact);
  }
}
