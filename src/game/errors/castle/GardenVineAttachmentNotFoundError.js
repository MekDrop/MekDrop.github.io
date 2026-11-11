/**
 * An authored shelter is missing a stem endpoint required by its live foliage.
 */
export class GardenVineAttachmentNotFoundError extends Error {
  /**
   * @param {{name: string}} options
   */
  constructor({ name }) {
    super(`Garden shelter model is missing vine attachment "${name}".`);
  }
}
