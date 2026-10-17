export class GameModelLibraryDestroyedError extends Error {
  /**
   * @param {{url:string}} context
   */
  constructor({ url }) {
    super(`Cannot load game model ${url} after its model library was destroyed.`);

    this.name = "GameModelLibraryDestroyedError";
  }
}
