export class PhysicsModuleLoadError extends Error {
  /**
   * @param {string} detail
   */
  constructor(detail) {
    super(`Could not initialize Ammo WebAssembly: ${detail}`);

    this.name = PhysicsModuleLoadError.name;
  }
}
