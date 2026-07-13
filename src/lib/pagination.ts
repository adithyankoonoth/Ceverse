/**
 * Cursor- and offset-style pagination helpers (pure, DB-free).
 */

export type PaginationParams = {
  page: number;
  pageSize: number;
  /** Zero-based offset derived from page/pageSize. */
  offset: number;
  cursor?: string;
};

export type PaginatedMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string | null;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginatedMeta;
};

export type ParsePaginationOptions = {
  /** Default page size when unset (default 20). */
  defaultPageSize?: number;
  /** Hard cap on page size (default 100). */
  maxPageSize?: number;
  /** Incoming query bag (URLSearchParams-like or plain object). */
  query?: Record<string, string | string[] | undefined> | URLSearchParams;
};

function first(
  value: string | string[] | undefined | null,
): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function readQuery(
  query: ParsePaginationOptions["query"],
  key: string,
): string | undefined {
  if (!query) return undefined;
  if (typeof (query as URLSearchParams).get === "function") {
    return (query as URLSearchParams).get(key) ?? undefined;
  }
  return first((query as Record<string, string | string[] | undefined>)[key]);
}

/**
 * Parse and clamp page / pageSize / cursor from query input.
 * Pages are 1-indexed. Invalid values fall back to defaults.
 */
export function parsePaginationParams(
  options: ParsePaginationOptions = {},
): PaginationParams {
  const defaultPageSize = options.defaultPageSize ?? 20;
  const maxPageSize = options.maxPageSize ?? 100;
  const query = options.query;

  const rawPage = Number(readQuery(query, "page") ?? "1");
  const rawSize = Number(
    readQuery(query, "pageSize") ??
      readQuery(query, "limit") ??
      String(defaultPageSize),
  );
  const cursor = readQuery(query, "cursor");

  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  let pageSize =
    Number.isFinite(rawSize) && rawSize >= 1
      ? Math.floor(rawSize)
      : defaultPageSize;
  pageSize = Math.min(maxPageSize, Math.max(1, pageSize));

  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    offset,
    cursor: cursor || undefined,
  };
}

/**
 * Build a standard paginated envelope from a slice + total count.
 */
export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  params: Pick<PaginationParams, "page" | "pageSize">,
  options?: { nextCursor?: string | null },
): PaginatedResult<T> {
  const totalSafe = Math.max(0, Math.floor(total));
  const totalPages =
    totalSafe === 0 ? 0 : Math.ceil(totalSafe / params.pageSize);

  return {
    data: items,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      total: totalSafe,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPreviousPage: params.page > 1 && totalPages > 0,
      nextCursor: options?.nextCursor ?? null,
    },
  };
}

/**
 * Encode a simple opaque cursor from a createdAt + id pair.
 * Format: base64url("iso|id")
 */
export function encodeCursor(createdAt: Date | string, id: string): string {
  const iso =
    typeof createdAt === "string" ? createdAt : createdAt.toISOString();
  const payload = `${iso}|${id}`;
  return Buffer.from(payload, "utf8").toString("base64url");
}

/**
 * Decode a cursor produced by {@link encodeCursor}.
 * Returns null if malformed.
 */
export function decodeCursor(
  cursor: string,
): { createdAt: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = raw.indexOf("|");
    if (sep <= 0) return null;
    const createdAt = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    if (!createdAt || !id) return null;
    // Basic ISO sanity check
    if (Number.isNaN(Date.parse(createdAt))) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
