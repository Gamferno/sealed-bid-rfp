import { useState, useEffect, useCallback } from 'react';
import { ContractService } from '../contractService';

export type RFPPhase = 'Committing' | 'Revealing' | 'Closed' | 'Unknown';

export type VendorSlot = {
  index: number;
  walletAddress?: string;
  commitmentHash: string | null; // hex, null if not yet committed
  revealed: boolean;
  committedAt?: number;
};

export type RFPState = {
  description: string;
  commitDeadline: bigint;       // block / timestamp
  revealDeadline: bigint;
  minBid: bigint;
  maxBid: bigint;
  phase: RFPPhase;
  creatorAddress: string;
  vendors: VendorSlot[];        // dynamic list of participating vendors
  winnerIndex: number | null;   // null until finalized
  winnerWallet: string | null;
  proofValid: boolean;
  totalVendors: number;
  revealedCount: number;
  secondsLeft: number;
};

const INITIAL_STATE: RFPState = {
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

export type UseRFPReturn = {
  rfp: RFPState;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Fetches and tracks RFP state for a given contract address.
 *
 * State is sourced from two layers:
 *   1. Local cache (localStorage) — fast synchronous read for instant UI paint.
 *   2. Midnight Indexer (async) — refreshed every 10 s and on any on-chain event.
 *      Updates the local cache and re-renders the UI automatically.
 *
 * `contractAddress` — 64-char hex address of the deployed contract.
 */
export function useRFP(contractAddress: string | null): UseRFPReturn {
  const [rfp, setRFP] = useState<RFPState>(() => ContractService.getRFPState(contractAddress));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  // ── 1-second timer: recompute phase / countdown from local cache ──────────
  useEffect(() => {
    if (!contractAddress) {
      setRFP(INITIAL_STATE);
      return;
    }

    let cancelled = false;

    const fetchLocalState = () => {
      try {
        const state = ContractService.getRFPState(contractAddress);
        if (!cancelled) setRFP(state);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to read RFP state');
      }
    };

    fetchLocalState();
    const interval = setInterval(fetchLocalState, 1_000);

    // Cross-tab sync via StorageEvent and custom BroadcastChannel event
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes(contractAddress)) fetchLocalState();
    };
    const handleCustomEvent = (e: any) => {
      if (e.detail?.contractAddress === contractAddress) fetchLocalState();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('rfp_state_changed', handleCustomEvent);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('rfp_state_changed', handleCustomEvent);
    };
  }, [contractAddress, tick]);

  // ── Indexer sync: pull live on-chain state every 10 s ────────────────────
  useEffect(() => {
    if (!contractAddress) return;

    let cancelled = false;

    const syncIndexer = async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const updatedState = await ContractService.syncFromIndexer(contractAddress);
        if (!cancelled && updatedState) {
          setRFP(updatedState);
          setError(null);
        }
      } catch {
        // Indexer sync errors are non-fatal; local cache remains the source of truth
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Run once immediately, then every 10 seconds
    syncIndexer();
    const indexerInterval = setInterval(syncIndexer, 10_000);

    return () => {
      cancelled = true;
      clearInterval(indexerInterval);
    };
  }, [contractAddress, tick]);

  return { rfp, loading, error, refresh };
}
