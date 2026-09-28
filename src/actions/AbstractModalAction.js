/**
 * @abstract
 * Defines the behavior required by actions that participate in modal closing.
 */
export class AbstractModalAction {
  /**
   * @abstract
   * @returns {boolean}
   */
  get visible() {
    return false;
  }

  /**
   * @abstract
   * @returns {boolean}
   */
  close() {
    return false;
  }
}
