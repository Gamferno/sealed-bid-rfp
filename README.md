# Sealed-Bid Procurement / RFP System

![CI](https://github.com/midnight-ntwrk/sealed-bid-rfp/actions/workflows/ci.yml/badge.svg)

> A privacy-preserving procurement platform where vendors submit sealed bids on an RFP, the lowest bid wins on-chain, and every losing bid stays permanently private — while anyone can verify the winner was chosen fairly. Built on the [Midnight Network](https://midnight.network).

---

## What This Does

1. **Buyer** posts an RFP: description, allowed bid range, and two phase deadlines (commit and reveal).
2. **Vendors** each select a private bid `b` and generate a cryptographic random salt `s`. They compute `commitment = persistentHash(b, s)` and submit the commitment hash on-chain. The actual bid stays strictly on their machine.
3. After the commit deadline, vendors reveal: the ZK circuit proves `persistentHash(b, s) == commitment` and `min_bid <= b <= max_bid` without disclosing `b` in any public output or transaction logs.
4. Once reveals complete, `determine_winner()` is called. The ZK circuit computes the lowest bid across all participants in zero knowledge and emits **only** the winner's slot index.
5. Anyone can call `verify_fairness()` to confirm the winner was chosen strictly and cryptographically according to the lowest bid rule.

---

## Privacy Model

### What an observer CAN learn:
- That an RFP exists, its public procurement brief, and deadline constraints.
- Which vendor slots participated (their commitment hashes).
- Who won (winning vendor slot index).
- That the winner's bid was **cryptographically proven** to be the lowest.
- That no reveal was accepted after the deadline, and no double-commitment occurred.

### What an observer CANNOT learn:
- The winning bid amount.
- Any losing bid amount.
- Any vendor's bid relative to another (beyond who won).
- The secret salt values used for commitment hashing.

---

## Architecture

```
contracts/
  sealed-bid.compact        — Compact smart contract (4 circuits: commit_bid, reveal_bid, determine_winner, verify_fairness)
  src/witnesses.ts          — Private witness providers (getBid, getSalt)
  src/index.ts              — Compiled contract exports & types
  test/
    sealed-bid.test.ts      — 9-scenario Vitest integration test suite

ui/
  src/
    App.tsx                 — Main application with 4-tab workflow
    contractService.ts      — Contract interaction service & ZK circuit executor
    hooks/
      useWallet.ts          — Wallet detection & DApp connector (1AM, Lace)
      useRFP.ts             — Real-time on-chain RFP state hook
    components/
      StatusBanner.tsx      — Lifecycle phase & countdown banner
      CreateRFP.tsx         — Buyer: deploy & initialize RFP round
      SubmitBid.tsx         — Vendor: sealed bid commitment submission
      RevealBid.tsx         — Vendor: ZK reveal & validity proof
      Results.tsx           — Winner announcement & fairness verification view

.github/workflows/ci.yml    — CI pipeline (install → build → test)
PROPOSAL.md                 — Product proposal, data model & Mainnet feasibility
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contract | Compact 0.23, Midnight Network |
| ZK proof system | Built into Midnight runtime (Binius / Plonk proof engine) |
| Frontend | React 19 + TypeScript + Vite |
| Wallet | 1AM or Lace (Midnight DApp Connector API) |
| Testing | Vitest (9 integration tests) |
| CI/CD | GitHub Actions |

---

## Prerequisites

- Node.js ≥ 22
- [Midnight Compact compiler](https://docs.midnight.network/develop/tutorial/building/step1) (`compact`)
- [Lace wallet](https://www.lace.io/) or [1AM wallet](https://chromewebstore.google.com/detail/1am/bphnkdkcnfhompoegfpgnkidcjfbojjp) (browser extension) connected to Midnight Preprod

---

## Setup & Run Locally

```bash
# Clone
git clone https://github.com/midnight-ntwrk/sealed-bid-rfp.git
cd sealed-bid-rfp

# Install dependencies
npm install

# Compile the Compact contract
npm run compile

# Build contracts and UI
npm run build

# Start the frontend dev server
cd ui && npm run dev
```

---

## Run Tests

```bash
npm test
```

The test suite runs 9 automated tests verifying:
1. Deterministic and collision-resistant commitment hashing
2. Contract state transitions & initialization
3. Witness isolation from public ledger
4. End-to-end flow: 3 vendors commit → reveal → lowest bidder wins → fairness verified
5. Rejection of invalid reveal with tampered bid/salt
6. Rejection of late reveals after reveal deadline
7. Rejection of out-of-range bids
8. Prevention of double-commitments
9. Total absence of raw bid leakage in public ledger structures

---

## Product Proposal

See [PROPOSAL.md](./PROPOSAL.md) for the complete product brief, selective disclosure architecture, data model, and Mainnet feasibility assessment.

