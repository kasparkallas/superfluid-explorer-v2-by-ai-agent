// Base types
export interface SubgraphEntity {
  id: string;
  createdAtTimestamp: string;
  createdAtBlockNumber: string;
  updatedAtTimestamp: string;
  updatedAtBlockNumber: string;
}

export interface Token {
  id: string;
  createdAtTimestamp: string;
  createdAtBlockNumber: string;
  decimals: number;
  name: string;
  symbol: string;
  isSuperToken: boolean;
  isNativeAssetSuperToken: boolean;
  isListed: boolean;
  underlyingAddress: string;
  underlyingToken?: Token | null;
  governanceConfig?: TokenGovernanceConfig | null;
}

export interface Account extends SubgraphEntity {
  isSuperApp: boolean;
}

export interface Stream extends SubgraphEntity {
  currentFlowRate: string;
  deposit: string;
  streamedUntilUpdatedAt: string;
  token: Token;
  sender: Account;
  receiver: Account;
  userData: string;
}

export interface StreamPeriod {
  id: string;
  stream: { id: string };
  sender: Account;
  receiver: Account;
  token: Token;
  flowRate: string;
  deposit: string;
  startedAtTimestamp: string;
  startedAtBlockNumber: string;
  stoppedAtTimestamp: string | null;
  stoppedAtBlockNumber: string | null;
  totalAmountStreamed: string | null;
}

export interface Pool extends SubgraphEntity {
  totalUnits: string;
  totalConnectedUnits: string;
  totalDisconnectedUnits: string;
  totalAmountDistributedUntilUpdatedAt: string;
  totalAmountInstantlyDistributedUntilUpdatedAt: string;
  totalAmountFlowedDistributedUntilUpdatedAt: string;
  perUnitSettledValue: string;
  perUnitFlowRate: string;
  totalMembers: number;
  totalConnectedMembers: number;
  totalDisconnectedMembers: number;
  adjustmentFlowRate: string;
  flowRate: string;
  totalBuffer: string;
  token: Token;
  admin: Account;
}

export interface PoolMember extends SubgraphEntity {
  units: string;
  isConnected: boolean;
  totalAmountClaimed: string;
  totalAmountReceivedUntilUpdatedAt: string;
  poolTotalAmountDistributedUntilUpdatedAt: string;
  syncedPerUnitSettledValue: string;
  syncedPerUnitFlowRate: string;
  account: Account;
  pool: Pool;
}

export interface PoolDistributor extends SubgraphEntity {
  totalAmountInstantlyDistributedUntilUpdatedAt: string;
  totalAmountFlowedDistributedUntilUpdatedAt: string;
  totalAmountDistributedUntilUpdatedAt: string;
  totalBuffer: string;
  flowRate: string;
  account: Account;
  pool: Pool;
}

export interface AccountTokenSnapshot extends SubgraphEntity {
  isLiquidationEstimateOptimistic: boolean;
  maybeCriticalAtTimestamp: string | null;
  totalNumberOfActiveStreams: number;
  totalCFANumberOfActiveStreams: number;
  totalGDANumberOfActiveStreams: number;
  activeOutgoingStreamCount: number;
  activeCFAOutgoingStreamCount: number;
  activeGDAOutgoingStreamCount: number;
  activeIncomingStreamCount: number;
  totalNumberOfClosedStreams: number;
  inactiveOutgoingStreamCount: number;
  inactiveIncomingStreamCount: number;
  totalMembershipsWithUnits: number;
  totalConnectedMemberships: number;
  adminOfPoolCount: number;
  balanceUntilUpdatedAt: string;
  totalDeposit: string;
  totalCFADeposit: string;
  totalGDADeposit: string;
  totalNetFlowRate: string;
  totalCFANetFlowRate: string;
  totalInflowRate: string;
  totalOutflowRate: string;
  totalCFAOutflowRate: string;
  totalGDAOutflowRate: string;
  totalAmountStreamedInUntilUpdatedAt: string;
  totalAmountStreamedOutUntilUpdatedAt: string;
  totalAmountStreamedUntilUpdatedAt: string;
  totalAmountTransferredUntilUpdatedAt: string;
  account: Account;
  token: Token;
}

export interface TokenStatistic {
  id: string;
  updatedAtTimestamp: string;
  updatedAtBlockNumber: string;
  totalNumberOfActiveStreams: number;
  totalCFANumberOfActiveStreams: number;
  totalGDANumberOfActiveStreams: number;
  totalNumberOfClosedStreams: number;
  totalCFANumberOfClosedStreams: number;
  totalGDANumberOfClosedStreams: number;
  totalNumberOfPools: number;
  totalNumberOfActivePools: number;
  totalDeposit: string;
  totalCFADeposit: string;
  totalGDADeposit: string;
  totalOutflowRate: string;
  totalCFAOutflowRate: string;
  totalGDAOutflowRate: string;
  totalAmountStreamedUntilUpdatedAt: string;
  totalCFAAmountStreamedUntilUpdatedAt: string;
  totalAmountDistributedUntilUpdatedAt: string;
  totalAmountTransferredUntilUpdatedAt: string;
  totalSupply: string;
  totalNumberOfAccounts: number;
  totalNumberOfHolders: number;
  token: Token;
}

export interface TokenGovernanceConfig {
  id: string;
  createdAtTimestamp: string;
  createdAtBlockNumber: string;
  updatedAtTimestamp: string;
  updatedAtBlockNumber: string;
  isDefault: boolean;
  rewardAddress: string | null;
  liquidationPeriod: string | null;
  patricianPeriod: string | null;
  minimumDeposit: string | null;
  token: Token | null;
}

// Event types
export interface SubgraphEvent {
  id: string;
  blockNumber: string;
  logIndex: string;
  order: string;
  name: string;
  addresses: string[];
  timestamp: string;
  transactionHash: string;
  gasPrice: string;
  gasUsed: string | null;
}

export interface FlowUpdatedEvent extends SubgraphEvent {
  token: string;
  sender: string;
  receiver: string;
  flowOperator: string;
  flowRate: string;
  totalSenderFlowRate: string;
  totalReceiverFlowRate: string;
  deposit: string;
  userData: string;
  oldFlowRate: string;
  type: number;
  totalAmountStreamedUntilTimestamp: string;
  stream: { id: string };
}

export interface AgreementLiquidatedV2Event extends SubgraphEvent {
  token: string;
  agreementClass: string;
  agreementId: string;
  liquidatorAccount: string;
  targetAccount: string;
  rewardAmountReceiver: string;
  rewardAmount: string;
  targetAccountBalanceDelta: string;
  version: string;
  liquidationType: number;
  deposit: string;
  flowRateAtLiquidation: string;
}

export interface NewPICEvent extends SubgraphEvent {
  token: string;
  pic: string;
  bond: string;
  exitRate: string;
}

export interface FlowDistributionUpdatedEvent extends SubgraphEvent {
  token: string;
  operator: string;
  oldFlowRate: string;
  newDistributorToPoolFlowRate: string;
  newTotalDistributionFlowRate: string;
  adjustmentFlowRecipient: string;
  adjustmentFlowRate: string;
  totalUnits: string;
  pool: { id: string };
  poolDistributor: { id: string };
}

export interface InstantDistributionUpdatedEvent extends SubgraphEvent {
  token: string;
  operator: string;
  requestedAmount: string;
  actualAmount: string;
  totalUnits: string;
  pool: { id: string };
  poolDistributor: { id: string };
}

export interface MemberUnitsUpdatedEvent extends SubgraphEvent {
  token: string;
  oldUnits: string;
  units: string;
  totalUnits: string;
  pool: { id: string };
  poolMember: { id: string };
}
