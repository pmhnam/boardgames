import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Game packages must stay framework-independent (docs/adr/0003).
const frameworkImports = [
  '@nestjs/*',
  'react',
  'react-dom',
  'socket.io',
  'socket.io-client',
  'drizzle-orm',
  'drizzle-orm/*',
  'pg',
  'node:*',
  '@bgp/shared-types',
];

const frameworkMessage = 'Game packages must stay framework-independent.';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', 'apps/api/drizzle/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['packages/game-core/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: [...frameworkImports, '@bgp/game-*'], message: frameworkMessage }] },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded PRNG.' },
        { object: 'Date', property: 'now', message: 'Take time from GameActionContext.' },
      ],
    },
  },
  {
    files: ['packages/game-*/src/**'],
    ignores: ['packages/game-core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: frameworkImports, message: frameworkMessage },
            {
              group: ['@bgp/game-*', '!@bgp/game-core'],
              message: 'Games must not import each other.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded PRNG.' },
        { object: 'Date', property: 'now', message: 'Take time from GameActionContext.' },
        { object: 'crypto', property: 'randomUUID', message: 'Engines must be deterministic.' },
      ],
    },
  },
);
