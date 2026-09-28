import { MapGenerationPipeline } from "./MapGenerationPipeline.js";

export function createMapGenerationPipeline({ createContext, createStages }) {
  return async function generate(options) {
    const context = createContext(options);
    const pipeline = new MapGenerationPipeline(createStages());
    return pipeline.run(context);
  };
}
