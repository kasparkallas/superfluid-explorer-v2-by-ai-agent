export interface SubgraphResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

export interface PaginationParams {
  first?: number;
  skip?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}

export const DEFAULT_PAGINATION: Required<
  Pick<PaginationParams, "first" | "skip" | "orderDirection">
> = {
  first: 25,
  skip: 0,
  orderDirection: "desc",
};

export async function querySubgraph<T>(
  networkSlug: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const url = `https://subgraph-endpoints.superfluid.dev/${networkSlug}/protocol-v1`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Subgraph error: ${res.status}`);
  const json: SubgraphResponse<T> = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

/**
 * Fetches all results from a subgraph entity using id_gt cursor pagination.
 * The subgraph limits `first` to 1000, so this loops until all pages are fetched.
 */
export async function querySubgraphAll<T extends { id: string }>(
  network: string,
  entityName: string,
  fields: string,
  extraWhere?: string,
): Promise<T[]> {
  const all: T[] = [];
  let lastId = "";
  while (true) {
    const conditions = [
      extraWhere,
      lastId ? `id_gt: "${lastId}"` : "",
    ].filter(Boolean).join(", ");
    const whereClause = conditions ? `, where: { ${conditions} }` : "";
    const query = `{ ${entityName}(first: 1000, orderBy: id${whereClause}) { ${fields} } }`;
    const data = await querySubgraph<Record<string, T[]>>(network, query);
    const items = data[entityName];
    all.push(...items);
    if (items.length < 1000) break;
    lastId = items[items.length - 1].id;
  }
  return all;
}

// TanStack Query key factory
export const subgraphKeys = {
  all: ["subgraph"] as const,
  network: (network: string) => ["subgraph", network] as const,
  entity: (network: string, entity: string, vars?: Record<string, unknown>) =>
    ["subgraph", network, entity, vars] as const,
};
