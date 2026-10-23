#!/usr/bin/env node

import path from 'node:path';
import {
  scanRepository,
  syncIgnoreFiles,
  checkBudget,
  renderTerminalReport,
  renderMarkdownReport
} from '../src/index.js';

function parseTokenLimit(val) {
  if (!val) return undefined;
  const str = String(val).toLowerCase().trim();
  if (str.endsWith('k')) {
    return parseFloat(str.slice(0, -1)) * 1000;
  }
  if (str.endsWith('m')) {
    return parseFloat(str.slice(0, -1)) * 1000000;
  }
  return parseInt(str, 10);
}

function printHelp() {
  console.log(`
🛡️  context-sentry - Universal AI Context & Token Bloat Profiler

USAGE:
  context-sentry [path] [flags]
  context-sentry sync [path] [flags]
  context-sentry check [path] --budget <tokens> [flags]

COMMANDS:
  scan [path]        Audit context payload and token bloat (default)
  sync [path]        Create or sync .agentignore, .cursorignore, .aiderignore, .claudeignore
  check [path]       Run budget enforcement tests for CI/CD

OPTIONS:
  --budget <tokens>     Max allowed total context tokens (e.g. 128k, 200k)
  --max-file <tokens>   Max allowed tokens per single file (e.g. 15k)
  --max-waste <pct>     Max allowable context waste ratio (e.g. 20 for 20%)
  --tool <name>         Simulate specific tool (cursor, aider, claude, agent)
  --json                Output results as machine-readable JSON
  --markdown            Output results formatted for GitHub PR comments
  --all                 Sync ignore rules across all AI tools
  --version, -v         Show version number
  --help, -h            Show this help manual

EXAMPLES:
  context-sentry .
  context-sentry . --budget 128k --max-file 15k
  context-sentry sync . --all
  context-sentry . --tool cursor --json
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log('context-sentry v1.0.0');
    process.exit(0);
  }

  let command = 'scan';
  let targetPath = '.';
  let isJson = false;
  let isMarkdown = false;
  let tool = null;
  let budgetVal = undefined;
  let maxFileVal = undefined;
  let maxWasteVal = undefined;
  let autoSync = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === 'sync' || arg === 'check' || arg === 'scan') {
      command = arg;
    } else if (arg === '--json') {
      isJson = true;
    } else if (arg === '--markdown') {
      isMarkdown = true;
    } else if (arg === '--sync') {
      autoSync = true;
    } else if (arg === '--budget' && args[i + 1]) {
      budgetVal = parseTokenLimit(args[++i]);
    } else if (arg === '--max-file' && args[i + 1]) {
      maxFileVal = parseTokenLimit(args[++i]);
    } else if (arg === '--max-waste' && args[i + 1]) {
      maxWasteVal = parseFloat(args[++i]);
    } else if (arg === '--tool' && args[i + 1]) {
      tool = args[++i].toLowerCase();
    } else if (!arg.startsWith('-')) {
      targetPath = arg;
    }
  }

  const rootDir = path.resolve(process.cwd(), targetPath);

  try {
    if (command === 'sync' || autoSync) {
      const syncResult = syncIgnoreFiles(rootDir, {
        tools: tool ? [tool] : undefined
      });
      if (isJson) {
        console.log(JSON.stringify({ status: 'ok', sync: syncResult }, null, 2));
      } else {
        console.log(`\n✔ Synchronized AI ignore configurations:`);
        if (syncResult.created.length > 0) {
          console.log(`  Created: ${syncResult.created.join(', ')}`);
        }
        if (syncResult.updated.length > 0) {
          console.log(`  Updated: ${syncResult.updated.join(', ')}`);
        }
        console.log('');
      }
      if (command === 'sync') {
        process.exit(0);
      }
    }

    // Determine ignore files based on tool simulation
    let ignoreFiles = undefined;
    if (tool === 'cursor') {
      ignoreFiles = ['.cursorignore', '.gitignore'];
    } else if (tool === 'aider') {
      ignoreFiles = ['.aiderignore', '.gitignore'];
    } else if (tool === 'claude') {
      ignoreFiles = ['.claudeignore', '.gitignore'];
    } else if (tool === 'agent') {
      ignoreFiles = ['.agentignore', '.gitignore'];
    }

    const scanResult = await scanRepository(rootDir, { ignoreFiles });

    // Handle Budget Checks if requested or command === 'check'
    const budgetCheck = checkBudget(scanResult, {
      maxTokens: budgetVal,
      maxFileTokens: maxFileVal,
      maxWasteRatio: maxWasteVal
    });

    if (isJson) {
      console.log(JSON.stringify({
        ...scanResult,
        budgetCheck
      }, null, 2));
    } else if (isMarkdown) {
      console.log(renderMarkdownReport(scanResult));
      if (!budgetCheck.passed) {
        console.log(`\n### ❌ Budget Gate Failures\n`);
        for (const v of budgetCheck.violations) {
          console.log(`- ${v}`);
        }
      }
    } else {
      console.log(renderTerminalReport(scanResult));
      if (!budgetCheck.passed) {
        console.error(`\x1b[1m\x1b[31m❌ Budget Violations:\x1b[0m`);
        for (const v of budgetCheck.violations) {
          console.error(`  \x1b[31m• ${v}\x1b[0m`);
        }
        console.error('');
      }
    }

    if (!budgetCheck.passed) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    process.exit(1);
  }
}

main();
