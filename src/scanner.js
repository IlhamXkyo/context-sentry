import fs from 'node:fs';
import path from 'node:path';
import { countTokens } from './tokenizer.js';
import { classifyFile } from './classifier.js';
import { auditSecurity } from './security.js';

const DEFAULT_ALWAYS_IGNORE = [
  '.git', 'node_modules', '__pycache__', '.venv',
  'env', '.idea', '.vscode', '.DS_Store', 'Thumbs.db'
];

/**
 * Simple robust glob matcher for ignore patterns.
 * Supports basic gitignore/cursorignore syntax: wildcards (*), directory markers (/), comments (#).
 * @param {string[]} patterns
 * @returns {(filePath: string, isDirectory: boolean) => boolean}
 */
export function createIgnoreMatcher(patterns) {
  const rules = [];

  for (const raw of patterns) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const isNegation = trimmed.startsWith('!');
    const cleanPattern = isNegation ? trimmed.slice(1).trim() : trimmed;
    const isDirOnly = cleanPattern.endsWith('/');
    const patternNoSlash = isDirOnly ? cleanPattern.slice(0, -1) : cleanPattern;

    // Convert glob pattern to regular expression
    let regexStr = patternNoSlash
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');

    if (!cleanPattern.startsWith('/') && !cleanPattern.startsWith('.*')) {
      regexStr = '(?:^|/)' + regexStr;
    } else if (cleanPattern.startsWith('/')) {
      regexStr = '^' + regexStr.slice(1);
    }

    regexStr += isDirOnly ? '(?:/.*|$)' : '(?:/.*|$)';

    rules.push({
      regex: new RegExp(regexStr),
      isNegation,
      isDirOnly
    });
  }

  return function matches(targetPath, isDirectory = false) {
    const normalized = targetPath.replace(/\\/g, '/').replace(/^\.\//, '');
    let ignored = false;

    for (const rule of rules) {
      if (rule.isDirOnly && !isDirectory && !normalized.includes('/')) {
        // Continue checking
      }
      if (rule.regex.test(normalized)) {
        ignored = !rule.isNegation;
      }
    }
    return ignored;
  };
}

/**
 * Load ignore patterns from specified files in repository.
 * @param {string} rootDir
 * @param {string[]} fileNames
 * @returns {string[]}
 */
export function loadIgnorePatterns(rootDir, fileNames = ['.agentignore', '.cursorignore', '.gitignore']) {
  const patterns = [...DEFAULT_ALWAYS_IGNORE];
  for (const file of fileNames) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split(/\r?\n/);
        patterns.push(...lines);
      } catch (err) {
        // Silently skip unreadable ignore files
      }
    }
  }
  return patterns;
}

/**
 * Check if a file buffer appears to be binary.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
export function isBinaryBuffer(buffer) {
  const maxBytes = Math.min(buffer.length, 512);
  for (let i = 0; i < maxBytes; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

/**
 * Scan a repository directory and generate comprehensive context payload profile.
 * @param {string} targetDir
 * @param {object} options
 * @param {string[]} [options.ignoreFiles]
 * @param {boolean} [options.includeIgnored=false]
 * @param {number} [options.maxFileSize=10485760] // 10MB default ceiling
 * @returns {Promise<ScanResult>}
 */
export async function scanRepository(targetDir, options = {}) {
  const root = path.resolve(targetDir);
  if (!fs.existsSync(root)) {
    throw new Error(`Target directory does not exist: ${root}`);
  }

  const ignoreFileNames = options.ignoreFiles || ['.agentignore', '.cursorignore', '.aiderignore', '.claudeignore', '.gitignore'];
  const rawPatterns = loadIgnorePatterns(root, ignoreFileNames);
  const matcher = createIgnoreMatcher(rawPatterns);

  const files = [];
  const securityIssues = [];
  const categoryStats = {};

  function walk(currentDir) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(root, fullPath).replace(/\\/g, '/');

      // Check default always-ignored directories
      if (DEFAULT_ALWAYS_IGNORE.includes(entry.name)) {
        continue;
      }

      const isDir = entry.isDirectory();
      const isIgnored = matcher(relPath, isDir);

      if (isIgnored && !options.includeIgnored) {
        continue;
      }

      if (isDir) {
        walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          const size = stat.size;

          if (size > (options.maxFileSize || 10 * 1024 * 1024)) {
            continue; // Skip gigantic files like big database dumps or binaries
          }

          let content = '';
          let tokens = 0;
          let isBinary = false;

          const buffer = fs.readFileSync(fullPath);
          isBinary = isBinaryBuffer(buffer);

          if (!isBinary) {
            content = buffer.toString('utf8');
            tokens = countTokens(content);
          } else {
            tokens = Math.ceil(size / 4); // Estimation for binary data
          }

          const classification = classifyFile(relPath, size, tokens);

          // Audit security on non-binary files
          if (!isBinary) {
            const secProblems = auditSecurity(relPath, content);
            securityIssues.push(...secProblems);
          }

          const fileRecord = {
            path: relPath,
            size,
            tokens,
            isBinary,
            category: classification.category,
            isWaste: classification.isWaste,
            wasteReason: classification.wasteReason
          };

          files.push(fileRecord);

          // Tally categories
          if (!categoryStats[classification.category]) {
            categoryStats[classification.category] = {
              count: 0,
              size: 0,
              tokens: 0,
              wasteTokens: 0
            };
          }
          categoryStats[classification.category].count += 1;
          categoryStats[classification.category].size += size;
          categoryStats[classification.category].tokens += tokens;
          if (classification.isWaste) {
            categoryStats[classification.category].wasteTokens += tokens;
          }
        } catch (err) {
          // File read or permission error, proceed
        }
      }
    }
  }

  walk(root);

  // Compute aggregate metrics
  let totalSize = 0;
  let totalTokens = 0;
  let wasteTokens = 0;
  let wasteFilesCount = 0;

  for (const f of files) {
    totalSize += f.size;
    totalTokens += f.tokens;
    if (f.isWaste) {
      wasteTokens += f.tokens;
      wasteFilesCount += 1;
    }
  }

  const wasteRatio = totalTokens > 0 ? (wasteTokens / totalTokens) * 100 : 0;

  // Sort descending by token consumption
  const topHogs = [...files]
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 10);

  return {
    root,
    totalFiles: files.length,
    totalSize,
    totalTokens,
    wasteTokens,
    wasteFilesCount,
    wasteRatio: parseFloat(wasteRatio.toFixed(1)),
    categoryStats,
    topHogs,
    securityIssues,
    allFiles: files
  };
}
