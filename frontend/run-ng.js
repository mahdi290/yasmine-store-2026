const { spawnSync } = require('child_process');

process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --experimental-require-module`.trim();

const args = process.argv.slice(2);
const result = spawnSync('node', ['./node_modules/@angular/cli/bin/ng.js', ...args], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS
  }
});

process.exit(result.status ?? 0);
