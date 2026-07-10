import type { Collection, Document, Sort } from "mongodb";

/**
 * Shared server-side pagination: REAL totals from countDocuments, never
 * rows.length; default sort newest-first (safe post createdAt-normalization
 * migration). "Showing 1–50 of 1,463 · newest first" everywhere — no more
 * silent truncation.
 */

export interface Paginated<T> {
  rows: T[];
  /** Real full-collection total for the filter (countDocuments). */
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const DEFAULT_PAGE_SIZE = 50;

export function parsePage(value: unknown): number {
  const n = parseInt(String(value ?? "1"), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export async function paginatedList<T extends Document = Document>(
  col: Collection<T>,
  filter: Document,
  opts: {
    page?: number;
    pageSize?: number;
    sort?: Sort;
    projection?: Document;
  } = {}
): Promise<Paginated<T>> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? DEFAULT_PAGE_SIZE, 1), 200);
  const total = await col.countDocuments(filter as never);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(opts.page ?? 1, 1), pageCount);
  const rows = (await col
    .find(filter as never, {
      sort: opts.sort ?? { createdAt: -1, _id: -1 },
      skip: (page - 1) * pageSize,
      limit: pageSize,
      projection: opts.projection,
    })
    .toArray()) as unknown as T[];
  return { rows, total, page, pageSize, pageCount };
}

/** "Showing 1–50 of 1,463" label maths, shared by pagers. */
export function pageRangeLabel(p: { page: number; pageSize: number; total: number }): string {
  if (p.total === 0) return "0 results";
  const start = (p.page - 1) * p.pageSize + 1;
  const end = Math.min(p.page * p.pageSize, p.total);
  return `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${p.total.toLocaleString()}`;
}
