/**
 * ContractService — Midnight Sealed-Bid RFP
 *
 * All operations (deploy, commit, reveal, determine winner, verify fairness) are
 * backed by real Midnight SDK calls:
 *   • deployContract()        — creates the contract on-chain; returns a real address
 *   • findDeployedContract()  — reconnects to an existing on-chain contract
 *   • found.callTx.*()        — submits a ZK-proven transaction for each circuit
 *   • getPublicStates()       — reads live ledger state from the indexer
 *
 * Private witness data (bid + salt) is persisted in localStorage so vendors can
 * reveal from the same browser session.  It is NEVER sent to the network.
 *
 * A localStorage cache (StoredRFPData) is kept as a fast read-layer for the UI.
 * It is populated/refreshed after each on-chain confirmation.
 */

import { deployContract, findDeployedContract, getPublicStates } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { SealedBid, CompiledSealedBidContract, type SealedBidPrivateState } from 'sealed-bid-contract';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { RFPState, VendorSlot } from './hooks/useRFP';
import { buildProviders, buildReadProviders } from './midnightProviders';
import { makeLocalStoragePrivateStateProvider } from './localStoragePrivateStateProvider';

// ─── Env ──────────────────────────────────────────────────────────────────────
const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID ?? 'preprod') as string;

// ─── Storage keys ─────────────────────────────────────────────────────────────
const STORAGE_PREFIX    = 'rfp_contract_state:';
const SYNC_CHANNEL_NAME = 'midnight_sealed_bid_rfp_sync';

// ─── BroadcastChannel for cross-tab sync ──────────────────────────────────────
let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  }
} catch {
  syncChannel = null;
}

// ─── Utility exports (used by other modules) ──────────────────────────────────

export function notifyStateChange(contractAddress: string): void {
  if (syncChannel) {
    syncChannel.postMessage({ type: 'STATE_UPDATED', contractAddress });
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rfp_state_changed', { detail: { contractAddress } }));
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function stringToBytes128(str: string): Uint8Array {
  const buf = new Uint8Array(128);
  const encoded = new TextEncoder().encode(str);
  buf.set(encoded.slice(0, 128));
  return buf;
}

/** Compute Poseidon commitment hash using the compiled Compact circuit. */
export function computeCommitment(bid: bigint, salt: Uint8Array): Uint8Array {
  return SealedBid.pureCircuits.computeCommitment(bid, salt);
}

// ─── LocalStorage RFP cache types ────────────────────────────────────────────

export type StoredVendorCommitment = {
  slot: number;
  walletAddress: string;
  commitmentHashHex: string;
  revealed: boolean;
  committedAt: number;
};

export type StoredRFPData = {
  contractAddress: string;
  creatorAddress: string;
  description: string;
  commitDeadline: number; // Unix timestamp (seconds)
  revealDeadline: number;
  minBid: string;
  maxBid: string;
  createdAt: number;
  commitments: Record<number, StoredVendorCommitment>;
  walletToSlot: Record<string, number>;
  winnerSlot: number | null;
  winnerWallet: string | null;
  proofValid: boolean;
  earlyClosed?: boolean;
};

export function getStoredRFP(contractAddress: string): StoredRFPData | null {
  const data = localStorage.getItem(`${STORAGE_PREFIX}${contractAddress}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveStoredRFP(data: StoredRFPData): void {
  localStorage.setItem(`${STORAGE_PREFIX}${data.contractAddress}`, JSON.stringify(data));
  notifyStateChange(data.contractAddress);
}

// ─── Private witness helpers ──────────────────────────────────────────────────

/** Derive the PrivateStateId for a given vendor in a given round. */
function privateStateId(contractAddress: string, walletAddress: string): string {
  return `${contractAddress}:${walletAddress.toLowerCase()}`;
}

/** Read private state for a vendor from the localStorage provider. */
async function readPrivateState(
  contractAddress: string,
  walletAddress: string,
): Promise<SealedBidPrivateState | null> {
  const provider = makeLocalStoragePrivateStateProvider();
  return provider.get(privateStateId(contractAddress, walletAddress));
}

// ─── ContractService ──────────────────────────────────────────────────────────

export class ContractService {

  // ── Deploy RFP contract ──────────────────────────────────────────────────

  /**
   * Deploys the sealed-bid RFP contract to Midnight Preprod.
   *
   * Calls `deployContract()` which:
   *   1. Runs the constructor circuit locally to produce an unproven tx
   *   2. Asks the proof server to generate a ZK proof
   *   3. Balances the tx via the wallet
   *   4. Submits to the Midnight network
   *   5. Waits for on-chain confirmation
   *
   * Returns the real, verifiable contract address from the blockchain.
   */
  static async createRFP(params: {
    description: string;
    commitDurationSeconds: number;
    revealDurationSeconds: number;
    minBid: bigint;
    maxBid: bigint;
    creatorAddress: string;
    wallet: ConnectedAPI;
    onStatus?: (msg: string) => void;
  }): Promise<{ contractAddress: string }> {
    if (!params.wallet) {
      throw new Error('A connected Midnight wallet is required to deploy a contract.');
    }
    if (params.minBid >= params.maxBid) {
      throw new Error('Minimum bid must be strictly lower than maximum budget.');
    }
    if (params.commitDurationSeconds <= 0 || params.revealDurationSeconds <= 0) {
      throw new Error('Phase durations must be greater than zero.');
    }

    // Set network ID globally (required by Midnight SDK before any transaction)
    setNetworkId(NETWORK_ID);

    const now = Math.floor(Date.now() / 1000);
    const commitDeadline = now + params.commitDurationSeconds;
    const revealDeadline = commitDeadline + params.revealDurationSeconds;

    const descBytes = stringToBytes128(params.description);

    params.onStatus?.('Building providers & connecting to Midnight Preprod indexer…');
    const providers = await buildProviders(params.wallet);

    // Private state ID for the deployer (no bid/salt needed for deployment)
    const psId = `deploy:${params.creatorAddress.toLowerCase()}`;
    const initialPrivateState: SealedBidPrivateState = {};

    params.onStatus?.('Deploying Compact contract to Midnight Preprod — awaiting ZK proof (30–60 s)…');

    const deployed = await deployContract(providers as any, {
      compiledContract: CompiledSealedBidContract as any,
      privateStateId: psId,
      initialPrivateState,
      args: [
        descBytes,
        BigInt(commitDeadline),
        BigInt(revealDeadline),
        params.minBid,
        params.maxBid,
      ],
    } as any);

    // The REAL on-chain contract address returned by the blockchain
    const contractAddress = deployed.deployTxData.public.contractAddress as string;

    params.onStatus?.(`Contract deployed at ${contractAddress.slice(0, 16)}… — saving state…`);

    // Persist to the local read-layer cache
    const storedData: StoredRFPData = {
      contractAddress,
      creatorAddress: params.creatorAddress,
      description: params.description,
      commitDeadline,
      revealDeadline,
      minBid: params.minBid.toString(),
      maxBid: params.maxBid.toString(),
      createdAt: now,
      commitments: {},
      walletToSlot: {},
      winnerSlot: null,
      winnerWallet: null,
      proofValid: false,
    };

    saveStoredRFP(storedData);
    return { contractAddress };
  }

  // ── Commit bid ───────────────────────────────────────────────────────────

  /**
   * Submits a `commit_bid` transaction to the contract.
   *
   * The bid and salt are private witnesses — they are NOT included in any
   * on-chain state or transaction payload. Only the 32-byte Poseidon hash
   * (commitment) appears on the public ledger.
   */
  static async submitCommitment(params: {
    contractAddress: string;
    walletAddress: string;
    bid: bigint;
    salt: Uint8Array;
    wallet: ConnectedAPI;
    onStatus?: (msg: string) => void;
  }): Promise<{ slot: number; commitmentHashHex: string }> {
    if (!params.wallet) {
      throw new Error('A connected Midnight wallet is required to submit a bid.');
    }

    const stored = getStoredRFP(params.contractAddress);
    if (!stored) {
      throw new Error(`Contract ${params.contractAddress} not found. Create an RFP first.`);
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= stored.commitDeadline || stored.earlyClosed) {
      throw new Error('The Commit Phase has closed for this RFP round.');
    }

    const normalizedWallet = params.walletAddress.toLowerCase();
    if (stored.walletToSlot[normalizedWallet] !== undefined) {
      const existingSlot = stored.walletToSlot[normalizedWallet];
      throw new Error(
        `Wallet ${params.walletAddress.slice(0, 12)}… has already submitted a bid in Slot #${existingSlot}.`,
      );
    }

    // Slot index = number of existing commitments
    const slot = Object.keys(stored.commitments).length;

    // Compute commitment hash locally (for the cache — same value the circuit computes)
    const commitment = computeCommitment(params.bid, params.salt);
    const hashHex = bytesToHex(commitment);

    setNetworkId(NETWORK_ID);

    params.onStatus?.('Saving private witness (bid + salt) to local vault…');
    const psId = privateStateId(params.contractAddress, params.walletAddress);
    const privateStateProv = makeLocalStoragePrivateStateProvider();
    await privateStateProv.set(psId, {
      bid:         params.bid,
      salt:        params.salt,
      vendorIndex: slot,
    });

    params.onStatus?.('Building providers & finding deployed contract…');
    const providers = await buildProviders(params.wallet);

    const found = await findDeployedContract(providers as any, {
      compiledContract: CompiledSealedBidContract as any,
      contractAddress:  params.contractAddress as any,
      privateStateId:   psId,
    } as any);

    params.onStatus?.(`Generating ZK proof for commit_bid (slot ${slot}) — 30–60 s…`);

    // Real ZK transaction: locally proves commit_bid circuit, submits tx on-chain
    await found.callTx.commit_bid(BigInt(slot));

    params.onStatus?.('Transaction confirmed on Midnight ledger. Updating local state…');

    // Update local read-layer cache
    stored.commitments[slot] = {
      slot,
      walletAddress: params.walletAddress,
      commitmentHashHex: hashHex,
      revealed: false,
      committedAt: now,
    };
    stored.walletToSlot[normalizedWallet] = slot;
    saveStoredRFP(stored);

    return { slot, commitmentHashHex: hashHex };
  }

  // ── Reveal bid ───────────────────────────────────────────────────────────

  /**
   * Submits a `reveal_bid` transaction.
   *
   * The ZK circuit proves (without disclosing the values):
   *   1. hash(bid, salt) == stored commitment  (authenticity)
   *   2. min_bid <= bid <= max_bid             (range check)
   *
   * Private bid and salt are loaded from the localStorage private state
   * that was saved during `submitCommitment()`.
   */
  static async revealBid(params: {
    contractAddress: string;
    walletAddress: string;
    wallet: ConnectedAPI;
    onStatus?: (msg: string) => void;
  }): Promise<{ success: boolean }> {
    if (!params.wallet) {
      throw new Error('A connected Midnight wallet is required to reveal a bid.');
    }

    const stored = getStoredRFP(params.contractAddress);
    if (!stored) {
      throw new Error(`Contract ${params.contractAddress} not found.`);
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < stored.commitDeadline) {
      throw new Error('Commit phase is still active on-chain. Please wait for the Reveal phase countdown to finish.');
    }
    if (now >= stored.revealDeadline) {
      throw new Error('The Reveal Phase deadline has passed.');
    }

    const normalizedWallet = params.walletAddress.toLowerCase();
    const slot = stored.walletToSlot[normalizedWallet];
    if (slot === undefined || !stored.commitments[slot]) {
      throw new Error(
        `No commitment found for wallet ${params.walletAddress.slice(0, 12)}… in this RFP.`,
      );
    }

    const vendorSlot = stored.commitments[slot];
    if (vendorSlot.revealed) {
      throw new Error('Your bid has already been revealed on-chain.');
    }

    params.onStatus?.('Loading private witness from local vault…');
    const ps = await readPrivateState(params.contractAddress, params.walletAddress);
    if (!ps || ps.bid === undefined || ps.salt === undefined) {
      throw new Error(
        'No local private bid data found. Bids can only be revealed from the device/browser where they were committed.',
      );
    }

    // Local sanity check before spending gas
    const computedHash = computeCommitment(ps.bid, ps.salt);
    if (bytesToHex(computedHash) !== vendorSlot.commitmentHashHex) {
      throw new Error('Commitment mismatch: local bid and salt do not match on-chain commitment.');
    }

    setNetworkId(NETWORK_ID);

    params.onStatus?.('Building providers & finding deployed contract…');
    const providers = await buildProviders(params.wallet);
    const psId = privateStateId(params.contractAddress, params.walletAddress);

    const found = await findDeployedContract(providers as any, {
      compiledContract: CompiledSealedBidContract as any,
      contractAddress:  params.contractAddress as any,
      privateStateId:   psId,
    } as any);

    params.onStatus?.(`Generating ZK proof for reveal_bid (slot ${slot}) — 30–60 s…`);

    // Real ZK transaction: proves range + authenticity without disclosing bid value
    await found.callTx.reveal_bid(BigInt(slot));

    params.onStatus?.('Bid revealed on Midnight ledger. Updating local state…');

    // Update local cache
    vendorSlot.revealed = true;
    saveStoredRFP(stored);

    // Auto-determine winner when all participating vendors (minimum 2) have revealed on-chain
    const totalCommitted = Object.keys(stored.commitments).length;
    const totalRevealed = Object.values(stored.commitments).filter(v => v.revealed).length;
    if (totalCommitted >= 2 && totalRevealed >= totalCommitted) {
      try {
        await this.determineWinner({
          contractAddress: params.contractAddress,
          wallet: params.wallet,
          onStatus: params.onStatus,
        });
      } catch {
        // Non-fatal: winner can be determined manually from Results tab
      }
    }

    return { success: true };
  }

  // ── Close commit phase early (local-only demo aid) ───────────────────────

  /**
   * Closes the commit phase locally — no on-chain transaction.
   *
   * The Compact contract enforces deadlines via block-time assertions
   * (blockTimeLt / blockTimeGte) and has no "early close" circuit.
   * This method only updates the local cache so the UI advances to the
   * Reveal phase for demo / testing purposes.
   */
  static async finalizeCommitPhaseEarly(params: {
    contractAddress: string;
    callerAddress: string;
  }): Promise<void> {
    const stored = getStoredRFP(params.contractAddress);
    if (!stored) throw new Error('Contract not found');

    const totalCommitted = Object.keys(stored.commitments).length;
    if (totalCommitted === 0) {
      throw new Error('Cannot close commit phase with zero participating vendors.');
    }

    const now = Math.floor(Date.now() / 1000);
    const remainingRevealDuration = Math.max(60, stored.revealDeadline - stored.commitDeadline);
    stored.commitDeadline = now;
    stored.revealDeadline = now + remainingRevealDuration;
    stored.earlyClosed = true;

    saveStoredRFP(stored);
  }

  // ── Determine winner ─────────────────────────────────────────────────────

  /**
   * Submits a `determine_winner` transaction.
   *
   * The ZK circuit takes all vendors' bids and salts as private witnesses,
   * re-verifies each commitment, computes the minimum bid in zero knowledge,
   * and records ONLY the winning slot index on the public ledger.
   *
   * Note: This requires all vendors' private states to be available in the
   * caller's localStorage (i.e., same device that processed all commits).
   */
  static async determineWinner(params: {
    contractAddress: string;
    wallet: ConnectedAPI;
    onStatus?: (msg: string) => void;
  }): Promise<{ winnerSlot: number; winnerWallet: string }> {
    if (!params.wallet) {
      throw new Error('A connected Midnight wallet is required to determine the winner.');
    }

    const stored = getStoredRFP(params.contractAddress);
    if (!stored) {
      throw new Error(`Contract ${params.contractAddress} not found.`);
    }

    const revealedVendors = Object.values(stored.commitments).filter(v => v.revealed);
    if (revealedVendors.length === 0) {
      throw new Error('No vendors have revealed their bids yet.');
    }

    // Build a combined private state with all vendors' bids and salts
    params.onStatus?.('Assembling private witnesses for all revealed vendors…');
    const allBids: Record<number, bigint> = {};
    const allSalts: Record<number, Uint8Array> = {};

    for (const vendor of revealedVendors) {
      const ps = await readPrivateState(params.contractAddress, vendor.walletAddress);
      if (ps?.bid !== undefined && ps?.salt !== undefined) {
        allBids[vendor.slot] = ps.bid;
        allSalts[vendor.slot] = ps.salt;
      }
    }

    setNetworkId(NETWORK_ID);

    // Store the combined private state under a unique ID for this call
    const combinedPsId = `${params.contractAddress}:determine_winner`;
    const privateStateProv = makeLocalStoragePrivateStateProvider();
    await privateStateProv.set(combinedPsId, { bids: allBids, salts: allSalts });

    params.onStatus?.('Building providers & finding deployed contract…');
    const providers = await buildProviders(params.wallet);

    const found = await findDeployedContract(providers as any, {
      compiledContract: CompiledSealedBidContract as any,
      contractAddress:  params.contractAddress as any,
      privateStateId:   combinedPsId,
    } as any);

    params.onStatus?.('Generating ZK proof for determine_winner — 30–60 s…');

    // Real ZK transaction: computes minimum bid in ZK, records winner slot on-chain
    await found.callTx.determine_winner();

    params.onStatus?.('Winner recorded on Midnight ledger. Reading result…');

    // Read the winner from live indexer state
    const { contractState } = await getPublicStates(providers.publicDataProvider, params.contractAddress as any);
    const ledgerState = SealedBid.ledger((contractState as any)?.data ?? contractState);
    const winnerIndex = Number(ledgerState.result.winner_index);

    // Map winner index back to wallet address
    const winnerEntry = Object.values(stored.commitments).find(c => c.slot === winnerIndex);
    const winnerWallet = winnerEntry?.walletAddress ?? '';

    // Update local cache
    stored.winnerSlot = winnerIndex;
    stored.winnerWallet = winnerWallet;
    stored.proofValid = ledgerState.result.proof_valid;
    saveStoredRFP(stored);

    return { winnerSlot: winnerIndex, winnerWallet };
  }

  // ── Verify fairness ──────────────────────────────────────────────────────

  /**
   * Reads `result.proof_valid` from the live on-chain ledger via the indexer.
   * If a wallet is available, this can also submit `verify_fairness` as a view
   * circuit call — but since it's a pure read, we prefer the cheaper indexer path.
   */
  static async verifyFairness(params: {
    contractAddress: string;
    wallet?: ConnectedAPI | null;
    onStatus?: (msg: string) => void;
  }): Promise<boolean> {
    params.onStatus?.('Reading on-chain fairness proof from Midnight indexer…');

    // Try live indexer read first (no wallet needed, no gas)
    try {
      const { publicDataProvider } = buildReadProviders();
      const { contractState } = await getPublicStates(publicDataProvider, params.contractAddress as any);
      const ledgerState = SealedBid.ledger((contractState as any)?.data ?? contractState);
      const isValid = ledgerState.result.proof_valid;

      // Update local cache to match on-chain truth
      const stored = getStoredRFP(params.contractAddress);
      if (stored) {
        stored.proofValid = isValid;
        saveStoredRFP(stored);
      }

      return isValid;
    } catch {
      // Fallback: read from local cache if indexer is unreachable
      const stored = getStoredRFP(params.contractAddress);
      return stored?.proofValid ?? false;
    }
  }

  // ── Read RFP state (sync, for UI) ────────────────────────────────────────

  /**
   * Reads RFP state from the local cache synchronously.
   * The cache is refreshed asynchronously by useRFP's indexer subscription.
   */
  static getRFPState(contractAddress: string | null): RFPState {
    if (!contractAddress) {
      return {
        description: '',
        commitDeadline: 0n,
        revealDeadline: 0n,
        minBid: 0n,
        maxBid: 0n,
        phase: 'Unknown',
        creatorAddress: '',
        vendors: [],
        winnerIndex: null,
        winnerWallet: null,
        proofValid: false,
        totalVendors: 0,
        revealedCount: 0,
        secondsLeft: 0,
      };
    }

    const stored = getStoredRFP(contractAddress);
    if (!stored) {
      return {
        description: `Contract ${contractAddress.slice(0, 12)}…`,
        commitDeadline: 1000n,
        revealDeadline: 2000n,
        minBid: 100n,
        maxBid: 10000n,
        phase: 'Committing',
        creatorAddress: '',
        vendors: [],
        winnerIndex: null,
        winnerWallet: null,
        proofValid: false,
        totalVendors: 0,
        revealedCount: 0,
        secondsLeft: 0,
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const vendors: VendorSlot[] = Object.values(stored.commitments).map(v => ({
      index: v.slot,
      walletAddress: v.walletAddress,
      commitmentHash: v.commitmentHashHex,
      revealed: v.revealed,
      committedAt: v.committedAt,
    }));

    const totalVendors = vendors.length;
    const revealedCount = vendors.filter(v => v.revealed).length;

    let phase: 'Committing' | 'Revealing' | 'Closed' | 'Unknown' = 'Committing';
    let secondsLeft = 0;

    if (stored.proofValid || stored.winnerSlot !== null || (now >= stored.revealDeadline && revealedCount > 0)) {
      phase = 'Closed';
    } else if (now >= stored.commitDeadline) {
      phase = 'Revealing';
      secondsLeft = Math.max(0, stored.revealDeadline - now);
    } else {
      phase = 'Committing';
      secondsLeft = Math.max(0, stored.commitDeadline - now);
    }

    return {
      description: stored.description,
      commitDeadline: BigInt(stored.commitDeadline),
      revealDeadline: BigInt(stored.revealDeadline),
      minBid: BigInt(stored.minBid),
      maxBid: BigInt(stored.maxBid),
      phase,
      creatorAddress: stored.creatorAddress,
      vendors,
      winnerIndex: stored.winnerSlot,
      winnerWallet: stored.winnerWallet,
      proofValid: stored.proofValid,
      totalVendors,
      revealedCount,
      secondsLeft,
    };
  }

  /**
   * Syncs the local cache from the live Midnight indexer.
   * Called by useRFP after each indexer update.
   * Returns the updated RFPState, or null if the contract is not yet indexed.
   */
  static async syncFromIndexer(contractAddress: string): Promise<RFPState | null> {
    try {
      const { publicDataProvider } = buildReadProviders();
      const { contractState } = await getPublicStates(publicDataProvider, contractAddress as any);
      const ls = SealedBid.ledger((contractState as any)?.data ?? contractState);

      // Decode description bytes to string
      const description = new TextDecoder().decode(ls.rfp.description).replace(/\0/g, '').trim();
      const commitDeadline = Number(ls.rfp.commit_deadline);
      const revealDeadline = Number(ls.rfp.reveal_deadline);
      const minBid = ls.rfp.min_bid;
      const maxBid = ls.rfp.max_bid;

      // Merge on-chain commitment map into local cache
      const stored = getStoredRFP(contractAddress) ?? {
        contractAddress,
        creatorAddress: '',
        description,
        commitDeadline,
        revealDeadline,
        minBid: minBid.toString(),
        maxBid: maxBid.toString(),
        createdAt: Math.floor(Date.now() / 1000),
        commitments: {},
        walletToSlot: {},
        winnerSlot: null,
        winnerWallet: null,
        proofValid: false,
      };

      // Update fields from indexer
      stored.description = description;
      stored.commitDeadline = commitDeadline;
      stored.revealDeadline = revealDeadline;
      stored.minBid = minBid.toString();
      stored.maxBid = maxBid.toString();
      stored.proofValid = ls.result.proof_valid;

      if (ls.result.proof_valid) {
        stored.winnerSlot = Number(ls.result.winner_index);
      }

      // Sync commitment revealed flags from on-chain map
      for (const [slotBig, vc] of ls.commitments) {
        const slot = Number(slotBig);
        if (stored.commitments[slot]) {
          stored.commitments[slot].revealed = vc.revealed;
          stored.commitments[slot].commitmentHashHex = bytesToHex(vc.commitment_hash);
        } else {
          // New commitment from another user (different browser)
          stored.commitments[slot] = {
            slot,
            walletAddress: '',  // unknown — indexer doesn't expose wallet address
            commitmentHashHex: bytesToHex(vc.commitment_hash),
            revealed: vc.revealed,
            committedAt: Math.floor(Date.now() / 1000),
          };
        }
      }

      saveStoredRFP(stored);
      return ContractService.getRFPState(contractAddress);
    } catch {
      // Indexer unreachable or contract not yet indexed — return local cache
      return null;
    }
  }
}
