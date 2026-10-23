import test from 'node:test';
import assert from 'node:assert';
import { classifyFile, CATEGORIES } from '../src/classifier.js';

test('classifyFile identifies dependency lockfiles as waste', () => {
  const npmLock = classifyFile('package-lock.json', 150000, 35000);
  assert.strictEqual(npmLock.category, CATEGORIES.LOCKFILES);
  assert.strictEqual(npmLock.isWaste, true);

  const pnpmLock = classifyFile('pnpm-lock.yaml', 80000, 20000);
  assert.strictEqual(pnpmLock.category, CATEGORIES.LOCKFILES);
  assert.strictEqual(pnpmLock.isWaste, true);
});

test('classifyFile identifies generated build bundles as waste', () => {
  const minJs = classifyFile('dist/bundle.min.js', 45000, 12000);
  assert.strictEqual(minJs.category, CATEGORIES.GENERATED_BUNDLES);
  assert.strictEqual(minJs.isWaste, true);

  const sourcemap = classifyFile('build/static/main.js.map', 100000, 25000);
  assert.strictEqual(sourcemap.category, CATEGORIES.GENERATED_BUNDLES);
  assert.strictEqual(sourcemap.isWaste, true);
});

test('classifyFile identifies oversized fixtures as waste', () => {
  const largeMock = classifyFile('fixtures/users.json', 12000, 3200);
  assert.strictEqual(largeMock.category, CATEGORIES.FIXTURES_DATA);
  assert.strictEqual(largeMock.isWaste, true);

  const tinyMock = classifyFile('fixtures/small.json', 500, 100);
  assert.strictEqual(tinyMock.category, CATEGORIES.FIXTURES_DATA);
  assert.strictEqual(tinyMock.isWaste, false);
});

test('classifyFile identifies normal source code as non-waste', () => {
  const source = classifyFile('src/models/user.ts', 2400, 600);
  assert.strictEqual(source.category, CATEGORIES.SOURCE_CODE);
  assert.strictEqual(source.isWaste, false);
  assert.strictEqual(source.wasteReason, null);
});

test('classifyFile identifies raw vector graphics as waste', () => {
  const icon = classifyFile('public/icons/logo.svg', 8000, 2200);
  assert.strictEqual(icon.category, CATEGORIES.ASSETS_MEDIA);
  assert.strictEqual(icon.isWaste, true);
});
