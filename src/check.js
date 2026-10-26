// `npm run check`: checks site.json and every review in reviews/, and says exactly what to fix.
// On GitHub Actions each problem also becomes an annotation that points at the file and line.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSite } from './reviews.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Workflow commands need these characters written as %-codes.
const escapeData = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeProperty = (s) => escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

export function report(problems, env = process.env, log = console.log) {
  for (const { file, line, message } of problems) {
    log(`✗ ${file} (line ${line}): ${message}`);
    if (env.GITHUB_ACTIONS === 'true') {
      // A workflow command: GitHub shows it on the run page and next to the line in a pull request.
      log(`::error file=${escapeProperty(file)},line=${line},title=Review check::${escapeData(message)}`);
    }
  }
}

async function main() {
  const { reviews, problems } = await loadSite(ROOT);
  if (problems.length) {
    report(problems);
    console.log(`\n${problems.length} problem(s) found. Fix them, then run npm run check again.`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ site.json and ${reviews.length} review files follow the rules.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
