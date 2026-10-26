import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildInfo, escapeHtml, formatDate, renderPage, renderReview, sortReviews, stars, summarize } from '../src/render.js';

const review = (changes = {}) => ({
  title: 'Continuous Integration',
  type: 'article',
  url: 'https://martinfowler.com/articles/continuousIntegration.html',
  creator: 'Martin Fowler',
  rating: 4,
  reviewer: 'Sam',
  date: '2026-09-15',
  review: 'Explains continuous integration as a team habit, not a tool.',
  ...changes,
});

describe('small helpers', () => {
  it('draws the rating as five stars', () => {
    assert.equal(stars(4), '★★★★☆');
    assert.equal(stars(1), '★☆☆☆☆');
  });

  it('writes dates the way people read them', () => {
    assert.equal(formatDate('2026-09-08'), 'Sep 8, 2026');
  });

  it('escapes HTML so a review cannot run code', () => {
    assert.equal(escapeHtml('<script>alert("hi")</script>'), '&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;');
  });

  it('puts the newest review first', () => {
    const sorted = sortReviews([review({ date: '2026-09-01' }), review({ date: '2026-10-01', title: 'Newer' })]);
    assert.equal(sorted[0].title, 'Newer');
  });

  it('counts the reviews and averages the ratings', () => {
    const { count, average, byType } = summarize([review({ rating: 5 }), review({ rating: 4, type: 'book' })]);
    assert.equal(count, 2);
    assert.equal(average, 4.5);
    assert.equal(byType.article, 1);
    assert.equal(byType.book, 1);
  });
});

describe('renderReview', () => {
  it('shows the title as a link, the creator and the stars', () => {
    const html = renderReview(review());
    assert.match(html, /<a href="https:\/\/martinfowler\.com\/articles\/continuousIntegration\.html" rel="noopener noreferrer">Continuous Integration<\/a>/);
    assert.match(html, /by Martin Fowler/);
    assert.match(html, /aria-label="4 out of 5 stars">★★★★☆</);
  });

  it('never puts review text into the page as HTML', () => {
    const html = renderReview(review({ review: 'Great <img src=x onerror=alert(1)> video' }));
    assert.ok(!html.includes('<img'), 'the <img> tag must be escaped');
    assert.match(html, /Great &lt;img src=x onerror=alert\(1\)&gt; video/);
  });
});

describe('renderPage', () => {
  const site = { title: 'Learning Reviews', tagline: 'What I learned from.' };

  it('shows the totals and one card per review', () => {
    const html = renderPage({ site, reviews: [review(), review({ title: 'Second', url: 'https://example.org/2' })], build: buildInfo({}) });
    assert.match(html, /2 reviews · average 4\.0 \/ 5 · 2 articles/);
    assert.equal(html.match(/<article class="review"/g).length, 2);
  });

  it('says where the site was built', () => {
    const local = renderPage({ site, reviews: [], build: buildInfo({}, new Date('2026-10-20T14:03:00Z')) });
    assert.match(local, /Built on your computer on 2026-10-20 14:03 UTC/);
    const env = {
      GITHUB_ACTIONS: 'true',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'sam/learning-reviews',
      GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567',
      GITHUB_RUN_NUMBER: '12',
      GITHUB_RUN_ID: '987654321',
    };
    const ci = renderPage({ site, reviews: [], build: buildInfo(env) });
    assert.match(ci, /GitHub Actions run #12<\/a> from commit <a href="https:\/\/github\.com\/sam\/learning-reviews\/commit\/0123456789abcdef0123456789abcdef01234567"><code>0123456<\/code>/);
  });

  it('shows a friendly message when there are no reviews', () => {
    assert.match(renderPage({ site, reviews: [], build: buildInfo({}) }), /No reviews yet/);
  });
});
