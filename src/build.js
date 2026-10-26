// `npm run build`: checks every review, then writes the finished website into dist/.
// The pipeline runs this same command, so the site you build here is the site that gets deployed.
import { appendFile, copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { report } from './check.js';
import { buildInfo, renderPage, summarize } from './render.js';
import { loadSite } from './reviews.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function build({ root = ROOT, out = path.join(root, 'dist'), env = process.env, now = new Date() } = {}) {
  const { site, reviews, problems } = await loadSite(root, { today: now });
  if (problems.length) return { ok: false, problems };

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'index.html'), renderPage({ site, reviews, build: buildInfo(env, now) }));
  const { count, average } = summarize(reviews);
  const data = { title: site.title, built: now.toISOString(), count, average, reviews };
  await writeFile(path.join(out, 'reviews.json'), `${JSON.stringify(data, null, 2)}\n`);
  const assets = (await readdir(path.join(root, 'public'))).sort();
  for (const name of assets) await copyFile(path.join(root, 'public', name), path.join(out, name));
  return { ok: true, reviews, files: ['index.html', 'reviews.json', ...assets] };
}

// A table for the run's summary page on GitHub.
export function summaryMarkdown(reviews) {
  const { count, average, byType } = summarize(reviews);
  const rows = Object.entries(byType).filter(([, n]) => n > 0).map(([type, n]) => `| ${type} | ${n} |`);
  return [`### Site built: ${count} reviews, average rating ${average.toFixed(1)} / 5`, '', '| Type | Reviews |', '| --- | --- |', ...rows, ''].join('\n');
}

async function main() {
  const result = await build();
  if (!result.ok) {
    report(result.problems);
    console.log(`\nThe site was not built: ${result.problems.length} problem(s) to fix.`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ Built ${result.reviews.length} reviews into dist/: ${result.files.join(', ')}`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(result.reviews));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
