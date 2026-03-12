import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { getNetworkBySlug } from "~/lib/config/networks";
import { querySubgraphAll, subgraphKeys } from "~/lib/subgraph/client";
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
});

export const Route = createFileRoute("/$network/supertokens/")({
  validateSearch: searchSchema,
  component: SuperTokensListing,
});

const TOKEN_WITH_STATS_FIELDS = `
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

const TOKEN_STATISTIC_FIELDS = `
  id
  updatedAtTimestamp
  updatedAtBlockNumber
  totalNumberOfActiveStreams
  totalCFANumberOfActiveStreams
  totalGDANumberOfActiveStreams
  totalNumberOfActivePools
  totalOutflowRate
  totalNumberOfHolders
  token {
    ${TOKEN_WITH_STATS_FIELDS}
  }
`;

interface TokenWithStats {
  token: Token;
  stats: TokenStatistic | null;
}

async function getTokensWithStats(network: string, search?: string): Promise<TokenWithStats[]> {
  const tokenWhere = search
    ? `isSuperToken: true, symbol_contains_nocase: "${search}"`
    : "isSuperToken: true";

  const [tokens, stats] = await Promise.all([
    querySubgraphAll<Token>(network, "tokens", TOKEN_WITH_STATS_FIELDS, tokenWhere),
    querySubgraphAll<TokenStatistic>(network, "tokenStatistics", TOKEN_STATISTIC_FIELDS),
  ]);

  const statsMap = new Map(
    stats.map((stat) => [stat.token.id.toLowerCase(), stat])
  );

  return tokens.map((token) => ({
    token,
    stats: statsMap.get(token.id.toLowerCase()) || null,
  }));
}

function SuperTokensListing() {
  const { network } = Route.useParams();
  const { page, pageSize, sort, dir, search } = Route.useSearch();
  const navigate = useNavigate();
  const networkConfig = getNetworkBySlug(network);

  const { data: tokensWithStats, isLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "tokensWithStats", { search }),
    queryFn: () => getTokensWithStats(network, search),
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

  const sortedData = tokensWithStats
    ? [...tokensWithStats].sort((a, b) => {
        if (a.token.isListed !== b.token.isListed) {
          return a.token.isListed ? -1 : 1;
        }

        let aVal: number;
        let bVal: number;

        switch (sort) {
          case "activeStreams":
            aVal = a.stats?.totalNumberOfActiveStreams || 0;
            bVal = b.stats?.totalNumberOfActiveStreams || 0;
            break;
          case "activePools":
            aVal = a.stats?.totalNumberOfActivePools || 0;
            bVal = b.stats?.totalNumberOfActivePools || 0;
            break;
          case "holders":
            aVal = a.stats?.totalNumberOfHolders || 0;
            bVal = b.stats?.totalNumberOfHolders || 0;
            break;
          case "totalOutflowRate":
            aVal = Number(a.stats?.totalOutflowRate || 0n);
            bVal = Number(b.stats?.totalOutflowRate || 0n);
            break;
          default:
            aVal = a.stats?.totalNumberOfActiveStreams || 0;
            bVal = b.stats?.totalNumberOfActiveStreams || 0;
        }

        return dir === "asc" ? aVal - bVal : bVal - aVal;
      })
    : [];

  const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize);

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
      </div>

      <DataTable
        columns={columns}
        data={paginatedData}
        totalCount={sortedData.length}
        isLoading={isLoading}
        pageSize={pageSize}
        page={page}
        sort={sort}
        dir={dir}
      />
    </div>
  );
}
