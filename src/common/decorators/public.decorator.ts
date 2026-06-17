import { SetMetadata } from '@nestjs/common';

/** Mark a route as publicly accessible (bypasses JwtAuthGuard). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
