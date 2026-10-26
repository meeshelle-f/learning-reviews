import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { build, summaryMarkdown } from '../src/build.js';

const NOW = new Date('2026-10-20T12:00:00Z');
const review = {
  title: 'Hello GitHub Actions',
  type: 'course',
  url: 'https://github.com/skills/hello-github-actions',
  creator: 'GitHub Skills',
  rating: 4,
  reviewer: 'Sam',
  date: '2026-10-06',
  review: 'A short, free course that runs inside your own copy of a repository.',
};

async function project(reviews) {
  const root = await mkdtemp(path.join(tmpdir(), 'site-'));
  await mkdir(path.join(root, 'reviews'));
  await mkdir(path.join(root, 'public'));
  await writeFile(path.join(root, 'site.json'), JSON.stringify({ title: 'Test site' }));
  await writeFile(path.join(root, 'public', 'style.css'), 'body {}');
  for (const [name, data] of Object.entries(reviews)) {
    await writeFile(path.join(root, 'reviews', name), JSON.stringify(data, null, 2));
  }
  return root;
}

describe('build', () => {
  it('writes the page, the data file and the assets into dist/', async () => {
    const root = await project({ '2026-10-06-hello.json': review });
    const result = await build({ root, env: {}, now: NOW });
    assert.equal(result.ok, true);
    assert.deepEqual((await readdir(path.join(root, 'dist'))).sort(), ['index.html', 'reviews.json', 'style.css']);
    assert.match(await readFile(path.join(root, 'dist', 'index.html'), 'utf8'), /Hello GitHub Actions/);
    const data = JSON.parse(await readFile(path.join(root, 'dist', 'reviews.json'), 'utf8'));
    assert.equal(data.count, 1);
    await rm(root, { recursive: true });
  });

  it('refuses to build when a review breaks a rule', async () => {
    const root = await project({ '2026-10-06-hello.json': { ...review, type: 'blog' } });
    const result = await build({ root, env: {}, now: NOW });
    assert.equal(result.ok, false);
    assert.equal(result.problems[0].file, 'reviews/2026-10-06-hello.json');
    await rm(root, { recursive: true });
  });

  it('summarises the build for the run page on GitHub', () => {
    assert.match(summaryMarkdown([review]), /### Site built: 1 reviews, average rating 4\.0 \/ 5/);
    assert.match(summaryMarkdown([review]), /\| course \| 1 \|/);
  });
});
