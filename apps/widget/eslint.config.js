import reactConfig from '@supportpilot/eslint-config/react';

export default [
  ...reactConfig,
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
];
