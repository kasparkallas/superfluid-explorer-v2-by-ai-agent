import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { getNetworkBySlug } from "~/lib/config/networks";
import { subgraphKeys } from "~/lib/subgraph/client";
import { getPool, getPoolMembers } from "~/lib/subgraph/queries/pools";
import {
  getFlowDistributionUpdatedEvents,
  getInstantDistributionUpdatedEvents,
} from "~/lib/subgraph/queries/events";
import type {
  PoolMember,
  FlowDistributionUpdatedEvent,
  InstantDistributionUpdatedEvent,
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
import { TabsWithUrl } from "~/components/tabs-with-url";
import { Badge } from "~/components/ui/badge";
import { formatEther } from "~/lib/utils/format";
import { checksumAddress } from "~/lib/utils/address";

const searchSchema = z.object({
  tab: z.enum(["members", "distributions"]).default("members").catch("members"),
  membersPage: z.coerce.number().positive().default(1).catch(1),
  membersPageSize: z.coerce.number().positive().default(25).catch(25),
  eventsPage: z.coerce.number().positive().default(1).catch(1),
});

export const Route = createFileRoute("/$network/pools/$address")({
  validateSearch: searchSchema,
  component: PoolDetail,
});

function PoolDetail() {
  const { network, address } = Route.useParams();
  const search = Route.useSearch();
  const networkConfig = getNetworkBySlug(network);

  const { data: pool, isLoading: poolLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "pool", { address }),
    queryFn: () => getPool(network, address),
    enabled: !!networkConfig,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "poolMembers", {
      address,
      page: search.membersPage,
      pageSize: search.membersPageSize,
    }),
    queryFn: () =>
      getPoolMembers(network, address, {
        first: search.membersPageSize,
        skip: (search.membersPage - 1) * search.membersPageSize,
        orderBy: "units",
        orderDirection: "desc",
      }),
    enabled: !!networkConfig,
  });

  const { data: flowDistEvents, isLoading: flowDistLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "flowDistributionUpdatedEvents", {
      address,
      page: search.eventsPage,
    }),
    queryFn: () =>
      getFlowDistributionUpdatedEvents(network, address, {
        first: 25,
        skip: (search.eventsPage - 1) * 25,
        orderBy: "timestamp",
        orderDirection: "desc",
      }),
    enabled: !!networkConfig && search.tab === "distributions",
  });

  const { data: instantDistEvents, isLoading: instantDistLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "instantDistributionUpdatedEvents", {
      address,
      page: search.eventsPage,
    }),
    queryFn: () =>
      getInstantDistributionUpdatedEvents(network, address, {
        first: 25,
        skip: (search.eventsPage - 1) * 25,
        orderBy: "timestamp",
        orderDirection: "desc",
      }),
    enabled: !!networkConfig && search.tab === "distributions",
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

  if (poolLoading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading pool...</p>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Pool not found</h1>
        <p className="text-muted-foreground">
          The pool at address {address} does not exist on {networkConfig.name}.
        </p>
      </div>
    );
  }

  const isActive = BigInt(pool.flowRate) > 0n;
  const totalUnits = BigInt(pool.totalUnits);
  const perUnitFlowRate = totalUnits > 0n ? BigInt(pool.flowRate) / totalUnits : 0n;

  // Members table columns
  const memberColumns: ColumnDef<PoolMember>[] = [
    {
      id: "member",
      header: "Member",
      cell: ({ row }) => (
        <Link
          to="/$network/pools/$address/members/$memberAddress"
          params={{
            network,
            address,
            memberAddress: row.original.account.id,
          }}
          search={{}}
          className="hover:underline"
        >
          <AddressDisplay
            address={row.original.account.id}
            network={network}
            blockExplorerUrl={networkConfig.blockExplorerUrl}
            showInternalLink={false}
          />
        </Link>
      ),
    },
    {
      id: "units",
      header: "Units",
      cell: ({ row }) => (
        <span className="font-mono">{BigInt(row.original.units).toLocaleString()}</span>
      ),
    },
    {
      id: "share",
      header: "% Share",
      cell: ({ row }) => {
        const units = BigInt(row.original.units);
        const share = totalUnits > 0n ? (Number(units) / Number(totalUnits)) * 100 : 0;
        return <span>{share.toFixed(2)}%</span>;
      },
    },
    {
      id: "connected",
      header: "Connected",
      cell: ({ row }) => (
        <Badge variant={row.original.isConnected ? "default" : "secondary"}>
          {row.original.isConnected ? "Connected" : "Disconnected"}
        </Badge>
      ),
    },
    {
      id: "totalReceived",
      header: "Total Received",
      cell: ({ row }) => (
        <span className="font-mono">
          {formatEther(row.original.totalAmountReceivedUntilUpdatedAt)}
        </span>
      ),
    },
  ];

  // Flow distribution events columns
  const flowDistColumns: ColumnDef<FlowDistributionUpdatedEvent>[] = [
    {
      id: "operator",
      header: "Operator",
      cell: ({ row }) => (
        <AddressDisplay
          address={row.original.operator}
          network={network}
          blockExplorerUrl={networkConfig.blockExplorerUrl}
        />
      ),
    },
    {
      id: "oldFlowRate",
      header: "Old Flow Rate",
      cell: ({ row }) => (
        <FlowRateDisplay flowRate={row.original.oldFlowRate} tokenSymbol={pool.token.symbol} />
      ),
    },
    {
      id: "newFlowRate",
      header: "New Flow Rate",
      cell: ({ row }) => (
        <FlowRateDisplay
          flowRate={row.original.newTotalDistributionFlowRate}
          tokenSymbol={pool.token.symbol}
        />
      ),
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

  // Instant distribution events columns
  const instantDistColumns: ColumnDef<InstantDistributionUpdatedEvent>[] = [
    {
      id: "operator",
      header: "Operator",
      cell: ({ row }) => (
        <AddressDisplay
          address={row.original.operator}
          network={network}
          blockExplorerUrl={networkConfig.blockExplorerUrl}
        />
      ),
    },
    {
      id: "requested",
      header: "Requested Amount",
      cell: ({ row }) => (
        <span className="font-mono">
          {formatEther(row.original.requestedAmount)} {pool.token.symbol}
        </span>
      ),
    },
    {
      id: "actual",
      header: "Actual Amount",
      cell: ({ row }) => (
        <span className="font-mono">
          {formatEther(row.original.actualAmount)} {pool.token.symbol}
        </span>
      ),
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
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold font-mono">{checksumAddress(address)}</h1>
          <CopyButton value={checksumAddress(address)} />
          <ExternalLink href={`${networkConfig.blockExplorerUrl}/address/${address}`} />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Token:</span>
            <TokenDisplay
              address={pool.token.id}
              symbol={pool.token.symbol}
              name={pool.token.name}
              network={network}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Admin:</span>
            <AddressDisplay
              address={pool.admin.id}
              network={network}
              blockExplorerUrl={networkConfig.blockExplorerUrl}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Units"
          value={BigInt(pool.totalUnits).toLocaleString()}
        />
        <StatCard
          title="Connected Units"
          value={BigInt(pool.totalConnectedUnits).toLocaleString()}
        />
        <StatCard
          title="Disconnected Units"
          value={BigInt(pool.totalDisconnectedUnits).toLocaleString()}
        />
        <StatCard
          title="Total Members"
          value={pool.totalMembers.toLocaleString()}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Flow Rate"
          value={
            <FlowRateDisplay
              flowRate={pool.flowRate}
              tokenSymbol={pool.token.symbol}
            />
          }
        />
        <StatCard
          title="Per-Unit Flow Rate"
          value={
            <FlowRateDisplay
              flowRate={perUnitFlowRate.toString()}
              tokenSymbol={pool.token.symbol}
            />
          }
        />
        <StatCard
          title="Total Distributed"
          value={
            <FlowingBalance
              balance={pool.totalAmountDistributedUntilUpdatedAt}
              timestamp={pool.updatedAtTimestamp}
              flowRate={pool.flowRate}
            />
          }
          description={pool.token.symbol}
        />
        <StatCard
          title="Total Buffer"
          value={`${formatEther(pool.totalBuffer)} ${pool.token.symbol}`}
        />
      </div>

      {/* Tabs */}
      <TabsWithUrl
        defaultTab="members"
        paramName="tab"
        tabs={[
          {
            value: "members",
            label: "Members",
            content: (
              <div className="space-y-4">
                <DataTable
                  columns={memberColumns}
                  data={members ?? []}
                  isLoading={membersLoading}
                  pageSize={search.membersPageSize}
                  page={search.membersPage}
                />
              </div>
            ),
          },
          {
            value: "distributions",
            label: "Distribution Events",
            content: (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Flow Distribution Events</h3>
                <DataTable
                  columns={flowDistColumns}
                  data={flowDistEvents ?? []}
                  isLoading={flowDistLoading}
                  pageSize={25}
                  page={search.eventsPage}
                />
                <h3 className="text-lg font-semibold mt-8">Instant Distribution Events</h3>
                <DataTable
                  columns={instantDistColumns}
                  data={instantDistEvents ?? []}
                  isLoading={instantDistLoading}
                  pageSize={25}
                  page={search.eventsPage}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
