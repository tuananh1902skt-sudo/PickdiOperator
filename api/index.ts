// Loads the pre-bundled CJS build (dist/server.cjs, produced by the esbuild step in
// `npm run build`) instead of the raw TS source. server.ts and everything it imports use
// extensionless relative imports, which TypeScript's "bundler" resolution allows but Node's
// real ESM loader does not — Vercel compiles each .ts file individually (no bundling) for
// serverless functions, so those imports 404 at runtime (ERR_MODULE_NOT_FOUND) unless we hand
// it an already-bundled, self-contained CJS file instead.
import serverModule from '../dist/server.cjs';

const app = (serverModule as any).default ?? serverModule;

export default app;
