// The rules every review file must follow, and the code that reads every file in reviews/.
// `npm run check`, `npm run build` and the pipeline all use these rules, so a review that breaks
// one stops the pipeline before it can reach the live site.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const TYPES = ['article', 'book', 'video', 'course', 'podcast'];
export const FIELDS = ['title', 'type', 'url', 'creator', 'rating', 'reviewer', 'date', 'review', 'tags'];
const OPTIONAL = new Set(['tags']);
const LENGTHS = { title: [3, 120], creator: [2, 80], reviewer: [2, 40], review: [20, 1500] };
const FILE_NAME = /^[a-z0-9]+(-[a-z0-9]+)*\.json$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TAG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Every example value in tutorial/new-review.json starts with "Replace with", and its link is on example.com.
const PLACEHOLDER = /^replace with\b/i;

// Checks one review. Returns a list of problems ({ field, message }); an empty list means the review is fine.
export function validateReview(review, { today = new Date() } = {}) {
  if (review === null || typeof review !== 'object' || Array.isArray(review)) {
    return [{ field: null, message: 'the file must contain one JSON object that starts with { and ends with }' }];
  }
  const problems = [];
  const problem = (field, message) => problems.push({ field, message });
  const present = (key) => review[key] !== undefined && review[key] !== null && review[key] !== '';

  for (const key of Object.keys(review)) {
    if (!FIELDS.includes(key)) problem(key, `unknown field "${key}" (the fields are: ${FIELDS.join(', ')})`);
  }
  for (const key of FIELDS) {
    if (!OPTIONAL.has(key) && !present(key)) problem(null, `missing "${key}"`);
  }
  for (const [key, [min, max]] of Object.entries(LENGTHS)) {
    if (!present(key)) continue;
    const value = review[key];
    if (typeof value !== 'string') {
      problem(key, `"${key}" must be text in double quotes`);
    } else if (value.trim().length < min || value.trim().length > max) {
      problem(key, `"${key}" must be ${min} to ${max} characters long (it is ${value.trim().length})`);
    } else if (PLACEHOLDER.test(value)) {
      problem(key, `"${key}" still has the example text: write your own`);
    }
  }
  if (present('type') && !TYPES.includes(review.type)) {
    problem('type', `"type" must be one of: ${TYPES.join(', ')} (found ${JSON.stringify(review.type)})`);
  }
  if (present('url')) {
    if (!isHttpsUrl(review.url)) {
      problem('url', `"url" must be a full link that starts with https:// (found ${JSON.stringify(review.url)})`);
    } else if (/(^|\.)example\.com$/i.test(new URL(review.url).hostname)) {
      problem('url', '"url" still has the example link: use the real one');
    }
  }
  if (present('rating') && !(Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5)) {
    problem('rating', `"rating" must be a whole number from 1 to 5, without quotes (found ${JSON.stringify(review.rating)})`);
  }
  if (present('date')) {
    const message = checkDate(review.date, today);
    if (message) problem('date', message);
  }
  if (review.tags !== undefined) {
    if (!Array.isArray(review.tags) || review.tags.length > 5) {
      problem('tags', '"tags" must be a list of up to 5 tags, like ["docker", "ci-cd"]');
    } else {
      for (const tag of review.tags) {
        if (typeof tag !== 'string' || tag.length > 24 || !TAG.test(tag)) {
          problem('tags', `tag ${JSON.stringify(tag)} must use lowercase letters, numbers and hyphens (24 characters at most)`);
        }
      }
    }
  }
  return problems;
}

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.includes('.');
  } catch {
    return false;
  }
}

function checkDate(value, today) {
  const match = typeof value === 'string' ? DATE.exec(value) : null;
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!match || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) {
    return `"date" must be a real date written as YYYY-MM-DD, like "2026-10-20" (found ${JSON.stringify(value)})`;
  }
  // GitHub's runners use UTC. One extra day lets someone east of UTC use their own "today".
  const latest = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1);
  if (date.getTime() > latest) return `"date" cannot be in the future (found "${value}")`;
  return null;
}

// The line a field is on, so GitHub can point at it. 1 when the field is not in the file.
export function lineOf(text, field) {
  if (!field) return 1;
  const index = text.split('\n').findIndex((line) => line.includes(`"${field}"`));
  return index === -1 ? 1 : index + 1;
}

// Reads and checks site.json and every file in reviews/.
// Returns { site, reviews, problems }; each problem is { file, line, message }.
export async function loadSite(root, { today = new Date() } = {}) {
  const problems = [];
  let site = null;
  const siteText = await readText(path.join(root, 'site.json'));
  if (siteText === null) {
    problems.push({ file: 'site.json', line: 1, message: 'site.json is missing: it holds the site\'s title' });
  } else {
    try {
      site = JSON.parse(siteText);
      for (const message of validateSite(site)) problems.push({ file: 'site.json', line: 1, message });
    } catch (error) {
      problems.push({ file: 'site.json', line: jsonErrorLine(error), message: jsonMessage(error, siteText) });
    }
  }

  const reviews = [];
  const seen = new Map();
  for (const name of await listReviews(path.join(root, 'reviews'))) {
    const file = `reviews/${name}`;
    if (!name.endsWith('.json')) {
      problems.push({ file, line: 1, message: 'only .json files belong in reviews/ (did your editor add .txt to the name?)' });
      continue;
    }
    if (!FILE_NAME.test(name)) {
      problems.push({ file, line: 1, message: 'the file name must use only lowercase letters, numbers and hyphens, like 2026-10-20-my-review.json' });
    }
    const text = await readText(path.join(root, 'reviews', name));
    let review;
    try {
      review = JSON.parse(text);
    } catch (error) {
      problems.push({ file, line: jsonErrorLine(error), message: jsonMessage(error, text) });
      continue;
    }
    const found = validateReview(review, { today });
    for (const { field, message } of found) problems.push({ file, line: lineOf(text, field), message });
    if (found.length) continue;
    // The same person reviewing the same link twice is almost always a copy-and-paste mistake.
    const key = `${review.url.toLowerCase()} ${review.reviewer.trim().toLowerCase()}`;
    if (seen.has(key)) {
      problems.push({ file, line: lineOf(text, 'url'), message: `${seen.get(key)} already reviews this link by the same reviewer` });
      continue;
    }
    seen.set(key, file);
    reviews.push(review);
  }
  return { site, reviews, problems };
}

export function validateSite(site) {
  if (site === null || typeof site !== 'object' || Array.isArray(site)) return ['site.json must contain one JSON object'];
  const problems = [];
  for (const key of Object.keys(site)) {
    if (!['title', 'tagline'].includes(key)) problems.push(`unknown field "${key}" (the fields are: title, tagline)`);
  }
  if (typeof site.title !== 'string' || site.title.trim().length < 3 || site.title.trim().length > 60) {
    problems.push('"title" must be text of 3 to 60 characters');
  }
  if (site.tagline !== undefined && (typeof site.tagline !== 'string' || site.tagline.length > 160)) {
    problems.push('"tagline" must be text of up to 160 characters');
  }
  return problems;
}

// The file's text without a byte order mark (Notepad can add one), or null when the file does not exist.
async function readText(file) {
  try {
    return (await readFile(file, 'utf8')).replace(/^\uFEFF/, '');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// The review files in name order. Git does not keep empty folders, so a missing reviews/ means no reviews yet.
async function listReviews(dir) {
  try {
    return (await readdir(dir)).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function jsonMessage(error, text) {
  const curly = /[\u201C\u201D]/.test(text)
    ? ' Your editor changed straight quotes (") into curly quotes (\u201C \u201D): retype them in a code editor.'
    : '';
  return `this is not valid JSON: ${error.message.replace(/\s+/g, ' ')}.${curly}`;
}

// Node.js reports where JSON breaks, for example "... (line 5 column 3)".
function jsonErrorLine(error) {
  const match = /line (\d+)/.exec(error.message);
  return match ? Number(match[1]) : 1;
}
