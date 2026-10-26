import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { lineOf, loadSite, validateReview, validateSite } from '../src/reviews.js';

const TODAY = new Date('2026-10-20T12:00:00Z');

const good = () => ({
  title: 'The Phoenix Project',
  type: 'book',
  url: 'https://itrevolution.com/product/the-phoenix-project/',
  creator: 'Gene Kim, Kevin Behr and George Spafford',
  rating: 5,
  reviewer: 'Sam',
  date: '2026-10-01',
  review: 'A novel that makes the Three Ways of DevOps easy to picture.',
  tags: ['devops'],
});

// The messages validateReview gives for one changed field.
const messagesFor = (changes) => validateReview({ ...good(), ...changes }, { today: TODAY }).map((p) => p.message);

describe('validateReview', () => {
  it('accepts a complete review', () => {
    assert.deepEqual(validateReview(good(), { today: TODAY }), []);
  });

  it('accepts a review without tags', () => {
    const review = good();
    delete review.tags;
    assert.deepEqual(validateReview(review, { today: TODAY }), []);
  });

  it('names every missing field', () => {
    const messages = validateReview({ title: 'Only a title' }, { today: TODAY }).map((p) => p.message);
    for (const field of ['type', 'url', 'creator', 'rating', 'reviewer', 'date', 'review']) {
      assert.ok(messages.includes(`missing "${field}"`), `expected a message about "${field}"`);
    }
  });

  it('rejects a rating outside 1 to 5, in quotes or with a decimal', () => {
    for (const rating of [0, 6, '5', 4.5]) {
      assert.match(messagesFor({ rating })[0], /"rating" must be a whole number from 1 to 5/);
    }
  });

  it('rejects an unknown type and lists the allowed ones', () => {
    assert.match(messagesFor({ type: 'blog' })[0], /"type" must be one of: article, book, video, course, podcast/);
  });

  it('rejects a link that is not https', () => {
    assert.match(messagesFor({ url: 'http://example.org/page' })[0], /must be a full link that starts with https:\/\//);
    assert.match(messagesFor({ url: 'www.youtube.com/watch?v=1' })[0], /must be a full link/);
  });

  it('rejects the example text from the template', () => {
    assert.match(messagesFor({ title: 'Replace with the title' })[0], /"title" still has the example text/);
    assert.match(messagesFor({ url: 'https://example.com/replace-with-the-real-link' })[0], /"url" still has the example link/);
  });

  it('accepts "replace with" in the middle of a real review', () => {
    assert.deepEqual(messagesFor({ review: 'Shows when to replace with a newer tool, and when not to.' }), []);
  });

  it('rejects dates that are not real or are in the future', () => {
    assert.match(messagesFor({ date: '2026-02-30' })[0], /must be a real date written as YYYY-MM-DD/);
    assert.match(messagesFor({ date: '20/10/2026' })[0], /must be a real date/);
    assert.match(messagesFor({ date: '2026-12-25' })[0], /cannot be in the future/);
  });

  it('allows tomorrow, for time zones ahead of UTC', () => {
    assert.deepEqual(messagesFor({ date: '2026-10-21' }), []);
  });

  it('rejects unknown fields, so a typo cannot hide', () => {
    assert.match(messagesFor({ ratting: 4 })[0], /unknown field "ratting"/);
  });

  it('rejects tags with spaces or capitals', () => {
    assert.match(messagesFor({ tags: ['CI CD'] })[0], /must use lowercase letters, numbers and hyphens/);
  });

  it('checks text length', () => {
    assert.match(messagesFor({ review: 'Too short.' })[0], /"review" must be 20 to 1500 characters long \(it is 10\)/);
  });
});

describe('validateSite', () => {
  it('accepts a title and a tagline', () => {
    assert.deepEqual(validateSite({ title: 'My Reviews', tagline: 'Things I learned from.' }), []);
  });

  it('needs a title', () => {
    assert.deepEqual(validateSite({ tagline: 'No title' }), ['"title" must be text of 3 to 60 characters']);
  });
});

describe('lineOf', () => {
  it('finds the line a field is on', () => {
    assert.equal(lineOf('{\n  "title": "x",\n  "rating": 6\n}', 'rating'), 3);
    assert.equal(lineOf('{}', null), 1);
  });
});

describe('loadSite', () => {
  async function folder(files) {
    const root = await mkdtemp(path.join(tmpdir(), 'reviews-'));
    await mkdir(path.join(root, 'reviews'));
    await writeFile(path.join(root, 'site.json'), JSON.stringify({ title: 'Test site' }));
    for (const [name, text] of Object.entries(files)) await writeFile(path.join(root, 'reviews', name), text);
    return root;
  }

  it('loads valid reviews and reports nothing', async () => {
    const root = await folder({ '2026-10-01-a.json': JSON.stringify(good()) });
    const { reviews, problems } = await loadSite(root, { today: TODAY });
    assert.equal(reviews.length, 1);
    assert.deepEqual(problems, []);
    await rm(root, { recursive: true });
  });

  it('points at the file and line of a mistake', async () => {
    const text = JSON.stringify({ ...good(), rating: 6 }, null, 2);
    const root = await folder({ '2026-10-01-a.json': text });
    const { problems } = await loadSite(root, { today: TODAY });
    assert.deepEqual(problems, [{
      file: 'reviews/2026-10-01-a.json',
      line: 6,
      message: '"rating" must be a whole number from 1 to 5, without quotes (found 6)',
    }]);
    await rm(root, { recursive: true });
  });

  it('reports broken JSON, a bad file name and a .txt file', async () => {
    const root = await folder({ 'My Review.json': JSON.stringify(good()), '2026-10-02-b.json': '{ "title": }', 'notes.txt': 'x' });
    const messages = (await loadSite(root, { today: TODAY })).problems.map((p) => `${p.file}: ${p.message}`);
    assert.equal(messages.length, 3);
    assert.match(messages[0], /^reviews\/2026-10-02-b\.json: this is not valid JSON/);
    assert.match(messages[1], /^reviews\/My Review\.json: the file name must use only lowercase letters/);
    assert.match(messages[2], /^reviews\/notes\.txt: only \.json files belong in reviews\//);
    await rm(root, { recursive: true });
  });

  it('explains curly quotes, which some editors type instead of straight ones', async () => {
    const root = await folder({ '2026-10-01-a.json': '{\n  “title”: “Curly”\n}' });
    const { problems } = await loadSite(root, { today: TODAY });
    assert.equal(problems.length, 1);
    assert.match(problems[0].message, /^this is not valid JSON: .*Your editor changed straight quotes/);
    await rm(root, { recursive: true });
  });

  it('treats a missing reviews/ folder as no reviews yet', async () => {
    const root = await folder({});
    await rm(path.join(root, 'reviews'), { recursive: true });
    const { reviews, problems } = await loadSite(root, { today: TODAY });
    assert.deepEqual(reviews, []);
    assert.deepEqual(problems, []);
    await rm(root, { recursive: true });
  });

  it('says so when site.json is missing', async () => {
    const root = await folder({});
    await rm(path.join(root, 'site.json'));
    const { problems } = await loadSite(root, { today: TODAY });
    assert.deepEqual(problems, [{ file: 'site.json', line: 1, message: 'site.json is missing: it holds the site\'s title' }]);
    await rm(root, { recursive: true });
  });

  it('catches the same link reviewed twice by the same person', async () => {
    const root = await folder({ '2026-10-01-a.json': JSON.stringify(good()), '2026-10-02-b.json': JSON.stringify(good()) });
    const { problems } = await loadSite(root, { today: TODAY });
    assert.equal(problems.length, 1);
    assert.match(problems[0].message, /reviews\/2026-10-01-a\.json already reviews this link/);
    await rm(root, { recursive: true });
  });
});
