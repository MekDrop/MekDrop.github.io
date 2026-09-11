export class InvalidLavaRiverCountError extends Error {
  constructor({ lavaCount, riverCount, maximum }) {
    super(
      `Map validation failed: ${lavaCount} lava rivers cannot appear among ${riverCount} total rivers; lava is limited to ${maximum} rivers and only islands with at most ${maximum} total rivers are eligible.`,
    );
    this.name = this.constructor.name;
  }
}
