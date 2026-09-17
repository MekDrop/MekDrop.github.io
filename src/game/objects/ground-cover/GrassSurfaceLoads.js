const MAXIMUM_SURFACE_LOADS = 4;
const VALUES_PER_LOAD = 4;

export class GrassSurfaceLoads {
  #positions = new Float32Array(MAXIMUM_SURFACE_LOADS * VALUES_PER_LOAD);
  #loads = new Float32Array(MAXIMUM_SURFACE_LOADS * VALUES_PER_LOAD);

  get positions() {
    return this.#positions;
  }

  get loads() {
    return this.#loads;
  }

  update(contacts = []) {
    this.#positions.fill(0);
    this.#loads.fill(0);
    contacts.slice(0, MAXIMUM_SURFACE_LOADS).forEach((contact, index) => {
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
