import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { passwordResetTokens } from '../database/schema';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { env } from '../config/env';
import type { JwtPayload } from './strategies/jwt.strategy';
import type { SignUpDto } from './dto/sign-up.dto';
import type { SignInDto } from './dto/sign-in.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_EXPIRES_MINUTES = 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly db: DrizzleService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
    private readonly jwt: JwtService,
  ) {}

  // ── Sign-up ────────────────────────────────────────────────────────────────

  async signUp(dto: SignUpDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.create({ email: dto.email, name: dto.name, passwordHash });

    await this.email.sendWelcome(user.email, user.name);

    const { accessToken, expiresAt } = this.signToken(user.id, user.email);
    return { user: this.users.toProfile(user), accessToken, expiresAt };
  }

  // ── Sign-in ────────────────────────────────────────────────────────────────

  async signIn(dto: SignInDto) {
    const user = await this.users.findByEmail(dto.email);

    // Always run bcrypt to prevent timing attacks even when user not found
    const hash = user?.passwordHash ?? '$2b$12$invalidhashtopreventtimingattacks000000000000000000000';
    const passwordMatch = await bcrypt.compare(dto.password, hash);

    if (!user || !passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { accessToken, expiresAt } = this.signToken(user.id, user.email);
    return { user: this.users.toProfile(user), accessToken, expiresAt };
  }

  // ── Sign-out ───────────────────────────────────────────────────────────────

  async signOut(jti: string): Promise<void> {
    // Blacklist the token until its natural expiry
    const ttl = this.parseDurationToSeconds(env.JWT_EXPIRES_IN);
    await this.redis.blacklistToken(jti, ttl);
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.users.toProfile(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const existing = await this.users.findByEmail(dto.email);
      if (existing && existing.id !== userId) {
        throw new ConflictException('This email is already taken');
      }
    }

    const updated = await this.users.update(userId, {
      ...(dto.name && { name: dto.name }),
      ...(dto.email && { email: dto.email }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
    });

    return this.users.toProfile(updated);
  }

  // ── Forgot password ────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.users.findByEmail(dto.email);

    // Always return success — never reveal whether the email exists
    if (!user) {
      this.logger.debug(`Password reset requested for unknown email: ${dto.email}`);
      return;
    }

    // Invalidate any existing tokens for this user
    await this.db.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000);

    await this.db.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await this.email.sendPasswordReset(user.email, rawToken);
  }

  // ── Reset password ─────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const [record] = await this.db.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .limit(1);

    if (!record) {
      throw new BadRequestException('Reset token is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await Promise.all([
      this.users.update(record.userId, { passwordHash }),
      this.db.db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, record.id)),
    ]);
  }

  // ── Change password ────────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!match) throw new UnauthorizedException('Current password is incorrect');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.users.update(userId, { passwordHash });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private signToken(userId: string, userEmail: string) {
    const jti = crypto.randomUUID();
    const payload: JwtPayload = { sub: userId, jti, email: userEmail };
    const accessToken = this.jwt.sign(payload);

    const decoded = this.jwt.decode(accessToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000).toISOString();

    return { accessToken, expiresAt };
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 min
    const [, value, unit] = match;
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(value, 10) * (multipliers[unit] ?? 60);
  }
}
