import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { report } from '../src/check.js';

describe('report', () => {
  const problem = { file: 'reviews/a.json', line: 6, message: '"rating" must be a whole number from 1 to 5' };

  it('prints one line per problem on your computer', () => {
    const lines = [];
    report([problem], {}, (line) => lines.push(line));
    assert.deepEqual(lines, ['✗ reviews/a.json (line 6): "rating" must be a whole number from 1 to 5']);
  });

  it('adds an annotation command on GitHub Actions', () => {
    const lines = [];
    report([problem], { GITHUB_ACTIONS: 'true' }, (line) => lines.push(line));
    assert.equal(lines[1], '::error file=reviews/a.json,line=6,title=Review check::"rating" must be a whole number from 1 to 5');
  });

  it('escapes the characters that would break the annotation', () => {
    const lines = [];
    report([{ file: 'reviews/a,b.json', line: 1, message: '100% wrong\nsecond line' }], { GITHUB_ACTIONS: 'true' }, (line) => lines.push(line));
    assert.equal(lines[1], '::error file=reviews/a%2Cb.json,line=1,title=Review check::100%25 wrong%0Asecond line');
  });
});
