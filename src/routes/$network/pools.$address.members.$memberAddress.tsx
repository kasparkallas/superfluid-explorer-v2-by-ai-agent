import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { getNetworkBySlug } from "~/lib/config/networks";
import { querySubgraph, subgraphKeys } from "~/lib/subgraph/client";
import { getMemberUnitsUpdatedEvents } from "~/lib/subgraph/queries/events";
import type { PoolMember, MemberUnitsUpdatedEvent } from "~/lib/subgraph/types";
import { DataTable } from "~/components/data-table";
import { AddressDisplay } from "~/components/address-display";
import { TokenDisplay } from "~/components/token-display";
import { FlowingBalance } from "~/components/flowing-balance";
import { TimeAgo } from "~/components/time-ago";
import { ExternalLink } from "~/components/external-link";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatEther } from "~/lib/utils/format";

const searchSchema = z.object({
  page: z.coerce.number().positive().default(1).catch(1),
  pageSize: z.coerce.number().positive().default(25).catch(25),
});

export const Route = createFileRoute(
  "/$network/pools/$address/members/$memberAddress"
)({
  validateSearch: searchSchema,
  component: PoolMemberDetail,
});

const POOL_MEMBER_FIELDS = `
  id
  createdAtTimestamp
  createdAtBlockNumber
  updatedAtTimestamp
  updatedAtBlockNumber
  units
  isConnected
  totalAmountClaimed
  totalAmountReceivedUntilUpdatedAt
  poolTotalAmountDistributedUntilUpdatedAt
  syncedPerUnitSettledValue
  syncedPerUnitFlowRate
  account {
    id
    createdAtTimestamp
    createdAtBlockNumber
    updatedAtTimestamp
    updatedAtBlockNumber
    isSuperApp
  }
  pool {
    id
    createdAtTimestamp
    createdAtBlockNumber
    updatedAtTimestamp
    updatedAtBlockNumber
    totalUnits
    totalConnectedUnits
    totalDisconnectedUnits
    totalAmountDistributedUntilUpdatedAt
    totalAmountInstantlyDistributedUntilUpdatedAt
    totalAmountFlowedDistributedUntilUpdatedAt
    perUnitSettledValue
    perUnitFlowRate
    totalMembers
    totalConnectedMembers
    totalDisconnectedMembers
    adjustmentFlowRate
    flowRate
    totalBuffer
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
    admin {
      id
      createdAtTimestamp
      createdAtBlockNumber
      updatedAtTimestamp
      updatedAtBlockNumber
      isSuperApp
    }
  }
`;

async function getPoolMember(
  network: string,
  poolAddress: string,
  memberAddress: string
): Promise<PoolMember | null> {
  // Pool member ID is constructed as pool-member composite
  const poolMemberId = `${poolAddress.toLowerCase()}-${memberAddress.toLowerCase()}`;

  const query = `
    query GetPoolMember($id: ID!) {
      poolMember(id: $id) {
        ${POOL_MEMBER_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ poolMember: PoolMember | null }>(
    network,
    query,
    { id: poolMemberId }
  );
  return data.poolMember;
}

function PoolMemberDetail() {
  const { network, address, memberAddress } = Route.useParams();
  const search = Route.useSearch();
  const networkConfig = getNetworkBySlug(network);

  const poolMemberId = `${address.toLowerCase()}-${memberAddress.toLowerCase()}`;

  const { data: poolMember, isLoading: memberLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "poolMember", {
      poolAddress: address,
      memberAddress,
    }),
    queryFn: () => getPoolMember(network, address, memberAddress),
    enabled: !!networkConfig,
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "memberUnitsUpdatedEvents", {
      poolMemberId,
      page: search.page,
      pageSize: search.pageSize,
    }),
    queryFn: () =>
      getMemberUnitsUpdatedEvents(network, poolMemberId, {
        first: search.pageSize,
        skip: (search.page - 1) * search.pageSize,
        orderBy: "timestamp",
        orderDirection: "desc",
      }),
    enabled: !!networkConfig && !!poolMember,
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

  if (memberLoading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading pool member...</p>
      </div>
    );
  }

  if (!poolMember) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Pool member not found</h1>
        <p className="text-muted-foreground">
          The member {memberAddress} does not exist in pool {address} on{" "}
          {networkConfig.name}.
        </p>
      </div>
    );
  }

  const totalUnits = BigInt(poolMember.pool.totalUnits);
  const memberUnits = BigInt(poolMember.units);
  const sharePercentage =
    totalUnits > 0n ? (Number(memberUnits) / Number(totalUnits)) * 100 : 0;

  // Calculate flowing balance for member
  const poolFlowRate = BigInt(poolMember.pool.flowRate);
  const memberFlowRate =
    totalUnits > 0n ? (poolFlowRate * memberUnits) / totalUnits : 0n;

  const eventColumns: ColumnDef<MemberUnitsUpdatedEvent>[] = [
    {
      id: "oldUnits",
      header: "Old Units",
      cell: ({ row }) => (
        <span className="font-mono">
          {BigInt(row.original.oldUnits).toLocaleString()}
        </span>
      ),
    },
    {
      id: "newUnits",
      header: "New Units",
      cell: ({ row }) => (
        <span className="font-mono">
          {BigInt(row.original.units).toLocaleString()}
        </span>
      ),
    },
    {
      id: "change",
      header: "Change",
      cell: ({ row }) => {
        const oldUnits = BigInt(row.original.oldUnits);
        const newUnits = BigInt(row.original.units);
        const change = newUnits - oldUnits;
        const isPositive = change > 0n;
        return (
          <span className={`font-mono ${isPositive ? "text-green-600" : "text-red-600"}`}>
            {isPositive ? "+" : ""}
            {change.toLocaleString()}
          </span>
        );
      },
    },
    {
      id: "timestamp",
      header: "Time",
      cell: ({ row }) => <TimeAgo timestamp={row.original.timestamp} />,
    },
    {
      id: "tx",
      header: "Transaction",
      cell: ({ row }) => (
        <ExternalLink
          href={`${networkConfig.blockExplorerUrl}/tx/${row.original.transactionHash}`}
        >
          View
        </ExternalLink>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Pool Member</h1>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Member:</span>
            <AddressDisplay
              address={poolMember.account.id}
              network={network}
              blockExplorerUrl={networkConfig.blockExplorerUrl}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Pool:</span>
            <Link
              to="/$network/pools/$address"
              params={{ network, address }}
              search={{}}
              className="hover:underline"
            >
              <AddressDisplay
                address={poolMember.pool.id}
                network={network}
                blockExplorerUrl={networkConfig.blockExplorerUrl}
                showInternalLink={false}
              />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Token:</span>
            <TokenDisplay
              address={poolMember.pool.token.id}
              symbol={poolMember.pool.token.symbol}
              name={poolMember.pool.token.name}
              network={network}
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Units
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {memberUnits.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              % of Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sharePercentage.toFixed(4)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={poolMember.isConnected ? "default" : "secondary"}>
              {poolMember.isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <FlowingBalance
                balance={poolMember.totalAmountReceivedUntilUpdatedAt}
                timestamp={poolMember.updatedAtTimestamp}
                flowRate={memberFlowRate.toString()}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {poolMember.pool.token.symbol}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Claimed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-mono">
              {formatEther(poolMember.totalAmountClaimed)}{" "}
              {poolMember.pool.token.symbol}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Synced Per-Unit Settled Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-mono">
              {formatEther(poolMember.syncedPerUnitSettledValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Synced Per-Unit Flow Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-mono">
              {formatEther(poolMember.syncedPerUnitFlowRate)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Units Update History</h2>
        <DataTable
          columns={eventColumns}
          data={events ?? []}
          isLoading={eventsLoading}
          pageSize={search.pageSize}
          page={search.page}
        />
      </div>
    </div>
  );
}
