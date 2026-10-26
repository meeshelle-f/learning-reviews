# Learning Reviews

A small website where you review the articles, books, videos, courses and podcasts you learned from.
It is the starter project for the **GitHub Actions project tutorial**: you build a real pipeline that
**tests** every change, **builds** the site and **deploys** it to GitHub Pages, one step at a time.

**Start here: [TUTORIAL.md](TUTORIAL.md)** walks you through the whole project, step by step.
To see where you are heading, look at the finished example: https://codedev-david.github.io/learning-reviews-demo/

## Get your own copy

1. Sign in to GitHub.
2. At the top of this page, click **Use this template**, then **Create a new repository**.
3. Keep yourself as the **Owner**, name the repository `learning-reviews`, choose **Public**, and click
   **Create repository**.

The tutorial explains why a copy made from a template is easier to work with here than a fork.

## What is in the project

| Path | What it is |
| --- | --- |
| `reviews/` | One JSON file per review. This is the folder you add to. |
| `site.json` | The site's title and tagline. |
| `src/` | The code: `reviews.js` checks the review files, `render.js` turns them into HTML, `build.js` writes the site into `dist/`, `check.js` reports problems. |
| `test/` | Unit tests for the code, run with Node.js's built-in test runner. |
| `public/` | The stylesheet and the small script that filters and searches the reviews. |
| `scripts/serve.js` | A tiny web server, to look at the site on your computer before you push. |
| `tutorial/` | The files the tutorial asks you to copy in: the pipeline at each stage, a review template and extras. |

## Commands

You need [Node.js](https://nodejs.org) 22 or newer. Run these in the project folder:

| Command | What it does |
| --- | --- |
| `npm ci` | Installs the tools the project uses, exactly as listed in `package-lock.json`. |
| `npm run check` | Checks `site.json` and every review, and says exactly what to fix. |
| `npm run lint` | Looks for mistakes in the JavaScript code. |
| `npm test` | Runs the unit tests. |
| `npm run build` | Checks the reviews, then writes the finished site into `dist/`. |
| `npm start` | Builds the site and serves it at http://localhost:4000 (press Ctrl+C to stop). |

The pipeline runs the same commands on GitHub's computers.

## Write a review

Copy `tutorial/new-review.json` into `reviews/` under a new name, such as `reviews/docker-video.json`,
and replace every example value:

| Field | What to write |
| --- | --- |
| `title` | The title of what you learned from. |
| `type` | One of `article`, `book`, `video`, `course` or `podcast`. A Medium post is an `article`. |
| `url` | The full link, starting with `https://`. |
| `creator` | The author, channel, teacher or host. |
| `rating` | A whole number from 1 to 5, without quotes. |
| `reviewer` | Your name. |
| `date` | The date you wrote the review, as `YYYY-MM-DD`. |
| `review` | Two or three sentences: what it taught you, and who should read or watch it. |
| `tags` | Optional: up to five tags, such as `["docker", "ci-cd"]`. |

Run `npm run check` before you push. The pipeline runs the same check, and a review that breaks a rule
never reaches the live site.
