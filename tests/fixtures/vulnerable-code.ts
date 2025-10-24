// Test fixture with intentional security issues

// SQL Injection vulnerability
export function unsafeQuery(userInput: string) {
  const query = `SELECT * FROM users WHERE id = ${userInput}`;
  return query;
}

// XSS vulnerability
export function unsafeHTML(content: string) {
  document.innerHTML = content;
}

// Hardcoded secrets
export const API_KEY = 'AKIA1234567890ABCDEF';
export const PASSWORD = 'mySecretPassword123';

// Command injection
export function execCommand(cmd: string) {
  const fullCmd = `ls ${cmd}`;
  return fullCmd;
}

// Weak crypto
import crypto from 'crypto';
export function weakHash(data: string) {
  return crypto.createHash('md5').update(data).digest('hex');
}


