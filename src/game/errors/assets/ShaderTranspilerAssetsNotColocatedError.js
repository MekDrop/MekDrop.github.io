export class ShaderTranspilerAssetsNotColocatedError extends Error {
  constructor(scriptUrl, wasmUrl) {
    super(
      `Shader transpiler script and WebAssembly assets must be colocated: ${scriptUrl}, ${wasmUrl}`,
    );
    this.name = ShaderTranspilerAssetsNotColocatedError.name;
  }
}
