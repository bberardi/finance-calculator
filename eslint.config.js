import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'reports', '.stryker-tmp'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // eslint-plugin-react-hooks v7's "recommended" preset bundles the new
      // React Compiler lint suite (set-state-in-effect, immutability, etc.).
      // The dependency-modernization upgrade (roadmap 0.5) intentionally keeps
      // the lint contract equivalent to the pre-upgrade v5 preset (rules-of-hooks
      // + exhaustive-deps) so this PR stays a mechanical migration. Adopting the
      // React Compiler rules and refactoring the affected effects is separate work.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
        },
      ],
    },
  },
  {
    // D7 core/UI boundary (roadmap 0.11). The math core — src/helpers/** and
    // src/models/** — is a pure, framework-free layer: TypeScript + dayjs only,
    // fully unit-testable in Node and the subject of the Math Correctness
    // Charter's 100% coverage gate. These rules make that purity a build
    // failure rather than a convention: the core may never import React, MUI,
    // emotion, any other UI runtime, or a UI component (every component is a
    // `.tsx` file, so importing one is forbidden outright). UI calls helpers,
    // never the reverse. This keeps the engine worker-safe (Phase 5/7) and
    // makes a future package extraction a file move, not a refactor.
    files: ['src/helpers/**/*.ts', 'src/models/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message:
                'The math core (src/helpers, src/models) must stay framework-free (D7). Move React-dependent code into a UI folder or src/hooks.',
            },
            {
              name: 'react-dom',
              message:
                'The math core (src/helpers, src/models) must stay framework-free (D7).',
            },
            {
              name: 'react-number-format',
              message:
                'The math core (src/helpers, src/models) must stay framework-free (D7).',
            },
          ],
          patterns: [
            {
              group: [
                'react/*',
                'react-dom/*',
                '@mui/*',
                '@emotion/*',
                '**/*.tsx',
              ],
              message:
                'The math core (src/helpers, src/models) must not import UI code or UI libraries (D7). UI depends on the core, never the reverse.',
            },
          ],
        },
      ],
    },
  }
);
