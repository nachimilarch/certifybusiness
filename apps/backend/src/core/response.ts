import { Response } from "express";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export function ok<T>(res: Response, data: T, message?: string, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    ...(message ? { message } : {}),
  });
}

export function created<T>(res: Response, data: T, message?: string): void {
  ok(res, data, message, 201);
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta
): void {
  res.json({ success: true, data, meta });
}

export function noContent(res: Response): void {
  res.status(204).end();
}

/** Parse page/limit from query params with safe defaults. */
export function parsePagination(
  query: Record<string, unknown>,
  maxLimit = 100
): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20)
  );
  return { page, limit, offset: (page - 1) * limit };
}
