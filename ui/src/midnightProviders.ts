/**
 * Midnight ContractProviders factory for the Sealed-Bid RFP DApp.
 *
 * Assembles the full MidnightProviders bundle from:
 *  - IndexerPublicDataProvider  (indexer GraphQL + WebSocket from .env)
 *  - BrowserZkConfigProvider    (ZK keys served as static files by Vite)
 *  - BrowserProofProvider       (native browser fetch for remote proof server via Vite proxy)
 *  - ConnectedAPI wallet        (balances + submits transactions)
 *  - LocalStorage private state provider
 */

import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import {
  ZKConfigProvider,
  createProverKey,
  createVerifierKey,
  createZKIR,
  zkConfigToProvingKeyMaterial,
  type ProverKey,
  type VerifierKey,
  type ZKIR,
  type ProofProvider,
  type MidnightProviders,
  type PrivateStateId,
} from '@midnight-ntwrk/midnight-js-types';
import {
  Transaction,
  createProvingPayload,
  createCheckPayload,
  parseCheckResult,
  CostModel,
  type ProvingProvider,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { SealedBidPrivateState } from 'sealed-bid-contract';
import { makeLocalStoragePrivateStateProvider } from './localStoragePrivateStateProvider';
import { bytesToHex, hexToBytes } from './contractService';

// ─── Environment constants ────────────────────────────────────────────────────

const INDEXER_URL     = (import.meta.env.VITE_INDEXER_URL    ?? 'https://indexer.preprod.midnight.network/api/v4/graphql') as string;
const INDEXER_WS_URL  = (import.meta.env.VITE_INDEXER_WS_URL ?? 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws') as string;

// Midnight proof server endpoint (defaults to Vite proxy /api-proof-server or remote Preprod)
const PROOF_URL = (
  import.meta.env.VITE_PROOF_SERVER_URL && import.meta.env.VITE_PROOF_SERVER_URL !== 'http://127.0.0.1:6300'
    ? import.meta.env.VITE_PROOF_SERVER_URL
    : '/api-proof-server'
) as string;

// Circuit IDs from the compiled sealed-bid contract
export type SealedBidCircuitId = 'commit_bid' | 'reveal_bid' | 'determine_winner' | 'verify_fairness';

export function cleanCircuitId(circuitId: string): string {
  let clean = circuitId;
  if (clean.includes('#')) {
    clean = clean.slice(clean.lastIndexOf('#') + 1);
  }
  if (clean.includes('/')) {
    clean = clean.slice(clean.lastIndexOf('/') + 1);
  }
  if (clean.includes('.')) {
    clean = clean.split('.')[0];
  }
  return clean;
}

// ─── Custom Browser ZK Config Provider ────────────────────────────────────────

/**
 * Custom ZKConfigProvider for browser environments.
 *
 * Strips contract name prefixes (e.g. `sealed-bid#commit_bid` -> `commit_bid`)
 * so that circuit assets are loaded correctly from Vite's public static directory.
 */
export class BrowserZkConfigProvider<K extends string = SealedBidCircuitId> extends ZKConfigProvider<K> {
  private async fetchBinary(path: string): Promise<Uint8Array> {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const fullUrl = `${origin}${path}`;
    try {
      const res = await window.fetch(fullUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch ZK artifact from ${fullUrl}: ${res.status} ${res.statusText}`);
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) {
        throw new Error(`Expected binary ZK artifact from ${fullUrl}, but received text/html (SPA fallback).`);
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } catch (e: any) {
      console.error(`[BrowserZkConfigProvider] Error fetching ${fullUrl}:`, e);
      throw e;
    }
  }

  async getProverKey(circuitId: K): Promise<ProverKey> {
    const name = cleanCircuitId(circuitId);
    const data = await this.fetchBinary(`/keys/${name}.prover`);
    return createProverKey(data);
  }

  async getVerifierKey(circuitId: K): Promise<VerifierKey> {
    const name = cleanCircuitId(circuitId);
    const data = await this.fetchBinary(`/keys/${name}.verifier`);
    return createVerifierKey(data);
  }

  async getZKIR(circuitId: K): Promise<ZKIR> {
    const name = cleanCircuitId(circuitId);
    try {
      const data = await this.fetchBinary(`/zkir/${name}.bzkir`);
      return createZKIR(data);
    } catch {
      const data = await this.fetchBinary(`/zkir/${name}.zkir`);
      return createZKIR(data);
    }
  }
}

// ─── Custom Browser Proof Provider ────────────────────────────────────────────

async function makeBrowserHttpRequest(
  url: string,
  payload: Uint8Array,
  timeout = 300_000,
): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  // Copy WASM linear memory view to a clean JS ArrayBuffer
  // Prevents WebAssembly SharedArrayBuffer / detachment errors in window.fetch
  const bodyData = new Uint8Array(payload.byteLength);
  bodyData.set(payload);

  try {
    const response = await window.fetch(url, {
      method: 'POST',
      body: bodyData,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Proof server error: ${response.status} ${response.statusText} (${url}) - ${text}`,
      );
    }

    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
  } catch (err: any) {
    console.error(`[Proof Server Request Failed] URL: ${url}`, err);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function createBrowserProofProvider(
  proofServerUrl: string,
  zkConfigProvider: ZKConfigProvider<any>,
): ProofProvider {
  const cleanUrl = proofServerUrl.replace(/\/+$/, '');
  const checkUrl = `${cleanUrl}/check`;
  const proveUrl = `${cleanUrl}/prove`;

  const provingProvider: ProvingProvider = {
    async check(serializedPreimage: Uint8Array, keyLocation: string) {
      const cleanLocation = cleanCircuitId(keyLocation);
      const zkConfig = await zkConfigProvider.get(cleanLocation as any);
      const keyMaterial = zkConfigToProvingKeyMaterial(zkConfig);
      const payload = createCheckPayload(serializedPreimage, keyMaterial.ir);
      const result = await makeBrowserHttpRequest(checkUrl, payload);
      return parseCheckResult(result);
    },

    async prove(
      serializedPreimage: Uint8Array,
      keyLocation: string,
      overwriteBindingInput?: bigint,
    ) {
      const cleanLocation = cleanCircuitId(keyLocation);
      const zkConfig = await zkConfigProvider.get(cleanLocation as any);
      const keyMaterial = zkConfigToProvingKeyMaterial(zkConfig);
      const payload = createProvingPayload(
        serializedPreimage,
        overwriteBindingInput,
        keyMaterial,
      );
      return makeBrowserHttpRequest(proveUrl, payload);
    },
  };

  return {
    async proveTx(unprovenTx: any) {
      const costModel = CostModel.initialCostModel();
      return unprovenTx.prove(provingProvider, costModel);
    },
  };
}

// ─── Provider type alias ──────────────────────────────────────────────────────

export type SealedBidProviders = MidnightProviders<
  SealedBidCircuitId,
  PrivateStateId,
  SealedBidPrivateState
>;

// ─── WalletProvider adapter ───────────────────────────────────────────────────

async function makeWalletProviderAdapter(wallet: ConnectedAPI) {
  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } = await wallet.getShieldedAddresses();

  return {
    balanceTx: async (tx: any, _ttl?: Date) => {
      let rawBytes: Uint8Array;
      if (typeof tx?.serialize === 'function') {
        rawBytes = tx.serialize();
      } else if (tx instanceof Uint8Array) {
        rawBytes = tx;
      } else if (typeof tx === 'string') {
        rawBytes = hexToBytes(tx);
      } else {
        throw new Error('Unrecognized transaction format in balanceTx');
      }

      const hex = bytesToHex(rawBytes);
      const balanced = await wallet.balanceUnsealedTransaction(hex);

      try {
        const balancedBytes = hexToBytes(balanced.tx);
        const balancedTx = Transaction.deserialize('signature', 'proof', 'binding', balancedBytes);
        return balancedTx as any;
      } catch {
        return balanced.tx as any;
      }
    },
    getCoinPublicKey: () => shieldedCoinPublicKey as any,
    getEncryptionPublicKey: () => shieldedEncryptionPublicKey as any,
  };
}

// ─── MidnightProvider adapter ─────────────────────────────────────────────────

function makeMidnightProviderAdapter(wallet: ConnectedAPI) {
  return {
    submitTx: async (tx: any): Promise<any> => {
      let hex: string;
      let txObj: any = null;

      if (typeof tx === 'string') {
        hex = tx;
        try {
          txObj = Transaction.deserialize('signature', 'proof', 'binding', hexToBytes(hex));
        } catch {
          // ignore
        }
      } else if (typeof tx?.serialize === 'function') {
        txObj = tx;
        hex = bytesToHex(tx.serialize());
      } else {
        hex = bytesToHex(new Uint8Array(tx));
      }

      await wallet.submitTransaction(hex);

      if (txObj && typeof txObj.identifiers === 'function') {
        const ids = txObj.identifiers();
        if (ids && ids.length > 0) {
          return ids[0];
        }
      }

      return hex.slice(0, 64) as any;
    },
  };
}

// ─── Public factory ───────────────────────────────────────────────────────────

/**
 * Build the full ContractProviders bundle for a connected wallet session.
 */
export async function buildProviders(wallet: ConnectedAPI): Promise<SealedBidProviders> {
  const publicDataProvider = indexerPublicDataProvider(
    INDEXER_URL,
    INDEXER_WS_URL,
  );

  const zkConfigProvider = new BrowserZkConfigProvider<SealedBidCircuitId>();
  const proofProvider = createBrowserProofProvider(PROOF_URL, zkConfigProvider);

  const walletProvider = await makeWalletProviderAdapter(wallet);
  const midnightProvider = makeMidnightProviderAdapter(wallet);
  const privateStateProvider = makeLocalStoragePrivateStateProvider();

  return {
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider: walletProvider as any,
    midnightProvider: midnightProvider as any,
    privateStateProvider,
  };
}

/** Build an indexer-only provider set for read operations (no wallet needed). */
export function buildReadProviders(): Pick<SealedBidProviders, 'publicDataProvider'> {
  return {
    publicDataProvider: indexerPublicDataProvider(INDEXER_URL, INDEXER_WS_URL),
  };
}
