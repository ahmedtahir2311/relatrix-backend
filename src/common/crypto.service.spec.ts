import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = new CryptoService();
  });

  describe('encrypt / decrypt roundtrip', () => {
    it('decrypts to the original plaintext', () => {
      const plain = 'my-super-secret-password!@#$%^';
      expect(service.decrypt(service.encrypt(plain))).toBe(plain);
    });

    it('handles empty string', () => {
      expect(service.decrypt(service.encrypt(''))).toBe('');
    });

    it('handles unicode and special characters', () => {
      const plain = '密码 пароль パスワード 🔑';
      expect(service.decrypt(service.encrypt(plain))).toBe(plain);
    });

    it('handles long strings', () => {
      const plain = 'x'.repeat(10_000);
      expect(service.decrypt(service.encrypt(plain))).toBe(plain);
    });
  });

  describe('encryption properties', () => {
    it('produces base64-encoded output (not the original plaintext)', () => {
      const plain = 'hello';
      const cipher = service.encrypt(plain);
      expect(cipher).not.toBe(plain);
      expect(() => Buffer.from(cipher, 'base64')).not.toThrow();
    });

    it('uses a random IV — same plaintext produces different ciphertexts', () => {
      const plain = 'same input';
      const a = service.encrypt(plain);
      const b = service.encrypt(plain);
      expect(a).not.toBe(b);
    });

    it('ciphertext is longer than plaintext (IV + tag overhead)', () => {
      const plain = 'short';
      const cipher = service.encrypt(plain);
      expect(Buffer.from(cipher, 'base64').length).toBeGreaterThan(plain.length + 27);
    });
  });

  describe('tamper detection (GCM auth tag)', () => {
    it('throws when the ciphertext body is modified', () => {
      const cipher = service.encrypt('test data');
      const buf = Buffer.from(cipher, 'base64');
      // Flip a byte in the ciphertext area (after IV[12] + tag[16] = byte 28+)
      buf[30] ^= 0xff;
      expect(() => service.decrypt(buf.toString('base64'))).toThrow();
    });

    it('throws when the auth tag is modified', () => {
      const cipher = service.encrypt('test data');
      const buf = Buffer.from(cipher, 'base64');
      // Flip a byte in the auth tag area (bytes 12–27)
      buf[15] ^= 0xff;
      expect(() => service.decrypt(buf.toString('base64'))).toThrow();
    });
  });
});
