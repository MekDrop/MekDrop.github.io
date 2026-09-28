export class CastleGenerationStageRunNotImplementedError extends Error {
  constructor(stageName) {
    super(`Castle generation stage ${stageName} must implement run(context).`);
    this.name = this.constructor.name;
  }
}
