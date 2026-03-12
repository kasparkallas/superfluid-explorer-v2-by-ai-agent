import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { getNetworkBySlug } from "~/lib/config/networks";
import { querySubgraph, querySubgraphAll, subgraphKeys } from "~/lib/subgraph/client";
import type { AccountTokenSnapshot, AgreementLiquidatedV2Event, NewPICEvent } from "~/lib/subgraph/types";
import { DataTable } from "~/components/data-table";
import { AddressDisplay } from "~/components/address-display";
import { TokenDisplay } from "~/components/token-display";
import { FlowRateDisplay } from "~/components/flow-rate-display";
import { FlowingBalance } from "~/components/flowing-balance";
import { TimeAgo } from "~/components/time-ago";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { formatEther, formatRelativeTime } from "~/lib/utils/format";
import { truncateAddress } from "~/lib/utils/address";
import { Badge } from "~/components/ui/badge";
import { useState, useEffect } from "react";

const searchSchema = z.object({
  window: z.enum(["1h", "6h", "24h", "7d"]).default("24h").catch("24h"),
  tab: z.enum(["at-risk", "recent", "toga"]).default("at-risk").catch("at-risk"),
  page: z.coerce.number().positive().default(1).catch(1),
  pageSize: z.coerce.number().positive().default(25).catch(25),
});

export const Route = createFileRoute("/$network/liquidations")({
  validateSearch: searchSchema,
  component: LiquidationsPage,
});

// Time window calculations
const WINDOW_SECONDS = {
  "1h": 3600,
  "6h": 21600,
  "24h": 86400,
  "7d": 604800,
};

// At-Risk Streams Query
async function getAtRiskStreams(
  network: string,
  windowSeconds: number,
  page: number,
  pageSize: number
): Promise<{ snapshots: AccountTokenSnapshot[]; total: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowEnd = now + windowSeconds;

  const query = `
    query GetAtRiskStreams {
      accountTokenSnapshots(
        where: {
          maybeCriticalAtTimestamp_gt: "${now}",
          maybeCriticalAtTimestamp_lt: "${windowEnd}",
          totalNetFlowRate_lt: "0"
        },
        orderBy: maybeCriticalAtTimestamp,
        orderDirection: asc,
        first: ${pageSize},
        skip: ${(page - 1) * pageSize}
      ) {
        id
        balanceUntilUpdatedAt
        totalNetFlowRate
        updatedAtTimestamp
        maybeCriticalAtTimestamp
        totalDeposit
        account {
          id
        }
        token {
          id
          symbol
          name
        }
      }
    }
  `;

  const data = await querySubgraph<{ accountTokenSnapshots: AccountTokenSnapshot[] }>(network, query);
  return { snapshots: data.accountTokenSnapshots, total: data.accountTokenSnapshots.length };
}

// Recent Liquidations Query
async function getRecentLiquidations(
  network: string,
  page: number,
  pageSize: number
): Promise<{ events: AgreementLiquidatedV2Event[]; total: number }> {
  const query = `
    query GetRecentLiquidations {
      agreementLiquidatedV2Events(
        orderBy: timestamp,
        orderDirection: desc,
        first: ${pageSize},
        skip: ${(page - 1) * pageSize}
      ) {
        id
        timestamp
        transactionHash
        blockNumber
        token
        liquidatorAccount
        targetAccount
        rewardAmountReceiver
        rewardAmount
        targetAccountBalanceDelta
      }
    }
  `;

  const data = await querySubgraph<{ agreementLiquidatedV2Events: AgreementLiquidatedV2Event[] }>(
    network,
    query
  );
  return { events: data.agreementLiquidatedV2Events, total: data.agreementLiquidatedV2Events.length };
}

// TOGA State Query
async function getTogaState(network: string): Promise<Map<string, NewPICEvent>> {
  const query = `
    query GetTogaState {
      newPICEvents(
        orderBy: timestamp,
        orderDirection: desc,
        first: 50
      ) {
        id
        timestamp
        token
        pic
        bond
        exitRate
      }
    }
  `;

  const data = await querySubgraph<{ newPICEvents: NewPICEvent[] }>(network, query);

  // Group by token, keeping only the most recent
  const latestByToken = new Map<string, NewPICEvent>();
  for (const event of data.newPICEvents) {
    const token = event.token.toLowerCase();
    if (!latestByToken.has(token)) {
      latestByToken.set(token, event);
    }
  }

  return latestByToken;
}

// Countdown component for time remaining
function Countdown({ targetTimestamp }: { targetTimestamp: string | number }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const target = typeof targetTimestamp === "string" ? parseInt(targetTimestamp) : targetTimestamp;
      const now = Math.floor(Date.now() / 1000);
      const diff = target - now;

      if (diff <= 0) {
        setRemaining("Critical!");
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
      if (days === 0) parts.push(`${seconds}s`);

      setRemaining(parts.join(" "));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  return <span className="tabular-nums">{remaining}</span>;
}

function LiquidationsPage() {
  const { network } = Route.useParams();
  const { window, tab, page, pageSize } = Route.useSearch();
  const navigate = useNavigate();
  const networkConfig = getNetworkBySlug(network);

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

  const windowSeconds = WINDOW_SECONDS[window];

  // Queries
  const atRiskQuery = useQuery({
    queryKey: subgraphKeys.entity(network, "atRiskStreams", { window, page, pageSize }),
    queryFn: () => getAtRiskStreams(network, windowSeconds, page, pageSize),
    enabled: tab === "at-risk",
  });

  const recentLiquidationsQuery = useQuery({
    queryKey: subgraphKeys.entity(network, "recentLiquidations", { page, pageSize }),
    queryFn: () => getRecentLiquidations(network, page, pageSize),
    enabled: tab === "recent",
  });

  const togaStateQuery = useQuery({
    queryKey: subgraphKeys.entity(network, "togaState", {}),
    queryFn: () => getTogaState(network),
    enabled: tab === "toga",
  });

  // Token lookup for resolving addresses to symbols
  const { data: tokenMap } = useQuery({
    queryKey: subgraphKeys.entity(network, "tokenLookup"),
    queryFn: async () => {
      const tokens = await querySubgraphAll<{ id: string; symbol: string; name: string }>(
        network, "tokens", "id symbol name"
      );
      const map = new Map<string, { symbol: string; name: string }>();
      for (const t of tokens) {
        map.set(t.id.toLowerCase(), { symbol: t.symbol, name: t.name });
      }
      return map;
    },
    staleTime: 60_000,
  });

  const updateSearch = (updates: Record<string, unknown>) => {
    navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...updates,
      }),
      replace: true,
    } as any);
  };

  // At-Risk Streams Columns
  const atRiskColumns: ColumnDef<AccountTokenSnapshot>[] = [
    {
      id: "account",
      header: "Account",
      enableSorting: false,
      cell: ({ row }) => (
        <AddressDisplay
          address={row.original.account.id}
          network={network}
          blockExplorerUrl={networkConfig.blockExplorerUrl}
        />
      ),
    },
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
      id: "currentBalance",
      header: "Current Balance",
      enableSorting: false,
      cell: ({ row }) => (
        <FlowingBalance
          balance={row.original.balanceUntilUpdatedAt}
          timestamp={row.original.updatedAtTimestamp}
          flowRate={row.original.totalNetFlowRate}
          className="text-sm"
        />
      ),
    },
    {
      id: "netFlowRate",
      header: "Net Flow Rate",
      enableSorting: false,
      cell: ({ row }) => (
        <FlowRateDisplay
          flowRate={row.original.totalNetFlowRate}
          tokenSymbol={row.original.token.symbol}
          className="text-red-600 dark:text-red-400"
        />
      ),
    },
    {
      id: "criticalAt",
      header: "Critical At",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.maybeCriticalAtTimestamp ? (
          <TimeAgo timestamp={row.original.maybeCriticalAtTimestamp} className="text-sm" />
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      id: "timeRemaining",
      header: "Time Remaining",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.maybeCriticalAtTimestamp ? (
          <Countdown targetTimestamp={row.original.maybeCriticalAtTimestamp} />
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      id: "depositAtRisk",
      header: "Deposit at Risk",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {formatEther(row.original.totalDeposit)} {row.original.token.symbol}
        </span>
      ),
    },
  ];

  // Recent Liquidations Columns
  const recentLiquidationsColumns: ColumnDef<AgreementLiquidatedV2Event>[] = [
    {
      id: "time",
      header: "Time",
      enableSorting: false,
      cell: ({ row }) => <TimeAgo timestamp={row.original.timestamp} className="text-sm" />,
    },
    {
      id: "targetAccount",
      header: "Target Account",
      enableSorting: false,
      cell: ({ row }) => (
        <AddressDisplay
          address={row.original.targetAccount}
          network={network}
          blockExplorerUrl={networkConfig.blockExplorerUrl}
        />
      ),
    },
    {
      id: "liquidator",
      header: "Liquidator",
      enableSorting: false,
      cell: ({ row }) => (
        <AddressDisplay
          address={row.original.liquidatorAccount}
          network={network}
          blockExplorerUrl={networkConfig.blockExplorerUrl}
        />
      ),
    },
    {
      id: "token",
      header: "Token",
      enableSorting: false,
      cell: ({ row }) => {
        const tokenInfo = tokenMap?.get(row.original.token.toLowerCase());
        return tokenInfo ? (
          <TokenDisplay
            address={row.original.token}
            symbol={tokenInfo.symbol}
            name={tokenInfo.name}
            network={network}
          />
        ) : (
          <span className="font-mono text-sm text-muted-foreground">
            {truncateAddress(row.original.token)}
          </span>
        );
      },
    },
    {
      id: "rewardAmount",
      header: "Reward Amount",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-green-600 dark:text-green-400">
          {formatEther(row.original.rewardAmount)}
        </span>
      ),
    },
    {
      id: "balanceDelta",
      header: "Balance Delta",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {formatEther(row.original.targetAccountBalanceDelta)}
        </span>
      ),
    },
    {
      id: "txHash",
      header: "Tx Hash",
      enableSorting: false,
      cell: ({ row }) => (
        <a
          href={`${networkConfig.blockExplorerUrl}/tx/${row.original.transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {truncateAddress(row.original.transactionHash)}
        </a>
      ),
    },
  ];

  // TOGA State Columns
  const togaStateColumns: ColumnDef<NewPICEvent>[] = [
    {
      id: "token",
      header: "Token",
      enableSorting: false,
      cell: ({ row }) => {
        const tokenInfo = tokenMap?.get(row.original.token.toLowerCase());
        return tokenInfo ? (
          <TokenDisplay
            address={row.original.token}
            symbol={tokenInfo.symbol}
            name={tokenInfo.name}
            network={network}
          />
        ) : (
          <span className="font-mono text-sm text-muted-foreground">
            {truncateAddress(row.original.token)}
          </span>
        );
      },
    },
    {
      id: "pic",
      header: "Current PIC",
      enableSorting: false,
      cell: ({ row }) => (
        <AddressDisplay
          address={row.original.pic}
          network={network}
          blockExplorerUrl={networkConfig.blockExplorerUrl}
        />
      ),
    },
    {
      id: "bond",
      header: "Bond Amount",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{formatEther(row.original.bond)}</span>
      ),
    },
    {
      id: "picSince",
      header: "PIC Since",
      enableSorting: false,
      cell: ({ row }) => <TimeAgo timestamp={row.original.timestamp} className="text-sm" />,
    },
    {
      id: "exitRate",
      header: "Exit Rate",
      enableSorting: false,
      cell: ({ row }) => <FlowRateDisplay flowRate={row.original.exitRate} />,
    },
  ];

  const togaStateData = togaStateQuery.data ? Array.from(togaStateQuery.data.values()) : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Liquidation Monitor</h1>
        <p className="text-muted-foreground">
          Monitor at-risk streams, recent liquidations, and TOGA state on {networkConfig.name}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        <button
          onClick={() => updateSearch({ tab: "at-risk", page: 1 })}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            tab === "at-risk"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          At-Risk Streams
        </button>
        <button
          onClick={() => updateSearch({ tab: "recent", page: 1 })}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            tab === "recent"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Recent Liquidations
        </button>
        <button
          onClick={() => updateSearch({ tab: "toga", page: 1 })}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            tab === "toga"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          TOGA State
        </button>
      </div>

      {/* At-Risk Streams Tab */}
      {tab === "at-risk" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Time Window:</span>
              <Select
                value={window}
                onValueChange={(value) => updateSearch({ window: value, page: 1 })}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="6h">6 hours</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {atRiskQuery.data && (
              <Badge variant="outline">
                {atRiskQuery.data.snapshots.length} streams at risk
              </Badge>
            )}
          </div>

          <DataTable
            columns={atRiskColumns}
            data={atRiskQuery.data?.snapshots || []}
            totalCount={atRiskQuery.data?.total}
            isLoading={atRiskQuery.isLoading}
            pageSize={pageSize}
            page={page}
          />
        </div>
      )}

      {/* Recent Liquidations Tab */}
      {tab === "recent" && (
        <div className="space-y-4">
          <DataTable
            columns={recentLiquidationsColumns}
            data={recentLiquidationsQuery.data?.events || []}
            totalCount={recentLiquidationsQuery.data?.total}
            isLoading={recentLiquidationsQuery.isLoading}
            pageSize={pageSize}
            page={page}
          />
        </div>
      )}

      {/* TOGA State Tab */}
      {tab === "toga" && (
        <div className="space-y-4">
          {togaStateQuery.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading TOGA state...</div>
          ) : togaStateData.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  No TOGA events found for this network.
                </p>
              </CardContent>
            </Card>
          ) : (
            <DataTable
              columns={togaStateColumns}
              data={togaStateData}
              totalCount={togaStateData.length}
              isLoading={togaStateQuery.isLoading}
              pageSize={pageSize}
              page={page}
            />
          )}
        </div>
      )}
    </div>
  );
}
