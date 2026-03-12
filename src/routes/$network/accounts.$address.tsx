import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Shield,
  User,
  Wallet,
} from "lucide-react";

import { getAccount, getAccountTokenSnapshots } from "~/lib/subgraph/queries/accounts";
import { getStreams } from "~/lib/subgraph/queries/streams";
import { getPools } from "~/lib/subgraph/queries/pools";
import { getEvents } from "~/lib/subgraph/queries/events";
import { querySubgraph, subgraphKeys } from "~/lib/subgraph/client";
import { resolveAddress } from "~/lib/api/whois";
import { getNetworkBySlug } from "~/lib/config/networks";
import { checksumAddress } from "~/lib/utils/address";
import { formatEther, formatTimestamp } from "~/lib/utils/format";

import type { PoolMember, PoolDistributor } from "~/lib/subgraph/types";

import { AddressDisplay } from "~/components/address-display";
import { FlowingBalance } from "~/components/flowing-balance";
import { FlowRateDisplay } from "~/components/flow-rate-display";
import { TokenDisplay } from "~/components/token-display";
import { TimeAgo } from "~/components/time-ago";
import { TabsWithUrl } from "~/components/tabs-with-url";
import { StatCard } from "~/components/stat-card";
import { CopyButton } from "~/components/copy-button";
import { ExternalLink } from "~/components/external-link";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

// ---------------------------------------------------------------------------
// Search params schema
// ---------------------------------------------------------------------------

const searchSchema = z.object({
  tab: z.enum(["tokens", "streams", "pools", "events"]).default("tokens").catch("tokens"),
  streamsPage: z.coerce.number().positive().default(1).catch(1),
  streamsPageSize: z.coerce.number().positive().default(25).catch(25),
  eventsPage: z.coerce.number().positive().default(1).catch(1),
  eventsPageSize: z.coerce.number().positive().default(25).catch(25),
  eventType: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/$network/accounts/$address")({
  validateSearch: searchSchema,
  component: AccountPage,
});

// ---------------------------------------------------------------------------
// Pool member / distributor queries (by account, not by pool)
// ---------------------------------------------------------------------------

const POOL_MEMBER_BY_ACCOUNT_FIELDS = `
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
    token { id name symbol }
    admin { id }
  }
`;

const POOL_DISTRIBUTOR_BY_ACCOUNT_FIELDS = `
  id
  createdAtTimestamp
  createdAtBlockNumber
  updatedAtTimestamp
  updatedAtBlockNumber
  totalAmountInstantlyDistributedUntilUpdatedAt
  totalAmountFlowedDistributedUntilUpdatedAt
  totalAmountDistributedUntilUpdatedAt
  totalBuffer
  flowRate
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
    token { id name symbol }
  }
`;

async function getPoolMembersByAccount(
  network: string,
  accountAddress: string
): Promise<PoolMember[]> {
  const query = `
    query GetPoolMembersByAccount {
      poolMembers(
        first: 100,
        orderBy: createdAtTimestamp,
        orderDirection: desc,
        where: { account: "${accountAddress.toLowerCase()}" }
      ) {
        ${POOL_MEMBER_BY_ACCOUNT_FIELDS}
      }
    }
  `;
  const data = await querySubgraph<{ poolMembers: PoolMember[] }>(network, query);
  return data.poolMembers;
}

async function getPoolDistributorsByAccount(
  network: string,
  accountAddress: string
): Promise<PoolDistributor[]> {
  const query = `
    query GetPoolDistributorsByAccount {
      poolDistributors(
        first: 100,
        orderBy: createdAtTimestamp,
        orderDirection: desc,
        where: { account: "${accountAddress.toLowerCase()}" }
      ) {
        ${POOL_DISTRIBUTOR_BY_ACCOUNT_FIELDS}
      }
    }
  `;
  const data = await querySubgraph<{ poolDistributors: PoolDistributor[] }>(network, query);
  return data.poolDistributors;
}

// ---------------------------------------------------------------------------
// Known event types for filtering
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  "FlowUpdated",
  "FlowOperatorUpdated",
  "TokenUpgraded",
  "TokenDowngraded",
  "Transfer",
  "AgreementLiquidatedV2",
  "Approval",
  "PoolCreated",
  "MemberUnitsUpdated",
  "FlowDistributionUpdated",
  "InstantDistributionUpdated",
  "DistributionClaimed",
  "BufferAdjusted",
] as const;

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function AccountPage() {
  const { network, address } = useParams({ from: "/$network/accounts/$address" });
  const search = Route.useSearch();
  const navigate = useNavigate();
  const networkConfig = getNetworkBySlug(network);
  const checksummed = checksumAddress(address);

  // ----- Core data queries -----

  const accountQuery = useQuery({
    queryKey: subgraphKeys.entity(network, "account", { address }),
    queryFn: () => getAccount(network, address),
    staleTime: 30_000,
  });

  const whoisQuery = useQuery({
    queryKey: ["whois", address.toLowerCase()],
    queryFn: () => resolveAddress({ data: address.toLowerCase() }),
    staleTime: 5 * 60 * 1000,
  });

  const tokenSnapshotsQuery = useQuery({
    queryKey: subgraphKeys.entity(network, "accountTokenSnapshots", { address }),
    queryFn: () => getAccountTokenSnapshots(network, address, { first: 100 }),
    staleTime: 15_000,
  });

  // ----- Streams tab queries -----

  const incomingStreamsQuery = useQuery({
    queryKey: subgraphKeys.entity(network, "streams-incoming", {
      receiver: address,
      page: search.streamsPage,
      pageSize: search.streamsPageSize,
    }),
    queryFn: () =>
      getStreams(network, {
        receiver: address,
        first: search.streamsPageSize,
        skip: (search.streamsPage - 1) * search.streamsPageSize,
        orderBy: "updatedAtTimestamp",
        orderDirection: "desc",
      }),
    enabled: search.tab === "streams",
    staleTime: 15_000,
  });

  const outgoingStreamsQuery = useQuery({
    queryKey: subgraphKeys.entity(network, "streams-outgoing", {
      sender: address,
      page: search.streamsPage,
      pageSize: search.streamsPageSize,
    }),
    queryFn: () =>
      getStreams(network, {
        sender: address,
        first: search.streamsPageSize,
        skip: (search.streamsPage - 1) * search.streamsPageSize,
        orderBy: "updatedAtTimestamp",
        orderDirection: "desc",
      }),
    enabled: search.tab === "streams",
    staleTime: 15_000,
  });

  // ----- Pools tab queries -----

  const adminPoolsQuery = useQuery({
    queryKey: subgraphKeys.entity(network, "pools-admin", { admin: address }),
    queryFn: () => getPools(network, { admin: address, first: 100 }),
    enabled: search.tab === "pools",
    staleTime: 30_000,
  });

  const poolMembershipsQuery = useQuery({
    queryKey: subgraphKeys.entity(network, "poolMembers-account", { account: address }),
    queryFn: () => getPoolMembersByAccount(network, address),
    enabled: search.tab === "pools",
    staleTime: 30_000,
  });

  const poolDistributorsQuery = useQuery({
    queryKey: subgraphKeys.entity(network, "poolDistributors-account", { account: address }),
    queryFn: () => getPoolDistributorsByAccount(network, address),
    enabled: search.tab === "pools",
    staleTime: 30_000,
  });

  // ----- Events tab query -----

  const eventsQuery = useQuery({
    queryKey: subgraphKeys.entity(network, "events", {
      addresses: [address],
      page: search.eventsPage,
      pageSize: search.eventsPageSize,
      name: search.eventType,
    }),
    queryFn: () =>
      getEvents(network, {
        addresses_contains: [address],
        first: search.eventsPageSize,
        skip: (search.eventsPage - 1) * search.eventsPageSize,
        orderBy: "timestamp",
        orderDirection: "desc",
        name: search.eventType,
      }),
    enabled: search.tab === "events",
    staleTime: 15_000,
  });

  // ----- Derived data -----

  const account = accountQuery.data;
  const whois = whoisQuery.data;
  const snapshots = tokenSnapshotsQuery.data ?? [];

  const isLoading = accountQuery.isLoading;

  // ----- Tab content -----

  const tabs = [
    {
      value: "tokens",
      label: `Tokens (${snapshots.length})`,
      content: (
        <TokensTab
          snapshots={snapshots}
          isLoading={tokenSnapshotsQuery.isLoading}
          network={network}
          blockExplorerUrl={networkConfig?.blockExplorerUrl}
        />
      ),
    },
    {
      value: "streams",
      label: "Streams",
      content: (
        <StreamsTab
          address={address}
          network={network}
          blockExplorerUrl={networkConfig?.blockExplorerUrl}
          incomingStreams={incomingStreamsQuery.data ?? []}
          outgoingStreams={outgoingStreamsQuery.data ?? []}
          isLoading={incomingStreamsQuery.isLoading || outgoingStreamsQuery.isLoading}
          page={search.streamsPage}
          pageSize={search.streamsPageSize}
          onPageChange={(page) =>
            navigate({
              search: (prev: Record<string, unknown>) => ({ ...prev, streamsPage: page }),
              replace: true,
            } as any)
          }
          onPageSizeChange={(size) =>
            navigate({
              search: (prev: Record<string, unknown>) => ({
                ...prev,
                streamsPageSize: size,
                streamsPage: 1,
              }),
              replace: true,
            } as any)
          }
        />
      ),
    },
    {
      value: "pools",
      label: "Pools",
      content: (
        <PoolsTab
          network={network}
          blockExplorerUrl={networkConfig?.blockExplorerUrl}
          adminPools={adminPoolsQuery.data ?? []}
          memberships={poolMembershipsQuery.data ?? []}
          distributions={poolDistributorsQuery.data ?? []}
          isLoading={
            adminPoolsQuery.isLoading ||
            poolMembershipsQuery.isLoading ||
            poolDistributorsQuery.isLoading
          }
        />
      ),
    },
    {
      value: "events",
      label: "Events",
      content: (
        <EventsTab
          events={eventsQuery.data ?? []}
          isLoading={eventsQuery.isLoading}
          blockExplorerUrl={networkConfig?.blockExplorerUrl}
          page={search.eventsPage}
          pageSize={search.eventsPageSize}
          eventType={search.eventType}
          onPageChange={(page) =>
            navigate({
              search: (prev: Record<string, unknown>) => ({ ...prev, eventsPage: page }),
              replace: true,
            } as any)
          }
          onPageSizeChange={(size) =>
            navigate({
              search: (prev: Record<string, unknown>) => ({
                ...prev,
                eventsPageSize: size,
                eventsPage: 1,
              }),
              replace: true,
            } as any)
          }
          onEventTypeChange={(type) =>
            navigate({
              search: (prev: Record<string, unknown>) => ({
                ...prev,
                eventType: type || undefined,
                eventsPage: 1,
              }),
              replace: true,
            } as any)
          }
        />
      ),
    },
  ];

  // ----- Render -----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {/* Avatar or fallback */}
            {whois?.avatar ? (
              <img
                src={whois.avatar}
                alt={whois.name ?? "avatar"}
                className="h-14 w-14 rounded-full border"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}

            <div className="space-y-1">
              {/* Whois name */}
              {whois?.name && (
                <h2 className="text-lg font-semibold">{whois.name}</h2>
              )}

              {/* Checksummed address */}
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-xl font-bold tracking-tight sm:text-2xl break-all">
                  {checksummed}
                </h1>
                <CopyButton value={checksummed} />
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {account?.isSuperApp && (
                  <Badge variant="default" className="gap-1">
                    <Shield className="h-3 w-3" />
                    Super App
                  </Badge>
                )}
                {networkConfig && (
                  <Badge variant="outline">{networkConfig.name}</Badge>
                )}
                {account && (
                  <Badge variant="secondary">
                    Since <TimeAgo timestamp={account.createdAtTimestamp} />
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* External link */}
          <div className="flex items-center gap-2">
            {networkConfig && (
              <ExternalLink
                href={`${networkConfig.blockExplorerUrl}/address/${address}`}
                className="text-sm"
              >
                Block Explorer
              </ExternalLink>
            )}
          </div>
        </div>

        {/* Summary stat cards */}
        {!isLoading && snapshots.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              title="Token Positions"
              value={snapshots.length}
            />
            <StatCard
              title="Active Streams"
              value={snapshots.reduce(
                (sum, s) => sum + s.totalNumberOfActiveStreams,
                0
              )}
            />
            <StatCard
              title="Pool Memberships"
              value={snapshots.reduce(
                (sum, s) => sum + s.totalMembershipsWithUnits,
                0
              )}
            />
            <StatCard
              title="Pools Administered"
              value={snapshots.reduce(
                (sum, s) => sum + s.adminOfPoolCount,
                0
              )}
            />
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <TabsWithUrl tabs={tabs} defaultTab="tokens" />
    </div>
  );
}

// ===========================================================================
// Tokens Tab
// ===========================================================================

import type { AccountTokenSnapshot } from "~/lib/subgraph/types";

function TokensTab({
  snapshots,
  isLoading,
  network,
  blockExplorerUrl,
}: {
  snapshots: AccountTokenSnapshot[];
  isLoading: boolean;
  network: string;
  blockExplorerUrl?: string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Wallet className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">No token positions found for this account.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {snapshots.map((snapshot) => (
        <TokenSnapshotCard
          key={snapshot.id}
          snapshot={snapshot}
          network={network}
          blockExplorerUrl={blockExplorerUrl}
        />
      ))}
    </div>
  );
}

function TokenSnapshotCard({
  snapshot,
  network,
  blockExplorerUrl,
}: {
  snapshot: AccountTokenSnapshot;
  network: string;
  blockExplorerUrl?: string;
}) {
  const netFlowRate = BigInt(snapshot.totalNetFlowRate);
  const balance = BigInt(snapshot.balanceUntilUpdatedAt);
  const updatedAt = parseInt(snapshot.updatedAtTimestamp);

  // Liquidation estimate
  let liquidationDate: Date | null = null;
  if (netFlowRate < 0n && balance > 0n) {
    const secondsToZero = balance / (-netFlowRate);
    const liquidationTimestamp = updatedAt + Number(secondsToZero);
    liquidationDate = new Date(liquidationTimestamp * 1000);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TokenDisplay
              address={snapshot.token.id}
              symbol={snapshot.token.symbol}
              name={snapshot.token.name}
              network={network}
            />
            {snapshot.token.isListed && (
              <Badge variant="secondary" className="text-xs">Listed</Badge>
            )}
          </div>
          {liquidationDate && (
            <Badge
              variant={
                liquidationDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
                  ? "destructive"
                  : "outline"
              }
              className="text-xs"
            >
              {liquidationDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
                ? "Liquidation risk"
                : "Liquidation est."}{" "}
              {liquidationDate.toLocaleDateString()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Real-time balance */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Balance</p>
            <p className="text-lg font-semibold tabular-nums">
              <FlowingBalance
                balance={snapshot.balanceUntilUpdatedAt}
                timestamp={snapshot.updatedAtTimestamp}
                flowRate={snapshot.totalNetFlowRate}
              />
            </p>
          </div>

          {/* Net flow rate */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Net Flow Rate</p>
            <p className="text-lg font-semibold">
              <FlowRateDisplay
                flowRate={snapshot.totalNetFlowRate}
                tokenSymbol={snapshot.token.symbol}
                className="text-lg"
              />
            </p>
          </div>

          {/* Active streams */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Active Streams</p>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-sm">
                <ArrowDownLeft className="h-3.5 w-3.5 text-green-500" />
                {snapshot.activeIncomingStreamCount} in
              </span>
              <span className="inline-flex items-center gap-1 text-sm">
                <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
                {snapshot.activeOutgoingStreamCount} out
              </span>
            </div>
          </div>

          {/* Total deposit */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Total Deposit</p>
            <p className="text-sm font-medium tabular-nums">
              {formatEther(snapshot.totalDeposit)} {snapshot.token.symbol}
            </p>
          </div>
        </div>

        {/* Additional details row */}
        <div className="mt-3 grid gap-4 border-t pt-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Inflow Rate</p>
            <FlowRateDisplay flowRate={snapshot.totalInflowRate} className="text-xs" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Outflow Rate</p>
            <FlowRateDisplay flowRate={snapshot.totalOutflowRate} className="text-xs" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Total Streamed In</p>
            <p className="text-xs tabular-nums">
              {formatEther(snapshot.totalAmountStreamedInUntilUpdatedAt)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Total Streamed Out</p>
            <p className="text-xs tabular-nums">
              {formatEther(snapshot.totalAmountStreamedOutUntilUpdatedAt)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Memberships</p>
            <p className="text-xs">
              {snapshot.totalConnectedMemberships} connected / {snapshot.totalMembershipsWithUnits} total
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Updated</p>
            <TimeAgo timestamp={snapshot.updatedAtTimestamp} className="text-xs" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Streams Tab
// ===========================================================================

import type { Stream } from "~/lib/subgraph/types";

function StreamsTab({
  address,
  network,
  blockExplorerUrl,
  incomingStreams,
  outgoingStreams,
  isLoading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  address: string;
  network: string;
  blockExplorerUrl?: string;
  incomingStreams: Stream[];
  outgoingStreams: Stream[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Incoming Streams */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowDownLeft className="h-4 w-4 text-green-500" />
            Incoming Streams ({incomingStreams.length})
          </CardTitle>
          <CardDescription>Streams where this account is the receiver</CardDescription>
        </CardHeader>
        <CardContent>
          {incomingStreams.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No incoming streams found.
            </p>
          ) : (
            <StreamsTable
              streams={incomingStreams}
              direction="incoming"
              accountAddress={address}
              network={network}
              blockExplorerUrl={blockExplorerUrl}
            />
          )}
        </CardContent>
      </Card>

      {/* Outgoing Streams */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpRight className="h-4 w-4 text-red-500" />
            Outgoing Streams ({outgoingStreams.length})
          </CardTitle>
          <CardDescription>Streams where this account is the sender</CardDescription>
        </CardHeader>
        <CardContent>
          {outgoingStreams.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No outgoing streams found.
            </p>
          ) : (
            <StreamsTable
              streams={outgoingStreams}
              direction="outgoing"
              accountAddress={address}
              network={network}
              blockExplorerUrl={blockExplorerUrl}
            />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={
              incomingStreams.length < pageSize && outgoingStreams.length < pageSize
            }
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function StreamsTable({
  streams,
  direction,
  accountAddress,
  network,
  blockExplorerUrl,
}: {
  streams: Stream[];
  direction: "incoming" | "outgoing";
  accountAddress: string;
  network: string;
  blockExplorerUrl?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{direction === "incoming" ? "Sender" : "Receiver"}</TableHead>
          <TableHead>Token</TableHead>
          <TableHead>Flow Rate</TableHead>
          <TableHead>Total Streamed</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {streams.map((stream) => {
          const counterparty =
            direction === "incoming" ? stream.sender : stream.receiver;
          const isActive = BigInt(stream.currentFlowRate) !== 0n;

          return (
            <TableRow key={stream.id}>
              <TableCell>
                <AddressDisplay
                  address={counterparty.id}
                  network={network}
                  blockExplorerUrl={blockExplorerUrl}
                  showExternalLink={false}
                />
              </TableCell>
              <TableCell>
                <TokenDisplay
                  address={stream.token.id}
                  symbol={stream.token.symbol}
                  name={stream.token.name}
                  network={network}
                />
              </TableCell>
              <TableCell>
                <FlowRateDisplay
                  flowRate={stream.currentFlowRate}
                  tokenSymbol={stream.token.symbol}
                />
              </TableCell>
              <TableCell>
                {isActive ? (
                  <FlowingBalance
                    balance={stream.streamedUntilUpdatedAt}
                    timestamp={stream.updatedAtTimestamp}
                    flowRate={stream.currentFlowRate}
                  />
                ) : (
                  <span className="tabular-nums text-sm">
                    {formatEther(stream.streamedUntilUpdatedAt)}
                  </span>
                )}
              </TableCell>
              <TableCell>
                {isActive ? (
                  <Badge variant="default" className="bg-green-500/15 text-green-700 border-green-500/25 hover:bg-green-500/15">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Closed</Badge>
                )}
              </TableCell>
              <TableCell>
                <TimeAgo timestamp={stream.createdAtTimestamp} className="text-sm" />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ===========================================================================
// Pools Tab
// ===========================================================================

import type { Pool } from "~/lib/subgraph/types";

function PoolsTab({
  network,
  blockExplorerUrl,
  adminPools,
  memberships,
  distributions,
  isLoading,
}: {
  network: string;
  blockExplorerUrl?: string;
  adminPools: Pool[];
  memberships: PoolMember[];
  distributions: PoolDistributor[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Administered Pools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Administered Pools ({adminPools.length})
          </CardTitle>
          <CardDescription>Pools where this account is the admin</CardDescription>
        </CardHeader>
        <CardContent>
          {adminPools.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              This account does not administer any pools.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pool</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Flow Rate</TableHead>
                  <TableHead>Total Distributed</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Total Units</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminPools.map((pool) => (
                  <TableRow key={pool.id}>
                    <TableCell>
                      <Link
                        to="/$network/pools/$address"
                        params={{ network, address: pool.id }}
                        search={{} as any}
                        className="font-mono text-sm hover:underline"
                      >
                        {pool.id.slice(0, 10)}...
                      </Link>
                    </TableCell>
                    <TableCell>
                      <TokenDisplay
                        address={pool.token.id}
                        symbol={pool.token.symbol}
                        name={pool.token.name}
                        network={network}
                      />
                    </TableCell>
                    <TableCell>
                      <FlowRateDisplay flowRate={pool.flowRate} />
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {formatEther(pool.totalAmountDistributedUntilUpdatedAt)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {pool.totalConnectedMembers}/{pool.totalMembers}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {pool.totalUnits}
                    </TableCell>
                    <TableCell>
                      <TimeAgo timestamp={pool.createdAtTimestamp} className="text-sm" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pool Memberships */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Droplets className="h-4 w-4" />
            Pool Memberships ({memberships.length})
          </CardTitle>
          <CardDescription>Pools where this account is a member</CardDescription>
        </CardHeader>
        <CardContent>
          {memberships.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              This account is not a member of any pools.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pool</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Connected</TableHead>
                  <TableHead>Amount Claimed</TableHead>
                  <TableHead>Total Received</TableHead>
                  <TableHead>Pool Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell>
                      <Link
                        to="/$network/pools/$address"
                        params={{ network, address: membership.pool.id }}
                        search={{} as any}
                        className="font-mono text-sm hover:underline"
                      >
                        {membership.pool.id.slice(0, 10)}...
                      </Link>
                    </TableCell>
                    <TableCell>
                      <TokenDisplay
                        address={membership.pool.token.id}
                        symbol={membership.pool.token.symbol}
                        name={membership.pool.token.name}
                        network={network}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {membership.units}
                    </TableCell>
                    <TableCell>
                      {membership.isConnected ? (
                        <Badge variant="default" className="bg-green-500/15 text-green-700 border-green-500/25 hover:bg-green-500/15">
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {formatEther(membership.totalAmountClaimed)}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {formatEther(membership.totalAmountReceivedUntilUpdatedAt)}
                    </TableCell>
                    <TableCell>
                      <AddressDisplay
                        address={membership.pool.admin.id}
                        network={network}
                        blockExplorerUrl={blockExplorerUrl}
                        showExternalLink={false}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Distributions (as distributor) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpRight className="h-4 w-4" />
            Distributions ({distributions.length})
          </CardTitle>
          <CardDescription>Pools where this account distributes tokens</CardDescription>
        </CardHeader>
        <CardContent>
          {distributions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              This account has not distributed to any pools.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pool</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Flow Rate</TableHead>
                  <TableHead>Instantly Distributed</TableHead>
                  <TableHead>Flow Distributed</TableHead>
                  <TableHead>Total Distributed</TableHead>
                  <TableHead>Buffer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributions.map((dist) => (
                  <TableRow key={dist.id}>
                    <TableCell>
                      <Link
                        to="/$network/pools/$address"
                        params={{ network, address: dist.pool.id }}
                        search={{} as any}
                        className="font-mono text-sm hover:underline"
                      >
                        {dist.pool.id.slice(0, 10)}...
                      </Link>
                    </TableCell>
                    <TableCell>
                      <TokenDisplay
                        address={dist.pool.token.id}
                        symbol={dist.pool.token.symbol}
                        name={dist.pool.token.name}
                        network={network}
                      />
                    </TableCell>
                    <TableCell>
                      <FlowRateDisplay flowRate={dist.flowRate} />
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {formatEther(dist.totalAmountInstantlyDistributedUntilUpdatedAt)}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {formatEther(dist.totalAmountFlowedDistributedUntilUpdatedAt)}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {formatEther(dist.totalAmountDistributedUntilUpdatedAt)}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {formatEther(dist.totalBuffer)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Events Tab
// ===========================================================================

import type { SubgraphEvent } from "~/lib/subgraph/types";

function EventsTab({
  events,
  isLoading,
  blockExplorerUrl,
  page,
  pageSize,
  eventType,
  onPageChange,
  onPageSizeChange,
  onEventTypeChange,
}: {
  events: SubgraphEvent[];
  isLoading: boolean;
  blockExplorerUrl?: string;
  page: number;
  pageSize: number;
  eventType?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onEventTypeChange: (type: string) => void;
}) {
  return (
    <div className="space-y-4 pt-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Event type:</span>
          <Select
            value={eventType ?? "all"}
            onValueChange={(v) => onEventTypeChange(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-[220px]">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Events table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No events found{eventType ? ` for type "${eventType}"` : ""}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Transaction Hash</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {event.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {blockExplorerUrl ? (
                        <ExternalLink
                          href={`${blockExplorerUrl}/tx/${event.transactionHash}`}
                          className="font-mono text-xs"
                        >
                          {event.transactionHash.slice(0, 10)}...{event.transactionHash.slice(-6)}
                        </ExternalLink>
                      ) : (
                        <span className="font-mono text-xs">
                          {event.transactionHash.slice(0, 10)}...{event.transactionHash.slice(-6)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {blockExplorerUrl ? (
                        <ExternalLink
                          href={`${blockExplorerUrl}/block/${event.blockNumber}`}
                          className="text-xs tabular-nums"
                        >
                          {event.blockNumber}
                        </ExternalLink>
                      ) : (
                        <span className="text-xs tabular-nums">{event.blockNumber}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <TimeAgo timestamp={event.timestamp} className="text-sm" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={events.length < pageSize}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
