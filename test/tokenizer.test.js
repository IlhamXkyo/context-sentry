import test from 'node:test';
import assert from 'node:assert';
import { countTokens, estimateCost, formatTokens, formatBytes, formatCost } from '../src/tokenizer.js';

test('countTokens calculates expected token range for standard code', () => {
  const code = `
function calculateTax(subtotal, rate) {
  if (subtotal < 0 || rate < 0) {
    throw new Error("Invalid parameters");
  }
  return subtotal * rate;
}
`;
  const tokens = countTokens(code);
  assert.ok(tokens > 15 && tokens < 50, `Expected tokens around 25-35, got ${tokens}`);
});

test('countTokens handles empty and invalid inputs gracefully', () => {
  assert.strictEqual(countTokens(''), 0);
  assert.strictEqual(countTokens(null), 0);
  assert.strictEqual(countTokens(undefined), 0);
});

test('countTokens correctly weights repetitive whitespace', () => {
  const spaces = ' '.repeat(100);
  const tokens = countTokens(spaces);
  assert.ok(tokens >= 25 && tokens <= 30);
});

test('estimateCost produces pricing for multiple models', () => {
  const costs = estimateCost(1_000_000);
  assert.strictEqual(costs['claude-3-7-sonnet'].costPerTurn, 3.00);
  assert.strictEqual(costs['gpt-4o'].costPerTurn, 2.50);
  assert.strictEqual(costs['claude-3-5-haiku'].costPerTurn, 0.80);
});

test('format helpers produce clean strings', () => {
  assert.strictEqual(formatTokens(500), '500');
  assert.strictEqual(formatTokens(25400), '25.4k');
  assert.strictEqual(formatTokens(1500000), '1.50M');

  assert.strictEqual(formatBytes(1024), '1 KB');
  assert.strictEqual(formatBytes(1048576), '1 MB');

  assert.strictEqual(formatCost(0.0002), '<$0.001');
  assert.strictEqual(formatCost(0.045), '$0.045');
  assert.strictEqual(formatCost(3.25), '$3.25');
});
