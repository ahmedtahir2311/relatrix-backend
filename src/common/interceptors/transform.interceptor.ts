import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Paginated } from '../paginated';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown) => {
        // Spread meta at top level for paginated responses
        if (result instanceof Paginated) {
          return {
            success: true,
            message: 'ok',
            data: result.data,
            meta: result.meta,
          };
        }

        return {
          success: true,
          message: 'ok',
          data: result ?? null,
        };
      }),
    );
  }
}
