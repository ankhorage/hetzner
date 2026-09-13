import { createKnipConfig } from '@ankhorage/devtools/knip';

export default createKnipConfig({
  entry: ['src/index.ts', 'examples/*/index.ts'],
  ignoreBinaries: ['ssh-keyscan'],
  ignoreFiles: [
    '.prettierrc.js',
    'eslint.examples.config.mjs',
    'eslint.config.mjs',
    'eslint.local.config.mjs',
    'paradox.config.ts',
    'prettier.local.config.js',
  ],
});
