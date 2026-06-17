import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, body } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({ success: false, error: body });
  }

  private resolve(exception: unknown): { status: number; body: ErrorBody } {
    // ── Zod validation error ───────────────────────────────────────────────────
    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: exception.flatten().fieldErrors,
        },
      };
    }

    // ── NestJS HttpException (includes BadRequestException, NotFoundException…) ─
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        return { status, body: { code: toCode(status), message: res } };
      }

      // NestJS may nest { message, error, statusCode } inside the response
      const obj = res as Record<string, unknown>;
      const message =
        Array.isArray(obj.message)
          ? (obj.message as string[]).join('; ')
          : (obj.message as string) ?? exception.message;

      return {
        status,
        body: {
          code: (obj.code as string) ?? toCode(status),
          message,
          details: obj.details,
        },
      };
    }

    // ── Unknown / unhandled error ──────────────────────────────────────────────
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
    };
  }
}

function toCode(httpStatus: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
  };
  return map[httpStatus] ?? 'HTTP_ERROR';
}
