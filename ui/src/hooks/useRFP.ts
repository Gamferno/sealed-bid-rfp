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
 * Fetches public RFP state from the Midnight indexer and local storage cache.
 * `contractAddress` — 64-char hex address of the deployed contract.
 */
export function useRFP(contractAddress: string | null): UseRFPReturn {
  const [rfp, setRFP] = useState<RFPState>(() => ContractService.getRFPState(contractAddress));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!contractAddress) {
      setRFP(INITIAL_STATE);
      return;
    }
    let cancelled = false;

    const fetchState = () => {
      try {
        const state = ContractService.getRFPState(contractAddress);
        if (!cancelled) {
          setRFP(state);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to fetch RFP state');
      }
    };

    fetchState();

    // 1-second interval for real-time timer countdown
    const interval = setInterval(fetchState, 1_000);

    // Listen for cross-tab sync events
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes(contractAddress)) {
        fetchState();
      }
    };
    const handleCustomEvent = (e: any) => {
      if (e.detail?.contractAddress === contractAddress) {
        fetchState();
      }
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

  return { rfp, loading, error, refresh };
}


