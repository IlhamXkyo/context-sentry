import path from 'node:path';

const SECRET_PATTERNS = [
  {
    name: 'AWS Access Key',
    regex: /\bAKIA[0-9A-Z]{16}\b/
  },
  {
    name: 'GitHub Personal/OAuth Token',
    regex: /\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/
  },
  {
    name: 'Anthropic API Key',
    regex: /\bsk-ant-[a-zA-Z0-9_\-]{32,}\b/
  },
  {
    name: 'OpenAI API Key',
    regex: /\bsk-(proj-)?[a-zA-Z0-9_\-]{32,}\b/
  },
  {
    name: 'Private Key Certificate',
    regex: /-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/
  },
  {
    name: 'Hardcoded Secret Assignment',
    regex: /(?:api_?key|auth_?token|secret_?key|access_?token)\s*[:=]\s*["']([a-zA-Z0-9_\-.~+=]{24,})["']/i
  }
];

const SUSPICIOUS_ENV_FILES = new Set([
  '.env', '.env.local', '.env.production', '.env.prod',
  '.env.staging', '.env.development.local', 'id_rsa', 'id_ed25519'
]);

/**
 * Scan file content and metadata for exposed security risks.
 * @param {string} relativePath
 * @param {string} content
 * @returns {Array<{ type: string, file: string, detail: string, severity: 'HIGH' | 'CRITICAL' }>}
 */
export function auditSecurity(relativePath, content) {
  const issues = [];
  const normalized = relativePath.replace(/\\/g, '/');
  const baseName = path.basename(normalized).toLowerCase();

  // 1. Check for sensitive file names
  if (SUSPICIOUS_ENV_FILES.has(baseName)) {
    issues.push({
      type: 'Sensitive Environment File',
      file: relativePath,
      detail: `File '${baseName}' is exposed and might be sent to external LLM APIs`,
      severity: 'CRITICAL'
    });
  }

  if (baseName.endsWith('.pem') || baseName.endsWith('.key') || baseName.endsWith('.pfx')) {
    issues.push({
      type: 'Cryptographic Key File',
      file: relativePath,
      detail: `Private key certificate file '${baseName}' is exposed in project tree`,
      severity: 'CRITICAL'
    });
  }

  // 2. Check content for secret patterns
  if (content && typeof content === 'string') {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(content)) {
        issues.push({
          type: pattern.name,
          file: relativePath,
          detail: `Potential exposed ${pattern.name} found inside content`,
          severity: 'HIGH'
        });
        break; // Stop at first pattern match per file to avoid flooding
      }
    }
  }

  return issues;
}
