import { Injectable, Logger } from '@nestjs/common';
import { isDev } from '../config/env';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const resetUrl = `http://localhost:3000/reset-password?token=${token}`;

    if (isDev) {
      // Console transport in dev — swap for SMTP/SendGrid in prod
      this.logger.log('─────────────────────────────────────────');
      this.logger.log('📧  PASSWORD RESET EMAIL (dev)');
      this.logger.log(`To:  ${email}`);
      this.logger.log(`URL: ${resetUrl}`);
      this.logger.log('─────────────────────────────────────────');
      return;
    }

    // TODO Phase 7: plug in real email provider (SendGrid, Resend, etc.)
    this.logger.warn(`sendPasswordReset called in ${process.env.NODE_ENV} — no email provider configured`);
  }

  async sendWelcome(email: string, name: string): Promise<void> {
    if (isDev) {
      this.logger.log(`📧  WELCOME EMAIL (dev) → ${name} <${email}>`);
      return;
    }
  }
}
