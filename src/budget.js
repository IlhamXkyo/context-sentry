import { formatTokens } from './tokenizer.js';

/**
 * Validate scan results against budget thresholds.
 * @param {import('./scanner.js').ScanResult} scanResult
 * @param {object} thresholds
 * @param {number} [thresholds.maxTokens]
 * @param {number} [thresholds.maxFileTokens]
 * @param {number} [thresholds.maxWasteRatio]
 * @returns {{ passed: boolean, violations: string[] }}
 */
export function checkBudget(scanResult, thresholds = {}) {
  const violations = [];

  // 1. Total Token Budget Ceiling
  if (thresholds.maxTokens && scanResult.totalTokens > thresholds.maxTokens) {
    violations.push(
      `Total repository context (${formatTokens(scanResult.totalTokens)} tokens) exceeds budget limit of ${formatTokens(thresholds.maxTokens)} tokens.`
    );
  }

  // 2. Individual File Token Ceiling
  if (thresholds.maxFileTokens && scanResult.topHogs) {
    for (const hog of scanResult.topHogs) {
      if (hog.tokens > thresholds.maxFileTokens) {
        violations.push(
          `File '${hog.path}' (${formatTokens(hog.tokens)} tokens) exceeds individual file limit of ${formatTokens(thresholds.maxFileTokens)} tokens.`
        );
      }
    }
  }

  // 3. Waste Ratio Ceiling
  if (thresholds.maxWasteRatio !== undefined && scanResult.wasteRatio > thresholds.maxWasteRatio) {
    violations.push(
      `Context Waste Ratio (${scanResult.wasteRatio}%) exceeds maximum allowable tolerance of ${thresholds.maxWasteRatio}%.`
    );
  }

  return {
    passed: violations.length === 0,
    violations
  };
}
