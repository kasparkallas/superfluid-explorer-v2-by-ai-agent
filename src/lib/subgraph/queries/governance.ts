import {
  querySubgraph,
  type PaginationParams,
  DEFAULT_PAGINATION,
} from "~/lib/subgraph/client";
import type { TokenGovernanceConfig, Account } from "~/lib/subgraph/types";

const TOKEN_GOVERNANCE_CONFIG_FIELDS = `
  id
  createdAtTimestamp
  createdAtBlockNumber
  updatedAtTimestamp
  updatedAtBlockNumber
  isDefault
  rewardAddress
  liquidationPeriod
  patricianPeriod
  minimumDeposit
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
`;

const DEFAULT_GOVERNANCE_ID = "0x0000000000000000000000000000000000000000";

export async function getTokenGovernanceConfig(
  network: string,
  tokenAddress?: string
): Promise<TokenGovernanceConfig | null> {
  const id = tokenAddress
    ? tokenAddress.toLowerCase()
    : DEFAULT_GOVERNANCE_ID;

  const query = `
    query GetTokenGovernanceConfig($id: ID!) {
      tokenGovernanceConfig(id: $id) {
        ${TOKEN_GOVERNANCE_CONFIG_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{
    tokenGovernanceConfig: TokenGovernanceConfig | null;
  }>(network, query, { id });
  return data.tokenGovernanceConfig;
}

export async function getSuperApps(
  network: string,
  params?: PaginationParams
): Promise<Account[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "createdAtTimestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
  } = params ?? {};

  const query = `
    query GetSuperApps {
      accounts(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        where: { isSuperApp: true }
      ) {
        id
        createdAtTimestamp
        createdAtBlockNumber
        updatedAtTimestamp
        updatedAtBlockNumber
        isSuperApp
      }
    }
  `;

  const data = await querySubgraph<{ accounts: Account[] }>(network, query);
  return data.accounts;
}
