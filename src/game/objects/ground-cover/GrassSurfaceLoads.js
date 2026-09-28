const MAXIMUM_SURFACE_LOADS = 4;
const VALUES_PER_LOAD = 4;

export class GrassSurfaceLoads {
  /**
   *
    * @type {Float32Array}
   */
  #positions = new Float32Array(MAXIMUM_SURFACE_LOADS * VALUES_PER_LOAD);
  /**
   *
    * @type {Float32Array}
   */
  #loads = new Float32Array(MAXIMUM_SURFACE_LOADS * VALUES_PER_LOAD);

  get positions() {
    return this.#positions;
  }

  get loads() {
    return this.#loads;
  }

  /**
   *
   * @param {number} contacts
   */
  update(contacts = []) {
    this.#positions.fill(0);
    this.#loads.fill(0);
    contacts.slice(0, MAXIMUM_SURFACE_LOADS).forEach(/**
     *
     * @param {number} contact
     * @param {number} index
     */
    (contact, index) => {
      const offset = index * VALUES_PER_LOAD;
      this.#positions.set([
        contact.x ?? 0,
        contact.y ?? 0,
        contact.z ?? 0,
        Math.max(0, contact.radius ?? 0),
      ], offset);
      this.#loads.set([
        Math.max(0, contact.compression ?? 0),
        contact.slopeX ?? 0,
        contact.slopeZ ?? 0,
        1,
      ], offset);
    });
  }
}
