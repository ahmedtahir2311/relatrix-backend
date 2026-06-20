import * as nodeCrypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { env } from '../config/env';

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor() {
    this.key = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32 bytes → AES-256
  }

  // Format: Base64( IV[12] + AuthTag[16] + Ciphertext[N] )
  encrypt(plaintext: string): string {
    const iv = nodeCrypto.randomBytes(12);
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
