const { execSync } = require('child_process');
const path = require('path');
const mcDir = path.resolve(__dirname, '..', 'apps', 'mission-control');
process.chdir(mcDir);
const next = path.join(mcDir, 'node_modules', '.bin', 'next');
const port = process.argv[2] || '3000';
require('child_process').execFileSync(next, ['dev', '--port', port], { stdio: 'inherit', cwd: mcDir });
