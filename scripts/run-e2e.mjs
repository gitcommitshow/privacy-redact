// One-shot e2e runner (used by CI, also fine locally): installs Playwright's Chromium, builds the app,
// serves the production build, runs the e2e test against it and always shuts the server down.
//   npm run test:e2e:ci
import { spawn, spawnSync } from 'node:child_process';
import waitOn from 'wait-on';

const port = 4173;
const url = `http://localhost:${port}/`;
const root = new URL('..', import.meta.url).pathname;

// Runs a command to completion with inherited output; exits the whole script on failure.
function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// GitHub Actions sets CI=true; a fresh Linux runner also needs Chromium's system libraries.
run('npx', ['playwright', 'install', ...(process.env.CI ? ['--with-deps'] : []), 'chromium']);
run('npm', ['run', 'build']);

const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'inherit' });
let status = 1;
try {
  await waitOn({ resources: [url], timeout: 60_000 });
  status = spawnSync('node', ['test/smoke.e2e.test.js', url], { cwd: root, stdio: 'inherit' }).status ?? 1;
} finally {
  server.kill();
}
process.exit(status);
