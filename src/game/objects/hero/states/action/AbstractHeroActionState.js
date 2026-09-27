import { State } from "yuka";

/**
 * Base state for an autonomous hero action and its presentation.
 * @abstract
 */
export class AbstractHeroActionState extends State {
  #action;
  #animation;

  constructor(action, animation) {
    super();
    this.#action = action;
    this.#animation = animation;
  }

  get action() {
    return this.#action;
  }

  get animation() {
    return this.#animation;
  }
}
