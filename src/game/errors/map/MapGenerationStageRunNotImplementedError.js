export class MapGenerationStageRunNotImplementedError extends Error {
  constructor(stageName) {
    super(`Map generation stage ${stageName} must implement run(context).`);
    this.name = this.constructor.name;
  }
}
