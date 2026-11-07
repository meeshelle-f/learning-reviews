// Turns the reviews into the website's HTML. Every value that comes from a review file is escaped,
// so a review that contains <script> shows that text instead of running it.
import { TYPES } from './reviews.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LABELS = { article: 'Article', book: 'Book', video: 'Video', course: 'Course', podcast: 'Podcast' };

export function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, (c) => entities[c]);
}

export function stars(rating) {
  return '★'.repeat(rating) + '☆'.repeat(4 - rating);
}

// "2026-09-08" -> "Sep 8, 2026"
export function formatDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// Newest first; reviews from the same day in title order.
export function sortReviews(reviews) {
  return [...reviews].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export function summarize(reviews) {
  const count = reviews.length;
  const average = count ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10 : 0;
  const byType = Object.fromEntries(TYPES.map((type) => [type, reviews.filter((r) => r.type === type).length]));
  return { count, average, byType };
}

// Where this copy of the site came from. GitHub Actions sets these variables on its runners.
export function buildInfo(env = {}, now = new Date()) {
  const info = { when: `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC` };
  if (env.GITHUB_ACTIONS === 'true' && env.GITHUB_SHA && env.GITHUB_REPOSITORY) {
    const repo = `${env.GITHUB_SERVER_URL || 'https://github.com'}/${env.GITHUB_REPOSITORY}`;
    info.repoUrl = repo;
    info.commit = env.GITHUB_SHA.slice(0, 7);
    info.commitUrl = `${repo}/commit/${env.GITHUB_SHA}`;
    info.run = env.GITHUB_RUN_NUMBER;
    info.runUrl = `${repo}/actions/runs/${env.GITHUB_RUN_ID}`;
  }
  return info;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function renderReview(review) {
  const tags = (review.tags || []).map((tag) => `<li>${escapeHtml(tag)}</li>`).join('');
  return `<article class="review" data-type="${escapeHtml(review.type)}">
  <div class="meta">
    <span class="type type-${escapeHtml(review.type)}">${LABELS[review.type]}</span>
    <span class="stars" role="img" aria-label="${review.rating} out of 5 stars">${stars(review.rating)}</span>
  </div>
  <h2><a href="${escapeHtml(review.url)}" rel="noopener noreferrer">${escapeHtml(review.title)}</a></h2>
  <p class="creator">by ${escapeHtml(review.creator)}</p>
  <p class="text">${escapeHtml(review.review)}</p>${tags ? `\n  <ul class="tags">${tags}</ul>` : ''}
  <p class="by">Reviewed by ${escapeHtml(review.reviewer)} on <time datetime="${escapeHtml(review.date)}">${formatDate(review.date)}</time></p>
</article>`;
}

export function renderPage({ site, reviews, build }) {
  const sorted = sortReviews(reviews);
  const { count, average, byType } = summarize(sorted);
  const kinds = TYPES.filter((type) => byType[type] > 0);
  const stats = count
    ? `${plural(count, 'review')} · average ${average.toFixed(1)} / 5 · ${kinds.map((t) => plural(byType[t], t)).join(', ')}`
    : 'No reviews yet';
  const filters = [`<button type="button" data-filter="all" aria-pressed="true">All (${count})</button>`]
    .concat(kinds.map((t) => `<button type="button" data-filter="${t}" aria-pressed="false">${LABELS[t]}s (${byType[t]})</button>`))
    .join('\n      ');
  const cards = sorted.length
    ? sorted.map(renderReview).join('\n')
    : '<p class="empty">No reviews yet. Add a file to the reviews/ folder to write the first one.</p>';
  const source = build.repoUrl
    ? `Built by <a href="${escapeHtml(build.runUrl)}">GitHub Actions run #${escapeHtml(build.run)}</a> from commit ` +
      `<a href="${escapeHtml(build.commitUrl)}"><code>${escapeHtml(build.commit)}</code></a> on ${escapeHtml(build.when)} · ` +
      `<a href="${escapeHtml(build.repoUrl)}">Source code</a>`
    : `Built on your computer on ${escapeHtml(build.when)}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title)}</title>
  <meta name="description" content="${escapeHtml(site.tagline || site.title)}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>★</text></svg>">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="site">
    <h1>${escapeHtml(site.title)}</h1>
    ${site.tagline ? `<p class="tagline">${escapeHtml(site.tagline)}</p>` : ''}
    <p class="stats">${stats}</p>
  </header>
  <nav class="controls" aria-label="Filter reviews" hidden>
    <div class="filters">
      ${filters}
    </div>
    <input id="search" type="search" placeholder="Search the reviews" aria-label="Search the reviews">
  </nav>
  <main class="reviews">
${cards}
    <p id="no-results" class="empty" hidden>No review matches. Try another word or show All.</p>
  </main>
  <footer class="site">${source}</footer>
  <script src="app.js" defer></script>
</body>
</html>
`;
}
