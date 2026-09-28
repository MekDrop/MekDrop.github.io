import { CastleGenerationPipeline } from "./CastleGenerationPipeline.js";

export function createCastleGenerationPipeline({ createContext, createStages }) {
  return async function generate(options) {
    const context = createContext(options);
    const pipeline = new CastleGenerationPipeline(createStages());
    return pipeline.run(context);
  };
}
