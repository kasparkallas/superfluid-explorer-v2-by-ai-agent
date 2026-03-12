import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { getNetworkBySlug } from "~/lib/config/networks";
import { querySubgraph, subgraphKeys } from "~/lib/subgraph/client";
import type { Stream } from "~/lib/subgraph/types";
import { StatCard } from "~/components/stat-card";
import { DataTable } from "~/components/data-table";
import { AddressDisplay } from "~/components/address-display";
import { TokenDisplay } from "~/components/token-display";
import { FlowRateDisplay } from "~/components/flow-rate-display";
import { FlowingBalance } from "~/components/flowing-balance";
import { TimeAgo } from "~/components/time-ago";

const searchSchema = z.object({
  page: z.number().int().positive().default(1).catch(1),
  pageSize: z.number().int().positive().default(25).catch(25),
  sort: z.string().default("createdAtTimestamp").catch("createdAtTimestamp"),
  dir: z.enum(["asc", "desc"]).default("desc").catch("desc"),
});

export const Route = createFileRoute("/$network/")({
  validateSearch: searchSchema,
  component: NetworkHome,
});

const STREAM_FIELDS = `
  id
  createdAtTimestamp
  createdAtBlockNumber
  updatedAtTimestamp
  updatedAtBlockNumber
  currentFlowRate
  deposit
  streamedUntilUpdatedAt
  userData
  token {
    id
    name
    symbol
    decimals
    isSuperToken
    isNativeAssetSuperToken
    isListed
    underlyingAddress
  }
  sender {
    id
    createdAtTimestamp
    createdAtBlockNumber
    updatedAtTimestamp
    updatedAtBlockNumber
    isSuperApp
  }
  receiver {
    id
    createdAtTimestamp
    createdAtBlockNumber
    updatedAtTimestamp
    updatedAtBlockNumber
    isSuperApp
  }
`;

interface NetworkAggregateCounts {
  totalActiveStreams: number;
  totalActivePools: number;
}

async function getNetworkStats(network: string): Promise<NetworkAggregateCounts> {
  const query = `{
    tokenStatistics(first: 1000, where: { token_: { isListed: true } }) {
      id
      totalNumberOfActiveStreams
      totalNumberOfActivePools
    }
  }`;

  const data = await querySubgraph<{
    tokenStatistics: Array<{
      id: string;
      totalNumberOfActiveStreams: number;
      totalNumberOfActivePools: number;
    }>;
  }>(network, query);

  const counts: NetworkAggregateCounts = { totalActiveStreams: 0, totalActivePools: 0 };
  for (const stat of data.tokenStatistics) {
    counts.totalActiveStreams += stat.totalNumberOfActiveStreams;
    counts.totalActivePools += stat.totalNumberOfActivePools;
  }
  return counts;
}

async function getListedTokenCount(network: string): Promise<number> {
  const query = `{
    tokens(first: 1000, where: { isListed: true }) { id }
  }`;

  const data = await querySubgraph<{ tokens: Array<{ id: string }> }>(network, query);
  return data.tokens.length;
}

async function getLatestStreams(network: string) {
  const query = `
    query GetLatestStreams {
      streams(
        first: 25,
        orderBy: createdAtTimestamp,
        orderDirection: desc
      ) {
        ${STREAM_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ streams: Stream[] }>(network, query);
  return data.streams;
}

function NetworkHome() {
  const { network } = Route.useParams();
  const networkConfig = getNetworkBySlug(network);

  const { data: aggregateCounts, isLoading: statsLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "networkStats"),
    queryFn: () => getNetworkStats(network),
    enabled: !!networkConfig,
  });

  const { data: listedTokenCount } = useQuery({
    queryKey: subgraphKeys.entity(network, "listedTokenCount"),
    queryFn: () => getListedTokenCount(network),
    enabled: !!networkConfig,
  });

  const { data: streams, isLoading: streamsLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "latestStreams"),
    queryFn: () => getLatestStreams(network),
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

  const totalActiveStreams = aggregateCounts?.totalActiveStreams ?? 0;
  const totalActivePools = aggregateCounts?.totalActivePools ?? 0;
  const listedTokens = listedTokenCount ?? 0;

  const columns: ColumnDef<Stream>[] = [
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
      id: "token",
      header: "Token",
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
      id: "flowRate",
      header: "Flow Rate",
      cell: ({ row }) => (
        <FlowRateDisplay
          flowRate={row.original.currentFlowRate}
          tokenSymbol={row.original.token.symbol}
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
      id: "createdAtTimestamp",
      header: "Created",
      cell: ({ row }) => (
        <TimeAgo timestamp={row.original.createdAtTimestamp} />
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">{networkConfig.name}</h1>
        <p className="text-muted-foreground">
          Network overview and latest activity
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Active Streams"
          value={statsLoading ? "..." : totalActiveStreams.toLocaleString()}
          description="Active streams across listed tokens"
        />
        <StatCard
          title="Active Pools"
          value={statsLoading ? "..." : totalActivePools.toLocaleString()}
          description="Active pools across listed tokens"
        />
        <StatCard
          title="Listed Super Tokens"
          value={statsLoading ? "..." : listedTokens.toLocaleString()}
          description="Number of Super Tokens listed on the network"
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Latest Streams</h2>
        <DataTable
          columns={columns}
          data={streams ?? []}
          isLoading={streamsLoading}
          pageSize={25}
          page={1}
        />
      </div>
    </div>
  );
}
