const DEFAULT_EXPLORER_BASE = 'https://preprod.midnightexplorer.com';
const SUBSCAN_EXPLORER_BASE = 'https://midnight-preprod.subscan.io';

export function getExplorerBaseUrl(): string {
  const envUrl = import.meta.env.VITE_EXPLORER_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.replace(/\/+$/, '');
  }
  return DEFAULT_EXPLORER_BASE;
}

export function getSubscanBaseUrl(): string {
  return SUBSCAN_EXPLORER_BASE;
}

export function getContractExplorerUrl(contractAddress?: string): string {
  const base = getExplorerBaseUrl();
  if (!contractAddress || contractAddress.trim() === '') {
    return `${base}/contracts`;
  }
  const cleanAddr = contractAddress.startsWith('0x') ? contractAddress : `0x${contractAddress}`;
  return `${base}/contracts/${cleanAddr}`;
}

export function getSubscanContractUrl(contractAddress?: string): string {
  if (!contractAddress || contractAddress.trim() === '') {
    return SUBSCAN_EXPLORER_BASE;
  }
  const cleanAddr = contractAddress.startsWith('0x') ? contractAddress : `0x${contractAddress}`;
  return `${SUBSCAN_EXPLORER_BASE}/account/${cleanAddr}`;
}

export function openMidnightExplorer(contractAddress?: string): void {
  const url = getContractExplorerUrl(contractAddress);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function openSubscanExplorer(contractAddress?: string): void {
  const url = getSubscanContractUrl(contractAddress);
  window.open(url, '_blank', 'noopener,noreferrer');
}
