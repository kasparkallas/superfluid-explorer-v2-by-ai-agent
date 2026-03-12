import {
  querySubgraph,
  type PaginationParams,
  DEFAULT_PAGINATION,
} from "~/lib/subgraph/client";
import type { Pool, PoolMember } from "~/lib/subgraph/types";

export interface PoolsFilter extends PaginationParams {
  token?: string;
  admin?: string;
}

const POOL_TOKEN_FIELDS = `
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

const POOL_ADMIN_FIELDS = `
  admin {
    id
    createdAtTimestamp
    createdAtBlockNumber
    updatedAtTimestamp
    updatedAtBlockNumber
    isSuperApp
  }
`;

const POOL_FIELDS = `
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
  ${POOL_TOKEN_FIELDS}
  ${POOL_ADMIN_FIELDS}
`;

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
  pool { id }
`;

export async function getPools(
  network: string,
  params?: PoolsFilter
): Promise<Pool[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "createdAtTimestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
    token,
    admin,
  } = params ?? {};

  const whereConditions: string[] = [];
  if (token) whereConditions.push(`token: "${token.toLowerCase()}"`);
  if (admin) whereConditions.push(`admin: "${admin.toLowerCase()}"`);

  const whereClause =
    whereConditions.length > 0
      ? `where: { ${whereConditions.join(", ")} },`
      : "";

  const query = `
    query GetPools {
      pools(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        ${whereClause}
      ) {
        ${POOL_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ pools: Pool[] }>(network, query);
  return data.pools;
}

export async function getPool(
  network: string,
  address: string
): Promise<Pool | null> {
  const query = `
    query GetPool($id: ID!) {
      pool(id: $id) {
        ${POOL_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ pool: Pool | null }>(network, query, {
    id: address.toLowerCase(),
  });
  return data.pool;
}

export async function getPoolMembers(
  network: string,
  poolAddress: string,
  params?: PaginationParams
): Promise<PoolMember[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "createdAtTimestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
  } = params ?? {};

  const query = `
    query GetPoolMembers {
      poolMembers(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        where: { pool: "${poolAddress.toLowerCase()}" }
      ) {
        ${POOL_MEMBER_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ poolMembers: PoolMember[] }>(
    network,
    query
  );
  return data.poolMembers;
}

