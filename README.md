# 🛡️ context-sentry

> **Universal AI Context & Token Bloat Profiler.**  
> Audit repository context payload, eliminate silent token waste, prevent credential leakage into LLM clouds, and synchronize ignore configurations across Cursor, Claude Code, Aider, and autonomous agents in one command.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![Tests Passing](https://img.shields.io/badge/tests-22%20passed-brightgreen.svg)](test/)

---

## The Problem: Silent Token Waste & Context Degradation

When you use AI coding assistants like **Cursor Composer**, **Claude Code**, **Aider**, or **Windsurf**, the assistant traverses your codebase to build an active working context.

Without strict boundaries, projects silently feed hundreds of thousands of useless tokens into every single turn:
- **Dependency Lockfiles** (`package-lock.json`, `pnpm-lock.yaml`, `Cargo.lock`): 20,000 to 120,000 tokens of checksums and resolved URLs that offer near-zero semantic value for writing code.
- **Minified Build Bundles & Source Maps** (`dist/bundle.min.js`, `*.map`): Unreadable machine output that causes context saturation and hallucinations.
- **Mammoth Fixtures & Snapshots** (`fixtures/**/*.json`, `*.snap`): Giant mock payloads eating up 50% of the active context window.
- **Raw Vector SVG Graphics** (`*.svg`): Repetitive coordinate numbers consuming thousands of tokens.
- **Accidental Credential Exposure**: Private keys, `.env` files, or access tokens that were in `.gitignore` but ingested anyway because the AI tool requires separate ignore files (`.cursorignore`, `.agentignore`).

This leads directly to **Context Degradation Syndrome**: AI models drop earlier system instructions, forget architectural constraints, hallucinate nonexistent imports, and rack up unexpected API bills.

`context-sentry` gives you instant visibility and automated protection.

---

## ⚡ 30-Second Quickstart

Run directly with zero installation via `npx`:

```bash
# Scan current repository
npx context-sentry .

# Scan and automatically sync .agentignore, .cursorignore, .aiderignore, .claudeignore
npx context-sentry sync .

# Enforce a 128k token ceiling in CI / pre-commit
npx context-sentry check . --budget 128k --max-file 15k
```

Or install globally:

```bash
npm install -g context-sentry
```

---

## 🔍 Visual Terminal Dashboard

```text
╔═══════════════════════════════════════════════════════════════════╗
║                  CONTEXT-SENTRY REPOSITORY AUDIT                  ║
╚═══════════════════════════════════════════════════════════════════╝

Context Overview:
  Directory   : /path/to/project
  Files       : 142 included
  Total Size  : 3.2 MB
  Total Tokens: 684.2k tokens
  Context Waste: 492.1k (71.9%) in 18 files

Estimated Inference Cost (per agent turn):
  Claude 3.7 Sonnet : $2.053 (potential saving: $1.476)
  GPT-4o            : $1.711 (potential saving: $1.230)
  Claude 3.5 Haiku  : $0.547
  Gemini 2.0 Flash  : $0.068

Payload Breakdown by Category:
  lockfiles          [████████████████]  420.5k ( 61.5%)  2 files
  source_code        [████░░░░░░░░░░░░]  142.1k ( 20.8%)  115 files
  generated_bundles  [██░░░░░░░░░░░░░░]   71.6k ( 10.5%)  16 files
  fixtures_data      [█░░░░░░░░░░░░░░░]   32.4k (  4.7%)  4 files
  markup_docs        [░░░░░░░░░░░░░░░░]   17.6k (  2.5%)  5 files

Top Context Hogs (Files Eating the Most Tokens):
  Tokens    Size      Category           File
  ────────────────────────────────────────────────────────────
  380.2k    1.4 MB    lockfiles          [WASTE] package-lock.json
  71.6k     240 KB    generated_bundles  [WASTE] dist/bundle.min.js
  40.3k     180 KB    lockfiles          [WASTE] pnpm-lock.yaml
  22.1k     95 KB     fixtures_data      [WASTE] test/fixtures/large_users.json

⚠️  Security & Credential Exposure Risks Detected:
  [CRITICAL] .env.local: File '.env.local' is exposed and might be sent to external LLM APIs
  Recommendation: Add these files to your .agentignore or .cursorignore immediately!
```

---

## 🌟 Key Capabilities

### 1. Calibrated Token Counter & Inference Cost Matrix
- Accurately approximates modern BPE subword and whitespace token boundaries (matching OpenAI `cl100k_base` and Anthropic tokenization principles) without heavy 20MB wasm dependencies.
- Calculates per-turn API costs across **Claude 3.7 Sonnet**, **GPT-4o**, **Claude 3.5 Haiku**, and **Gemini 2.0 Flash**.

### 2. Context Waste Ratio (CWR) Metric
- Automatically categorizes all files into `source_code`, `lockfiles`, `generated_bundles`, `fixtures_data`, `assets_media`, `configs`, and `markup_docs`.
- Identifies files that inflate context payload without contributing to software engineering intelligence.

### 3. Secret Ingestion Watchdog
- Audits unignored files for leaked credentials before they get transmitted to cloud LLM inference endpoints.
- Detects AWS keys, GitHub tokens, Anthropic/OpenAI API keys, private key certificates (`.pem`, `.key`), and unignored `.env` files.

### 4. Universal Ignore Synchronizer (`sync`)
- Generates or updates unified, clean rules across all modern AI coding tools:
  - `.agentignore` (General autonomous agents)
  - `.cursorignore` (Cursor)
  - `.aiderignore` (Aider)
  - `.claudeignore` (Claude Code)
- Intelligently merges recommended boundaries without overwriting custom project rules.

### 5. CI/CD Budget Gates (`check`)
- Prevent pull requests or branches from introducing massive fixtures or unignored bundles that bankrupt the team's AI coding quota.
- Exit code 1 on budget violation for automated workflow prevention.

---

## 🛠️ Command Line Interface

```bash
# Basic audit of target directory
context-sentry [path]

# Simulate a specific tool environment (evaluating only that tool's ignore files)
context-sentry . --tool cursor
context-sentry . --tool aider
context-sentry . --tool claude
context-sentry . --tool agent

# Synchronize ignore configurations
context-sentry sync .

# CI Budget enforcement
context-sentry check . --budget 150k --max-file 20k --max-waste 15

# Machine-readable output for scripts
context-sentry . --json

# Markdown output for GitHub PR comments
context-sentry . --markdown
```

### CLI Flags

| Flag | Description |
| :--- | :--- |
| `--budget <tokens>` | Maximum allowed total context tokens (e.g. `128k`, `200000`). |
| `--max-file <tokens>` | Maximum allowed tokens in any single file (e.g. `15k`). |
| `--max-waste <pct>` | Maximum acceptable Context Waste Ratio percentage (e.g. `20`). |
| `--tool <name>` | Simulate specific tool: `cursor`, `aider`, `claude`, or `agent`. |
| `--json` | Print full audit data in JSON format. |
| `--markdown` | Print audit summary formatted in GitHub Markdown. |
| `--all` | Target all AI assistants when syncing ignore files. |
| `--version, -v` | Print context-sentry version. |
| `--help, -h` | Show CLI help manual. |

---

## 🤖 GitHub Action Workflow Example

Add this workflow to `.github/workflows/context-budget.yml` to prevent context bloat on pull requests:

```yaml
name: AI Context Budget Gate

on:
  pull_request:
    branches: [main, master]

jobs:
  context-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run Context-Sentry Audit
        run: |
          npx context-sentry check . --budget 150k --max-file 25k --max-waste 20
```

---

## 📦 Programmatic Node.js API

You can also import `context-sentry` as an ES Module in your scripts:

```javascript
import {
  scanRepository,
  countTokens,
  estimateCost,
  classifyFile,
  auditSecurity,
  syncIgnoreFiles,
  checkBudget
} from 'context-sentry';

// Scan repository
const result = await scanRepository('./my-repo');
console.log(`Total tokens: ${result.totalTokens}`);
console.log(`Waste ratio: ${result.wasteRatio}%`);

// Check budget programmatically
const check = checkBudget(result, { maxTokens: 128000 });
if (!check.passed) {
  console.error('Violations:', check.violations);
}
```

---

## 📄 License

MIT © [IlhamXkyo](https://github.com/IlhamXkyo)
