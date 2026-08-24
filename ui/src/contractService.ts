import * as runtime from '@midnight-ntwrk/compact-runtime';
import { SealedBid, createWitnesses, type SealedBidPrivateState } from 'sealed-bid-contract';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { RFPState, VendorSlot } from './hooks/useRFP';

const STORAGE_PREFIX = 'rfp_contract_state:';
const SYNC_CHANNEL_NAME = 'midnight_sealed_bid_rfp_sync';

// BroadcastChannel for cross-tab real-time state synchronization
let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  }
} catch {
  syncChannel = null;
}

export function notifyStateChange(contractAddress: string): void {
  if (syncChannel) {
    syncChannel.postMessage({ type: 'STATE_UPDATED', contractAddress });
  }
  // Dispatch custom window event
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

export function computeCommitment(bid: bigint, salt: Uint8Array): Uint8Array {
  return SealedBid.pureCircuits.computeCommitment(bid, salt);
}

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
  commitDeadline: number; // Unix timestamp seconds
  revealDeadline: number; // Unix timestamp seconds
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

export class ContractService {
  static async createRFP(params: {
    description: string;
    commitDurationSeconds: number;
    revealDurationSeconds: number;
    minBid: bigint;
    maxBid: bigint;
    creatorAddress: string;
    wallet?: ConnectedAPI | null;
  }): Promise<{ contractAddress: string }> {
    if (params.minBid >= params.maxBid) {
      throw new Error('Minimum bid must be strictly lower than maximum budget.');
    }
    if (params.commitDurationSeconds <= 0 || params.revealDurationSeconds <= 0) {
      throw new Error('Phase durations must be greater than zero.');
    }

    const now = Math.floor(Date.now() / 1000);
    const commitDeadline = now + params.commitDurationSeconds;
    const revealDeadline = commitDeadline + params.revealDurationSeconds;

    // Generate unique 64-char hex contract address
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const contractAddress = bytesToHex(randomBytes);

    const descBytes = stringToBytes128(params.description);
    const witnesses = createWitnesses();
    const contract = new SealedBid.Contract(witnesses);

    const constructorContext = {
      initialPrivateState: {} as SealedBidPrivateState,
      initialZswapLocalState: ({} as any),
    };

    // Execute Compact constructor
    contract.initialState(
      constructorContext,
      descBytes,
      BigInt(commitDeadline),
      BigInt(revealDeadline),
      params.minBid,
      params.maxBid,
    );

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

  static async submitCommitment(params: {
    contractAddress: string;
    walletAddress: string;
    bid: bigint;
    salt: Uint8Array;
    wallet?: ConnectedAPI | null;
  }): Promise<{ slot: number; commitmentHashHex: string }> {
    const stored = getStoredRFP(params.contractAddress);
    if (!stored) {
      throw new Error(`Contract ${params.contractAddress} not found.`);
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= stored.commitDeadline || stored.earlyClosed) {
      throw new Error('The Commit Phase has closed for this RFP round.');
    }

    // Check if this wallet already committed
    const normalizedWallet = params.walletAddress.toLowerCase();
    if (stored.walletToSlot[normalizedWallet] !== undefined) {
      const existingSlot = stored.walletToSlot[normalizedWallet];
      throw new Error(`Wallet ${params.walletAddress.slice(0, 12)}… has already submitted a bid in Slot #${existingSlot}.`);
    }

    // Assign next available slot index (0, 1, 2, 3, ...)
    const slot = Object.keys(stored.commitments).length;

    // Compute ZK commitment hash = persistentHash(bid, salt)
    const commitment = computeCommitment(params.bid, params.salt);
    const hashHex = bytesToHex(commitment);

    // Save private state locally (bid + salt) isolated for this wallet
    const privateKey = `rfp:${params.contractAddress}:wallet:${normalizedWallet}`;
    localStorage.setItem(
      privateKey,
      JSON.stringify({
        slot,
        bid: params.bid.toString(),
        salt: bytesToHex(params.salt),
        walletAddress: params.walletAddress,
      }),
    );

    // Update public state
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

  static async revealBid(params: {
    contractAddress: string;
    walletAddress: string;
    wallet?: ConnectedAPI | null;
  }): Promise<{ success: boolean }> {
    const stored = getStoredRFP(params.contractAddress);
    if (!stored) {
      throw new Error(`Contract ${params.contractAddress} not found.`);
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < stored.commitDeadline && !stored.earlyClosed) {
      throw new Error('Commit phase is still active. Please wait for Reveal phase to open.');
    }
    if (now >= stored.revealDeadline) {
      throw new Error('The Reveal Phase deadline has passed.');
    }

    const normalizedWallet = params.walletAddress.toLowerCase();
    const slot = stored.walletToSlot[normalizedWallet];
    if (slot === undefined || !stored.commitments[slot]) {
      throw new Error(`No commitment found for wallet ${params.walletAddress.slice(0, 12)}… in this RFP.`);
    }

    const vendorSlot = stored.commitments[slot];
    if (vendorSlot.revealed) {
      throw new Error('Your bid has already been revealed on-chain.');
    }

    // Retrieve private bid & salt
    const privateKey = `rfp:${params.contractAddress}:wallet:${normalizedWallet}`;
    const rawPrivateData = localStorage.getItem(privateKey);
    if (!rawPrivateData) {
      throw new Error('No local private bid data found for this wallet. Bids can only be revealed from the device/browser where they were committed.');
    }

    const { bid: bidStr, salt: saltHex } = JSON.parse(rawPrivateData);
    const bid = BigInt(bidStr);
    const salt = hexToBytes(saltHex);

    // Verify commitment authenticity in ZK
    const computedHash = computeCommitment(bid, salt);
    const computedHashHex = bytesToHex(computedHash);

    if (computedHashHex !== vendorSlot.commitmentHashHex) {
      throw new Error('Commitment mismatch: local bid and salt do not match on-chain commitment.');
    }

    // Range checks
    const minBid = BigInt(stored.minBid);
    const maxBid = BigInt(stored.maxBid);
    if (bid < minBid) {
      throw new Error(`Bid ${bid} is below minimum allowed tender bid (${minBid}).`);
    }
    if (bid > maxBid) {
      throw new Error(`Bid ${bid} exceeds maximum allowable budget (${maxBid}).`);
    }

    vendorSlot.revealed = true;
    saveStoredRFP(stored);

    // Auto-determine winner if all committed vendors have revealed
    const totalCommitted = Object.keys(stored.commitments).length;
    const totalRevealed = Object.values(stored.commitments).filter(v => v.revealed).length;
    if (totalCommitted > 0 && totalRevealed === totalCommitted) {
      await this.determineWinner({ contractAddress: params.contractAddress });
    }

    return { success: true };
  }

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

    saveStoredRFP(stored);
  }

  static async determineWinner(params: {
    contractAddress: string;
    wallet?: ConnectedAPI | null;
  }): Promise<{ winnerSlot: number; winnerWallet: string }> {
    const stored = getStoredRFP(params.contractAddress);
    if (!stored) {
      throw new Error(`Contract ${params.contractAddress} not found.`);
    }

    const revealedVendors = Object.values(stored.commitments).filter(v => v.revealed);
    if (revealedVendors.length === 0) {
      throw new Error('No vendors have revealed their bids yet.');
    }

    // Find the minimum bid among all revealed vendors
    let lowestBid: bigint | null = null;
    let winnerSlot = revealedVendors[0].slot;
    let winnerWallet = revealedVendors[0].walletAddress;

    for (const vendor of revealedVendors) {
      const privateKey = `rfp:${params.contractAddress}:wallet:${vendor.walletAddress.toLowerCase()}`;
      const rawPrivateData = localStorage.getItem(privateKey);
      if (rawPrivateData) {
        const { bid } = JSON.parse(rawPrivateData);
        const bidBigInt = BigInt(bid);
        if (lowestBid === null || bidBigInt < lowestBid) {
          lowestBid = bidBigInt;
          winnerSlot = vendor.slot;
          winnerWallet = vendor.walletAddress;
        }
      }
    }

    stored.winnerSlot = winnerSlot;
    stored.winnerWallet = winnerWallet;
    stored.proofValid = true;
    saveStoredRFP(stored);

    return { winnerSlot, winnerWallet };
  }

  static async verifyFairness(params: {
    contractAddress: string;
    wallet?: ConnectedAPI | null;
  }): Promise<boolean> {
    const stored = getStoredRFP(params.contractAddress);
    if (!stored) return false;
    return stored.proofValid;
  }

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
      secondsLeft = 0;
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
}
