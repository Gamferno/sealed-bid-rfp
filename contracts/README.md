# Sealed-Bid RFP Smart Contract

Privacy-preserving procurement and RFP smart contract for the Midnight Network.

## Overview

The Sealed-Bid RFP contract enables a buyer to publish a Request-for-Proposal with a budget range and deadline phases, vendors to submit cryptographically sealed bids, and an on-chain zero-knowledge circuit to declare the lowest bidder as the winner without disclosing the winning bid or any losing bids.

## Contract at a Glance

- **File**: `sealed-bid.compact` (~200 lines)
- **Language**: `pragma language_version 0.23`
- **Circuits**: 4 (`commit_bid`, `reveal_bid`, `determine_winner`, `verify_fairness`)
- **Pure Functions**: 1 (`computeCommitment`)
- **Witnesses**: 2 (`getBid`, `getSalt`)

## Data Structures

```compact
struct RFP {
  description:     Bytes<128>,        // Public brief description
  commit_deadline: Uint<64>,          // Block timestamp when commit phase ends
  reveal_deadline: Uint<64>,          // Block timestamp when reveal phase ends
  min_bid:         Uint<64>,          // Minimum allowable bid
  max_bid:         Uint<64>           // Maximum budget cap
}

struct VendorCommitment {
  commitment_hash: Bytes<32>,         // Public: persistentHash(bid, salt)
  revealed:        Boolean            // Public flag: true once revealed
}

struct AuctionResult {
  winner_index: Uint<8>,             // 0-based vendor slot (0, 1, 2)
  proof_valid:  Boolean              // True if winner selection was cryptographically proven
}
```

## Ledger State (Public)

```compact
export ledger rfp: RFP;
export ledger commitments: Map<Uint<8>, VendorCommitment>;
export ledger result: AuctionResult;
export ledger reveal_count: Counter;
```

- **`rfp`** — Public procurement brief and deadline constraints.
- **`commitments`** — Map storing vendor commitment hashes and revealed status.
- **`result`** — Winning vendor index and fairness proof validity.
- **`reveal_count`** — Monotonic counter of completed reveals.

## Circuits & Entry Points

### 1. `commit_bid(vendor_index: Uint<8>): []`
Vendors submit `hash(bid, salt)` on-chain before `commit_deadline`. The actual bid amount and salt are provided as private witnesses (`getBid`, `getSalt`) and never disclosed to the public ledger.

### 2. `reveal_bid(vendor_index: Uint<8>): []`
Vendors reveal during the reveal window (`commit_deadline` to `reveal_deadline`). The circuit verifies:
1. `hash(bid, salt) == stored_commitment`
2. `min_bid <= bid <= max_bid`

### 3. `determine_winner(): []`
Executes once all vendors have revealed. Compares bids in zero knowledge using ternary comparisons to find the lowest bid index and emits **only** `winner_index` to the public state.

### 4. `verify_fairness(): Boolean`
A public view returning `result.proof_valid` confirming that the recorded winner was cryptographically verified.

## Compilation

```bash
npm run compact
# or: compact compile sealed-bid.compact managed/sealed-bid
```

Generates TypeScript bindings and ZK artifacts in `managed/sealed-bid/`.

## Testing

```bash
npm test
```

Runs the 9-scenario Vitest integration test suite covering circuit logic, ledger transitions, invalid reveals, out-of-range bids, late reveals, double commits, and zero-knowledge privacy guarantees.

