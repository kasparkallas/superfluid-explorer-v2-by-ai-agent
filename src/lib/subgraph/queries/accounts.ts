import {
  querySubgraph,
  type PaginationParams,
  DEFAULT_PAGINATION,
} from "~/lib/subgraph/client";
import type { Account, AccountTokenSnapshot } from "~/lib/subgraph/types";

const ACCOUNT_FIELDS = `
  id
  createdAtTimestamp
  createdAtBlockNumber
  updatedAtTimestamp
  updatedAtBlockNumber
  isSuperApp
`;

const ACCOUNT_TOKEN_SNAPSHOT_FIELDS = `
  id
  createdAtTimestamp
  createdAtBlockNumber
  updatedAtTimestamp
  updatedAtBlockNumber
  isLiquidationEstimateOptimistic
  maybeCriticalAtTimestamp
  totalNumberOfActiveStreams
  totalCFANumberOfActiveStreams
  totalGDANumberOfActiveStreams
  activeOutgoingStreamCount
  activeCFAOutgoingStreamCount
  activeGDAOutgoingStreamCount
  activeIncomingStreamCount
  totalNumberOfClosedStreams
  inactiveOutgoingStreamCount
  inactiveIncomingStreamCount
  totalMembershipsWithUnits
  totalConnectedMemberships
  adminOfPoolCount
  balanceUntilUpdatedAt
  totalDeposit
  totalCFADeposit
  totalGDADeposit
  totalNetFlowRate
  totalCFANetFlowRate
  totalInflowRate
  totalOutflowRate
  totalCFAOutflowRate
  totalGDAOutflowRate
  totalAmountStreamedInUntilUpdatedAt
  totalAmountStreamedOutUntilUpdatedAt
  totalAmountStreamedUntilUpdatedAt
  totalAmountTransferredUntilUpdatedAt
  account {
    id
    createdAtTimestamp
    createdAtBlockNumber
    updatedAtTimestamp
    updatedAtBlockNumber
    isSuperApp
  }
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

export async function getAccount(
  network: string,
  address: string
): Promise<Account | null> {
  const query = `
    query GetAccount($id: ID!) {
      account(id: $id) {
        ${ACCOUNT_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ account: Account | null }>(
    network,
    query,
    { id: address.toLowerCase() }
  );
  return data.account;
}

export async function getAccountTokenSnapshots(
  network: string,
  accountAddress: string,
  params?: PaginationParams
): Promise<AccountTokenSnapshot[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "updatedAtTimestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
  } = params ?? {};

  const query = `
    query GetAccountTokenSnapshots {
      accountTokenSnapshots(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        where: { account: "${accountAddress.toLowerCase()}" }
      ) {
        ${ACCOUNT_TOKEN_SNAPSHOT_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{
    accountTokenSnapshots: AccountTokenSnapshot[];
  }>(network, query);
  return data.accountTokenSnapshots;
}
