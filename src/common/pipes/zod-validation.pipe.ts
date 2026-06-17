import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Usage:
 *   @Body(new ZodValidationPipe(myZodSchema)) body: MyDto
 *   @Param('id', new ZodValidationPipe(z.string().uuid())) id: string
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const zodErr = result.error as ZodError;
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: zodErr.flatten().fieldErrors,
      });
    }

    return result.data;
  }
}
