import {
  querySubgraph,
  type PaginationParams,
  DEFAULT_PAGINATION,
} from "~/lib/subgraph/client";
import type {
  SubgraphEvent,
  AgreementLiquidatedV2Event,
  NewPICEvent,
  FlowDistributionUpdatedEvent,
  InstantDistributionUpdatedEvent,
  MemberUnitsUpdatedEvent,
} from "~/lib/subgraph/types";

export interface EventsFilter extends PaginationParams {
  addresses_contains?: string[];
  name?: string;
  transactionHash?: string;
  timestamp_gte?: string;
  timestamp_lte?: string;
}

const BASE_EVENT_FIELDS = `
  id
  blockNumber
  logIndex
  order
  name
  addresses
  timestamp
  transactionHash
  gasPrice
  gasUsed
`;

export async function getEvents(
  network: string,
  params?: EventsFilter
): Promise<SubgraphEvent[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "timestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
    addresses_contains,
    name,
    transactionHash,
    timestamp_gte,
    timestamp_lte,
  } = params ?? {};

  const whereConditions: string[] = [];
  if (addresses_contains?.length)
    whereConditions.push(
      `addresses_contains: [${addresses_contains.map((a) => `"${a.toLowerCase()}"`).join(", ")}]`
    );
  if (name) whereConditions.push(`name: "${name}"`);
  if (transactionHash)
    whereConditions.push(`transactionHash: "${transactionHash}"`);
  if (timestamp_gte)
    whereConditions.push(`timestamp_gte: "${timestamp_gte}"`);
  if (timestamp_lte)
    whereConditions.push(`timestamp_lte: "${timestamp_lte}"`);

  const whereClause =
    whereConditions.length > 0
      ? `where: { ${whereConditions.join(", ")} },`
      : "";

  const query = `
    query GetEvents {
      events(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        ${whereClause}
      ) {
        ${BASE_EVENT_FIELDS}
      }
    }
  `;

  const data = await querySubgraph<{ events: SubgraphEvent[] }>(
    network,
    query
  );
  return data.events;
}

export async function getAgreementLiquidatedV2Events(
  network: string,
  params?: EventsFilter
): Promise<AgreementLiquidatedV2Event[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "timestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
    addresses_contains,
    timestamp_gte,
    timestamp_lte,
  } = params ?? {};

  const whereConditions: string[] = [];
  if (addresses_contains?.length)
    whereConditions.push(
      `addresses_contains: [${addresses_contains.map((a) => `"${a.toLowerCase()}"`).join(", ")}]`
    );
  if (timestamp_gte)
    whereConditions.push(`timestamp_gte: "${timestamp_gte}"`);
  if (timestamp_lte)
    whereConditions.push(`timestamp_lte: "${timestamp_lte}"`);

  const whereClause =
    whereConditions.length > 0
      ? `where: { ${whereConditions.join(", ")} },`
      : "";

  const query = `
    query GetAgreementLiquidatedV2Events {
      agreementLiquidatedV2Events(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        ${whereClause}
      ) {
        ${BASE_EVENT_FIELDS}
        token
        agreementClass
        agreementId
        liquidatorAccount
        targetAccount
        rewardAmountReceiver
        rewardAmount
        targetAccountBalanceDelta
        version
        liquidationType
        deposit
        flowRateAtLiquidation
      }
    }
  `;

  const data = await querySubgraph<{
    agreementLiquidatedV2Events: AgreementLiquidatedV2Event[];
  }>(network, query);
  return data.agreementLiquidatedV2Events;
}

export async function getNewPICEvents(
  network: string,
  params?: EventsFilter
): Promise<NewPICEvent[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "timestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
    addresses_contains,
    timestamp_gte,
    timestamp_lte,
  } = params ?? {};

  const whereConditions: string[] = [];
  if (addresses_contains?.length)
    whereConditions.push(
      `addresses_contains: [${addresses_contains.map((a) => `"${a.toLowerCase()}"`).join(", ")}]`
    );
  if (timestamp_gte)
    whereConditions.push(`timestamp_gte: "${timestamp_gte}"`);
  if (timestamp_lte)
    whereConditions.push(`timestamp_lte: "${timestamp_lte}"`);

  const whereClause =
    whereConditions.length > 0
      ? `where: { ${whereConditions.join(", ")} },`
      : "";

  const query = `
    query GetNewPICEvents {
      newPICEvents(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        ${whereClause}
      ) {
        ${BASE_EVENT_FIELDS}
        token
        pic
        bond
        exitRate
      }
    }
  `;

  const data = await querySubgraph<{ newPICEvents: NewPICEvent[] }>(
    network,
    query
  );
  return data.newPICEvents;
}

export async function getFlowDistributionUpdatedEvents(
  network: string,
  poolAddress: string,
  params?: PaginationParams
): Promise<FlowDistributionUpdatedEvent[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "timestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
  } = params ?? {};

  const query = `
    query GetFlowDistributionUpdatedEvents {
      flowDistributionUpdatedEvents(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        where: { pool: "${poolAddress.toLowerCase()}" }
      ) {
        ${BASE_EVENT_FIELDS}
        token
        operator
        oldFlowRate
        newDistributorToPoolFlowRate
        newTotalDistributionFlowRate
        adjustmentFlowRecipient
        adjustmentFlowRate
        totalUnits
        pool {
          id
        }
        poolDistributor {
          id
        }
      }
    }
  `;

  const data = await querySubgraph<{
    flowDistributionUpdatedEvents: FlowDistributionUpdatedEvent[];
  }>(network, query);
  return data.flowDistributionUpdatedEvents;
}

export async function getInstantDistributionUpdatedEvents(
  network: string,
  poolAddress: string,
  params?: PaginationParams
): Promise<InstantDistributionUpdatedEvent[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "timestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
  } = params ?? {};

  const query = `
    query GetInstantDistributionUpdatedEvents {
      instantDistributionUpdatedEvents(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        where: { pool: "${poolAddress.toLowerCase()}" }
      ) {
        ${BASE_EVENT_FIELDS}
        token
        operator
        requestedAmount
        actualAmount
        totalUnits
        pool {
          id
        }
        poolDistributor {
          id
        }
      }
    }
  `;

  const data = await querySubgraph<{
    instantDistributionUpdatedEvents: InstantDistributionUpdatedEvent[];
  }>(network, query);
  return data.instantDistributionUpdatedEvents;
}

export async function getMemberUnitsUpdatedEvents(
  network: string,
  poolMemberId: string,
  params?: PaginationParams
): Promise<MemberUnitsUpdatedEvent[]> {
  const {
    first = DEFAULT_PAGINATION.first,
    skip = DEFAULT_PAGINATION.skip,
    orderBy = "timestamp",
    orderDirection = DEFAULT_PAGINATION.orderDirection,
  } = params ?? {};

  const query = `
    query GetMemberUnitsUpdatedEvents {
      memberUnitsUpdatedEvents(
        first: ${first},
        skip: ${skip},
        orderBy: ${orderBy},
        orderDirection: ${orderDirection},
        where: { poolMember: "${poolMemberId}" }
      ) {
        ${BASE_EVENT_FIELDS}
        token
        oldUnits
        units
        totalUnits
        pool {
          id
        }
        poolMember {
          id
        }
      }
    }
  `;

  const data = await querySubgraph<{
    memberUnitsUpdatedEvents: MemberUnitsUpdatedEvent[];
  }>(network, query);
  return data.memberUnitsUpdatedEvents;
}
