import { defineConfig } from 'tsdown';

// publint and attw both shell out to `npm pack` internally. Under
// `npm pack --dry-run` / `npm publish --dry-run` npm writes no tarball but
// still runs the prepack lifecycle, so that inner pack finds nothing and the
// build aborts. Skip the validators in that one case; `npm run build` and a
// real pack/publish still run them.
const inDryRunPack = process.env.npm_config_dry_run === 'true';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'node',
  outDir: 'dist',
  tsconfig: './tsconfig.build.json',
  dts: true,
  sourcemap: true,
  clean: true,
  // ESM lands on .js (valid because package.json sets "type": "module"), CJS on
  // .cjs. Without this tsdown defaults to .mjs/.cjs. Note the normalized format
  // is 'es', not 'esm' -- comparing against 'esm' silently names both outputs
  // .cjs and the ESM build overwrites the CJS one.
  outExtensions: ({ format }) => ({ js: format === 'es' ? '.js' : '.cjs' }),
  publint: !inDryRunPack,
  attw: inDryRunPack ? false : { profile: 'node16' },
});
