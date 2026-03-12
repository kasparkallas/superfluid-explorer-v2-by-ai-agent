import {
  querySubgraph,
  type PaginationParams,
  DEFAULT_PAGINATION,
} from "~/lib/subgraph/client";
import type { Token, TokenStatistic } from "~/lib/subgraph/types";

export interface TokensFilter extends PaginationParams {
  isSuperToken?: boolean;
  isListed?: boolean;
  nameOrSymbol?: string;
}

const TOKEN_FIELDS = `
  id
  createdAtTimestamp
  createdAtBlockNumber
  decimals
  name
  symbol
  isSuperToken
  isNativeAssetSuperToken
  isListed
  underlyingAddress
  underlyingToken {
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

const TOKEN_STATISTIC_FIELDS = `
  id
  updatedAtTimestamp
  updatedAtBlockNumber
  totalNumberOfActiveStreams
  totalCFANumberOfActiveStreams
  totalGDANumberOfActiveStreams
  totalNumberOfClosedStreams
  totalCFANumberOfClosedStreams
  totalGDANumberOfClosedStreams
  totalNumberOfPools
  totalNumberOfActivePools
  totalDeposit
  totalCFADeposit
  totalGDADeposit
  totalOutflowRate
  totalCFAOutflowRate
  totalGDAOutflowRate
  totalAmountStreamedUntilUpdatedAt
  totalCFAAmountStreamedUntilUpdatedAt
  totalAmountDistributedUntilUpdatedAt
  totalAmountTransferredUntilUpdatedAt
  totalSupply
  totalNumberOfAccounts
  totalNumberOfHolders
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

export async function getTokens(
  network: string,
  params?: TokensFilter
): Promise<Token[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "createdAtTimestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
    isSuperToken,
    isListed,
    nameOrSymbol,
  } = params ?? {};

  const whereConditions: string[] = [];
  if (isSuperToken !== undefined)
    whereConditions.push(`isSuperToken: ${isSuperToken}`);
  if (isListed !== undefined) whereConditions.push(`isListed: ${isListed}`);
  if (nameOrSymbol)
    whereConditions.push(`symbol_contains_nocase: "${nameOrSymbol}"`);

  const whereClause =
    whereConditions.length > 0
      ? `where: { ${whereConditions.join(", ")} },`
      : "";

  const query = `
    query GetTokens {
      tokens(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        ${whereClause}
      ) {
        ${TOKEN_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ tokens: Token[] }>(network, query);
  return data.tokens;
}

export async function getToken(
  network: string,
  address: string
): Promise<Token | null> {
  const query = `
    query GetToken($id: ID!) {
      token(id: $id) {
        ${TOKEN_FIELDS}
        governanceConfig {
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
        }
      }
    }
  `;

  const data = await querySubgraph<{ token: Token | null }>(network, query, {
    id: address.toLowerCase(),
  });
  return data.token;
}

export async function getTokenStatistic(
  network: string,
  tokenAddress: string
): Promise<TokenStatistic | null> {
  const query = `
    query GetTokenStatistic($id: ID!) {
      tokenStatistic(id: $id) {
        ${TOKEN_STATISTIC_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ tokenStatistic: TokenStatistic | null }>(
    network,
    query,
    { id: tokenAddress.toLowerCase() }
  );
  return data.tokenStatistic;
}
