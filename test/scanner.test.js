import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scanRepository, createIgnoreMatcher } from '../src/scanner.js';

test('createIgnoreMatcher correctly filters paths based on wildcard patterns', () => {
  const matcher = createIgnoreMatcher(['dist/', '*.min.js', 'package-lock.json']);

  assert.strictEqual(matcher('dist/bundle.js', false), true);
  assert.strictEqual(matcher('src/app.min.js', false), true);
  assert.strictEqual(matcher('package-lock.json', false), true);
  assert.strictEqual(matcher('src/index.ts', false), false);
});

test('scanRepository audits files and computes tokens, waste, and statistics', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-sentry-scan-'));

  try {
    // Set up mock repo structure
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'dist'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, 'src', 'index.js'), 'export function hello() { return "world"; }\n');
    fs.writeFileSync(path.join(tempDir, 'dist', 'bundle.min.js'), 'function a(){return"minified"}'.repeat(50));
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{"name": "test", "version": "1.0.0"}');

    const result = await scanRepository(tempDir, {
      ignoreFiles: [] // no ignore files to allow seeing all 3 files
    });

    assert.strictEqual(result.totalFiles, 3);
    assert.ok(result.totalTokens > 0);
    assert.ok(result.wasteFilesCount >= 2); // bundle.min.js and package-lock.json
    assert.ok(result.wasteRatio > 0);
    assert.strictEqual(result.topHogs.length, 3);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
