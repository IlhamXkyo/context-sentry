import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { mergePatterns, syncIgnoreFiles, RECOMMENDED_PATTERNS } from '../src/sync.js';

test('mergePatterns appends without duplicating existing lines', () => {
  const existing = 'dist/\nmy-custom-folder/\n';
  const newPatterns = ['dist/', 'build/', 'package-lock.json'];
  const merged = mergePatterns(existing, newPatterns);

  assert.ok(merged.includes('my-custom-folder/'));
  assert.ok(merged.includes('build/'));
  assert.ok(merged.includes('package-lock.json'));

  // Ensure 'dist/' only appears once as non-comment
  const distMatches = merged.split('\n').filter(l => l.trim() === 'dist/');
  assert.strictEqual(distMatches.length, 1);
});

test('syncIgnoreFiles generates expected ignore files in directory', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-sentry-test-'));

  try {
    const result = syncIgnoreFiles(tempDir, { tools: ['cursor', 'agent'] });
    assert.strictEqual(result.created.length, 2);
    assert.ok(fs.existsSync(path.join(tempDir, '.cursorignore')));
    assert.ok(fs.existsSync(path.join(tempDir, '.agentignore')));

    const content = fs.readFileSync(path.join(tempDir, '.cursorignore'), 'utf8');
    assert.ok(content.includes('package-lock.json'));
    assert.ok(content.includes('dist/'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
