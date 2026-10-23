import fs from 'node:fs';
import path from 'node:path';

export const TARGET_FILES = {
  AGENT: '.agentignore',
  CURSOR: '.cursorignore',
  AIDER: '.aiderignore',
  CLAUDE: '.claudeignore'
};

export const RECOMMENDED_PATTERNS = [
  '# === Build Artifacts & Generated Bundles ===',
  'dist/',
  'build/',
  'out/',
  '.next/',
  '.nuxt/',
  '.output/',
  '*.min.js',
  '*.min.css',
  '*.bundle.js',
  '*.chunk.js',
  '*.map',
  '',
  '# === Dependency Lockfiles (High Token Waste, Near-Zero AI Value) ===',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'Cargo.lock',
  'poetry.lock',
  'composer.lock',
  '',
  '# === Test Fixtures & Heavy Snapshots ===',
  '**/__snapshots__/',
  '*.snap',
  'fixtures/**/*.json',
  'mock-data/**/*.json',
  '',
  '# === Raw Vector Graphics & Heavy Media ===',
  '*.svg',
  '*.ico',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.webp',
  '*.pdf',
  '',
  '# === Secrets & Environment Exposure Safeguard ===',
  '.env',
  '.env.*',
  '!.env.example',
  '*.pem',
  '*.key',
  '*.pfx',
  'id_rsa',
  'id_ed25519'
];

/**
 * Merge new patterns into existing file content without duplicating lines.
 * @param {string} existingContent
 * @param {string[]} newPatterns
 * @returns {string}
 */
export function mergePatterns(existingContent, newPatterns) {
  const existingLines = existingContent ? existingContent.split(/\r?\n/) : [];
  const existingSet = new Set(existingLines.map(l => l.trim()).filter(l => l && !l.startsWith('#')));

  const addedLines = [];
  for (const line of newPatterns) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      addedLines.push(line);
    } else if (!existingSet.has(trimmed)) {
      addedLines.push(line);
      existingSet.add(trimmed);
    }
  }

  if (existingLines.length === 0) {
    return addedLines.join('\n') + '\n';
  }

  return existingContent.trimEnd() + '\n\n' + addedLines.join('\n') + '\n';
}

/**
 * Sync or create ignore files in target repository.
 * @param {string} targetDir
 * @param {object} options
 * @param {boolean} [options.all=true]
 * @param {string[]} [options.tools]
 * @returns {{ updated: string[], created: string[] }}
 */
export function syncIgnoreFiles(targetDir, options = {}) {
  const root = path.resolve(targetDir);
  if (!fs.existsSync(root)) {
    throw new Error(`Target directory does not exist: ${root}`);
  }

  let selectedTargets = Object.values(TARGET_FILES);
  if (options.tools && options.tools.length > 0) {
    selectedTargets = options.tools.map(t => {
      const upper = t.toUpperCase();
      return TARGET_FILES[upper] || `.${t.toLowerCase()}ignore`;
    });
  }

  const result = {
    updated: [],
    created: []
  };

  for (const fileName of selectedTargets) {
    const filePath = path.join(root, fileName);
    let isNew = false;
    let currentContent = '';

    if (fs.existsSync(filePath)) {
      currentContent = fs.readFileSync(filePath, 'utf8');
    } else {
      isNew = true;
    }

    const merged = mergePatterns(currentContent, RECOMMENDED_PATTERNS);
    fs.writeFileSync(filePath, merged, 'utf8');

    if (isNew) {
      result.created.push(fileName);
    } else {
      result.updated.push(fileName);
    }
  }

  return result;
}
