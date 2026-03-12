# PRD: Superfluid Explorer v2

## 1. Overview

A read-only block explorer for the Superfluid Protocol, targeting developers who build on and debug Superfluid integrations. The explorer surfaces CFA (streams), GDA (pools), Super Tokens, accounts, liquidations, TOGA state, and Super App discovery across all Superfluid-supported networks. It replaces the existing Next.js-based explorer with a modern TanStack Start application.

The explorer is **view-only** — no wallet connection, no transaction execution.

### 1.1 Design Philosophy

Minimal UI. Default shadcn styling. No custom branding work beyond a logo and green accent. The app should feel like a well-made developer tool — dense with information, fast, keyboard-friendly. Every table view's filter/sort/pagination state must be reflected in the URL so users can share and bookmark specific views.

### 1.2 Non-Goals

- Wallet connection or transaction execution
- IDA (Instant Distribution Agreement) — legacy, superseded by GDA
- Subgraph GraphQL IDE — developers can use the subgraph endpoints directly
- Flow scheduling or vesting schedule visibility
- Notification or alerting system
- Mobile-optimized experience
- Address book (client-side storage feature)

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start (file-based routing, loaders, server functions) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui (Base UI primitives, not Radix) |
| Data fetching | TanStack React Query (via wagmi integration + direct subgraph queries) |
| Blockchain | wagmi v2 + viem |
| Superfluid SDK | `@sfpro/sdk` (ABIs, typed addresses) |
| Superfluid metadata | `@superfluid-finance/metadata` (network resolution) |
| Superfluid token list | `@superfluid-finance/tokenlist` (token metadata, logos) |
| Subgraph client | Plain `fetch` with typed GraphQL queries (no heavy GraphQL client) |
| URL state | TanStack Router search params (validated with Zod) |

### 2.1 Data Sources

All data comes from three sources. No proprietary backend is needed.

**Superfluid Subgraph** (primary) — historical and aggregate data for all protocol entities. Endpoint pattern: `https://subgraph-endpoints.superfluid.dev/{network-name}/protocol-v1`. Use for: listing entities, searching, event history, aggregate statistics, stream periods.

**RPC via wagmi/viem** (supplementary) — live on-chain reads for data that changes between subgraph indexing. Use `@sfpro/sdk` ABIs and addresses. Use for: real-time balances (`realtimeBalanceOf`), total supply, minimum deposit, protocol version, pool adjustment flow rates.

**Superfluid API Services** (supplementary):
- **Whois** (`https://whois.superfluid.finance/api`) — name resolution (ENS, Farcaster, AlfaFrens, Lens, TOREX). Note: `resolve` takes an address, `reverse-resolve` takes a name (naming is inverted from intuition).
- **Token Prices** (`https://token-prices-api.superfluid.dev/v1/{network}/{token}`) — CoinGecko-backed Super Token prices.
- **TOGA** (`https://toga.superfluid.finance`) — reference for liquidation/TOGA data, but primary data comes from subgraph events.

### 2.2 Subgraph Query Patterns

Use plain `fetch` POST requests to the subgraph endpoint with typed query strings. Define query types manually to match the GraphQL schema. Keep queries co-located with the route or component that uses them.

Pagination: The subgraph uses `first` / `skip` / `orderBy` / `orderDirection`. Max `first` is 1000. For cursor-based pagination, use `where: { id_gt: $lastId }` with `orderBy: id`.

Nested entity filters use trailing underscore syntax: `streams(where: { sender: $address })`.

Important: subgraph data is only as fresh as the last indexed block. For real-time balances, always compute: `balance = balanceUntilUpdatedAt + (now - updatedAtTimestamp) * totalNetFlowRate`.

---

## 3. Supported Networks

Networks should be loaded from `@superfluid-finance/metadata` at build time or from a static config. The following networks must be supported:

### Mainnets
- Ethereum (1)
- Base (8453) — **default network**
- Polygon (137)
- Optimism (10)
- Arbitrum One (42161)
- Gnosis Chain (100)
- Avalanche C-Chain (43114)
- BNB Smart Chain (56)
- Celo (42220)
- Degen Chain (666666666)
- Scroll (534352)

### Testnets
- Sepolia (11155111)
- Optimism Sepolia (11155420)
- Base Sepolia (84532)
- Scroll Sepolia (534351)
- Avalanche Fuji (43113)

Testnets should be hideable via a toggle in settings. All networks support GDA. Each network needs: chain ID, display name, slug (for URLs), subgraph URL, RPC URL, and block explorer base URL.

---

## 4. Routing and URL Structure

All routes are network-scoped. The network slug is the first path segment.

```
/                                           → redirect to /base-mainnet
/:network                                   → network home (latest streams)
/:network/accounts/:address                 → account detail
/:network/streams/:id                       → stream detail
/:network/supertokens                       → super token listing
/:network/supertokens/:address              → super token detail
/:network/pools/:address                    → GDA pool detail
/:network/pools/:address/members/:address   → pool member detail
/:network/protocol                          → protocol contracts and governance
/:network/liquidations                      → liquidation monitor
/:network/super-apps                        → Super App directory
/settings                                   → user preferences
```

### 4.1 URL State Bidirectionality

Every table/list view must serialize its state to URL search params and restore from them. This includes:

- **Pagination:** `?page=2&pageSize=25`
- **Sorting:** `?sort=createdAt&dir=desc`
- **Filters:** `?sender=0x...&status=active&token=0x...`
- **Tab selection:** `?tab=streams`

Use TanStack Router's `searchParams` validation (Zod schemas) to parse and validate URL state. Invalid params should fall back to defaults, never error.

Example URL: `/:network/accounts/:address?tab=streams&sort=flowRate&dir=desc&status=active`

---

## 5. Pages and Features

### 5.1 Network Home (`/:network`)

A landing page for each network showing recent activity.

**Content:**
- Network name and chain ID in the header
- "Latest Streams" table: the 25 most recent streams, showing sender, receiver, token, flow rate, total streamed (real-time flowing), created time (relative)
- Basic network statistics summary: total active streams, total active pools, number of listed Super Tokens

**Data sources:** Subgraph `streams` query ordered by `createdAtTimestamp` desc. Subgraph `tokenStatistics` for aggregate stats.

### 5.2 Account Page (`/:network/accounts/:address`)

The central entity page. Shows everything about an address's Superfluid activity.

**Header:**
- Address (checksummed, copyable)
- Resolved name from Whois API (ENS, Farcaster, etc.) with avatar if available
- Super App badge if `isSuperApp === true`
- Link to block explorer
- Network switcher dropdown (same address, different networks)

**Tab: Tokens** (default)
Table of all Super Tokens this account interacts with, sourced from `accountTokenSnapshots`:

| Column | Source |
|---|---|
| Token (symbol + logo) | tokenlist enrichment |
| Real-time balance | Computed: `balanceUntilUpdatedAt + (now - updatedAtTimestamp) * totalNetFlowRate` |
| Net flow rate | `totalNetFlowRate`, displayed in user's selected granularity |
| Active streams (in/out) | `activeIncomingStreamCount` / `activeOutgoingStreamCount` |
| Total deposit | `totalDeposit` |
| Liquidation estimate | `maybeCriticalAtTimestamp` (show as relative time if in the future) |

Filterable by: token symbol. Sortable by: balance, flow rate, stream count.

**Tab: Streams**
Two sub-sections: Incoming and Outgoing.

*Incoming Streams table:*

| Column | Source |
|---|---|
| Sender | `stream.sender` (resolved name if available) |
| Token | `stream.token` |
| Flow rate | `stream.currentFlowRate` |
| Total streamed | Real-time computed from `streamedUntilUpdatedAt` |
| Started | `stream.createdAtTimestamp` |
| Status | Active if `currentFlowRate > 0`, otherwise Closed |

*Outgoing Streams table:* Same columns, receiver instead of sender.

Both filterable by: counterparty address, token, status (active/closed). Sortable by: flow rate, created time, total streamed.

**Tab: Pools (GDA)**
Three sub-sections:

*Administered Pools:*

| Column | Source |
|---|---|
| Pool address | `pool.id` |
| Token | `pool.token` |
| Total members | `pool.totalMembers` |
| Flow rate | `pool.flowRate` |
| Total distributed | Real-time computed |
| Created | `pool.createdAtTimestamp` |

*Pool Memberships:*

| Column | Source |
|---|---|
| Pool address | `poolMember.pool` |
| Token | via pool |
| Units | `poolMember.units` |
| % share | `units / pool.totalUnits * 100` |
| Connected | `poolMember.isConnected` |
| Amount received | `poolMember.totalAmountReceivedUntilUpdatedAt` |

*Pool Distributions (as distributor):*

| Column | Source |
|---|---|
| Pool | `poolDistributor.pool` |
| Token | via pool |
| Flow rate | `poolDistributor.flowRate` |
| Total distributed | `poolDistributor.totalAmountDistributedUntilUpdatedAt` |
| Buffer | `poolDistributor.totalBuffer` |

**Tab: Events**
Paginated event log showing all events where this account's address appears in the `addresses` array.

| Column | Source |
|---|---|
| Block | `event.blockNumber` |
| Tx hash | `event.transactionHash` (linked to block explorer) |
| Event name | `event.name` |
| Time | `event.timestamp` (relative) |

Filterable by: event name (dropdown of known event types), tx hash (text input). Sortable by: timestamp (default desc), block number.

### 5.3 Stream Detail (`/:network/streams/:id`)

Detail view for a single CFA stream.

**Header info:**
- Stream ID (copyable)
- Token (symbol, logo, link to token page)
- Sender → Receiver (with resolved names, links to account pages)
- Status badge: Active or Closed
- Current flow rate (in user's selected granularity)
- Total amount streamed (real-time flowing if active)
- Deposit amount
- Created at, Last updated at
- Link to block explorer (tx of creation)

**Stream Periods table:**
Historical log of every flow rate change for this stream.

| Column | Source |
|---|---|
| Flow rate | `streamPeriod.flowRate` |
| Deposit | `streamPeriod.deposit` |
| Started | `streamPeriod.startedAtTimestamp` |
| Stopped | `streamPeriod.stoppedAtTimestamp` (null if current) |
| Duration | Computed |
| Amount streamed | `streamPeriod.totalAmountStreamed` |

Sortable by: start time. Paginated.

### 5.4 Super Token Listing (`/:network/supertokens`)

Searchable table of all Super Tokens on the network.

| Column | Source |
|---|---|
| Token (logo, symbol, name) | Token entity + tokenlist enrichment |
| Listed | `token.isListed` |
| Address | `token.id` |
| Type | Pure / Wrapper / Native Asset (derived from `underlyingAddress` and `isNativeAssetSuperToken`) |
| Active streams | `tokenStatistic.totalNumberOfActiveStreams` |
| Total flow rate | `tokenStatistic.totalOutflowRate` |
| Active pools | `tokenStatistic.totalNumberOfActivePools` |
| Holders | `tokenStatistic.totalNumberOfHolders` |

Filterable by: name/symbol (text search), listed status, token type. Sortable by: all numeric columns. Default sort: listed tokens first, then by active streams desc.

### 5.5 Super Token Detail (`/:network/supertokens/:address`)

**Header:**
- Token name, symbol, logo (from tokenlist)
- Listed/Unlisted badge
- Token type (Pure / Wrapper / Native Asset)
- Token address (copyable, linked to block explorer)
- Underlying token address (if wrapper, linked to block explorer)
- Price (from Token Prices API, if available)

**Statistics grid** (card layout):

| Stat | Source |
|---|---|
| Total supply | RPC: `totalSupply()` |
| Holders | `tokenStatistic.totalNumberOfHolders` |
| Active CFA streams | `tokenStatistic.totalCFANumberOfActiveStreams` |
| Closed CFA streams | `tokenStatistic.totalCFANumberOfClosedStreams` |
| CFA flow rate | `tokenStatistic.totalCFAOutflowRate` |
| Total CFA streamed | Real-time computed from `totalCFAAmountStreamedUntilUpdatedAt` |
| Active GDA pools | `tokenStatistic.totalNumberOfActivePools` |
| GDA flow rate | `tokenStatistic.totalGDAOutflowRate` |
| Total distributed | `tokenStatistic.totalAmountDistributedUntilUpdatedAt` |
| Total deposit locked | `tokenStatistic.totalDeposit` |
| Minimum deposit | RPC: via governance config |

**Tab: Streams**
Table of all streams for this token. Same columns as account streams table but showing both sender and receiver.

**Tab: Pools**
Table of all GDA pools for this token.

| Column | Source |
|---|---|
| Pool address | `pool.id` |
| Admin | `pool.admin` |
| Total members | `pool.totalMembers` |
| Flow rate | `pool.flowRate` |
| Total units | `pool.totalUnits` |
| Total distributed | Real-time computed |

**Tab: Events**
Events filtered to this token address.

### 5.6 Pool Detail (`/:network/pools/:address`)

**Header:**
- Pool address (copyable, linked to block explorer)
- Token (symbol, logo, link to token page)
- Admin address (link to account page, resolved name)
- Status: Active (has flow rate or recent distributions) / Inactive

**Statistics grid:**

| Stat | Source |
|---|---|
| Total units | `pool.totalUnits` |
| Connected units | `pool.totalConnectedUnits` |
| Disconnected units | `pool.totalDisconnectedUnits` |
| Total members | `pool.totalMembers` |
| Connected members | `pool.totalConnectedMembers` |
| Flow rate | `pool.flowRate` |
| Per-unit flow rate | `pool.perUnitFlowRate` |
| Adjustment flow rate | RPC: `adjustmentFlowRate()` from pool contract |
| Total distributed | Real-time computed from `totalAmountDistributedUntilUpdatedAt` |
| Total buffer | `pool.totalBuffer` |

**Section: Members**
Paginated data grid of all pool members.

| Column | Source |
|---|---|
| Member address | `poolMember.account` (resolved name) |
| Units | `poolMember.units` |
| % share | Computed: `units / totalUnits * 100` |
| Connected | `poolMember.isConnected` |
| Amount received | Computed from member snapshot |

Sortable by: units, connected status. Filterable by: address, connected status.

**Section: Distribution Events**
Two sub-tables:

*Flow Distributions:* `FlowDistributionUpdatedEvent` — shows distributor, old flow rate, new flow rate, adjustment flow rate, timestamp.

*Instant Distributions:* `InstantDistributionUpdatedEvent` — shows distributor, requested amount, actual amount, timestamp.

### 5.7 Pool Member Detail (`/:network/pools/:poolAddress/members/:memberAddress`)

**Header:**
- Member address (link to account page, resolved name)
- Pool address (link to pool page)
- Token
- Units held and percentage of total pool units
- Connected status
- Total amount received (real-time computed)

**Events table:** `MemberUnitsUpdatedEvent` entries for this member — showing old units, new units, timestamp.

### 5.8 Protocol Page (`/:network/protocol`)

Developer reference page showing governance parameters and deployed contract addresses.

**Governance Parameters section:**

| Parameter | Source | Notes |
|---|---|---|
| Liquidation period | Subgraph `TokenGovernanceConfig` (default, `id = 0x0`) | The buffer = liquidation period × flow rate |
| Patrician period | Subgraph `TokenGovernanceConfig` | Window where patrician gets full reward |
| Minimum deposit | Subgraph `TokenGovernanceConfig` | Floor for buffer amount |
| Reward address | Subgraph `TokenGovernanceConfig` | Typically the TOGA contract |

**Contract Addresses section:**
Table of all deployed contracts for this network. Each row: contract name, address (copyable, linked to block explorer). Source: `@superfluid-finance/metadata`.

Contracts to list:
- Host (Superfluid)
- CFAv1
- CFAv1Forwarder
- GDAv1
- GDAv1Forwarder
- SuperTokenFactory
- Resolver
- TOGA
- BatchLiquidator
- MacroForwarder

**Protocol Version:** fetched via RPC from the Host contract. Displayed as `vX.Y.Z-gitHash`.

### 5.9 Liquidation Monitor (`/:network/liquidations`)

A new page focused on liquidation visibility.

**At-Risk Streams section:**
Streams where the sender's `maybeCriticalAtTimestamp` is within a configurable future window (default: 24 hours). Query `accountTokenSnapshots` where `maybeCriticalAtTimestamp` is not null and is less than `now + window`, join with the account's outgoing streams.

| Column | Source |
|---|---|
| Sender | Account address |
| Token | Token |
| Balance | Real-time computed |
| Net flow rate | `totalNetFlowRate` |
| Critical at | `maybeCriticalAtTimestamp` (relative countdown) |
| Active streams | Count of outgoing streams |

Filterable by: token, time window (1h, 6h, 24h, 7d). Sortable by: critical time (ascending = most urgent first).

**Recent Liquidations section:**
Query `AgreementLiquidatedV2Event` events, ordered by timestamp descending.

| Column | Source |
|---|---|
| Time | `event.timestamp` |
| Token | From event |
| Liquidated account | From event `addresses` |
| Liquidator | From event |
| Reward amount | From event |
| Tx hash | Linked to block explorer |

Paginated, sortable by time.

**TOGA State section:**
For each listed Super Token on the network, show the current PIC (Patrician In Charge) and their bond. This requires querying `NewPICEvent` to find the most recent PIC per token, and the TOGA contract for bond amounts.

| Column | Source |
|---|---|
| Token | Token symbol |
| Current PIC | Most recent `NewPICEvent.pic` |
| Bond amount | From `NewPICEvent` or TOGA contract |
| PIC since | `NewPICEvent.timestamp` |
| Exit rate | From TOGA contract |

### 5.10 Super App Directory (`/:network/super-apps`)

A new page that makes it easy to find and browse Super Apps on each network.

**Content:**
Query all accounts where `isSuperApp === true`.

| Column | Source |
|---|---|
| Address | `account.id` (resolved name if available) |
| Active inflows | Count from `accountTokenSnapshots` |
| Active outflows | Count from `accountTokenSnapshots` |
| Tokens interacted | Count of `accountTokenSnapshots` |
| First seen | `account.createdAtTimestamp` |
| Last active | `account.updatedAtTimestamp` |

Sortable by: all columns. Filterable by: address, activity status (active streams vs. dormant).

Clicking an address goes to the standard account page, which already shows all the Super App's streams, pools, and events.

### 5.11 Settings (`/settings`)

Persisted in `localStorage`.

**Preferences:**
- **Theme:** Light / System / Dark — use shadcn's built-in theme switching
- **Stream granularity:** per second, minute, hour, day, week, month — affects how flow rates are displayed everywhere
- **Decimal places:** Smart (auto-detect significant digits), 5, 9, 18
- **Testnet visibility:** Toggle to show/hide all testnets, or per-testnet toggles

---

## 6. Global Features

### 6.1 Search

Accessible from every page via a search bar in the header (or keyboard shortcut `Cmd+K` / `Ctrl+K`). Opens a command-palette-style dialog.

**Search inputs and behavior:**

1. **Ethereum address input** (detected by `0x` prefix + 40 hex chars or valid checksum):
   - Query subgraph across all visible networks for: tokens matching this address, tokens with this underlying address, accounts, pools
   - Query Whois API for name resolution

2. **Name input** (ENS `.eth`, Farcaster, etc.):
   - Query Whois reverse-resolve API to get address
   - Then search as address

3. **Token symbol input** (3+ characters, not an address):
   - Query subgraph for tokens where symbol contains the search term (case-insensitive)
   - Search across all visible networks

**Results display:**
- Grouped by network (tabs or sections)
- Each result shows: entity type (Account / Token / Pool), address, resolved name, network badge
- Tokens show logo from tokenlist
- Clicking a result navigates to the entity's detail page on the appropriate network

Results are debounced (250ms).

### 6.2 Real-Time Flowing Balances

Balances involved in active streams must animate in real-time. The calculation:

```
currentBalance = snapshotBalance + (Date.now()/1000 - snapshotTimestamp) * flowRate
```

Use `requestAnimationFrame` for smooth updates. Update the displayed value every ~100ms. Respect the user's decimal places setting.

This applies everywhere a balance is shown alongside an active flow rate: account token balances, stream totals, pool distributions, token statistics.

### 6.3 Address Display

Addresses should be displayed as truncated (`0x1234...5678`) with full address on hover/tooltip. If a resolved name exists (from Whois), show the name with the truncated address in secondary text.

Copy-to-clipboard on click for all addresses.

### 6.4 Network Switching

Every page that is network-scoped should have a network selector in the header or sidebar. Changing network navigates to the same page type on the new network:
- `/:network/supertokens` → `/:newNetwork/supertokens`
- `/:network/accounts/:address` → `/:newNetwork/accounts/:address` (same address, different network)

### 6.5 External Links

Every entity that has a presence on the block explorer should link out to it:
- Addresses → `{blockExplorerUrl}/address/{address}`
- Transaction hashes → `{blockExplorerUrl}/tx/{hash}`

### 6.6 Flow Rate Display

Flow rates are stored as wei/second in the subgraph. Display them converted to the user's selected granularity:

| Granularity | Multiplier |
|---|---|
| /second | 1 |
| /minute | 60 |
| /hour | 3,600 |
| /day | 86,400 |
| /week | 604,800 |
| /month | 2,592,000 (30 days) |

Always show the granularity unit label. Example: "1.5 DAIx/day".

---

## 7. Data Architecture

### 7.1 Subgraph Query Layer

Create a thin query layer that:
1. Accepts a network slug and returns the subgraph endpoint URL
2. Provides typed query functions that accept GraphQL variables and return typed results
3. Integrates with TanStack Query for caching, refetching, and pagination
4. Handles pagination via `first`/`skip` parameters with configurable page sizes

Query keys should include: `['subgraph', networkSlug, entityType, variables]` for proper cache invalidation.

### 7.2 RPC Query Layer

Use wagmi's `useReadContract` and `useReadContracts` hooks with ABIs from `@sfpro/sdk`. Configure wagmi with all supported chains and their RPC endpoints.

Key RPC reads:
- `SuperToken.realtimeBalanceOfNow(account)` — accurate real-time balance
- `SuperToken.totalSupply()` — current total supply
- `Host.NON_UPGRADABLE_DEPLOYMENT()` — protocol version
- `SuperfluidPool.getDisconnectedBalance(member)` — unclaimed pool balance
- Governance parameters via `TokenGovernanceConfig`

### 7.3 Token Metadata

Load the Superfluid token list (`@superfluid-finance/tokenlist`) at startup. Use it to enrich token data from the subgraph with: logos, canonical names, symbols. Cache in memory.

### 7.4 Name Resolution

Cache Whois API responses in TanStack Query with a long stale time (5 minutes). Batch resolution requests where possible. Gracefully handle failures (just show the address).

---

## 8. Component Patterns

### 8.1 Data Tables

All tables should use a consistent pattern:
- shadcn `Table` component with Base UI primitives
- Column header clicks for sorting (with visual indicator)
- Filter popovers per column where applicable
- Pagination bar at bottom with page size selector (10, 25, 50, 100)
- Loading skeleton rows during fetch
- Empty state when no results match filters
- All table state (sort, filter, page) reflected in URL search params

### 8.2 Entity Cards

Statistics and summary data use a grid of cards:
- shadcn `Card` component
- Label + value layout
- Flowing values use the real-time animation component
- Tooltip on hover for additional context (e.g., raw wei value)

### 8.3 Address Component

A reusable component that:
- Displays truncated address
- Shows resolved name (if available) as primary text with address as secondary
- Copy button
- Link to account page (internal) and block explorer (external)
- Avatar from Whois API (if available)

### 8.4 Token Component

A reusable component that:
- Shows token logo (from tokenlist) + symbol
- Links to token detail page
- Tooltip with full token name and address

### 8.5 Flowing Balance Component

A reusable component that:
- Accepts: `balance` (BigInt), `timestamp` (number), `flowRate` (BigInt)
- Animates the balance in real-time using `requestAnimationFrame`
- Formats according to user's decimal places setting
- Shows token symbol alongside if provided
- Handles negative flow rates (balance decreasing)
- Stops animation when `flowRate === 0`

---

## 9. Implementation Phases

### Phase 1: Foundation
- TanStack Start project setup with file-based routing
- shadcn/ui initialization with Base UI
- wagmi v2 configuration with all supported chains
- Network config module (slugs, chain IDs, subgraph URLs, block explorer URLs)
- Subgraph query layer with TanStack Query integration
- URL search param state management pattern (Zod schemas)
- Core reusable components: Address, Token, FlowingBalance, DataTable
- Settings page with localStorage persistence
- Global search (command palette)
- Layout: header with network selector, search bar, nav links

### Phase 2: Core Entity Pages
- Network home page (latest streams)
- Account page (all tabs: tokens, streams, pools, events)
- Stream detail page (with stream periods)
- Super Token listing page
- Super Token detail page (all tabs)

### Phase 3: GDA Pool Pages
- Pool detail page (members, distribution events)
- Pool member detail page

### Phase 4: Protocol and Discovery
- Protocol page (governance params, contract addresses)
- Super App directory page
- Liquidation monitor page (at-risk streams, recent liquidations, TOGA state)

---

## 10. Subgraph and Contract Queries

The implementing agent has access to the **Superfluid Skill** which contains comprehensive documentation for:
- All subgraph entity schemas (protocol-v1), query patterns, and pagination conventions
- All contract ABIs via `@sfpro/sdk` with typed addresses per chain
- API service endpoints (Whois, Token Prices, etc.)

Refer to the Superfluid Skill rather than hardcoding queries. The key subgraph entities to query are: `Stream`, `Account`, `AccountTokenSnapshot`, `Token`, `TokenStatistic`, `Pool`, `PoolMember`, `PoolDistributor`, `StreamPeriod`, `FlowDistributionUpdatedEvent`, `InstantDistributionUpdatedEvent`, `AgreementLiquidatedV2Event`, `NewPICEvent`, and the generic `Event` interface.

The subgraph endpoint pattern is: `https://subgraph-endpoints.superfluid.dev/{network-name}/protocol-v1`

Pagination uses `first` / `skip` / `orderBy` / `orderDirection`. Max `first` is 1000.

---

## 11. Important Protocol Notes for the Implementer

These are non-obvious behaviors that affect how data should be displayed:

1. **Super Token decimals are always 18.** All amounts in the subgraph and from RPC are in 18-decimal precision, regardless of the underlying token's decimals.

2. **Real-time balance calculation:** `balance = balanceUntilUpdatedAt + (now_seconds - updatedAtTimestamp) * totalNetFlowRate`. This must be done client-side for accurate display. The subgraph snapshot is only accurate at `updatedAtTimestamp`.

3. **GDA pool rounding:** When `distributeFlow` is called, `perUnitFlowRate = requestedFlowRate / totalUnits` (integer division, rounds down). The remainder goes to the pool admin as the `adjustmentFlowRate`. If `requestedFlowRate < totalUnits`, per-unit rate truncates to 0 and the entire flow goes to admin.

4. **Pool connection limit:** An account can be a member of unlimited pools but can only **connect** to 256 pools per token. Unconnected members must manually claim.

5. **`maybeCriticalAtTimestamp`** is an optimistic estimate — it assumes no incoming IDA/GDA distributions. If `isLiquidationEstimateOptimistic` is true, the account has subscriptions/memberships that might extend the actual critical time.

6. **Token types:** Determine from subgraph fields:
   - `isNativeAssetSuperToken === true` → Native Asset (ETH/MATIC wrapper)
   - `underlyingAddress !== 0x0000...0000` → Wrapper Super Token
   - Otherwise → Pure Super Token

7. **Stream ID format:** `senderAddress-receiverAddress-tokenAddress-revisionIndex`. A new stream between the same pair creates a new revision.

8. **Flow rate sign convention:** Flow rates in the subgraph are always positive. The direction is determined by the entity relationship (sender vs. receiver, inflow vs. outflow). `totalNetFlowRate` can be negative (more outflow than inflow).
