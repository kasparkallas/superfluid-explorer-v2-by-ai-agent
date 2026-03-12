import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { getNetworkBySlug } from "~/lib/config/networks";
import { querySubgraph, subgraphKeys } from "~/lib/subgraph/client";
import type { Token, TokenStatistic } from "~/lib/subgraph/types";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { DataTable } from "~/components/data-table";
import { TokenDisplay } from "~/components/token-display";
import { FlowRateDisplay } from "~/components/flow-rate-display";
import { getTokenType, tokenTypeLabel } from "~/lib/utils/token-type";
import { truncateAddress } from "~/lib/utils/address";
import { useNavigate } from "@tanstack/react-router";

const searchSchema = z.object({
  page: z.coerce.number().positive().default(1).catch(1),
  pageSize: z.coerce.number().positive().default(25).catch(25),
  sort: z.string().default("activeStreams").catch("activeStreams"),
  dir: z.enum(["asc", "desc"]).default("desc").catch("desc"),
  search: z.string().default("").catch(""),
  listed: z
    .enum(["true", "false"])
    .default("true")
    .catch("true")
    .transform((v) => v === "true"),
});

export const Route = createFileRoute("/$network/supertokens/")({
  validateSearch: searchSchema,
  component: SuperTokensListing,
});

const TOKEN_FIELDS = `
  id
  createdAtTimestamp
  createdAtBlockNumber
  decimals
  name
  symbol
  isSuperToken
  isNativeAssetSuperToken
  isListed
  underlyingAddress
`;

const SORT_FIELD_MAP: Record<string, string> = {
  activeStreams: "totalNumberOfActiveStreams",
  activePools: "totalNumberOfActivePools",
  holders: "totalNumberOfHolders",
  totalOutflowRate: "totalOutflowRate",
};

interface TokenWithStats {
  token: Token;
  stats: TokenStatistic | null;
}

async function getTokenStats(
  network: string,
  page: number,
  pageSize: number,
  sort: string,
  dir: "asc" | "desc",
  search: string,
  listed: boolean
): Promise<TokenWithStats[]> {
  const skip = (page - 1) * pageSize;
  const orderBy = SORT_FIELD_MAP[sort] || "totalNumberOfActiveStreams";

  const tokenFilters: string[] = ["isSuperToken: true"];
  if (listed) tokenFilters.push("isListed: true");
  if (search) tokenFilters.push(`symbol_contains_nocase: "${search}"`);
  const tokenWhere = tokenFilters.join(", ");

  const query = `
    query GetTokenStats {
      tokenStatistics(
        first: ${pageSize},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${dir},
        where: { token_: { ${tokenWhere} } }
      ) {
        id
        totalNumberOfActiveStreams
        totalNumberOfActivePools
        totalOutflowRate
        totalNumberOfHolders
        token {
          ${TOKEN_FIELDS}
        }
      }
    }
  `;

  const data = await querySubgraph<{ tokenStatistics: (TokenStatistic & { token: Token })[] }>(
    network,
    query
  );

  return data.tokenStatistics.map((stat) => ({
    token: stat.token,
    stats: stat,
  }));
}

function SuperTokensListing() {
  const { network } = Route.useParams();
  const { page, pageSize, sort, dir, search, listed } = Route.useSearch();
  const navigate = useNavigate();
  const networkConfig = getNetworkBySlug(network);

  const { data: tokensWithStats, isLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "tokensWithStats", { page, pageSize, sort, dir, search, listed }),
    queryFn: () => getTokenStats(network, page, pageSize, sort, dir, search, listed),
    enabled: !!networkConfig,
  });

  if (!networkConfig) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Network not found</h1>
        <p className="text-muted-foreground">
          The network "{network}" is not supported.
        </p>
      </div>
    );
  }

  const columns: ColumnDef<TokenWithStats>[] = [
    {
      id: "token",
      header: "Token",
      enableSorting: false,
      cell: ({ row }) => (
        <TokenDisplay
          address={row.original.token.id}
          symbol={row.original.token.symbol}
          name={row.original.token.name}
          network={network}
        />
      ),
    },
    {
      id: "listed",
      header: "Listed",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.token.isListed ? (
          <Badge variant="default">Listed</Badge>
        ) : (
          <Badge variant="outline">Unlisted</Badge>
        ),
    },
    {
      id: "address",
      header: "Address",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">
          {truncateAddress(row.original.token.id)}
        </span>
      ),
    },
    {
      id: "type",
      header: "Type",
      enableSorting: false,
      cell: ({ row }) => {
        const type = getTokenType(row.original.token);
        return <span className="text-sm">{tokenTypeLabel(type)}</span>;
      },
    },
    {
      id: "activeStreams",
      header: "Active Streams",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.stats?.totalNumberOfActiveStreams.toLocaleString() || 0}
        </span>
      ),
    },
    {
      id: "totalOutflowRate",
      header: "Total Flow Rate",
      cell: ({ row }) =>
        row.original.stats?.totalOutflowRate ? (
          <FlowRateDisplay
            flowRate={row.original.stats.totalOutflowRate}
            tokenSymbol={row.original.token.symbol}
          />
        ) : (
          <span className="text-sm text-muted-foreground">0</span>
        ),
    },
    {
      id: "activePools",
      header: "Active Pools",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.stats?.totalNumberOfActivePools.toLocaleString() || 0}
        </span>
      ),
    },
    {
      id: "holders",
      header: "Holders",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.stats?.totalNumberOfHolders.toLocaleString() || 0}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Super Tokens</h1>
        <p className="text-muted-foreground">
          All Super Tokens on {networkConfig.name}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search by symbol..."
          value={search}
          onChange={(e) => {
            navigate({
              search: (prev: Record<string, unknown>) => ({
                ...prev,
                search: e.target.value,
                page: 1,
              }),
              replace: true,
            } as any);
          }}
          className="max-w-sm"
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={listed}
            onChange={(e) => {
              navigate({
                search: (prev: Record<string, unknown>) => ({
                  ...prev,
                  listed: e.target.checked ? "true" : "false",
                  page: 1,
                }),
                replace: true,
              } as any);
            }}
            className="rounded border-input"
          />
          Listed only
        </label>
      </div>

      <DataTable
        columns={columns}
        data={tokensWithStats ?? []}
        isLoading={isLoading}
        pageSize={pageSize}
        page={page}
        sort={sort}
        dir={dir}
      />
    </div>
  );
}
