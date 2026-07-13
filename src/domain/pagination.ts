import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export function skipTake(input: PaginationInput): { skip: number; take: number } {
  const page = input.page;
  const pageSize = input.pageSize;
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function paginate<T>(
  items: T[],
  total: number,
  input: PaginationInput,
): PaginatedResult<T> {
  const page = input.page;
  const pageSize = input.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}
