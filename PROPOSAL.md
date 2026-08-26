# Sealed-Bid Procurement / RFP System — Product Proposal

## What is the product?

A privacy-preserving procurement platform built on the Midnight Network. Buyers post
Request-for-Proposals (RFPs), vendors submit cryptographically sealed bids, and the
smart contract declares the lowest bidder as winner — all without revealing any bid
amounts to competitors or observers.

The commit-reveal mechanism is enforced by ZK circuits: the winning amount is proven
correct without ever being disclosed. Losing bids stay sealed forever.

## Why Midnight?

Traditional blockchain systems are fundamentally transparent, which makes sealed-bid procurement impossible without complex off-chain trusted execution environments (TEEs) or fragile multi-party computation (MPC) networks. On transparent ledgers, submitted bids leak strategic pricing to competitors, creating front-running and last-mover manipulation.

Midnight's dual-state architecture and selective disclosure model are **load-bearing** for this product:

- **Strict Client-Side Privacy**: Bids and randomness salts remain exclusively within the vendor's local wallet environment. Zero plaintext bid data is ever transmitted across the network or committed to ledger storage.
- **ZK Authenticity & Range Validation**: During the reveal phase, ZK circuits mathematically prove that `persistentHash(bid, salt) == commitment` and that `min_bid <= bid <= max_bid` without exposing the numerical bid value.
- **Zero-Knowledge Winner Selection**: The `determine_winner` circuit computes the minimum bid across all revealed vendors in zero knowledge, outputting solely the winning vendor index (`winner_index`).
- **Verifiable Fairness**: The public `verify_fairness()` view allows regulators, buyers, and competing vendors to independently audit and verify that the auction adhered to deterministic rules without exposing commercial trade secrets.

This satisfies Midnight's core thesis: **prove what matters, keep commercial secrets private**.

## Data Model

| Field                | Type            | Visibility  | Purpose                              |
|----------------------|-----------------|-------------|--------------------------------------|
| `rfp.description`    | Bytes<128>      | Public      | Human-readable procurement brief     |
| `rfp.commit_deadline`| Uint<64>        | Public      | Block timestamp — commit phase closes|
| `rfp.reveal_deadline`| Uint<64>        | Public      | Block timestamp — reveal phase closes|
| `rfp.min_bid`        | Uint<64>        | Public      | Lower bound on valid bids            |
| `rfp.max_bid`        | Uint<64>        | Public      | Upper bound (budget cap)             |
| `commitments[i].commitment_hash` | Bytes<32> | Public | persistentHash(bid, salt) per vendor|
| `commitments[i].revealed`  | Boolean     | Public      | Whether vendor has revealed          |
| `result.winner_index`      | Uint<8>     | Public      | Winning vendor slot (0 / 1 / 2)      |
| `result.proof_valid`       | Boolean     | Public      | Cryptographic fairness proof recorded|
| Vendor bid amount    | Uint<64>        | **Private** | Never leaves vendor's machine        |
| Vendor salt          | Bytes<32>       | **Private** | Never leaves vendor's machine        |

## Mainnet Feasibility

### 1. Gas & ZK Proving Performance
Midnight offloads ZK proof generation to client-side proving (via the local proof server / WASM runtime), keeping on-chain verification gas costs constant and lightweight (`O(1)` verification complexity per circuit execution). On Midnight Mainnet, transaction fees are predictable and independent of circuit depth.

### 2. Scalability Beyond 3 Vendors
The 3-vendor fixed model serves as an efficient prototype. On Mainnet, arbitrary `N`-vendor scalability can be achieved via:
- **Incremental Winner Updates**: Comparing new reveals against the current running minimum on-chain in ZK.
- **Merkle Tree State Trees**: Storing commitments in a Sparse Merkle Tree (SMT) enabling thousands of concurrent participants.

### 3. Regulatory & Enterprise Compliance
Public procurement mandates transparency in rule enforcement alongside commercial privacy for participating contractors. Midnight enables automated compliance reporting where accredited auditors can receive verifiable zero-knowledge attestations of regulatory adherence without exposing proprietary supplier cost breakdowns.

### 4. Decentralized Identity & KYC Integration
By pairing Midnight's ZK circuits with Atala PRISM or W3C Verifiable Credentials (VCs), buyers can enforce eligibility criteria (e.g. ISO certifications, jurisdictional compliance, bonded status) directly within the `commit_bid` circuit without revealing the vendor's legal entity on public block explorers.

