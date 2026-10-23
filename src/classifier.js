import path from 'node:path';

export const CATEGORIES = {
  SOURCE_CODE: 'source_code',
  MARKUP_DOCS: 'markup_docs',
  CONFIG: 'config',
  FIXTURES_DATA: 'fixtures_data',
  GENERATED_BUNDLES: 'generated_bundles',
  LOCKFILES: 'lockfiles',
  ASSETS_MEDIA: 'assets_media',
  UNKNOWN: 'unknown'
};

const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx',
  '.py', '.rs', '.go', '.rb', '.java', '.cpp',
  '.c', '.cs', '.php', '.swift', '.kt', '.scala',
  '.zig', '.lua', '.sh', '.bash', '.ps1', '.sql'
]);

const DOCS_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.rst', '.adoc', '.html', '.htm'
]);

const CONFIG_EXTENSIONS = new Set([
  '.json', '.yaml', '.yml', '.toml', '.ini', '.xml'
]);

const LOCKFILE_NAMES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'cargo.lock', 'poetry.lock', 'composer.lock', 'gemfile.lock', 'bun.lockb'
]);

const MEDIA_EXTENSIONS = new Set([
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico',
  '.webp', '.pdf', '.woff', '.woff2', '.ttf', '.eot', '.mp4'
]);

/**
 * Classify a file by category and determine its context waste status.
 * @param {string} relativePath
 * @param {number} sizeInBytes
 * @param {number} tokenCount
 * @returns {{ category: string, isWaste: boolean, wasteReason: string | null }}
 */
export function classifyFile(relativePath, sizeInBytes = 0, tokenCount = 0) {
  const normalized = relativePath.replace(/\\/g, '/');
  const baseName = path.basename(normalized).toLowerCase();
  const ext = path.extname(baseName).toLowerCase();

  // 1. Lockfiles
  if (LOCKFILE_NAMES.has(baseName)) {
    return {
      category: CATEGORIES.LOCKFILES,
      isWaste: true,
      wasteReason: 'Dependency lockfile: high token volume with near-zero code-generation value'
    };
  }

  // 2. Generated bundles / Source maps
  if (
    normalized.includes('/dist/') ||
    normalized.startsWith('dist/') ||
    normalized.includes('/build/') ||
    normalized.startsWith('build/') ||
    normalized.includes('/out/') ||
    normalized.startsWith('out/') ||
    baseName.endsWith('.min.js') ||
    baseName.endsWith('.min.css') ||
    baseName.endsWith('.bundle.js') ||
    baseName.endsWith('.chunk.js') ||
    baseName.endsWith('.map')
  ) {
    return {
      category: CATEGORIES.GENERATED_BUNDLES,
      isWaste: true,
      wasteReason: 'Generated build output or sourcemap: corrupts AI context and causes hallucination'
    };
  }

  // 3. Fixtures & Test Snapshots
  if (
    normalized.includes('/fixtures/') ||
    normalized.startsWith('fixtures/') ||
    normalized.includes('/mocks/') ||
    normalized.startsWith('mocks/') ||
    normalized.includes('/__snapshots__/') ||
    baseName.endsWith('.snap') ||
    normalized.includes('/test_data/') ||
    normalized.includes('/testdata/')
  ) {
    const isWaste = sizeInBytes > 3072 || tokenCount > 800;
    return {
      category: CATEGORIES.FIXTURES_DATA,
      isWaste,
      wasteReason: isWaste ? 'Oversized fixture/snapshot data: bloats LLM memory with static payload' : null
    };
  }

  // 4. Media & SVG vector graphics
  if (MEDIA_EXTENSIONS.has(ext)) {
    return {
      category: CATEGORIES.ASSETS_MEDIA,
      isWaste: true,
      wasteReason: ext === '.svg' ? 'Raw SVG vector graphic: drains tokens on path coordinates' : 'Binary media asset'
    };
  }

  // 5. Config files
  if (CONFIG_EXTENSIONS.has(ext)) {
    const isWaste = sizeInBytes > 50000 || tokenCount > 10000;
    return {
      category: CATEGORIES.CONFIG,
      isWaste,
      wasteReason: isWaste ? 'Mammoth configuration payload' : null
    };
  }

  // 6. Source code
  if (CODE_EXTENSIONS.has(ext)) {
    if (baseName.endsWith('.d.ts') && sizeInBytes > 35000) {
      return {
        category: CATEGORIES.SOURCE_CODE,
        isWaste: true,
        wasteReason: 'Monolithic type declaration stub: consume thousands of tokens'
      };
    }
    return {
      category: CATEGORIES.SOURCE_CODE,
      isWaste: false,
      wasteReason: null
    };
  }

  // 7. Docs & Markdown / License
  if (
    DOCS_EXTENSIONS.has(ext) ||
    baseName === 'license' ||
    baseName === 'readme' ||
    baseName.startsWith('license.') ||
    baseName.startsWith('readme.')
  ) {
    return {
      category: CATEGORIES.MARKUP_DOCS,
      isWaste: false,
      wasteReason: null
    };
  }

  return {
    category: CATEGORIES.UNKNOWN,
    isWaste: false,
    wasteReason: null
  };
}
