import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import sfMeta from "@superfluid-finance/metadata";
import { getNetworkBySlug } from "~/lib/config/networks";
import { querySubgraph, subgraphKeys } from "~/lib/subgraph/client";
import type { TokenGovernanceConfig } from "~/lib/subgraph/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AddressDisplay } from "~/components/address-display";
import { formatTimestamp } from "~/lib/utils/format";
import { ZERO_ADDRESS } from "~/lib/utils/address";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

const searchSchema = z.object({});

export const Route = createFileRoute("/$network/protocol")({
  validateSearch: searchSchema,
  component: ProtocolPage,
});

const TOKEN_GOVERNANCE_CONFIG_FIELDS = `
  id
  rewardAddress
  liquidationPeriod
  patricianPeriod
  minimumDeposit
`;

async function getGovernanceConfig(network: string): Promise<TokenGovernanceConfig | null> {
  const query = `
    query GetGovernanceConfig {
      tokenGovernanceConfigs(first: 1, where: { id: "${ZERO_ADDRESS}" }) {
        ${TOKEN_GOVERNANCE_CONFIG_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ tokenGovernanceConfigs: TokenGovernanceConfig[] }>(
    network,
    query
  );

  return data.tokenGovernanceConfigs[0] || null;
}

function formatDuration(seconds: string | null): string {
  if (!seconds) return "N/A";
  const sec = parseInt(seconds);

  if (sec === 0) return "0 seconds";

  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(" ") || "0 seconds";
}

function ProtocolPage() {
  const { network } = Route.useParams();
  const networkConfig = getNetworkBySlug(network);

  const { data: governanceConfig, isLoading: govLoading } = useQuery({
    queryKey: subgraphKeys.entity(network, "governanceConfig", { id: ZERO_ADDRESS }),
    queryFn: () => getGovernanceConfig(network),
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

  const sfNetwork = sfMeta.getNetworkByChainId(networkConfig.chainId);
  const contracts = sfNetwork?.contractsV1;

  const contractAddresses = [
    { name: "Host", address: contracts?.host },
    { name: "CFAv1", address: contracts?.cfaV1 },
    { name: "CFAv1 Forwarder", address: contracts?.cfaV1Forwarder },
    { name: "GDAv1", address: contracts?.gdaV1 },
    { name: "GDAv1 Forwarder", address: contracts?.gdaV1Forwarder },
    { name: "SuperToken Factory", address: contracts?.superTokenFactory },
    { name: "Resolver", address: contracts?.resolver },
    { name: "TOGA", address: contracts?.toga },
    { name: "Batch Liquidator", address: contracts?.batchLiquidator },
    { name: "Macro Forwarder", address: contracts?.macroForwarder },
  ].filter(item => item.address);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Protocol Configuration</h1>
        <p className="text-muted-foreground">
          Governance parameters and contract addresses for {networkConfig.name}
        </p>
      </div>

      {/* Governance Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Governance Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          {govLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !governanceConfig ? (
            <p className="text-muted-foreground">No governance configuration found</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">
                    Liquidation Period
                  </h3>
                  <p className="text-lg font-mono">
                    {formatDuration(governanceConfig.liquidationPeriod)}
                  </p>
                  {governanceConfig.liquidationPeriod && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {parseInt(governanceConfig.liquidationPeriod).toLocaleString()} seconds
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">
                    Patrician Period
                  </h3>
                  <p className="text-lg font-mono">
                    {formatDuration(governanceConfig.patricianPeriod)}
                  </p>
                  {governanceConfig.patricianPeriod && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {parseInt(governanceConfig.patricianPeriod).toLocaleString()} seconds
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">
                    Minimum Deposit
                  </h3>
                  <p className="text-lg font-mono">
                    {governanceConfig.minimumDeposit || "N/A"}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">
                    Reward Address
                  </h3>
                  {governanceConfig.rewardAddress ? (
                    <AddressDisplay
                      address={governanceConfig.rewardAddress}
                      network={network}
                      blockExplorerUrl={networkConfig.blockExplorerUrl}
                    />
                  ) : (
                    <p className="text-lg font-mono">N/A</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Addresses */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          {!sfNetwork || !contracts ? (
            <p className="text-muted-foreground">
              No contract information available for this network
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractAddresses.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <AddressDisplay
                          address={item.address!}
                          network={network}
                          blockExplorerUrl={networkConfig.blockExplorerUrl}
                          showInternalLink={false}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
