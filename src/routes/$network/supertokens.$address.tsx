import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { getNetworkBySlug } from "~/lib/config/networks";
import { querySubgraph, subgraphKeys } from "~/lib/subgraph/client";
import { getTokenPrice } from "~/lib/api/token-prices";
import { useTokenFromList } from "~/lib/hooks/use-token-list";
import { getTokenType, tokenTypeLabel } from "~/lib/utils/token-type";
import { formatEther } from "~/lib/utils/format";
import type {
  Token,
  TokenStatistic,
  Stream,
  Pool,
  SubgraphEvent,
} from "~/lib/subgraph/types";
import { StatCard } from "~/components/stat-card";
import { DataTable } from "~/components/data-table";
import { AddressDisplay } from "~/components/address-display";
import { TokenDisplay } from "~/components/token-display";
import { FlowRateDisplay } from "~/components/flow-rate-display";
import { FlowingBalance } from "~/components/flowing-balance";
import { TimeAgo } from "~/components/time-ago";
import { CopyButton } from "~/components/copy-button";
import { ExternalLink } from "~/components/external-link";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

const searchSchema = z.object({
  tab: z.enum(["streams", "pools", "events"]).default("streams").catch("streams"),
  page: z.coerce.number().positive().default(1).catch(1),
  pageSize: z.coerce.number().positive().default(25).catch(25),
  sort: z.string().optional(),
  dir: z.enum(["asc", "desc"]).default("desc").catch("desc"),
});

export const Route = createFileRoute("/$network/supertokens/$address")({
  validateSearch: searchSchema,
  component: SuperTokenDetailPage,
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
  underlyingToken {
    id
    name
    symbol
    decimals
  }
`;

const TOKEN_STATISTIC_FIELDS = `
  id
  updatedAtTimestamp
  updatedAtBlockNumber
  totalNumberOfActiveStreams
  totalCFANumberOfActiveStreams
  totalGDANumberOfActiveStreams
  totalNumberOfClosedStreams
  totalCFANumberOfClosedStreams
  totalGDANumberOfClosedStreams
  totalNumberOfPools
  totalNumberOfActivePools
  totalDeposit
  totalCFADeposit
  totalGDADeposit
  totalOutflowRate
  totalCFAOutflowRate
  totalGDAOutflowRate
  totalAmountStreamedUntilUpdatedAt
  totalCFAAmountStreamedUntilUpdatedAt
  totalAmountDistributedUntilUpdatedAt
  totalAmountTransferredUntilUpdatedAt
  totalSupply
  totalNumberOfAccounts
  totalNumberOfHolders
`;

const STREAM_FIELDS = `
  id
  createdAtTimestamp
  updatedAtTimestamp
  currentFlowRate
  deposit
  streamedUntilUpdatedAt
  sender {
    id
    isSuperApp
  }
  receiver {
    id
    isSuperApp
  }
`;

const POOL_FIELDS = `
  id
  createdAtTimestamp
  updatedAtTimestamp
  totalUnits
  totalMembers
  flowRate
  totalAmountDistributedUntilUpdatedAt
  admin {
    id
  }
`;

const EVENT_FIELDS = `
  id
  blockNumber
  name
  addresses
  timestamp
  transactionHash
`;

async function getToken(network: string, address: string): Promise<Token | null> {
  const query = `
    query GetToken($id: ID!) {
      token(id: $id) {
        ${TOKEN_FIELDS}
      }
    }
  `;
  const data = await querySubgraph<{ token: Token | null }>(network, query, {
    id: address.toLowerCase(),
  });
  return data.token;
}

async function getTokenStatistic(
  network: string,
  address: string
): Promise<TokenStatistic | null> {
  const query = `
    query GetTokenStatistic($id: ID!) {
      tokenStatistic(id: $id) {
        ${TOKEN_STATISTIC_FIELDS}
      }
    }
  `;
  const data = await querySubgraph<{ tokenStatistic: TokenStatistic | null }>(
    network,
    query,
    { id: address.toLowerCase() }
  );
  return data.tokenStatistic;
}

async function getTokenStreams(
  network: string,
  tokenAddress: string,
  params: { first: number; skip: number; orderBy: string; orderDirection: string }
): Promise<Stream[]> {
  const query = `
    query GetTokenStreams {
      streams(
        first: ${params.first},
        skip: ${params.skip},
        orderBy: ${params.orderBy},
        orderDirection: ${params.orderDirection},
        where: { token: "${tokenAddress.toLowerCase()}" }
      ) {
        ${STREAM_FIELDS}
      }
    }
  `;
  const data = await querySubgraph<{ streams: Stream[] }>(network, query);
  return data.streams;
}

async function getTokenPools(
  network: string,
  tokenAddress: string,
  params: { first: number; skip: number; orderBy: string; orderDirection: string }
): Promise<Pool[]> {
  const query = `
    query GetTokenPools {
      pools(
        first: ${params.first},
        skip: ${params.skip},
        orderBy: ${params.orderBy},
        orderDirection: ${params.orderDirection},
        where: { token: "${tokenAddress.toLowerCase()}" }
      ) {
        ${POOL_FIELDS}
      }
    }
  `;
  const data = await querySubgraph<{ pools: Pool[] }>(network, query);
  return data.pools;
}

async function getTokenEvents(
  network: string,
  tokenAddress: string,
  params: { first: number; skip: number; orderBy: string; orderDirection: string }
): Promise<SubgraphEvent[]> {
  const query = `
    query GetTokenEvents {
      events(
        first: ${params.first},
        skip: ${params.skip},
        orderBy: ${params.orderBy},
        orderDirection: ${params.orderDirection},
        where: { addresses_contains: ["${tokenAddress.toLowerCase()}"] }
      ) {
        ${EVENT_FIELDS}
      }
    }
  `;
  const data = await querySubgraph<{ events: SubgraphEvent[] }>(network, query);
  return data.events;
}

function SuperTokenDetailPage() {
  const { network, address } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const networkConfig = getNetworkBySlug(network);

  const { data: token, isLoading: tokenLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "token", { address }),
    queryFn: () => getToken(network, address),
    enabled: !!networkConfig,
  });

  const { data: tokenStatistic, isLoading: statsLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "tokenStatistic", { address }),
    queryFn: () => getTokenStatistic(network, address),
    enabled: !!networkConfig,
  });

  const { data: price } = useQuery({
    queryKey: ["tokenPrice", network, address],
    queryFn: () => getTokenPrice({ data: { network, tokenAddress: address } }),
    enabled: !!networkConfig,
  });

  const tokenFromList = useTokenFromList(networkConfig?.chainId, address);

  // Streams tab
  const { data: streams, isLoading: streamsLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "tokenStreams", {
      address,
      page: search.page,
      pageSize: search.pageSize,
      sort: search.sort || "createdAtTimestamp",
      dir: search.dir,
    }),
    queryFn: () =>
      getTokenStreams(network, address, {
        first: search.pageSize,
        skip: (search.page - 1) * search.pageSize,
        orderBy: search.sort || "createdAtTimestamp",
        orderDirection: search.dir,
      }),
    enabled: !!networkConfig && search.tab === "streams",
  });

  // Pools tab
  const { data: pools, isLoading: poolsLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "tokenPools", {
      address,
      page: search.page,
      pageSize: search.pageSize,
      sort: search.sort || "createdAtTimestamp",
      dir: search.dir,
    }),
    queryFn: () =>
      getTokenPools(network, address, {
        first: search.pageSize,
        skip: (search.page - 1) * search.pageSize,
        orderBy: search.sort || "createdAtTimestamp",
        orderDirection: search.dir,
      }),
    enabled: !!networkConfig && search.tab === "pools",
  });

  // Events tab
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "tokenEvents", {
      address,
      page: search.page,
      pageSize: search.pageSize,
      sort: search.sort || "timestamp",
      dir: search.dir,
    }),
    queryFn: () =>
      getTokenEvents(network, address, {
        first: search.pageSize,
        skip: (search.page - 1) * search.pageSize,
        orderBy: search.sort || "timestamp",
        orderDirection: search.dir,
      }),
    enabled: !!networkConfig && search.tab === "events",
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

  if (tokenLoading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading token...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Token not found</h1>
        <p className="text-muted-foreground">
          The token "{address}" was not found on {networkConfig.name}.
        </p>
      </div>
    );
  }

  const tokenType = getTokenType(token);
  const tokenSymbol = tokenFromList?.symbol || token.symbol;
  const tokenName = tokenFromList?.name || token.name;
  const logoUrl = tokenFromList?.logoURI;

  // Calculate total CFA streamed with flowing balance
  const totalCFAStreamed = tokenStatistic
    ? (
        BigInt(tokenStatistic.totalAmountStreamedUntilUpdatedAt) +
        BigInt(tokenStatistic.totalOutflowRate) *
          BigInt(Math.floor(Date.now() / 1000) - Number(tokenStatistic.updatedAtTimestamp))
      ).toString()
    : "0";

  const streamColumns: ColumnDef<Stream>[] = [
    {
      id: "sender",
      header: "Sender",
      cell: ({ row }) => (
        <AddressDisplay
          address={row.original.sender.id}
          network={network}
          blockExplorerUrl={networkConfig.blockExplorerUrl}
        />
      ),
    },
    {
      id: "receiver",
      header: "Receiver",
      cell: ({ row }) => (
        <AddressDisplay
          address={row.original.receiver.id}
          network={network}
          blockExplorerUrl={networkConfig.blockExplorerUrl}
        />
      ),
    },
    {
      id: "currentFlowRate",
      header: "Flow Rate",
      cell: ({ row }) => (
        <FlowRateDisplay
          flowRate={row.original.currentFlowRate}
          tokenSymbol={tokenSymbol}
        />
      ),
    },
    {
      id: "totalStreamed",
      header: "Total Streamed",
      cell: ({ row }) => (
        <FlowingBalance
          balance={row.original.streamedUntilUpdatedAt}
          timestamp={row.original.updatedAtTimestamp}
          flowRate={row.original.currentFlowRate}
        />
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={BigInt(row.original.currentFlowRate) > 0n ? "default" : "secondary"}>
          {BigInt(row.original.currentFlowRate) > 0n ? "Active" : "Closed"}
        </Badge>
      ),
    },
    {
      id: "createdAtTimestamp",
      header: "Created",
      cell: ({ row }) => <TimeAgo timestamp={row.original.createdAtTimestamp} />,
    },
  ];

  const poolColumns: ColumnDef<Pool>[] = [
    {
      id: "id",
      header: "Pool Address",
      cell: ({ row }) => (
        <AddressDisplay
          address={row.original.id}
          network={network}
          blockExplorerUrl={networkConfig.blockExplorerUrl}
        />
      ),
    },
    {
      id: "admin",
      header: "Admin",
      cell: ({ row }) => (
        <AddressDisplay
          address={row.original.admin.id}
          network={network}
          blockExplorerUrl={networkConfig.blockExplorerUrl}
        />
      ),
    },
    {
      id: "totalUnits",
      header: "Total Units",
      cell: ({ row }) => BigInt(row.original.totalUnits).toLocaleString(),
    },
    {
      id: "totalMembers",
      header: "Members",
      cell: ({ row }) => row.original.totalMembers.toLocaleString(),
    },
    {
      id: "flowRate",
      header: "Flow Rate",
      cell: ({ row }) => (
        <FlowRateDisplay flowRate={row.original.flowRate} tokenSymbol={tokenSymbol} />
      ),
    },
    {
      id: "createdAtTimestamp",
      header: "Created",
      cell: ({ row }) => <TimeAgo timestamp={row.original.createdAtTimestamp} />,
    },
  ];

  const eventColumns: ColumnDef<SubgraphEvent>[] = [
    {
      id: "name",
      header: "Event",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono text-xs">
          {row.original.name}
        </Badge>
      ),
    },
    {
      id: "transactionHash",
      header: "Transaction",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <span className="font-mono text-sm">
            {row.original.transactionHash.slice(0, 10)}...
          </span>
          <CopyButton value={row.original.transactionHash} />
          <ExternalLink
            href={`${networkConfig.blockExplorerUrl}/tx/${row.original.transactionHash}`}
          />
        </div>
      ),
    },
    {
      id: "blockNumber",
      header: "Block",
      cell: ({ row }) => (
        <ExternalLink
          href={`${networkConfig.blockExplorerUrl}/block/${row.original.blockNumber}`}
          className="font-mono text-sm"
        >
          {row.original.blockNumber}
        </ExternalLink>
      ),
    },
    {
      id: "timestamp",
      header: "Time",
      cell: ({ row }) => <TimeAgo timestamp={row.original.timestamp} />,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={tokenSymbol}
              className="h-16 w-16 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold">{tokenName}</h1>
              <span className="text-2xl text-muted-foreground">{tokenSymbol}</span>
              {token.isListed && (
                <Badge className="bg-green-600 hover:bg-green-600/80">Listed</Badge>
              )}
              <Badge variant="outline">{tokenTypeLabel(tokenType)}</Badge>
            </div>

            <div className="mt-2 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Address:</span>
                <span className="font-mono">{address}</span>
                <CopyButton value={address} />
                <ExternalLink href={`${networkConfig.blockExplorerUrl}/address/${address}`} />
              </div>

              {tokenType === "wrapper" && token.underlyingAddress && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Underlying:</span>
                  <AddressDisplay
                    address={token.underlyingAddress}
                    network={network}
                    blockExplorerUrl={networkConfig.blockExplorerUrl}
                    showInternalLink={false}
                  />
                </div>
              )}

              {price?.usd && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-semibold">${price.usd.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {tokenStatistic && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <StatCard
            title="Total Supply"
            value={formatEther(tokenStatistic.totalSupply)}
            description={tokenSymbol}
          />
          <StatCard
            title="Total Holders"
            value={tokenStatistic.totalNumberOfHolders.toLocaleString()}
          />
          <StatCard
            title="Active CFA Streams"
            value={tokenStatistic.totalCFANumberOfActiveStreams.toLocaleString()}
          />
          <StatCard
            title="Closed CFA Streams"
            value={tokenStatistic.totalCFANumberOfClosedStreams.toLocaleString()}
          />
          <StatCard
            title="CFA Outflow Rate"
            value={
              <FlowRateDisplay
                flowRate={tokenStatistic.totalCFAOutflowRate}
                tokenSymbol={tokenSymbol}
              />
            }
          />
          <StatCard
            title="Total CFA Streamed"
            value={
              <FlowingBalance
                balance={tokenStatistic.totalAmountStreamedUntilUpdatedAt}
                timestamp={tokenStatistic.updatedAtTimestamp}
                flowRate={tokenStatistic.totalOutflowRate}
              />
            }
            description={tokenSymbol}
          />
          <StatCard
            title="Active GDA Pools"
            value={tokenStatistic.totalNumberOfActivePools.toLocaleString()}
          />
          <StatCard
            title="GDA Flow Rate"
            value={
              <FlowRateDisplay
                flowRate={tokenStatistic.totalGDAOutflowRate}
                tokenSymbol={tokenSymbol}
              />
            }
          />
          <StatCard
            title="Total Distributed"
            value={formatEther(tokenStatistic.totalAmountDistributedUntilUpdatedAt)}
            description={tokenSymbol}
          />
          <StatCard
            title="Total Deposit"
            value={formatEther(tokenStatistic.totalDeposit)}
            description={tokenSymbol}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={search.tab}
        onValueChange={(value: string) => {
          navigate({
            from: Route.fullPath,
            search: (prev) => ({ ...prev, tab: value as "streams" | "pools" | "events", page: 1 }),
            replace: true,
          });
        }}
      >
        <TabsList>
          <TabsTrigger value="streams">Streams</TabsTrigger>
          <TabsTrigger value="pools">Pools</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="streams">
          <DataTable
            columns={streamColumns}
            data={streams ?? []}
            isLoading={streamsLoading}
            pageSize={search.pageSize}
            page={search.page}
            sort={search.sort}
            dir={search.dir}
          />
        </TabsContent>

        <TabsContent value="pools">
          <DataTable
            columns={poolColumns}
            data={pools ?? []}
            isLoading={poolsLoading}
            pageSize={search.pageSize}
            page={search.page}
            sort={search.sort}
            dir={search.dir}
          />
        </TabsContent>

        <TabsContent value="events">
          <DataTable
            columns={eventColumns}
            data={events ?? []}
            isLoading={eventsLoading}
            pageSize={search.pageSize}
            page={search.page}
            sort={search.sort}
            dir={search.dir}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
