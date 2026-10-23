import test from 'node:test';
import assert from 'node:assert';
import { auditSecurity } from '../src/security.js';

test('auditSecurity catches exposed sensitive environment files', () => {
  const issues = auditSecurity('.env.local', 'DATABASE_URL=postgres://localhost:5432/db');
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].severity, 'CRITICAL');
  assert.strictEqual(issues[0].type, 'Sensitive Environment File');
});

test('auditSecurity catches hardcoded AWS keys', () => {
  const code = 'const s3Key = "AKIA1234567890ABCDEF";';
  const issues = auditSecurity('src/aws.js', code);
  assert.ok(issues.some(i => i.type === 'AWS Access Key'));
});

test('auditSecurity catches GitHub personal access tokens', () => {
  const code = 'const token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";';
  const issues = auditSecurity('scripts/deploy.js', code);
  assert.ok(issues.some(i => i.type === 'GitHub Personal/OAuth Token'));
});

test('auditSecurity catches private keys', () => {
  const key = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
  const issues = auditSecurity('cert.pem', key);
  assert.ok(issues.some(i => i.type === 'Private Key Certificate'));
});

test('auditSecurity reports zero issues on safe files', () => {
  const safeCode = 'export const API_URL = "https://api.example.com/v1";';
  const issues = auditSecurity('src/config.ts', safeCode);
  assert.strictEqual(issues.length, 0);
});
