import {
  querySubgraph,
  type PaginationParams,
  DEFAULT_PAGINATION,
} from "~/lib/subgraph/client";
import type { Stream, StreamPeriod } from "~/lib/subgraph/types";

export interface StreamsFilter extends PaginationParams {
  sender?: string;
  receiver?: string;
  token?: string;
}

const STREAM_FIELDS = `
  id
  createdAtTimestamp
  createdAtBlockNumber
  updatedAtTimestamp
  updatedAtBlockNumber
  currentFlowRate
  deposit
  streamedUntilUpdatedAt
  userData
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
  sender {
    id
    createdAtTimestamp
    createdAtBlockNumber
    updatedAtTimestamp
    updatedAtBlockNumber
    isSuperApp
  }
  receiver {
    id
    createdAtTimestamp
    createdAtBlockNumber
    updatedAtTimestamp
    updatedAtBlockNumber
    isSuperApp
  }
`;

const STREAM_PERIOD_FIELDS = `
  id
  stream {
    id
  }
  sender {
    id
    createdAtTimestamp
    createdAtBlockNumber
    updatedAtTimestamp
    updatedAtBlockNumber
    isSuperApp
  }
  receiver {
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
  flowRate
  deposit
  startedAtTimestamp
  startedAtBlockNumber
  stoppedAtTimestamp
  stoppedAtBlockNumber
  totalAmountStreamed
`;

export async function getStreams(
  network: string,
  params?: StreamsFilter
): Promise<Stream[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "createdAtTimestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
    sender,
    receiver,
    token,
  } = params ?? {};

  const whereConditions: string[] = [];
  if (sender) whereConditions.push(`sender: "${sender.toLowerCase()}"`);
  if (receiver) whereConditions.push(`receiver: "${receiver.toLowerCase()}"`);
  if (token) whereConditions.push(`token: "${token.toLowerCase()}"`);

  const whereClause =
    whereConditions.length > 0
      ? `where: { ${whereConditions.join(", ")} },`
      : "";

  const query = `
    query GetStreams {
      streams(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        ${whereClause}
      ) {
        ${STREAM_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ streams: Stream[] }>(network, query);
  return data.streams;
}

export async function getStream(
  network: string,
  id: string
): Promise<Stream | null> {
  const query = `
    query GetStream($id: ID!) {
      stream(id: $id) {
        ${STREAM_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ stream: Stream | null }>(network, query, {
    id,
  });
  return data.stream;
}

export async function getStreamPeriods(
  network: string,
  streamId: string,
  params?: PaginationParams
): Promise<StreamPeriod[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "startedAtTimestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
  } = params ?? {};

  const query = `
    query GetStreamPeriods {
      streamPeriods(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        where: { stream: "${streamId}" }
      ) {
        ${STREAM_PERIOD_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ streamPeriods: StreamPeriod[] }>(
    network,
    query
  );
  return data.streamPeriods;
}
