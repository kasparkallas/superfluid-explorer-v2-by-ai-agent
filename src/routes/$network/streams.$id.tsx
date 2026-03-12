import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { getNetworkBySlug } from "~/lib/config/networks";
import { subgraphKeys } from "~/lib/subgraph/client";
import { getStream, getStreamPeriods } from "~/lib/subgraph/queries/streams";
import type { StreamPeriod } from "~/lib/subgraph/types";
import { Card, CardHeader, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/data-table";
import { AddressDisplay } from "~/components/address-display";
import { TokenDisplay } from "~/components/token-display";
import { FlowRateDisplay } from "~/components/flow-rate-display";
import { FlowingBalance } from "~/components/flowing-balance";
import { TimeAgo } from "~/components/time-ago";
import { ExternalLink } from "~/components/external-link";
import { formatEther } from "~/lib/utils/format";

const searchSchema = z.object({
  page: z.coerce.number().positive().default(1).catch(1),
  pageSize: z.coerce.number().positive().default(25).catch(25),
});

export const Route = createFileRoute("/$network/streams/$id")({
  validateSearch: searchSchema,
  component: StreamDetail,
});

function StreamDetail() {
  const { network, id } = Route.useParams();
  const { page, pageSize } = Route.useSearch();
  const networkConfig = getNetworkBySlug(network);

  const { data: stream, isLoading: streamLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "stream", { id }),
    queryFn: () => getStream(network, id),
    enabled: !!networkConfig,
  });

  const { data: streamPeriods, isLoading: periodsLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "streamPeriods", { id, page, pageSize }),
    queryFn: () =>
      getStreamPeriods(network, id, {
        first: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: "startedAtTimestamp",
        orderDirection: "desc",
      }),
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

  if (streamLoading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading stream...</p>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Stream not found</h1>
        <p className="text-muted-foreground">
          The stream with ID "{id}" does not exist on {networkConfig.name}.
        </p>
      </div>
    );
  }

  const isActive = BigInt(stream.currentFlowRate) > 0n;
  const totalStreamed =
    BigInt(stream.streamedUntilUpdatedAt) +
    BigInt(stream.currentFlowRate) * BigInt(Math.floor(Date.now() / 1000) - parseInt(stream.updatedAtTimestamp));

  const columns: ColumnDef<StreamPeriod>[] = [
    {
      id: "flowRate",
      header: "Flow Rate",
      cell: ({ row }) => (
        <FlowRateDisplay
          flowRate={row.original.flowRate}
          tokenSymbol={row.original.token.symbol}
        />
      ),
    },
    {
      id: "deposit",
      header: "Deposit",
      cell: ({ row }) => (
        <span className="text-sm">
          {formatEther(row.original.deposit)} {row.original.token.symbol}
        </span>
      ),
    },
    {
      id: "startedAtTimestamp",
      header: "Started At",
      cell: ({ row }) => <TimeAgo timestamp={row.original.startedAtTimestamp} />,
    },
    {
      id: "stoppedAtTimestamp",
      header: "Stopped At",
      cell: ({ row }) =>
        row.original.stoppedAtTimestamp ? (
          <TimeAgo timestamp={row.original.stoppedAtTimestamp} />
        ) : (
          <span className="text-muted-foreground text-sm">Active</span>
        ),
    },
    {
      id: "duration",
      header: "Duration",
      cell: ({ row }) => {
        const started = parseInt(row.original.startedAtTimestamp);
        const stopped = row.original.stoppedAtTimestamp
          ? parseInt(row.original.stoppedAtTimestamp)
          : Math.floor(Date.now() / 1000);
        const duration = stopped - started;
        const days = Math.floor(duration / 86400);
        const hours = Math.floor((duration % 86400) / 3600);
        const mins = Math.floor((duration % 3600) / 60);

        if (days > 0) {
          return <span className="text-sm">{days}d {hours}h</span>;
        } else if (hours > 0) {
          return <span className="text-sm">{hours}h {mins}m</span>;
        } else {
          return <span className="text-sm">{mins}m</span>;
        }
      },
    },
    {
      id: "totalAmountStreamed",
      header: "Amount Streamed",
      cell: ({ row }) => {
        const amount = row.original.totalAmountStreamed
          ? BigInt(row.original.totalAmountStreamed)
          : (() => {
              const started = parseInt(row.original.startedAtTimestamp);
              const stopped = row.original.stoppedAtTimestamp
                ? parseInt(row.original.stoppedAtTimestamp)
                : Math.floor(Date.now() / 1000);
              return BigInt(row.original.flowRate) * BigInt(stopped - started);
            })();

        return (
          <span className="text-sm">
            {formatEther(amount)} {row.original.token.symbol}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold">Stream</h1>
                <Badge variant={isActive ? "default" : "secondary"}>
                  {isActive ? "Active" : "Closed"}
                </Badge>
              </div>
              <p className="font-mono text-sm text-muted-foreground break-all">{stream.id}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Token</p>
                <TokenDisplay
                  address={stream.token.id}
                  symbol={stream.token.symbol}
                  name={stream.token.name}
                  network={network}
                />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Flow Rate</p>
                <FlowRateDisplay
                  flowRate={stream.currentFlowRate}
                  tokenSymbol={stream.token.symbol}
                />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Sender</p>
                <AddressDisplay
                  address={stream.sender.id}
                  network={network}
                  blockExplorerUrl={networkConfig.blockExplorerUrl}
                />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Receiver</p>
                <AddressDisplay
                  address={stream.receiver.id}
                  network={network}
                  blockExplorerUrl={networkConfig.blockExplorerUrl}
                />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Streamed</p>
                <FlowingBalance
                  balance={stream.streamedUntilUpdatedAt}
                  timestamp={stream.updatedAtTimestamp}
                  flowRate={stream.currentFlowRate}
                />
                <span className="text-sm ml-1">{stream.token.symbol}</span>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Deposit</p>
                <span className="text-sm">
                  {formatEther(stream.deposit)} {stream.token.symbol}
                </span>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Created</p>
                <TimeAgo timestamp={stream.createdAtTimestamp} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Updated</p>
                <TimeAgo timestamp={stream.updatedAtTimestamp} />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Block Explorer</p>
                <ExternalLink href={`${networkConfig.blockExplorerUrl}/address/${stream.sender.id}`}>
                  View on Explorer
                </ExternalLink>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Stream Periods</h2>
        <DataTable
          columns={columns}
          data={streamPeriods ?? []}
          isLoading={periodsLoading}
          pageSize={pageSize}
          page={page}
        />
      </div>
    </div>
  );
}
