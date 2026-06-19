import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import { createRequire } from 'node:module';

// Read the app version straight from package.json so the footer shows the right
// version regardless of how the build is invoked (roadmap 0.10). The previous
// `process.env.npm_package_version` is only populated when run through an npm
// script; reading the file is the conventional Vite approach and works always.
const require = createRequire(import.meta.url);
const { version: appVersion } = require('./package.json') as {
  version: string;
};

// https://vitejs.dev/config/
export default defineConfig({
  base: '/finance-calculator/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  test: {
    globals: true,
    // Default environment for the pure math/helper/reducer tests. UI component
    // tests opt into jsdom per-file with a `// @vitest-environment jsdom`
    // docblock, so the fast node default stays in force for src/helpers/**.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    server: {
      deps: {
        // MUI's ESM build does a directory import of react-transition-group
        // (TransitionGroupContext) that Node's ESM resolver rejects. Inlining
        // the @mui packages (the importers) + react-transition-group routes
        // them through Vite's resolver, which handles the directory import, for
        // the jsdom component tests. The MUI transform is a one-time per-run
        // cost (Vite-cached locally), amortized across the component tests.
        inline: [/@mui\//, 'react-transition-group'],
      },
    },
    // Keep the default ignores and also skip generated dirs — notably the
    // Stryker sandbox, whose copied *.test.ts files would otherwise be
    // discovered and double-counted during a local mutation run.
    exclude: [...configDefaults.exclude, '**/.stryker-tmp/**', 'coverage/**'],
    coverage: {
      // Math Correctness Charter §4 enforcement: the math core is held to a
      // hard 100% line+branch gate (UI gets pragmatic targets in Phase 6). The
      // scope is the pure helpers only; test files, type-only models, and the
      // relocated React hook are out of scope by construction.
      provider: 'v8',
      include: ['src/helpers/**/*.ts'],
      exclude: ['src/helpers/**/*.test.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);
