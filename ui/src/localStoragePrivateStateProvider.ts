/**
 * LocalStorage-backed PrivateStateProvider for Midnight sealed-bid DApp.
 *
 * Stores private witness state (bid + salt) and signing keys in localStorage
 * so they persist across page reloads. None of this data is ever sent to the
 * Midnight network — it is only passed as private witness inputs when the SDK
 * constructs a ZK proof locally.
 *
 * The PrivateStateProvider interface requires both state management (set/get/remove)
 * and signing-key management (setSigningKey / getSigningKey / removeSigningKey).
 * Both are implemented here using localStorage with distinct key prefixes.
 */

import type { PrivateStateProvider, PrivateStateId } from '@midnight-ntwrk/midnight-js-types';
import type { ContractAddress, SigningKey } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type { SealedBidPrivateState } from 'sealed-bid-contract';
import { bytesToHex, hexToBytes } from './contractService';

const STATE_PREFIX   = 'rfp:ps:state:';
const SIGNING_PREFIX = 'rfp:ps:sigkey:';
const ADDR_KEY       = 'rfp:ps:contractAddress';

// ─── Serialisation helpers ────────────────────────────────────────────────────

function serializeState(state: SealedBidPrivateState): string {
  return JSON.stringify({
    bid:         state.bid !== undefined ? state.bid.toString() : undefined,
    salt:        state.salt ? bytesToHex(state.salt) : undefined,
    vendorIndex: state.vendorIndex,
    bids:  state.bids
      ? Object.fromEntries(Object.entries(state.bids).map(([k, v]) => [k, v.toString()]))
      : undefined,
    salts: state.salts
      ? Object.fromEntries(Object.entries(state.salts).map(([k, v]) => [k, bytesToHex(v)]))
      : undefined,
  });
}

function deserializeState(raw: string): SealedBidPrivateState {
  const obj = JSON.parse(raw);
  return {
    bid:         obj.bid !== undefined ? BigInt(obj.bid) : undefined,
    salt:        obj.salt ? hexToBytes(obj.salt) : undefined,
    vendorIndex: obj.vendorIndex,
    bids:  obj.bids
      ? Object.fromEntries(Object.entries(obj.bids).map(([k, v]) => [Number(k), BigInt(v as string)]))
      : undefined,
    salts: obj.salts
      ? Object.fromEntries(Object.entries(obj.salts).map(([k, v]) => [Number(k), hexToBytes(v as string)]))
      : undefined,
  };
}

function serializeSigningKey(key: SigningKey): string {
  // SigningKey is a Uint8Array branded type
  return bytesToHex(key as unknown as Uint8Array);
}

function deserializeSigningKey(hex: string): SigningKey {
  return hexToBytes(hex) as unknown as SigningKey;
}

// ─── Provider factory ─────────────────────────────────────────────────────────

/**
 * Creates a PrivateStateProvider<PrivateStateId, SealedBidPrivateState> backed
 * by localStorage. Safe to call multiple times — each call returns a fresh
 * object referencing the same underlying localStorage.
 */
export function makeLocalStoragePrivateStateProvider(): PrivateStateProvider<PrivateStateId, SealedBidPrivateState> {
  return {
    // ── Private state (bid + salt witnesses) ──────────────────────────────

    async set(id: PrivateStateId, state: SealedBidPrivateState): Promise<void> {
      localStorage.setItem(STATE_PREFIX + id, serializeState(state));
    },

    async get(id: PrivateStateId): Promise<SealedBidPrivateState | null> {
      const raw = localStorage.getItem(STATE_PREFIX + id);
      if (!raw) return null;
      try {
        return deserializeState(raw);
      } catch {
        return null;
      }
    },

    async remove(id: PrivateStateId): Promise<void> {
      localStorage.removeItem(STATE_PREFIX + id);
    },

    async clear(): Promise<void> {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STATE_PREFIX)) toRemove.push(key);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    },

    // ── Contract address scoping ──────────────────────────────────────────

    async setContractAddress(address: ContractAddress): Promise<void> {
      localStorage.setItem(ADDR_KEY, address as string);
    },

    // ── Signing key management ────────────────────────────────────────────

    async setSigningKey(address: ContractAddress, key: SigningKey): Promise<void> {
      localStorage.setItem(SIGNING_PREFIX + (address as string), serializeSigningKey(key));
    },

    async getSigningKey(address: ContractAddress): Promise<SigningKey | null> {
      const raw = localStorage.getItem(SIGNING_PREFIX + (address as string));
      if (!raw) return null;
      try {
        return deserializeSigningKey(raw);
      } catch {
        return null;
      }
    },

    async removeSigningKey(address: ContractAddress): Promise<void> {
      localStorage.removeItem(SIGNING_PREFIX + (address as string));
    },

    async clearSigningKeys(): Promise<void> {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(SIGNING_PREFIX)) toRemove.push(key);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    },

    // ── Export / Import stubs (not required for DApp functionality) ──────

    async exportPrivateStates(): Promise<never> {
      throw new Error('exportPrivateStates not implemented in LocalStoragePrivateStateProvider');
    },

    async importPrivateStates(): Promise<never> {
      throw new Error('importPrivateStates not implemented in LocalStoragePrivateStateProvider');
    },

    async exportSigningKeys(): Promise<never> {
      throw new Error('exportSigningKeys not implemented in LocalStoragePrivateStateProvider');
    },

    async importSigningKeys(): Promise<never> {
      throw new Error('importSigningKeys not implemented in LocalStoragePrivateStateProvider');
    },
  } as unknown as PrivateStateProvider<PrivateStateId, SealedBidPrivateState>;
}
