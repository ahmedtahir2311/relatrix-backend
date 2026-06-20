import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './strategies/jwt.strategy';
import { signUpSchema, SignUpDto } from './dto/sign-up.dto';
import { signInSchema, SignInDto } from './dto/sign-in.dto';
import { forgotPasswordSchema, ForgotPasswordDto } from './dto/forgot-password.dto';
import { resetPasswordSchema, ResetPasswordDto } from './dto/reset-password.dto';
import { changePasswordSchema, ChangePasswordDto } from './dto/change-password.dto';
import { updateProfileSchema, UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Public routes ──────────────────────────────────────────────────────────

  @Public()
  @Post('sign-up')
  @ApiOperation({ summary: 'Create a new account' })
  async signUp(@Body(new ZodValidationPipe(signUpSchema)) dto: SignUpDto) {
    return this.authService.signUp(dto);
  }

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  async signIn(@Body(new ZodValidationPipe(signInSchema)) dto: SignInDto) {
    return this.authService.signIn(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return { message: 'If an account exists for this email, a reset link has been sent' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a reset token' })
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { ok: true };
  }

  // ── Authenticated routes ───────────────────────────────────────────────────

  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke the current access token' })
  async signOut(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.signOut(user.jti);
    return { ok: true };
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current user profile' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update the current user profile' })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
  ) {
    return this.authService.updateMe(user.id, dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change the current user password' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto);
    return { ok: true };
  }
}
