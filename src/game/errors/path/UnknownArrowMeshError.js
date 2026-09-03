export class UnknownArrowMeshError extends Error {
  constructor(meshKey) {
    super(`Unknown arrow mesh: ${meshKey}`);
    this.name = this.constructor.name;
    this.meshKey = meshKey;
  }
}
