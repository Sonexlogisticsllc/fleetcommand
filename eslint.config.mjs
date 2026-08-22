import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    '.next/**',
    '.next-stale-*/**',
    'node_modules/**',
    'output/**',
    'tmp/**',
    'scratch/**',
  ]),
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
