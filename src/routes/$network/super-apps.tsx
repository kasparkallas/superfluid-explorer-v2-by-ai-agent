import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { getNetworkBySlug } from "~/lib/config/networks";
import { querySubgraph, subgraphKeys } from "~/lib/subgraph/client";
import type { Account } from "~/lib/subgraph/types";
import { DataTable } from "~/components/data-table";
import { AddressDisplay } from "~/components/address-display";
import { TimeAgo } from "~/components/time-ago";

const searchSchema = z.object({
  page: z.coerce.number().positive().default(1).catch(1),
  pageSize: z.coerce.number().positive().default(25).catch(25),
  sort: z.string().default("updatedAtTimestamp").catch("updatedAtTimestamp"),
  dir: z.enum(["asc", "desc"]).default("desc").catch("desc"),
});

export const Route = createFileRoute("/$network/super-apps")({
  validateSearch: searchSchema,
  component: SuperAppsPage,
});

const SUPER_APP_FIELDS = `
  id
  isSuperApp
  createdAtTimestamp
  updatedAtTimestamp
`;

interface SnapshotStats {
  activeStreams: number;
  tokenCount: number;
}

async function getSuperApps(
  network: string,
  page: number,
  pageSize: number,
  sort: string,
  dir: "asc" | "desc"
): Promise<Account[]> {
  const skip = (page - 1) * pageSize;

  const query = `
    query GetSuperApps {
      accounts(
        where: { isSuperApp: true },
        first: ${pageSize},
        skip: ${skip},
        orderBy: ${sort},
        orderDirection: ${dir}
      ) {
        ${SUPER_APP_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ accounts: Account[] }>(network, query);
  return data.accounts;
}

async function getSuperAppSnapshots(
  network: string,
  accountIds: string[]
): Promise<Map<string, SnapshotStats>> {
  if (accountIds.length === 0) return new Map();

  const ids = accountIds.map((id) => `"${id}"`).join(", ");
  const query = `{
    accountTokenSnapshots(
      first: 1000,
      where: { account_in: [${ids}] }
    ) {
      account { id }
      totalNumberOfActiveStreams
      token { id }
    }
  }`;

  const data = await querySubgraph<{
    accountTokenSnapshots: Array<{
      account: { id: string };
      totalNumberOfActiveStreams: number;
      token: { id: string };
    }>;
  }>(network, query);

  const intermediate = new Map<string, { activeStreams: number; tokens: Set<string> }>();
  for (const snap of data.accountTokenSnapshots) {
    const entry = intermediate.get(snap.account.id) ?? { activeStreams: 0, tokens: new Set() };
    entry.activeStreams += snap.totalNumberOfActiveStreams;
    entry.tokens.add(snap.token.id);
    intermediate.set(snap.account.id, entry);
  }

  const result = new Map<string, SnapshotStats>();
  for (const [id, entry] of intermediate) {
    result.set(id, { activeStreams: entry.activeStreams, tokenCount: entry.tokens.size });
  }
  return result;
}

function SuperAppsPage() {
  const { network } = Route.useParams();
  const search = Route.useSearch();
  const { page, pageSize, sort, dir } = search;

  const networkConfig = getNetworkBySlug(network);

  const { data, isLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "superApps", { page, pageSize, sort, dir }),
    queryFn: async () => {
      const accounts = await getSuperApps(network, page, pageSize, sort, dir);
      const snapshotStats = await getSuperAppSnapshots(
        network,
        accounts.map((a) => a.id)
      );
      return { accounts, snapshotStats };
    },
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

  const columns: ColumnDef<Account>[] = [
    {
      id: "id",
      header: "Address",
      enableSorting: false,
      cell: ({ row }) => (
        <AddressDisplay
          address={row.original.id}
          network={network}
          blockExplorerUrl={networkConfig.blockExplorerUrl}
        />
      ),
    },
    {
      id: "activeStreams",
      header: "Active Streams",
      enableSorting: false,
      cell: ({ row }) => {
        const stats = data?.snapshotStats.get(row.original.id);
        return <span className="font-mono">{(stats?.activeStreams ?? 0).toLocaleString()}</span>;
      },
    },
    {
      id: "tokensInteracted",
      header: "Tokens Interacted",
      enableSorting: false,
      cell: ({ row }) => {
        const stats = data?.snapshotStats.get(row.original.id);
        return <span className="font-mono">{stats?.tokenCount ?? 0}</span>;
      },
    },
    {
      id: "createdAtTimestamp",
      header: "First Seen",
      cell: ({ row }) => (
        <TimeAgo timestamp={row.original.createdAtTimestamp} />
      ),
    },
    {
      id: "updatedAtTimestamp",
      header: "Last Active",
      cell: ({ row }) => (
        <TimeAgo timestamp={row.original.updatedAtTimestamp} />
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Super App Directory</h1>
        <p className="text-muted-foreground">
          Browse all Super Apps on {networkConfig.name}
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.accounts ?? []}
        isLoading={isLoading}
        pageSize={pageSize}
        page={page}
        sort={sort}
        dir={dir}
      />
    </div>
  );
}
