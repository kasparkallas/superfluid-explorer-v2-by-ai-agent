import { z } from "zod";

// Note: Zod v4 uses z.catch() differently - it's a method on a schema
// In Zod v4, .catch() still works the same way for providing defaults

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(25),
});

export const sortSchema = z.object({
  sort: z.string().optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).catch("desc"),
});

export const tableSearchSchema = paginationSchema.merge(sortSchema);

export type PaginationState = z.infer<typeof paginationSchema>;
export type SortState = z.infer<typeof sortSchema>;
export type TableSearchState = z.infer<typeof tableSearchSchema>;

/**
 * Convert table search params to subgraph pagination params.
 */
export function toSubgraphPagination(params: TableSearchState) {
  return {
    first: params.pageSize,
    skip: (params.page - 1) * params.pageSize,
    orderBy: params.sort,
    orderDirection: params.dir as "asc" | "desc",
  };
}
