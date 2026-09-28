export class ShaderTranspilerAssetsNotColocatedError extends Error {
  /**
   *
   * @param {string} scriptUrl
   * @param {boolean} wasmUrl
   */
  constructor(scriptUrl, wasmUrl) {
    super(
      `Shader transpiler script and WebAssembly assets must be colocated: ${scriptUrl}, ${wasmUrl}`,
    );
    /**
     *
     * @type {string}
     */
    this.name = ShaderTranspilerAssetsNotColocatedError.name;
  }
}
