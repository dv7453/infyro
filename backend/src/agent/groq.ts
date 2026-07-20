/** Compatibility re-exports — prefer `./llm.js`. */
export {
  createLlmClient,
  getHeavyModel,
  getLightModel,
  groq,
  modelsForProvider,
  resolveLlmForUser,
  type LlmRuntime,
} from "./llm.js";
