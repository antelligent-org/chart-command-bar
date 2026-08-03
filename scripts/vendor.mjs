/**
 * Download Chart.js into `vendor/` so the demo runs with the wifi off.
 *
 *   npm run vendor
 *
 * Run it once after cloning. The page prefers `vendor/chart.umd.js` and only
 * falls back to the CDN when that file is missing, so a vendored copy is what
 * makes the offline promise real. Nothing else in this project is fetched.
 *
 * Chart.js is MIT licensed, so the file is safe to keep in the repository; the
 * licence header travels inside the bundle.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const VERSION = '4.4.7';
const URL = `https://cdn.jsdelivr.net/npm/chart.js@${VERSION}/dist/chart.umd.js`;

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, 'vendor', 'chart.umd.js');

console.log(`\n  Fetching Chart.js ${VERSION}`);
console.log(`  from ${URL}\n`);

const res = await fetch(URL);
if (!res.ok) {
  console.error(`  Failed: ${res.status} ${res.statusText}\n`);
  process.exit(1);
}

const body = await res.text();

// A truncated or redirected download would leave a file that silently fails at
// runtime, which is exactly the sort of thing you discover on stage.
if (!/chart\.js/i.test(body) || body.length < 100_000) {
  console.error(`  Failed: that did not look like the Chart.js bundle (${body.length} bytes)\n`);
  process.exit(1);
}

await mkdir(join(root, 'vendor'), { recursive: true });
await writeFile(target, body, 'utf8');

console.log(`  Wrote vendor/chart.umd.js (${Math.round(body.length / 1024)} KB)`);
console.log(`  The demo now works offline. Start it with: npm start\n`);
