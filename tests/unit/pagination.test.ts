import { describe, expect, it } from "vitest";
import {
  buildPaginatedResult,
  decodeCursor,
  encodeCursor,
  parsePaginationParams,
} from "@/lib/pagination";

describe("pagination", () => {
  it("parses and clamps page size", () => {
    const p = parsePaginationParams({
      query: { page: "2", pageSize: "999" },
      maxPageSize: 50,
    });
    expect(p.page).toBe(2);
    expect(p.pageSize).toBe(50);
    expect(p.offset).toBe(50);
  });

  it("builds meta correctly", () => {
    const result = buildPaginatedResult([1, 2], 25, { page: 1, pageSize: 10 });
    expect(result.meta.totalPages).toBe(3);
    expect(result.meta.hasNextPage).toBe(true);
  });

  it("round-trips cursors", () => {
    const cursor = encodeCursor(new Date("2026-01-01T00:00:00.000Z"), "abc");
    const decoded = decodeCursor(cursor);
    expect(decoded?.id).toBe("abc");
    expect(decoded?.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
