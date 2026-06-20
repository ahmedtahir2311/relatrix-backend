export interface PaginationMeta {
  total: number;
  offset: number;
  limit: number;
}

/**
 * Wrap paginated results so TransformInterceptor can spread `meta`
 * at the top level: { success, message, data: T[], meta: {...} }
 */
export class Paginated<T> {
  constructor(
    public readonly data: T[],
    public readonly meta: PaginationMeta,
  ) {}
}
