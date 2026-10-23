/**
 * Calibrated Tokenizer & Cost Estimator for Context-Sentry
 * Estimates token counts for code and prose matching modern LLM BPE boundary heuristics (cl100k / o200k / Claude).
 */

const MODEL_PRICING = {
  'claude-3-7-sonnet': { name: 'Claude 3.7 Sonnet', inputPerMillion: 3.00 },
  'gpt-4o': { name: 'GPT-4o', inputPerMillion: 2.50 },
  'claude-3-5-haiku': { name: 'Claude 3.5 Haiku', inputPerMillion: 0.80 },
  'gemini-2-0-flash': { name: 'Gemini 2.0 Flash', inputPerMillion: 0.10 }
};

// Calibrated regex reflecting OpenAI cl100k_base / Anthropic BPE subword and whitespace boundaries
const BPE_TOKEN_REGEX = /(?:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+|[\r\n]+|\s+(?!\S)|\s+/gu;

/**
 * Fast calibrated token count estimator.
 * Avoids 20MB wasm downloads while maintaining high accuracy against tiktoken on code repositories.
 * @param {string} text
 * @returns {number}
 */
export function countTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  if (text.length === 0) return 0;

  const matches = text.match(BPE_TOKEN_REGEX);
  if (!matches) {
    return Math.ceil(text.length / 4);
  }

  let totalTokens = 0;
  for (let i = 0; i < matches.length; i++) {
    const chunk = matches[i];
    const len = chunk.length;

    if (/^[\r\n\s]+$/.test(chunk)) {
      // Multiple spaces or newlines (approx 4 spaces = 1 token)
      totalTokens += Math.max(1, Math.ceil(len / 4));
    } else if (/^ ?\d+$/.test(chunk)) {
      totalTokens += Math.ceil(len / 3);
    } else if (len > 12 && !/^[ a-zA-Z]+$/.test(chunk)) {
      // Long continuous symbols, base64 or minified hex tokens
      totalTokens += Math.ceil(len / 3.5);
    } else if (/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(chunk)) {
      // CJK characters
      totalTokens += Math.ceil(len * 1.5);
    } else {
      totalTokens += 1;
    }
  }

  return Math.max(1, totalTokens);
}

/**
 * Calculate multi-model API cost per turn for a given token volume.
 * @param {number} tokens
 * @returns {Record<string, { name: string, costPerTurn: number, costFormatted: string }>}
 */
export function estimateCost(tokens) {
  const result = {};
  for (const [key, spec] of Object.entries(MODEL_PRICING)) {
    const cost = (tokens / 1_000_000) * spec.inputPerMillion;
    result[key] = {
      name: spec.name,
      costPerTurn: cost,
      costFormatted: formatCost(cost)
    };
  }
  return result;
}

/**
 * Format token count with human-readable suffixes (k, M).
 * @param {number} count
 * @returns {string}
 */
export function formatTokens(count) {
  if (count === null || count === undefined || isNaN(count)) return '0';
  if (count < 1000) return count.toString();
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1_000_000).toFixed(2)}M`;
}

/**
 * Format bytes to readable size.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format USD cost.
 * @param {number} dollars
 * @returns {string}
 */
export function formatCost(dollars) {
  if (dollars < 0.001) return '<$0.001';
  if (dollars < 1) return `$${dollars.toFixed(3)}`;
  return `$${dollars.toFixed(2)}`;
}
