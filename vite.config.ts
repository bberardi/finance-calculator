import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
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
    environment: 'node',
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);
