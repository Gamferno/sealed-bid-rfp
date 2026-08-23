import { useState, useEffect, useCallback } from 'react';
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

const NETWORK_ID = import.meta.env.VITE_NETWORK_ID ?? 'preprod';
const TAB_WALLET_KEY = 'midnight_active_wallet_address';

export type WalletMeta = {
  key: string;
  name: string;
  icon: string;
};

export type InstalledWallet = WalletMeta & {
  api: InitialAPI;
};

export type WalletState =
  | 'detecting'
  | 'no-wallet'
  | 'ready'
  | 'connecting'
  | 'connected';

export type UseWalletReturn = {
  walletState: WalletState;
  wallet: ConnectedAPI | null;
  walletName: string | null;
  installedWallets: InstalledWallet[];
  address: string | null;
  error: string | null;
  connect: (key: string) => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
};

/** Wallets known to inject a Midnight DApp Connector API. */
export const KNOWN_WALLETS: Record<string, WalletMeta> = {
  'com.oneam.wallet': {
    key: 'com.oneam.wallet',
    name: '1AM',
    icon: 'https://raw.githubusercontent.com/the-1am-project/1am-website/main/public/icons/1am.svg',
  },
  'io.lace.midnight': {
    key: 'io.lace.midnight',
    name: 'Lace',
    icon: 'https://www.lace.io/favicon-192.png',
  },
};

export const WALLET_INSTALL_LINKS: Record<string, string> = {
  'com.oneam.wallet':
    'https://chromewebstore.google.com/detail/1am/bphnkdkcnfhompoegfpgnkidcjfbojjp',
  'io.lace.midnight': 'https://www.lace.io/',
};

function findWallets(): InstalledWallet[] {
  const midnight = (window as any).midnight as Record<string, unknown> | undefined;
  if (!midnight) return [];
  const result: InstalledWallet[] = [];
  for (const [key, value] of Object.entries(midnight)) {
    if (!value || typeof value !== 'object' || !('apiVersion' in value)) continue;
    const api = value as InitialAPI;
    const known = KNOWN_WALLETS[key];
    result.push({
      key,
      name: known?.name ?? api.name ?? key,
      icon: known?.icon ?? api.icon ?? '',
      api,
    });
  }
  return result;
}

function extractErrorMessage(e: any): string {
  if (!e) return '';
  if (e.message && e.message !== '') return e.message;
  const failure = e?.cause?.failure;
  if (failure?.message) return failure.message;
  if (failure?.cause?.message) return failure.cause.message;
  if (e?.cause?.message) return e.cause.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

export function friendlyError(e: any): string {
  const msg = extractErrorMessage(e);
  if (msg.includes('User rejected')) return 'Transaction cancelled.';
  if (msg.includes('not authorized')) return 'Wallet connection rejected. Try again.';
  if (msg.includes('Network ID')) return 'Network error. Ensure your wallet is set to Preprod.';
  if (msg.includes('insufficient') || msg.includes('DUST'))
    return 'Insufficient funds. Request tokens from the Preprod faucet.';
  if (msg.includes('Failed to fetch') || msg.includes('Failed Proof Server'))
    return 'Cannot reach the proof server. Check your connection.';
  return msg || 'Unexpected error. Check the browser console.';
}

export function useWallet(): UseWalletReturn {
  const [walletState, setWalletState] = useState<WalletState>('detecting');
  const [installedWallets, setInstalledWallets] = useState<InstalledWallet[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [wallet, setWallet] = useState<ConnectedAPI | null>(null);
  const [address, setAddress] = useState<string | null>(() =>
    sessionStorage.getItem(TAB_WALLET_KEY),
  );
  const [error, setError] = useState<string | null>(null);

  // Detect injected wallets on mount
  useEffect(() => {
    const found = findWallets();
    setInstalledWallets(found);
    setWalletState(found.length > 0 ? 'ready' : 'no-wallet');
  }, []);

  const connect = useCallback(async (key: string) => {
    const target = findWallets().find(w => w.key === key);
    if (!target) {
      setError('Wallet not found. Refresh the page and try again.');
      setWalletState('ready');
      return;
    }

    setWalletState('connecting');
    setError(null);
    try {
      const c = await target.api.connect(NETWORK_ID);
      setWallet(c);
      setActiveKey(key);
      const { unshieldedAddress } = await c.getUnshieldedAddress();
      setAddress(unshieldedAddress);
      sessionStorage.setItem(TAB_WALLET_KEY, unshieldedAddress);
      setWalletState('connected');
    } catch (e) {
      setError(friendlyError(e));
      setWalletState('ready');
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet(null);
    setActiveKey(null);
    setAddress(null);
    sessionStorage.removeItem(TAB_WALLET_KEY);
    setWalletState('ready');
  }, []);

  const walletName =
    activeKey !== null
      ? (KNOWN_WALLETS[activeKey]?.name ?? installedWallets.find(w => w.key === activeKey)?.name ?? null)
      : null;

  return {
    walletState,
    wallet,
    walletName,
    installedWallets,
    address,
    error,
    connect,
    disconnect,
    clearError: () => setError(null),
  };
}
