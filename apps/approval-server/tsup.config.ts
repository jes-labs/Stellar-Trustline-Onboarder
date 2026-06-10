import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/app.ts', 'src/config.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  // Keep workspace + node_modules deps external; this is an app bundle, not a library.
  skipNodeModulesBundle: true,
});
