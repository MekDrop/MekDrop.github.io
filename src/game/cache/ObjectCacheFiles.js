/**
 * The glob may be empty in a clean checkout. Each file becomes a separate SPA
 * chunk. Node's offline baker starts without filesystem cache loaders.
 */
let files = {};
try {
  files = import.meta.glob("./generated/*/*.json");
} catch {
  // Native Node execution uses recording mode rather than bundled artifacts.
}

export default files;

// Populated by the validating Vite plugin; keys select complete large variants.
export const lazyEntries = {};
