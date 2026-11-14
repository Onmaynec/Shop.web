import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, checkPassword } from '../lib/auth';
import { fingerprint, trustedClientIp } from '../lib/rate-limit';

afterEach(()=>vi.unstubAllEnvs());

describe('account security',()=>{
  it('uses unique salts and verifies the correct password',()=>{
    const first=hashPassword('MySecurePassword_12345');
    const second=hashPassword('MySecurePassword_12345');
    expect(first).not.toBe(second);
    expect(checkPassword('MySecurePassword_12345',first)).toBe(true);
    expect(checkPassword('not-the-password',first)).toBe(false);
  });
  it('rejects malformed hashes safely',()=>{
    expect(checkPassword('password','invalid')).toBe(false);
    expect(checkPassword('password','f'.repeat(32)+':broken')).toBe(false);
  });
  it('never stores email addresses in plaintext rate-limit keys',()=>{
    const hash=fingerprint('  User@Example.com ');
    expect(hash).toHaveLength(64);
    expect(hash).toBe(fingerprint('user@example.com'));
    expect(hash).not.toContain('@');
  });
  it('does not trust client-provided IP headers by default',()=>{
    vi.stubEnv('TRUST_PROXY_HEADERS','false');
    const req=new Request('https://shop.example.test/login',{headers:{'x-forwarded-for':'198.51.100.7'}});
    expect(trustedClientIp(req)).toBeNull();
    vi.stubEnv('TRUST_PROXY_HEADERS','true');
    expect(trustedClientIp(req)).toBe('198.51.100.7');
  });
});
