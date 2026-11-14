import {describe,it,expect,beforeAll} from 'vitest';
import {base32,fromBase32,totpAt,verifyTotp,encryptSecret,decryptSecret,
  generateMfaSecret,createRecoveryCodes,hashRecovery,normalizeRecovery,otpAuthUrl} from '../lib/mfa';

beforeAll(()=>{process.env.SESSION_SECRET='vitest-platform-only-secret-0123456789ABCDEF';});

describe('StandoffShop Platform v1.0.0 TOTP',()=>{
  const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  it('uses RFC 6238 compatible 30-second SHA1 TOTP values',()=>{
    expect(base32(Buffer.from('12345678901234567890'))).toBe(secret);
    expect(fromBase32(secret)?.toString()).toBe('12345678901234567890');
    expect(totpAt(secret,1)).toBe('287082');
    expect(verifyTotp(secret,'287082',59000)).toBe(1);
    expect(verifyTotp(secret,'00000x',59000)).toBeNull();
    expect(verifyTotp(secret,'287082',5*30000)).toBeNull();
  });
  it('encrypts MFA secret at rest using authenticated encryption',()=>{
    const original=generateMfaSecret();
    const cipher=encryptSecret(original);
    expect(cipher.startsWith('v1.')).toBe(true);
    expect(cipher).not.toContain(original);
    expect(decryptSecret(cipher)).toBe(original);
    const tampered=cipher.slice(0,-2)+'XX';
    expect(()=>decryptSecret(tampered)).toThrow();
  });
  it('creates high entropy one-time recovery codes and normalizes formatting',()=>{
    const codes=createRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for(const code of codes){
      expect(code).toMatch(/^[A-F0-9]{5}(?:-[A-F0-9]{5}){3}$/);
      expect(normalizeRecovery(code)).toBe(code.replaceAll('-',''));
      expect(hashRecovery(code)).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(hashRecovery(codes[0])).not.toBe(hashRecovery(codes[1]));
    expect(normalizeRecovery('something-invalid')).toBeNull();
  });
  it('provides a standards compliant URI without transmitting it to third parties',()=>{
    const uri=otpAuthUrl('test+user@example.test',secret);
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('issuer=StandoffShop');
    expect(uri).toContain('secret='+secret);
    expect(uri).toContain('test%2Buser');
  });
});
