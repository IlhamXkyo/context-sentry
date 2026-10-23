import { formatTokens, formatBytes, estimateCost } from './tokenizer.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

/**
 * Generate a visual ASCII bar.
 * @param {number} percentage
 * @param {number} length
 * @returns {string}
 */
function makeBar(percentage, length = 20) {
  const filled = Math.min(length, Math.max(0, Math.round((percentage / 100) * length)));
  const empty = length - filled;
  return `${CYAN}${'█'.repeat(filled)}${GRAY}${'░'.repeat(empty)}${RESET}`;
}

/**
 * Render terminal report.
 * @param {import('./scanner.js').ScanResult} result
 * @returns {string}
 */
export function renderTerminalReport(result) {
  const cost = estimateCost(result.totalTokens);
  const wasteCost = estimateCost(result.wasteTokens);

  let out = '\n';
  out += `${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════════════╗${RESET}\n`;
  out += `${BOLD}${CYAN}║                  CONTEXT-SENTRY REPOSITORY AUDIT                  ║${RESET}\n`;
  out += `${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════════════╝${RESET}\n\n`;

  // Summary Metrics
  out += `${BOLD}Context Overview:${RESET}\n`;
  out += `  Directory   : ${GRAY}${result.root}${RESET}\n`;
  out += `  Files       : ${BOLD}${result.totalFiles.toLocaleString()}${RESET} included\n`;
  out += `  Total Size  : ${BOLD}${formatBytes(result.totalSize)}${RESET}\n`;
  out += `  Total Tokens: ${BOLD}${CYAN}${formatTokens(result.totalTokens)}${RESET} tokens\n`;

  // Waste Metric
  const wasteColor = result.wasteRatio > 30 ? RED : result.wasteRatio > 15 ? YELLOW : GREEN;
  out += `  Context Waste: ${wasteColor}${BOLD}${formatTokens(result.wasteTokens)} (${result.wasteRatio}%)${RESET} in ${result.wasteFilesCount} files\n\n`;

  // Estimated API Inference Cost
  out += `${BOLD}Estimated Inference Cost (per agent turn):${RESET}\n`;
  out += `  Claude 3.7 Sonnet : ${BOLD}${cost['claude-3-7-sonnet'].costFormatted}${RESET} ${GRAY}(potential saving: ${wasteCost['claude-3-7-sonnet'].costFormatted})${RESET}\n`;
  out += `  GPT-4o            : ${BOLD}${cost['gpt-4o'].costFormatted}${RESET} ${GRAY}(potential saving: ${wasteCost['gpt-4o'].costFormatted})${RESET}\n`;
  out += `  Claude 3.5 Haiku  : ${BOLD}${cost['claude-3-5-haiku'].costFormatted}${RESET}\n`;
  out += `  Gemini 2.0 Flash  : ${BOLD}${cost['gemini-2-0-flash'].costFormatted}${RESET}\n\n`;

  // Category Breakdown
  out += `${BOLD}Payload Breakdown by Category:${RESET}\n`;
  for (const [cat, data] of Object.entries(result.categoryStats)) {
    const pct = result.totalTokens > 0 ? (data.tokens / result.totalTokens) * 100 : 0;
    const catName = cat.padEnd(18, ' ');
    const tokensFormatted = formatTokens(data.tokens).padStart(7, ' ');
    const bar = makeBar(pct, 16);
    out += `  ${GRAY}${catName}${RESET} [${bar}] ${BOLD}${tokensFormatted}${RESET} (${pct.toFixed(1).padStart(5, ' ')}%)  ${GRAY}${data.count} files${RESET}\n`;
  }
  out += '\n';

  // Top 10 Context Hogs
  if (result.topHogs.length > 0) {
    out += `${BOLD}${YELLOW}Top Context Hogs (Files Eating the Most Tokens):${RESET}\n`;
    out += `  ${GRAY}${'Tokens'.padEnd(9)} ${'Size'.padEnd(9)} ${'Category'.padEnd(18)} File${RESET}\n`;
    out += `  ${GRAY}${'─'.repeat(60)}${RESET}\n`;
    for (const hog of result.topHogs) {
      const tokensStr = formatTokens(hog.tokens).padEnd(9);
      const sizeStr = formatBytes(hog.size).padEnd(9);
      const catStr = hog.category.padEnd(18);
      const flag = hog.isWaste ? `${RED}[WASTE]${RESET} ` : '';
      out += `  ${CYAN}${tokensStr}${RESET} ${sizeStr} ${GRAY}${catStr}${RESET} ${flag}${hog.path}\n`;
      if (hog.wasteReason) {
        out += `  ${GRAY}└─ ${hog.wasteReason}${RESET}\n`;
      }
    }
    out += '\n';
  }

  // Security & Credential Exposure Alerts
  if (result.securityIssues.length > 0) {
    out += `${BOLD}${RED}⚠️  Security & Credential Exposure Risks Detected:${RESET}\n`;
    for (const sec of result.securityIssues) {
      out += `  ${RED}[${sec.severity}]${RESET} ${BOLD}${sec.file}${RESET}: ${sec.detail}\n`;
    }
    out += `  ${YELLOW}Recommendation: Add these files to your .agentignore or .cursorignore immediately!${RESET}\n\n`;
  } else {
    out += `${GREEN}✔ No exposed secrets or sensitive env files detected in context.${RESET}\n\n`;
  }

  return out;
}

/**
 * Render Markdown report suitable for GitHub PR comments.
 * @param {import('./scanner.js').ScanResult} result
 * @returns {string}
 */
export function renderMarkdownReport(result) {
  const cost = estimateCost(result.totalTokens);
  const wasteCost = estimateCost(result.wasteTokens);

  let md = `## 🛡️ Context-Sentry Audit Report\n\n`;
  md += `**Repository:** \`${result.root}\`  \n`;
  md += `**Total Context Payload:** **${formatTokens(result.totalTokens)}** tokens (${formatBytes(result.totalSize)}) across **${result.totalFiles}** files.  \n`;
  md += `**Context Waste Ratio:** **${result.wasteRatio}%** (${formatTokens(result.wasteTokens)} tokens in ${result.wasteFilesCount} files).  \n\n`;

  md += `### 💰 Estimated AI Cost Per Turn\n`;
  md += `| AI Model | Total Cost | Wasted Cost | Potential Savings |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  md += `| Claude 3.7 Sonnet | ${cost['claude-3-7-sonnet'].costFormatted} | ${wasteCost['claude-3-7-sonnet'].costFormatted} | -${result.wasteRatio}% |\n`;
  md += `| GPT-4o | ${cost['gpt-4o'].costFormatted} | ${wasteCost['gpt-4o'].costFormatted} | -${result.wasteRatio}% |\n`;
  md += `| Gemini 2.0 Flash | ${cost['gemini-2-0-flash'].costFormatted} | ${wasteCost['gemini-2-0-flash'].costFormatted} | -${result.wasteRatio}% |\n\n`;

  md += `### 📊 Top Context Hogs\n`;
  md += `| File | Category | Size | Tokens | Status |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  for (const hog of result.topHogs) {
    const status = hog.isWaste ? `⚠️ Waste` : `✅ Essential`;
    md += `| \`${hog.path}\` | \`${hog.category}\` | ${formatBytes(hog.size)} | **${formatTokens(hog.tokens)}** | ${status} |\n`;
  }
  md += `\n`;

  if (result.securityIssues.length > 0) {
    md += `### ⚠️ Security Warnings\n`;
    for (const sec of result.securityIssues) {
      md += `- **[${sec.severity}]** \`${sec.file}\`: ${sec.detail}\n`;
    }
    md += `\n`;
  }

  md += `*Generated by [context-sentry](https://github.com/IlhamXkyo/context-sentry)*\n`;
  return md;
}
