import test from 'node:test';
import assert from 'node:assert';
import { checkBudget } from '../src/budget.js';

test('checkBudget passes when metrics stay within thresholds', () => {
  const scanResult = {
    totalTokens: 50000,
    wasteRatio: 12.5,
    topHogs: [
      { path: 'src/app.ts', tokens: 8000 }
    ]
  };

  const check = checkBudget(scanResult, {
    maxTokens: 100000,
    maxFileTokens: 10000,
    maxWasteRatio: 20
  });

  assert.strictEqual(check.passed, true);
  assert.strictEqual(check.violations.length, 0);
});

test('checkBudget flags total token ceiling violations', () => {
  const scanResult = {
    totalTokens: 150000,
    wasteRatio: 10,
    topHogs: []
  };

  const check = checkBudget(scanResult, {
    maxTokens: 100000
  });

  assert.strictEqual(check.passed, false);
  assert.ok(check.violations[0].includes('exceeds budget limit'));
});

test('checkBudget flags individual file token violations', () => {
  const scanResult = {
    totalTokens: 40000,
    wasteRatio: 5,
    topHogs: [
      { path: 'dist/bundle.js', tokens: 25000 }
    ]
  };

  const check = checkBudget(scanResult, {
    maxFileTokens: 15000
  });

  assert.strictEqual(check.passed, false);
  assert.ok(check.violations[0].includes("dist/bundle.js"));
});
