// Loads the pre-bundled ESM build (dist/server.mjs, produced by the esbuild step in
// `npm run build`) instead of the raw TS source. server.ts and everything it imports use
// extensionless relative imports, which TypeScript's "bundler" resolution allows but Node's
// real ESM loader does not — Vercel compiles each .ts file individually (no bundling) for
// serverless functions, so those imports 404 at runtime (ERR_MODULE_NOT_FOUND) unless we hand
// it an already-bundled, self-contained file instead. The bundle is ESM (not CJS) because some
// dependencies (e.g. archiver, email-reply-parser) are ESM-only or rely on import.meta.url,
// which breaks when esbuild forces them into a CJS bundle.
import app from '../dist/server.mjs';

export default app;
